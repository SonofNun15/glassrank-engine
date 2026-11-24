/**
 * Receipts: one per player per rated event, explaining the change in three
 * tiers. Receipts are structured data; player-facing text is rendered from
 * them, so wording can improve without touching the math or the hash.
 *
 * A receipt carries `provenance.inputHash`, the hash of the full `RateRequest`
 * that produced it. The service stores that request once per event, and
 * `verify(request, receipt)` re-runs it.
 */
import * as s from "../tooling/builder";
import { GameScore } from "./event";
import { ProvisionalStatus } from "./rating";
import {
  Discipline,
  EventId,
  MatchId,
  NumberMap,
  OverlayId,
  PlayerId,
  PolicyId,
  Probability,
  RatingDelta,
  SchemaVersion,
  Sigma,
  Timestamp,
  UnitWeight,
  Version,
} from "./primitives";

/** Policy rules, in the order the engine applies them. */
export const RuleName = s.enumOf([
  "provisional_period",
  "upward_bias",
  "decline_damping",
  "returning_protection",
  "correction_overlay",
  "large_gain_hold",
  "held_gain_release",
  "decline_cap",
  "scale_bounds",
]);

/** Why the rating moved, most important first. The renderer turns these into a sentence. */
export const ReasonCode = s.enumOf([
  "first_event",
  "provisional_rating",
  "beat_higher_rated",
  "above_expected",
  "as_expected",
  "below_expected",
  "lost_to_lower_rated",
  "returning_after_break",
  "decline_damped",
  "decline_capped",
  "gain_held",
  "gain_released",
  "matches_voided",
  "reduced_source_weight",
  "correction_active",
  "correction_exempt",
]);

export const RatingSnapshot = s.object({
  rating: s.number({ minimum: 0, maximum: 10 }),
  mu: s.number({ minimum: -10, maximum: 20 }),
  sigma: Sigma,
});

/** Tier 1: "+0.06. You beat two higher-rated teams at Saturday's round robin." */
export const ReceiptHeadline = s.object({
  delta: RatingDelta,
  direction: s.enumOf(["up", "down", "none"]),
  reasons: s.array(ReasonCode, { minItems: 1, maxItems: 4 }),
  facts: NumberMap,
  provisional: ProvisionalStatus,
}, { description: "Inputs for the one-line explanation. `facts` holds counts the sentence cites." });

export const KeyGame = s.object({
  matchId: MatchId,
  gameIndex: s.integer({ minimum: 0 }),
  impact: RatingDelta,
});

/** Tier 2: expected vs. actual, the games that mattered most, protections applied. */
export const ReceiptSummary = s.object({
  gamesPlayed: s.integer({ minimum: 0 }),
  gamesWon: s.integer({ minimum: 0 }),
  expectedGamesWon: s.number({ minimum: 0 }),
  pointsFor: s.integer({ minimum: 0 }),
  pointsAgainst: s.integer({ minimum: 0 }),
  expectedPointShare: Probability,
  actualPointShare: Probability,
  voidedMatches: s.integer({ minimum: 0 }),
  keyGames: s.array(KeyGame, { maxItems: 3 }),
  protections: s.array(RuleName, { description: "Rules that changed the outcome." }),
});

export const GameEvidence = s.object({
  matchId: MatchId,
  gameIndex: s.integer({ minimum: 0 }),
  partners: s.array(PlayerId, { maxItems: 1 }),
  opponents: s.array(PlayerId, { minItems: 1, maxItems: 2 }),
  score: GameScore,
  weight: UnitWeight,
  expectedShare: Probability,
  actualShare: Probability,
  contribution: RatingDelta,
}, { description: "One game from this player's side. `score` is [for, against]." });

export const RuleApplication = s.object({
  rule: RuleName,
  fired: s.boolean(),
  before: RatingDelta,
  after: RatingDelta,
  params: NumberMap,
}, { description: "Rating change before and after one rule, with the parameters it used." });

/** Tier 3: per-game math and every rule, enough to check the arithmetic by hand. */
export const ReceiptTechnical = s.object({
  evidenceModel: s.string({ pattern: "^[a-z][a-z0-9_]{0,47}$" }),
  evidenceParams: NumberMap,
  sigmaWidening: s.object({
    daysAway: s.integer({ minimum: 0 }),
    sigmaBefore: Sigma,
    sigmaAfter: Sigma,
  }),
  games: s.array(GameEvidence),
  evidenceDelta: s.object({ mu: RatingDelta, sigma: RatingDelta }),
  rules: s.array(RuleApplication, { description: "Every rule evaluated, in application order." }),
});

export const Provenance = s.object({
  schemaVersion: SchemaVersion,
  engineVersion: Version,
  policyId: PolicyId,
  policyHash: s.string({
    pattern: "^sha256:[0-9a-f]{64}$",
    description: "Hash of the EffectivePolicy (base plus overlay) used.",
  }),
  overlayId: s.nullable(OverlayId),
  inputHash: s.string({
    pattern: "^sha256:[0-9a-f]{64}$",
    description: "Hash of the full RateRequest. verify() re-runs that request.",
  }),
});

export const Receipt = s.object(
  {
    schemaVersion: SchemaVersion,
    eventId: EventId,
    playerId: PlayerId,
    discipline: Discipline,
    occurredAt: Timestamp,
    before: RatingSnapshot,
    after: RatingSnapshot,
    headline: ReceiptHeadline,
    summary: ReceiptSummary,
    technical: ReceiptTechnical,
    provenance: Provenance,
  },
  { title: "Receipt", description: "Explains one player's rating change from one event." },
);

export type RuleName = s.Infer<typeof RuleName>;
export type ReasonCode = s.Infer<typeof ReasonCode>;
export type RatingSnapshot = s.Infer<typeof RatingSnapshot>;
export type ReceiptHeadline = s.Infer<typeof ReceiptHeadline>;
export type KeyGame = s.Infer<typeof KeyGame>;
export type ReceiptSummary = s.Infer<typeof ReceiptSummary>;
export type GameEvidence = s.Infer<typeof GameEvidence>;
export type RuleApplication = s.Infer<typeof RuleApplication>;
export type ReceiptTechnical = s.Infer<typeof ReceiptTechnical>;
export type Provenance = s.Infer<typeof Provenance>;
export type Receipt = s.Infer<typeof Receipt>;
