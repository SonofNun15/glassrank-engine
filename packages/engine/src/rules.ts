/**
 * Policy layer: community rules that turn the evidence into a displayed rating.
 *
 * The displayed rating follows the evidence estimate (mu), asymmetrically:
 *   - When the evidence is above the rating, the rating catches up fully, plus
 *     an upward-bias bonus on this event's evidence gain.
 *   - When the evidence is below the rating, the rating moves only part of the
 *     way down, and only after an event where the player did worse than
 *     expected. Repeated events keep closing the gap, so an inflated rating
 *     comes back down through play, and a correction overlay (a higher loss
 *     multiplier) makes that happen faster.
 *
 * Rules run in a fixed, published order and every one is recorded, fired or not.
 */
import type { DeclineEntry, EffectivePolicy, RuleApplication, RuleName } from "@glassrank/schema";
import { MS_PER_DAY, parseTimestamp } from "@glassrank/schema";
import { isExempt, largeGainThreshold } from "./policy";
import { clamp } from "./math";

export interface RuleInput {
  readonly policy: EffectivePolicy;
  readonly occurredAt: string;
  readonly eventId: string;
  readonly ratingBefore: number;
  readonly muBefore: number;
  readonly muAfter: number;
  readonly heldGain: number;
  readonly recentDeclines: readonly DeclineEntry[];
  /** Protection events left, including this one if the player just returned. */
  readonly protectedEvents: number;
  readonly daysAway: number;
  readonly gamesPlayed: number;
  /** Events the player had completed before this one. */
  readonly priorEvents: number;
}

export interface RuleOutput {
  readonly rating: number;
  readonly heldGain: number;
  readonly recentDeclines: readonly DeclineEntry[];
  readonly applications: readonly RuleApplication[];
  readonly fired: readonly RuleName[];
  readonly exemptFromOverlay: boolean;
}

export function applyRules(input: RuleInput): RuleOutput {
  const { policy, muBefore, muAfter, ratingBefore } = input;
  const rules = policy.base.rules;
  const evidenceChange = muAfter - muBefore;
  const gap = muAfter - ratingBefore;
  const applications: RuleApplication[] = [];
  const record = (rule: RuleName, before: number, after: number, params: Record<string, number>, fired = before !== after) =>
    applications.push({ rule, fired, before, after, params });

  let delta = gap;
  let held = input.heldGain;
  const protectedNow = input.protectedEvents > 0;

  // 0. Provisional period: early on, the rating simply follows the evidence.
  const provisionalEvents = rules.provisionalPeriod.events;
  const provisional = input.priorEvents < provisionalEvents;
  record("provisional_period", gap, gap, { events: provisionalEvents, event_number: input.priorEvents + 1 }, provisional);
  if (provisional) {
    const scale = policy.base.scale;
    const rating = clamp(muAfter, scale.min, scale.max);
    for (const rule of ["upward_bias", "decline_damping", "returning_protection", "correction_overlay", "large_gain_hold", "held_gain_release", "decline_cap"] as const) {
      record(rule, gap, gap, {}, false);
    }
    record("scale_bounds", gap, rating - ratingBefore, { min: scale.min, max: scale.max }, Math.abs(rating - ratingBefore - gap) > 1e-12);
    const delta0 = rating - ratingBefore;
    const windowStart0 = parseTimestamp(input.occurredAt) - rules.declineCap.windowDays * MS_PER_DAY;
    const kept = input.recentDeclines.filter((d) => parseTimestamp(d.at) > windowStart0);
    return {
      rating,
      heldGain: held,
      recentDeclines: delta0 < 0 ? [...kept, { at: input.occurredAt, eventId: input.eventId, amount: -delta0 }] : kept,
      applications,
      fired: applications.filter((a) => a.fired).map((a) => a.rule),
      exemptFromOverlay: false,
    };
  }

  // 1. Upward bias: full catch-up, plus a bonus on this event's evidence gain.
  {
    const before = delta;
    if (gap > 0) delta = gap + (rules.upwardBias.gainMultiplier - 1) * Math.max(0, evidenceChange);
    record("upward_bias", before, delta, { gain_multiplier: rules.upwardBias.gainMultiplier, evidence_change: evidenceChange });
  }

  // 2. Decline damping: no drop after an at-or-above-expected event; otherwise a partial move down.
  const undamped = delta;
  {
    const before = delta;
    if (delta < 0) delta = evidenceChange >= 0 ? 0 : delta * rules.declineDamping.lossMultiplier;
    record("decline_damping", before, delta, { loss_multiplier: rules.declineDamping.lossMultiplier, evidence_change: evidenceChange });
  }

  // 3. Returning-player protection: an extra multiplier on drops for the first events back.
  {
    const before = delta;
    if (delta < 0 && protectedNow) delta *= rules.returningProtection.lossMultiplier;
    record("returning_protection", before, delta, {
      loss_multiplier: rules.returningProtection.lossMultiplier,
      protected_events: input.protectedEvents,
      days_away: input.daysAway,
    });
  }

  // 4. Correction overlay: replaces the base loss multiplier for non-exempt players.
  const overlay = policy.overlay;
  const exempt = overlay !== null && isExempt(overlay, input.daysAway, protectedNow);
  {
    const before = delta;
    const lm = overlay?.adjust.lossMultiplier;
    if (overlay !== null && lm !== undefined && !exempt && delta < 0) {
      delta = undamped * lm * (protectedNow ? rules.returningProtection.lossMultiplier : 1);
    }
    record("correction_overlay", before, delta, {
      active: overlay === null ? 0 : 1,
      exempt: exempt ? 1 : 0,
      ...(lm === undefined ? {} : { loss_multiplier: lm }),
    });
  }

  // 5. Large-gain hold: gain above the threshold waits for more evidence.
  const threshold = largeGainThreshold(policy);
  const enoughGames = input.gamesPlayed >= rules.largeGain.minGamesToExceed;
  {
    const before = delta;
    if (delta > threshold && !enoughGames) {
      held += delta - threshold;
      delta = threshold;
    }
    record("large_gain_hold", before, delta, {
      threshold,
      min_games_to_exceed: rules.largeGain.minGamesToExceed,
      games: input.gamesPlayed,
    });
  }

  // 6. Held-gain release: confirming evidence releases held gain; contrary evidence forfeits it.
  {
    const before = delta;
    const heldBefore = input.heldGain;
    let forfeited = 0;
    if (heldBefore > 0 && evidenceChange > 0) {
      const room = enoughGames ? heldBefore : Math.max(0, threshold - delta);
      const release = Math.min(heldBefore, room);
      delta += release;
      held -= release;
    } else if (heldBefore > 0 && evidenceChange < 0) {
      forfeited = Math.min(heldBefore, -evidenceChange);
      held -= forfeited;
    }
    record(
      "held_gain_release",
      before,
      delta,
      { held_before: heldBefore, held_after: held, forfeited },
      before !== delta || forfeited > 0,
    );
  }

  // 7. Decline cap: total drops inside the rolling window stay under the cap.
  const eventMs = parseTimestamp(input.occurredAt);
  const windowStart = eventMs - rules.declineCap.windowDays * MS_PER_DAY;
  const inWindow = input.recentDeclines.filter((d) => parseTimestamp(d.at) > windowStart);
  const used = inWindow.reduce((s, d) => s + d.amount, 0);
  {
    const before = delta;
    if (delta < 0) delta = Math.max(delta, -Math.max(0, rules.declineCap.amount - used));
    record("decline_cap", before, delta, {
      amount: rules.declineCap.amount,
      window_days: rules.declineCap.windowDays,
      used,
    });
  }

  // 8. Scale bounds.
  const scale = policy.base.scale;
  let rating = clamp(ratingBefore + delta, scale.min, scale.max);
  {
    const before = delta;
    const after = rating - ratingBefore;
    record("scale_bounds", before, after, { min: scale.min, max: scale.max }, Math.abs(after - before) > 1e-12);
    delta = after;
  }

  const recentDeclines =
    delta < 0 ? [...inWindow, { at: input.occurredAt, eventId: input.eventId, amount: -delta }] : inWindow;
  return {
    rating,
    heldGain: Math.max(0, held),
    recentDeclines,
    applications,
    fired: applications.filter((a) => a.fired).map((a) => a.rule),
    exemptFromOverlay: exempt,
  };
}
