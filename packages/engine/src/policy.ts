/**
 * Policy resolution: which base config and correction overlay apply at an
 * instant, and the effective lever values for one player.
 */
import type { CorrectionOverlay, EffectivePolicy, PolicySchedule } from "@glassrank/schema";

/** The policy in force at `at` (an RFC 3339 timestamp), or null if none has started. */
export function resolvePolicy(schedule: PolicySchedule, at: string): EffectivePolicy | null {
  let base = null;
  for (const entry of schedule.policies) {
    if (entry.effectiveFrom <= at) base = entry.policy;
  }
  if (base === null) return null;
  const overlay = schedule.overlays.find((o) => o.effectiveFrom <= at && at < o.expiresAt) ?? null;
  return { base, overlay };
}

/** Whether a player is exempt from an overlay (returning players keep their protections). */
export function isExempt(overlay: CorrectionOverlay, daysAway: number, returningProtected: boolean): boolean {
  return returningProtected || daysAway >= overlay.exemptions.awayDays;
}

export function defaultRating(policy: EffectivePolicy): number {
  return policy.overlay?.adjust.defaultRating ?? policy.base.seeding.defaultRating;
}

export function largeGainThreshold(policy: EffectivePolicy): number {
  return policy.overlay?.adjust.largeGainThreshold ?? policy.base.rules.largeGain.perEventThreshold;
}
