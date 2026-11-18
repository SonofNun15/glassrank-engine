/**
 * replay(): fold rate() over an ordered event log. Used for voids and
 * corrections (recompute from the affected event onward) and for testing a
 * proposed policy against real history.
 */
import {
  ReplayRequest,
  SCHEMA_VERSION,
  assertValid,
  hashCanonical,
  matchDiscipline,
  type Diagnostic,
  type Prior,
  type RatingState,
  type Receipt,
  type ReplayResponse,
} from "@glassrank/schema";
import { resolvePolicy } from "./policy";
import { key, rateUnchecked } from "./rate";

export function replayUnchecked(request: ReplayRequest): ReplayResponse {
  const latest = new Map<string, Prior>();
  for (const p of request.initial) {
    const src = p.kind === "state" ? p.state : p.seed;
    latest.set(key(src.discipline, src.playerId), p);
  }
  const receipts: Receipt[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const event of request.events) {
    const policy = resolvePolicy(request.schedule, event.occurredAt);
    if (policy === null) {
      diagnostics.push({ level: "warning", code: "no_policy", message: `no policy in force at ${event.occurredAt}; event ${event.eventId} skipped` });
      continue;
    }
    const keys = new Set<string>();
    for (const m of event.matches) for (const t of m.teams) for (const p of t) keys.add(key(matchDiscipline(m), p));
    const priors = [...keys].sort().map((k): Prior => {
      const known = latest.get(k);
      if (known !== undefined) return known;
      const [discipline, playerId] = k.split("\u0000") as ["singles" | "doubles", string];
      return { kind: "seed", seed: { source: "policy_default", playerId, discipline } };
    });
    const result = rateUnchecked({ schemaVersion: SCHEMA_VERSION, priors, event, policy });
    for (const s of result.states) latest.set(key(s.discipline, s.playerId), { kind: "state", state: s });
    receipts.push(...result.receipts);
    diagnostics.push(...result.diagnostics);
  }

  const states: RatingState[] = [...latest.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .flatMap(([, p]) => (p.kind === "state" ? [p.state] : []));
  return { schemaVersion: SCHEMA_VERSION, inputHash: hashCanonical(request), states, receipts, diagnostics };
}

/** Replay an ordered event log. Validates the request. */
export function replay(request: unknown): ReplayResponse {
  return replayUnchecked(assertValid(ReplayRequest, request));
}
