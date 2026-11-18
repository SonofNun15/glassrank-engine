/**
 * predict(): win probability and expected score for a planned match, from
 * current states, using the evidence model's own forward function.
 */
import {
  PredictRequest,
  SCHEMA_VERSION,
  assertValid,
  hashCanonical,
  type PredictResponse,
} from "@glassrank/schema";
import { matchup, type Estimate } from "./evidence";
import { quantize } from "./math";
import { key, preState, widen } from "./rate";

export function predictUnchecked(request: PredictRequest): PredictResponse {
  const discipline = request.teams[0].length === 1 ? "singles" : "doubles";
  const estimates = new Map<string, Estimate>();
  for (const prior of request.priors) {
    const s = preState(prior, request.policy);
    estimates.set(key(s.discipline, s.playerId), { mu: s.mu, sigma: widen(s, request.policy, request.at).sigma });
  }
  const side = (team: readonly string[]) => team.map((p) => estimates.get(key(discipline, p)) as Estimate);
  const m = matchup(request.policy.base.evidence, side(request.teams[0]), side(request.teams[1]));
  const target = request.gameFormat.target;
  const s = m.expectedShare;
  const expectedScore: [number, number] =
    s >= 0.5 ? [target, quantize((target * (1 - s)) / s)] : [quantize((target * s) / (1 - s)), target];
  return {
    schemaVersion: SCHEMA_VERSION,
    inputHash: hashCanonical(request),
    prediction: {
      gameWinProbability: quantize(m.winProbability),
      expectedPointShare: quantize(s),
      expectedScore,
    },
  };
}

/** Predict one game between two teams. Validates the request. */
export function predict(request: unknown): PredictResponse {
  return predictUnchecked(assertValid(PredictRequest, request));
}
