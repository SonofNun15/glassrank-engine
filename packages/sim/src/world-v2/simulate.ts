/**
 * simulateRecipeV2(): validate a recipe, run it under a policy, and return
 * every player's rating history with a result hash. Two runs agree exactly
 * if and only if their result hashes match.
 */
import { ENGINE_VERSION } from "@glassrank/engine";
import { assertValid, hashCanonical, type PolicyConfig } from "@glassrank/schema";
import { SIM_V2_VERSION, SimulationRecipeV2 } from "./recipe";
import { runWorldV2, scheduleFromDayZero, type RatingPoint } from "./run";

export interface PlayerHistory {
  readonly id: string;
  readonly label: string | null;
  readonly group: string | null;
  readonly home: string;
  readonly points: readonly RatingPoint[];
}

export interface SimulationResultV2 {
  readonly recipeHash: string;
  readonly engineVersion: string;
  readonly simVersion: string;
  readonly policyId: string;
  readonly world: { readonly players: number; readonly events: number; readonly ratedEvents: number; readonly games: number };
  readonly eventLogHash: string;
  readonly players: readonly PlayerHistory[];
  /** Hash of everything above. */
  readonly resultHash: string;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

export function simulateRecipeV2(input: unknown, policy: PolicyConfig): SimulationResultV2 {
  return simulateRecipeV2Unchecked(assertValid(SimulationRecipeV2, input), policy);
}

export function simulateRecipeV2Unchecked(recipe: SimulationRecipeV2, policy: PolicyConfig): SimulationResultV2 {
  const run = runWorldV2(recipe, scheduleFromDayZero(policy));
  const ratedIds = new Set(run.occurrences.filter((o) => o.rated).map((o) => o.eventId));
  const body = {
    recipeHash: hashCanonical(recipe),
    engineVersion: ENGINE_VERSION,
    simVersion: SIM_V2_VERSION,
    policyId: policy.policyId,
    world: {
      players: run.players.length,
      events: run.events.length,
      ratedEvents: ratedIds.size,
      games: run.events.reduce((n, e) => n + e.matches.reduce((m, x) => m + x.games.length, 0), 0),
    },
    eventLogHash: hashCanonical(run.events),
    players: run.players.map((p) => ({
      id: p.id,
      label: p.label,
      group: p.group,
      home: p.home,
      points: (run.history.get(p.id) ?? []).map((pt) => ({
        ...pt,
        ratingBefore: r6(pt.ratingBefore),
        rating: r6(pt.rating),
        trueSkill: r6(pt.trueSkill),
        provisional: pt.provisional === null ? null : { ...pt.provisional, low: r6(pt.provisional.low), high: r6(pt.provisional.high) },
      })),
    })),
  };
  return { ...body, resultHash: hashCanonical(body) };
}
