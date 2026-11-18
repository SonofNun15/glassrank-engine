/**
 * Seeds, rating state, and priors.
 *
 * The engine is stateless. The hosted service stores each `RatingState` the
 * engine returns and passes it back unchanged as the prior next time.
 */
import * as s from "../tooling/builder";
import {
  Discipline,
  EventId,
  Hash,
  PlayerId,
  PolicyId,
  Rating,
  SchemaVersion,
  Sigma,
  Timestamp,
  Version,
} from "./primitives";

export const SeedSource = s.enumOf(["self", "host", "external_claimed", "policy_default"], {
  description:
    "Where a starting rating came from. `external_claimed` is a number the player reports " +
    "from another system. `policy_default` uses the policy's new-player rating.",
});

function claimedSeed<const T extends "self" | "host" | "external_claimed">(source: T) {
  return s.object({
    source: s.literal(source),
    playerId: PlayerId,
    discipline: Discipline,
    rating: Rating,
    recordedAt: Timestamp,
  });
}

/**
 * A starting point for a player's first rated event. Every seed gets wide
 * uncertainty from the policy, so a bad seed washes out in a few events.
 */
export const Seed = s.tagged("source", {
  self: claimedSeed("self"),
  host: claimedSeed("host"),
  external_claimed: claimedSeed("external_claimed"),
  policy_default: s.object({
    source: s.literal("policy_default"),
    playerId: PlayerId,
    discipline: Discipline,
  }),
}, { description: "Starting point for a player with no rating state yet." });

export const EvidenceEstimate = s.object({
  mu: s.number({ minimum: -10, maximum: 20, description: "Evidence-layer skill estimate, rating units." }),
  sigma: Sigma,
}, { description: "What the results alone say, before community policy is applied." });

export const DeclineEntry = s.object({
  at: Timestamp,
  eventId: EventId,
  amount: s.number({ exclusiveMinimum: 0, maximum: 10, description: "Size of the applied decline." }),
});

export const RatingState = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      playerId: PlayerId,
      discipline: Discipline,
      rating: s.number({ minimum: 0, maximum: 10, description: "Displayed rating, after policy." }),
      evidence: EvidenceEstimate,
      heldGain: s.number({
        minimum: 0,
        maximum: 10,
        description: "Gain above the large-gain threshold, held until more evidence confirms it.",
      }),
      protectedEventsRemaining: s.integer({
        minimum: 0,
        maximum: 20,
        description: "Events left under returning-player protection. Set when a player returns from a long break.",
      }),
      recentDeclines: s.array(DeclineEntry, {
        maxItems: 400,
        description: "Declines inside the decline-cap window, oldest first. The engine prunes it.",
      }),
      counts: s.object({
        events: s.integer({ minimum: 0 }),
        matches: s.integer({ minimum: 0 }),
        games: s.integer({ minimum: 0 }),
      }),
      origin: s.object({
        source: SeedSource,
        rating: Rating,
      }, { description: "The seed this player started from, kept for receipts and audits." }),
      firstRatedAt: Timestamp,
      lastPlayedAt: Timestamp,
      lastUpdate: s.object({
        eventId: EventId,
        engineVersion: Version,
        policyId: PolicyId,
        policyHash: Hash,
        inputHash: Hash,
      }, { description: "The rate() call that produced this state." }),
    },
    {
      title: "RatingState",
      description: "Engine-owned state for one player in one discipline. Callers store it and pass it back unchanged.",
    },
  ),
  "recentDeclines is ordered by `at` (then eventId); firstRatedAt <= lastPlayedAt",
  (state, path, issues) => {
    for (let i = 1; i < state.recentDeclines.length; i++) {
      const prev = state.recentDeclines[i - 1]!;
      const cur = state.recentDeclines[i]!;
      if (prev.at > cur.at || (prev.at === cur.at && prev.eventId > cur.eventId)) {
        issues.push({ path: `${path}/recentDeclines/${i}`, message: "out of order" });
      }
    }
    // Fixed-format UTC timestamps compare correctly as strings.
    if (state.firstRatedAt > state.lastPlayedAt) {
      issues.push({ path: `${path}/lastPlayedAt`, message: "must not be before firstRatedAt" });
    }
  },
);

/** What the engine needs to know about a player before an event. */
export const Prior = s.tagged("kind", {
  state: s.object({ kind: s.literal("state"), state: RatingState }),
  seed: s.object({ kind: s.literal("seed"), seed: Seed }),
});

export type SeedSource = s.Infer<typeof SeedSource>;
export type Seed = s.Infer<typeof Seed>;
export type EvidenceEstimate = s.Infer<typeof EvidenceEstimate>;
export type DeclineEntry = s.Infer<typeof DeclineEntry>;
export type RatingState = s.Infer<typeof RatingState>;
export type Prior = s.Infer<typeof Prior>;

/** The (player, discipline) key a prior refers to. */
export function priorKey(prior: Prior): { playerId: string; discipline: "singles" | "doubles" } {
  const src = prior.kind === "state" ? prior.state : prior.seed;
  return { playerId: src.playerId, discipline: src.discipline };
}

