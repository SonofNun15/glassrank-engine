/**
 * Events: the unit of rating. Everything in one event is evaluated together
 * against frozen pre-event ratings, so match order within an event does not
 * change the result. Events are ordered by (`occurredAt`, `eventId`).
 */
import * as s from "../tooling/builder";
import {
  EventId,
  HostId,
  MatchId,
  PlayerId,
  SchemaVersion,
  Timestamp,
  UnitWeight,
} from "./primitives";

export const EventFormat = s.enumOf(
  ["round_robin", "ladder", "league", "tournament", "other"],
  {
    description:
      "Kind of rated event. Open play is deliberately absent: it is not rated. " +
      "Informational for receipts; not a math input in v0.",
  },
);

/**
 * Who vouched for the results. The policy maps each tier to a weight, so the
 * mapping is public and versioned rather than buried in code.
 */
export const SourceTier = s.enumOf(
  ["verified_host", "provisional_host", "video_verified"],
  {
    description:
      "Who vouched for the results. Weighted by `policy.sourceWeights`. Results reported " +
      "only by players are not accepted: a host or video must vouch for every rated event.",
  },
);

export const EventSource = s.object({
  hostId: HostId,
  tier: SourceTier,
});

export const Team = s.refine(
  s.array(PlayerId, { minItems: 1, maxItems: 2, description: "One player (singles) or two (doubles)." }),
  "players within a team are distinct",
  (players, path, issues) => {
    if (players.length === 2 && players[0] === players[1]) {
      issues.push({ path, message: "a team cannot list the same player twice" });
    }
  },
);

export const GameFormat = s.object(
  {
    target: s.integer({ minimum: 1, maximum: 50, description: "Points to win a game, e.g. 11." }),
    winBy: s.integer({ minimum: 1, maximum: 5 }),
    scoring: s.enumOf(["side_out", "rally"]),
  },
  { description: "Rules every game in the match was played under." },
);

export const GameScore = s.tuple([
  s.integer({ minimum: 0, maximum: 99 }),
  s.integer({ minimum: 0, maximum: 99 }),
], { description: "Points for teams[0] and teams[1], in that order." });

export const Game = s.object({
  score: GameScore,
  /** Absent means the game was played to completion. */
  ending: s.optional(s.enumOf(["completed", "timed", "retired"], {
    description: "How the game ended. Absent means completed.",
  })),
});

export const TrustReason = s.enumOf([
  "dispute_upheld",
  "host_correction",
  "anomaly_review",
  "duplicate",
  "provisional_review",
  "other",
]);

/**
 * Effect of trust and safety decisions made outside the engine. How the
 * decision was reached never crosses the seam; only its effect does.
 */
export const MatchTrust = s.object({
  weight: UnitWeight,
  voided: s.boolean(),
  reason: s.optional(TrustReason),
}, { description: "weight multiplies the evidence; voided matches are recorded but ignored." });

export const Match = s.refine(
  s.object({
    matchId: MatchId,
    teams: s.tuple([Team, Team]),
    gameFormat: GameFormat,
    games: s.array(Game, { minItems: 1, maxItems: 7 }),
    trust: MatchTrust,
  }),
  "both teams have the same size, and no player appears on both teams",
  (match, path, issues) => {
    const [a, b] = match.teams;
    if (a.length !== b.length) {
      issues.push({ path: `${path}/teams`, message: "teams must be the same size" });
    }
    const seen = new Set(a);
    for (const p of b) {
      if (seen.has(p)) issues.push({ path: `${path}/teams`, message: `player ${p} is on both teams` });
    }
  },
);

export const EventInput = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      eventId: EventId,
      occurredAt: Timestamp,
      format: EventFormat,
      label: s.optional(s.string({
        maxLength: 120,
        description: "Short display label, e.g. \"Saturday round robin\". Not a math input.",
      })),
      source: EventSource,
      matches: s.array(Match, { minItems: 1, maxItems: 500 }),
    },
    { title: "EventInput", description: "One rated event as submitted by a host." },
  ),
  "matchId values are unique within the event",
  (event, path, issues) => {
    const seen = new Set<string>();
    event.matches.forEach((m, i) => {
      if (seen.has(m.matchId)) {
        issues.push({ path: `${path}/matches/${i}/matchId`, message: `duplicate matchId ${m.matchId}` });
      }
      seen.add(m.matchId);
    });
  },
);

export type EventFormat = s.Infer<typeof EventFormat>;
export type SourceTier = s.Infer<typeof SourceTier>;
export type EventSource = s.Infer<typeof EventSource>;
export type Team = s.Infer<typeof Team>;
export type GameFormat = s.Infer<typeof GameFormat>;
export type GameScore = s.Infer<typeof GameScore>;
export type Game = s.Infer<typeof Game>;
export type TrustReason = s.Infer<typeof TrustReason>;
export type MatchTrust = s.Infer<typeof MatchTrust>;
export type Match = s.Infer<typeof Match>;
export type EventInput = s.Infer<typeof EventInput>;

/** Discipline implied by a match's team size. */
export function matchDiscipline(match: Match): "singles" | "doubles" {
  return match.teams[0].length === 1 ? "singles" : "doubles";
}
