/**
 * Policy: the community's published, versioned rules. Every tunable number
 * the engine uses lives here, so a parameter change is a data change with a
 * changelog entry and a content hash rather than a code change.
 */
import * as s from "../tooling/builder";
import {
  OverlayId,
  PolicyId,
  Rating,
  SchemaVersion,
  Sigma,
  Timestamp,
  UnitWeight,
} from "./primitives";

export const ScaleConfig = s.refine(
  s.object({
    min: Rating,
    max: Rating,
    displayDecimals: s.integer({ minimum: 0, maximum: 4, description: "Decimals shown to players." }),
  }),
  "min < max",
  (scale, path, issues) => {
    if (scale.min >= scale.max) issues.push({ path, message: "min must be below max" });
  },
);

export const SeedingConfig = s.object({
  defaultRating: Rating,
  defaultSigma: Sigma,
  sigmaBySource: s.object({
    self: Sigma,
    host: Sigma,
    external_claimed: Sigma,
  }, { description: "Starting uncertainty for each claimed seed source." }),
}, { description: "Starting point for new players. `defaultRating` is a correction lever." });

export const SourceWeights = s.object({
  verified_host: UnitWeight,
  provisional_host: UnitWeight,
  video_verified: UnitWeight,
}, { description: "Evidence weight for each source tier. Multiplied with each match's trust weight." });

/**
 * Evidence models, selected by `model`. New models are added as new variants
 * (a minor schema bump). `elo_baseline` exists so the metrics harness has a
 * plain baseline to beat.
 */
export const EvidenceConfig = s.tagged("model", {
  elo_baseline: s.object({
    model: s.literal("elo_baseline"),
    kFactor: s.number({ exclusiveMinimum: 0, maximum: 2, description: "Max rating units moved per game at weight 1." }),
    spread: s.number({
      exclusiveMinimum: 0,
      maximum: 10,
      description: "Rating gap, in rating units, at which the stronger side is a 10:1 favorite.",
    }),
    useMargin: s.boolean({ description: "Score each game by point share instead of win/loss." }),
  }),
  bayes_v0: s.object({
    model: s.literal("bayes_v0"),
    winScale: s.number({
      exclusiveMinimum: 0,
      maximum: 20,
      description: "Logistic slope per rating unit for winning a game: P(win) = 1 / (1 + exp(-winScale * gap)).",
    }),
    shareScale: s.number({
      exclusiveMinimum: 0,
      maximum: 20,
      description: "Logistic slope per rating unit for the share of points won.",
    }),
    marginWeight: s.number({
      minimum: 0,
      maximum: 1,
      description: "How much the point share counts versus the win/loss result. 0 is win/loss only.",
    }),
    dynamicsSigma: s.number({
      minimum: 0,
      maximum: 1,
      description: "Uncertainty added before every event, so active players never become hard to move.",
    }),
    sigmaFloor: s.number({ exclusiveMinimum: 0, maximum: 2, description: "Uncertainty never drops below this." }),
  }),
});

export const InactivityConfig = s.object({
  graceDays: s.integer({ minimum: 0, maximum: 3650, description: "Days away before uncertainty starts to grow." }),
  sigmaGrowthPerDay: s.number({ minimum: 0, maximum: 1 }),
  sigmaMax: Sigma,
}, { description: "No rating decay for inactivity. Uncertainty widens instead." });

export const RulesConfig = s.object({
  upwardBias: s.object({
    gainMultiplier: s.number({ minimum: 1, maximum: 3, description: "Applied to evidence gains." }),
  }),
  declineDamping: s.object({
    lossMultiplier: s.number({ minimum: 0, maximum: 1, description: "Applied to evidence losses. Lower is gentler." }),
  }),
  returningProtection: s.object({
    awayDays: s.integer({ minimum: 1, maximum: 3650, description: "Days away that make a player a returner." }),
    events: s.integer({ minimum: 1, maximum: 20, description: "How many events back the protection lasts." }),
    lossMultiplier: s.number({ minimum: 0, maximum: 1, description: "Extra multiplier on losses while protected." }),
  }),
  declineCap: s.object({
    amount: s.number({ exclusiveMinimum: 0, maximum: 10, description: "Max total decline inside the window." }),
    windowDays: s.integer({ minimum: 1, maximum: 366, description: "Rolling window length." }),
  }),
  largeGain: s.object({
    perEventThreshold: s.number({ exclusiveMinimum: 0, maximum: 10, description: "Gain above this in one event needs more evidence." }),
    minGamesToExceed: s.integer({ minimum: 1, maximum: 100, description: "Games in the event needed to apply gain above the threshold." }),
  }),
}, { description: "Community rules applied on top of the evidence, in a fixed published order." });

export const PolicyConfig = s.object(
  {
    schemaVersion: SchemaVersion,
    policyId: PolicyId,
    title: s.string({ minLength: 1, maxLength: 120 }),
    scale: ScaleConfig,
    seeding: SeedingConfig,
    sourceWeights: SourceWeights,
    evidence: EvidenceConfig,
    inactivity: InactivityConfig,
    rules: RulesConfig,
  },
  { title: "PolicyConfig", description: "A complete, versioned set of rating parameters." },
);

/**
 * A temporary correction-dial setting. It may adjust only the levers listed
 * in `adjust`. The decline cap and returning-player protection cannot be
 * changed by an overlay. It is announced before it takes effect and expires
 * unless renewed by a new overlay.
 */
export const CorrectionOverlay = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      overlayId: OverlayId,
      title: s.string({ minLength: 1, maxLength: 120 }),
      rationaleUrl: s.optional(s.string({
        pattern: "^https://",
        maxLength: 500,
        description: "Public evidence for the correction.",
      })),
      announcedAt: Timestamp,
      effectiveFrom: Timestamp,
      expiresAt: Timestamp,
      adjust: s.object({
        lossMultiplier: s.optional(s.number({ minimum: 0, maximum: 1 })),
        largeGainThreshold: s.optional(s.number({ exclusiveMinimum: 0, maximum: 10 })),
        defaultRating: s.optional(Rating),
      }, { description: "Replacement values for the base policy's levers while active." }),
      exemptions: s.object({
        awayDays: s.integer({
          minimum: 1,
          maximum: 3650,
          description: "Players returning after at least this many days away are exempt.",
        }),
      }),
    },
    { title: "CorrectionOverlay" },
  ),
  "announcedAt <= effectiveFrom < expiresAt; adjust sets at least one lever",
  (o, path, issues) => {
    if (o.announcedAt > o.effectiveFrom) {
      issues.push({ path: `${path}/effectiveFrom`, message: "must not be before announcedAt" });
    }
    if (o.effectiveFrom >= o.expiresAt) {
      issues.push({ path: `${path}/expiresAt`, message: "must be after effectiveFrom" });
    }
    if (Object.keys(o.adjust).length === 0) {
      issues.push({ path: `${path}/adjust`, message: "must set at least one lever" });
    }
  },
);

export const PolicyScheduleEntry = s.object({
  effectiveFrom: Timestamp,
  policy: PolicyConfig,
});

/**
 * The published history of policies and overlays. Replay resolves the
 * effective policy for each event from this.
 */
export const PolicySchedule = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      policies: s.array(PolicyScheduleEntry, { minItems: 1 }),
      overlays: s.array(CorrectionOverlay),
    },
    { title: "PolicySchedule" },
  ),
  "policies strictly ordered by effectiveFrom; overlays ordered by effectiveFrom and never overlapping",
  (sched, path, issues) => {
    for (let i = 1; i < sched.policies.length; i++) {
      if (sched.policies[i - 1]!.effectiveFrom >= sched.policies[i]!.effectiveFrom) {
        issues.push({ path: `${path}/policies/${i}/effectiveFrom`, message: "must be after the previous entry" });
      }
    }
    for (let i = 1; i < sched.overlays.length; i++) {
      if (sched.overlays[i - 1]!.expiresAt > sched.overlays[i]!.effectiveFrom) {
        issues.push({ path: `${path}/overlays/${i}/effectiveFrom`, message: "overlaps the previous overlay" });
      }
    }
  },
);

/** The policy in force for one event: a base config plus at most one active overlay. */
export const EffectivePolicy = s.object(
  {
    base: PolicyConfig,
    overlay: s.nullable(CorrectionOverlay),
  },
  { title: "EffectivePolicy" },
);

export type ScaleConfig = s.Infer<typeof ScaleConfig>;
export type SeedingConfig = s.Infer<typeof SeedingConfig>;
export type SourceWeights = s.Infer<typeof SourceWeights>;
export type EvidenceConfig = s.Infer<typeof EvidenceConfig>;
export type InactivityConfig = s.Infer<typeof InactivityConfig>;
export type RulesConfig = s.Infer<typeof RulesConfig>;
export type PolicyConfig = s.Infer<typeof PolicyConfig>;
export type CorrectionOverlay = s.Infer<typeof CorrectionOverlay>;
export type PolicyScheduleEntry = s.Infer<typeof PolicyScheduleEntry>;
export type PolicySchedule = s.Infer<typeof PolicySchedule>;
export type EffectivePolicy = s.Infer<typeof EffectivePolicy>;
