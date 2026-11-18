/**
 * Policies the simulator compares. These are data, like every policy: the
 * numbers are starting points for tuning, not a published proposal.
 */
import { SCHEMA_VERSION, type CorrectionOverlay, type PolicyConfig, type PolicySchedule } from "@glassrank/schema";

const SHARED = {
  schemaVersion: SCHEMA_VERSION,
  scale: { min: 2, max: 8, displayDecimals: 3 },
  seeding: {
    defaultRating: 3.0,
    defaultSigma: 0.8,
    sigmaBySource: { self: 0.7, host: 0.5, external_claimed: 0.6 },
  },
  sourceWeights: { verified_host: 1, provisional_host: 0.6, video_verified: 1 },
  inactivity: { graceDays: 30, sigmaGrowthPerDay: 0.004, sigmaMax: 0.8 },
} as const;

/** Rules that leave the evidence untouched: displayed rating = evidence estimate. */
export const NEUTRAL_RULES: PolicyConfig["rules"] = {
  upwardBias: { gainMultiplier: 1 },
  declineDamping: { lossMultiplier: 1 },
  returningProtection: { awayDays: 3650, events: 1, lossMultiplier: 1 },
  declineCap: { amount: 10, windowDays: 30 },
  largeGain: { perEventThreshold: 10, minGamesToExceed: 1 },
};

export const GLASSRANK_RULES: PolicyConfig["rules"] = {
  upwardBias: { gainMultiplier: 1.2 },
  declineDamping: { lossMultiplier: 0.6 },
  returningProtection: { awayDays: 60, events: 3, lossMultiplier: 0.5 },
  declineCap: { amount: 0.2, windowDays: 30 },
  largeGain: { perEventThreshold: 0.3, minGamesToExceed: 6 },
};

const BAYES = {
  model: "bayes_v0",
  winScale: 3.2,
  shareScale: 1.0,
  marginWeight: 0.5,
  dynamicsSigma: 0.05,
  sigmaFloor: 0.08,
} as const;

/** Plain Elo on team averages, game wins only, no community rules. The bar to beat. */
export const ELO_BASELINE: PolicyConfig = {
  ...SHARED,
  policyId: "sim-elo-baseline",
  title: "Plain Elo baseline",
  sourceWeights: { verified_host: 1, provisional_host: 1, video_verified: 1 },
  evidence: { model: "elo_baseline", kFactor: 0.06, spread: 0.73, useMargin: false },
  rules: NEUTRAL_RULES,
};

/** GlassRank's evidence layer alone. */
export const EVIDENCE_ONLY: PolicyConfig = {
  ...SHARED,
  policyId: "sim-evidence-only",
  title: "Bayesian evidence layer, no community rules",
  evidence: BAYES,
  rules: NEUTRAL_RULES,
};

/** Evidence layer plus community rules. */
export const GLASSRANK: PolicyConfig = {
  ...SHARED,
  policyId: "sim-glassrank-v0",
  title: "Evidence layer with community rules (draft parameters)",
  evidence: BAYES,
  rules: GLASSRANK_RULES,
};

export function scheduleOf(policy: PolicyConfig, from: string, overlays: readonly CorrectionOverlay[] = []): PolicySchedule {
  return { schemaVersion: SCHEMA_VERSION, policies: [{ effectiveFrom: from, policy }], overlays: [...overlays] };
}

/** A one-year correction: losses count at 0.9 instead of 0.6; returners exempt. */
export function correctionOverlay(announcedAt: string, effectiveFrom: string, expiresAt: string): CorrectionOverlay {
  return {
    schemaVersion: SCHEMA_VERSION,
    overlayId: "sim-correction",
    title: "Simulated one-year scale correction",
    announcedAt,
    effectiveFrom,
    expiresAt,
    adjust: { lossMultiplier: 0.9 },
    exemptions: { awayDays: 60 },
  };
}
