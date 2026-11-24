/**
 * Plain-language explanations rendered from structured receipts.
 *
 * Pure: the same receipt and options always give the same text. Wording can
 * change between versions without touching rating math or receipt hashes,
 * because receipts store facts and codes, not sentences.
 */
import type { Receipt, RuleApplication, RuleName } from "@glassrank/schema";

export interface ExplainOptions {
  /** Where and what the event was, e.g. "Saturday round robin at Maple Street Rec". */
  readonly eventLabel?: string;
}

export interface Explanation {
  /** Tier 1: one line, e.g. "+0.060 at Saturday round robin. Won 2 of 3 games; the ratings expected about 1.4." */
  readonly headline: string;
  /** Tier 2: expected vs. actual, the games that mattered most, protections. */
  readonly summary: readonly string[];
  /** Tier 3: what the evidence said and what each rule did, with the numbers. */
  readonly details: readonly string[];
}

const f2 = (x: number) => x.toFixed(2);
const f3 = (x: number) => x.toFixed(3);
const signed = (x: number) => (x === 0 ? "±0.000" : `${x > 0 ? "+" : "−"}${Math.abs(x).toFixed(3)}`);
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function explainReceipt(receipt: Receipt, options: ExplainOptions = {}): Explanation {
  const { headline: h, summary: s, technical: t } = receipt;
  const rule = (name: RuleName): RuleApplication | undefined => t.rules.find((r) => r.rule === name);
  const fired = (name: RuleName) => rule(name)?.fired === true;
  const reasons = new Set(h.reasons);

  // Tier 1.
  let lead: string;
  if (reasons.has("first_event")) lead = `First rated event, starting from ${f2(receipt.before.rating)}.`;
  else if (s.gamesPlayed === 0) lead = "No games counted at this event.";
  else if (reasons.has("beat_higher_rated")) lead = `Beat ${count(h.facts["higher_rated_wins"] ?? 0, "higher-rated team")}.`;
  else if (reasons.has("lost_to_lower_rated")) lead = `Lost to ${count(h.facts["lower_rated_losses"] ?? 0, "lower-rated team")}.`;
  else if (reasons.has("above_expected")) lead = `Won ${s.gamesWon} of ${s.gamesPlayed} games; the ratings expected about ${s.expectedGamesWon.toFixed(1)}.`;
  else if (reasons.has("below_expected")) lead = `Won ${s.gamesWon} of ${s.gamesPlayed} games, below the ${s.expectedGamesWon.toFixed(1)} expected.`;
  else lead = `Played about as expected: won ${s.gamesWon} of ${s.gamesPlayed} games.`;

  const damping = rule("decline_damping");
  let tail = "";
  if (fired("provisional_period")) tail = " Provisional: the rating follows results directly.";
  else if (fired("decline_cap")) tail = " The decline cap limited the drop.";
  else if (damping?.fired && damping.after === 0) tail = " No drop, because the result was at or above expectation.";
  else if (fired("returning_protection")) tail = " Returning-player protection softened the drop.";
  else if (damping?.fired) tail = " The drop was softened.";
  else if (fired("large_gain_hold")) tail = " Part of the gain is held until more games confirm it.";
  const where = options.eventLabel === undefined ? "" : ` at ${options.eventLabel}`;
  const headline = `${signed(h.delta)}${where}. ${lead}${tail}`;

  // Tier 2.
  const summary: string[] = [];
  if (s.gamesPlayed > 0) {
    summary.push(
      `Won ${s.gamesWon} of ${s.gamesPlayed} games (expected ${s.expectedGamesWon.toFixed(1)}); ` +
        `won ${Math.round(s.actualPointShare * 100)}% of points (expected ${Math.round(s.expectedPointShare * 100)}%).`,
    );
  }
  if (s.keyGames.length > 0) {
    const g = s.keyGames[0]!;
    const game = t.games.find((x) => x.matchId === g.matchId && x.gameIndex === g.gameIndex);
    if (game !== undefined) {
      summary.push(`The game that mattered most: ${game.score[0]}–${game.score[1]}, worth ${signed(g.impact)} on the evidence.`);
    }
  }
  if (s.voidedMatches > 0) summary.push(`${count(s.voidedMatches, "match")} voided and not counted.`);
  if (h.provisional !== null) {
    summary.push(
      `Provisional rating: likely between ${f2(h.provisional.low)} and ${f2(h.provisional.high)}, ` +
        `${count(h.provisional.eventsRemaining, "event")} until it is established.`,
    );
  }

  // Tier 3.
  const details: string[] = [];
  details.push(`The results moved the evidence estimate ${signed(t.evidenceDelta.mu)} to ${f3(receipt.after.mu)} (uncertainty ${f3(receipt.after.sigma)}).`);
  const w = t.sigmaWidening;
  if (w.sigmaAfter > w.sigmaBefore) {
    details.push(`${w.daysAway} days since the previous event: uncertainty widened from ${f3(w.sigmaBefore)} to ${f3(w.sigmaAfter)}, so this event counted for more. The rating itself does not decay.`);
  }
  if (fired("provisional_period")) {
    const p = rule("provisional_period")!;
    details.push(`Provisional event ${p.params["event_number"]} of ${p.params["events"]}: the rating moved straight to the evidence estimate, with no damping, cap, or bias.`);
  }
  const bias = rule("upward_bias");
  if (bias !== undefined && !fired("provisional_period") && bias.before > 0) {
    details.push(
      bias.fired
        ? `The evidence was ${signed(bias.before)} above the rating. Gains apply in full, plus an upward-bias bonus of ${signed(bias.after - bias.before)}.`
        : `The evidence was ${signed(bias.before)} above the rating, so the rating caught up in full.`,
    );
  }
  if (damping?.fired) {
    details.push(
      damping.after === 0
        ? `The evidence sat ${signed(damping.before)} below the rating, but this event was at or above expectation, so the rating held.`
        : `The evidence sat ${signed(damping.before)} below the rating. Drops are damped: the rating moved ${signed(damping.after)} (${damping.params["loss_multiplier"]}× the gap).`,
    );
  }
  const returning = rule("returning_protection");
  if (returning?.fired) details.push(`Returning-player protection: the drop was cut from ${signed(returning.before)} to ${signed(returning.after)}.`);
  const overlay = rule("correction_overlay");
  if (overlay?.fired) details.push(`A scale correction is active: drops count at ${overlay.params["loss_multiplier"]}× the gap, giving ${signed(overlay.after)}.`);
  else if (reasons.has("correction_exempt")) details.push("A scale correction is active, but returning players are exempt.");
  const hold = rule("large_gain_hold");
  if (hold?.fired) {
    details.push(`Gains above ${f2(hold.params["threshold"] ?? 0)} in one event need at least ${hold.params["min_games_to_exceed"]} games; this event had ${hold.params["games"]}. ${f3(hold.before - hold.after)} is held until later results confirm it.`);
  }
  const release = rule("held_gain_release");
  if (release?.fired) {
    details.push(
      release.after > release.before
        ? `Later results confirmed earlier held gain: ${signed(release.after - release.before)} released.`
        : `This event pointed down, so ${f3(release.params["forfeited"] ?? 0)} of the held gain was dropped.`,
    );
  }
  const cap = rule("decline_cap");
  if (cap?.fired) {
    details.push(`Decline cap: ${f3(cap.params["used"] ?? 0)} of the ${f2(cap.params["amount"] ?? 0)} allowed per ${cap.params["window_days"]} days was already used, so only ${signed(cap.after)} of the ${signed(cap.before)} drop applied.`);
  }
  if (fired("scale_bounds")) details.push("The rating reached the edge of the scale.");
  details.push(`Final change: ${signed(h.delta)}, from ${f3(receipt.before.rating)} to ${f3(receipt.after.rating)}.`);

  return { headline, summary, details };
}
