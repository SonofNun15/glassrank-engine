/**
 * Request and response envelopes for each public entry point. These are the
 * exact JSON documents a non-TypeScript service sends to and receives from the
 * command-line adapter, and what the library functions take and return.
 */
import * as s from "../tooling/builder";
import { EventInput, EventSource, Game, GameFormat, Team, matchDiscipline } from "./event";
import { EffectivePolicy, PolicySchedule } from "./policy";
import {
  Discipline,
  Hash,
  PlayerId,
  Probability,
  RatingDelta,
  SchemaVersion,
  Timestamp,
} from "./primitives";
import { Prior, RatingState, priorKey } from "./rating";
import { RatingSnapshot, Receipt, RuleName } from "./receipt";

export const Diagnostic = s.object({
  level: s.enumOf(["info", "warning"]),
  code: s.string({ pattern: "^[a-z][a-z0-9_]{0,63}$" }),
  message: s.string({ maxLength: 500 }),
  path: s.optional(s.string({ maxLength: 200 })),
}, { description: "Something worth knowing that did not stop the call." });

function keyOf(p: Prior): string {
  const k = priorKey(p);
  return `${k.discipline}\u0000${k.playerId}`;
}

/** Priors are sorted by (discipline, playerId) and unique, so equal inputs hash equally. */
const SortedPriors = s.refine(
  s.array(Prior, { maxItems: 2000 }),
  "sorted by (discipline, playerId) with no duplicates",
  (priors, path, issues) => {
    for (let i = 1; i < priors.length; i++) {
      if (keyOf(priors[i - 1]!) >= keyOf(priors[i]!)) {
        issues.push({ path: `${path}/${i}`, message: "priors must be sorted by (discipline, playerId) and unique" });
      }
    }
  },
);

function participantKeys(teams: readonly (readonly string[])[], discipline: string): Set<string> {
  const keys = new Set<string>();
  for (const team of teams) for (const p of team) keys.add(`${discipline}\u0000${p}`);
  return keys;
}

function checkPriorsCover(
  priors: readonly Prior[],
  needed: Set<string>,
  path: string,
  issues: s.Issue[],
): void {
  const have = new Set(priors.map(keyOf));
  for (const k of [...needed].sort()) {
    if (!have.has(k)) {
      const [discipline, playerId] = k.split("\u0000");
      issues.push({ path: `${path}/priors`, message: `missing prior for ${playerId} (${discipline})` });
    }
  }
  priors.forEach((p, i) => {
    if (!needed.has(keyOf(p))) {
      issues.push({ path: `${path}/priors/${i}`, message: "prior for a player not in this request" });
    }
  });
}

// rate() -------------------------------------------------------------------

export const RateRequest = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      priors: SortedPriors,
      event: EventInput,
      policy: EffectivePolicy,
    },
    { title: "RateRequest" },
  ),
  "exactly one prior per (player, discipline) in the event, voided matches included; " +
    "the overlay, if any, is active at event.occurredAt",
  (req, path, issues) => {
    const needed = new Set<string>();
    for (const m of req.event.matches) {
      for (const k of participantKeys(m.teams, matchDiscipline(m))) needed.add(k);
    }
    checkPriorsCover(req.priors, needed, path, issues);
    const o = req.policy.overlay;
    if (o !== null && (req.event.occurredAt < o.effectiveFrom || req.event.occurredAt >= o.expiresAt)) {
      issues.push({ path: `${path}/policy/overlay`, message: "overlay is not active at event.occurredAt" });
    }
  },
);

export const RateResponse = s.object(
  {
    schemaVersion: SchemaVersion,
    inputHash: Hash,
    states: s.array(RatingState),
    receipts: s.array(Receipt),
    diagnostics: s.array(Diagnostic),
  },
  { title: "RateResponse", description: "States and receipts sorted by (discipline, playerId)." },
);

// predict() ----------------------------------------------------------------

export const PredictRequest = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      at: Timestamp,
      priors: SortedPriors,
      teams: s.tuple([Team, Team]),
      gameFormat: GameFormat,
      policy: EffectivePolicy,
    },
    { title: "PredictRequest" },
  ),
  "teams are the same size; exactly one prior per player",
  (req, path, issues) => {
    if (req.teams[0].length !== req.teams[1].length) {
      issues.push({ path: `${path}/teams`, message: "teams must be the same size" });
      return;
    }
    const discipline = req.teams[0].length === 1 ? "singles" : "doubles";
    checkPriorsCover(req.priors, participantKeys(req.teams, discipline), path, issues);
  },
);

export const Prediction = s.object({
  gameWinProbability: Probability,
  expectedPointShare: Probability,
  expectedScore: s.tuple([s.number({ minimum: 0 }), s.number({ minimum: 0 })]),
}, { description: "From the side of teams[0], for one game under gameFormat." });

export const PredictResponse = s.object(
  { schemaVersion: SchemaVersion, inputHash: Hash, prediction: Prediction },
  { title: "PredictResponse" },
);

// forecast() ---------------------------------------------------------------

export const ForecastRequest = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      occurredAt: Timestamp,
      source: EventSource,
      priors: SortedPriors,
      teams: s.tuple([Team, Team]),
      gameFormat: GameFormat,
      policy: EffectivePolicy,
      outcomes: s.optional(s.array(s.array(Game, { minItems: 1, maxItems: 7 }), {
        minItems: 1,
        maxItems: 50,
        description: "Hypothetical game lists to evaluate. Absent: the engine picks a standard set.",
      })),
    },
    { title: "ForecastRequest" },
  ),
  "teams are the same size; exactly one prior per player",
  (req, path, issues) => {
    if (req.teams[0].length !== req.teams[1].length) {
      issues.push({ path: `${path}/teams`, message: "teams must be the same size" });
      return;
    }
    const discipline = req.teams[0].length === 1 ? "singles" : "doubles";
    checkPriorsCover(req.priors, participantKeys(req.teams, discipline), path, issues);
  },
);

export const ForecastChange = s.object({
  playerId: PlayerId,
  discipline: Discipline,
  before: RatingSnapshot,
  after: RatingSnapshot,
  delta: RatingDelta,
  rulesFired: s.array(RuleName),
});

export const ForecastOutcome = s.object({
  games: s.array(Game, { minItems: 1 }),
  probability: Probability,
  changes: s.array(ForecastChange),
});

export const ForecastResponse = s.object(
  {
    schemaVersion: SchemaVersion,
    inputHash: Hash,
    prediction: Prediction,
    outcomes: s.array(ForecastOutcome),
  },
  { title: "ForecastResponse", description: "Computed by running rate() on each outcome. Nothing is stored." },
);

// replay() -----------------------------------------------------------------

export const ReplayRequest = s.refine(
  s.object(
    {
      schemaVersion: SchemaVersion,
      initial: SortedPriors,
      events: s.array(EventInput, { maxItems: 100_000 }),
      schedule: PolicySchedule,
    },
    {
      title: "ReplayRequest",
      description:
        "Folds rate() over events. Players without an initial prior start from a policy_default seed.",
    },
  ),
  "events sorted by (occurredAt, eventId) with unique eventId",
  (req, path, issues) => {
    for (let i = 1; i < req.events.length; i++) {
      const a = req.events[i - 1]!;
      const b = req.events[i]!;
      if (a.occurredAt > b.occurredAt || (a.occurredAt === b.occurredAt && a.eventId >= b.eventId)) {
        issues.push({ path: `${path}/events/${i}`, message: "events must be sorted by (occurredAt, eventId) and unique" });
      }
    }
  },
);

export const ReplayResponse = s.object(
  {
    schemaVersion: SchemaVersion,
    inputHash: Hash,
    states: s.array(RatingState),
    receipts: s.array(Receipt),
    diagnostics: s.array(Diagnostic),
  },
  { title: "ReplayResponse", description: "Final states, plus every receipt in event order." },
);

// verify() -----------------------------------------------------------------

export const VerifyRequest = s.object(
  { input: RateRequest, receipt: Receipt },
  { title: "VerifyRequest" },
);

export const VerifyResponse = s.object(
  {
    schemaVersion: SchemaVersion,
    ok: s.boolean(),
    inputHashMatches: s.boolean(),
    mismatches: s.array(s.object({
      path: s.string(),
      expected: s.string({ description: "Canonical JSON of the recomputed value." }),
      actual: s.string({ description: "Canonical JSON of the value in the receipt." }),
    }), { maxItems: 100 }),
  },
  { title: "VerifyResponse" },
);

export type Diagnostic = s.Infer<typeof Diagnostic>;
export type RateRequest = s.Infer<typeof RateRequest>;
export type RateResponse = s.Infer<typeof RateResponse>;
export type PredictRequest = s.Infer<typeof PredictRequest>;
export type Prediction = s.Infer<typeof Prediction>;
export type PredictResponse = s.Infer<typeof PredictResponse>;
export type ForecastRequest = s.Infer<typeof ForecastRequest>;
export type ForecastChange = s.Infer<typeof ForecastChange>;
export type ForecastOutcome = s.Infer<typeof ForecastOutcome>;
export type ForecastResponse = s.Infer<typeof ForecastResponse>;
export type ReplayRequest = s.Infer<typeof ReplayRequest>;
export type ReplayResponse = s.Infer<typeof ReplayResponse>;
export type VerifyRequest = s.Infer<typeof VerifyRequest>;
export type VerifyResponse = s.Infer<typeof VerifyResponse>;
