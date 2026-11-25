/**
 * simulateRecipe(): run a recipe and summarize it. Deterministic: the same
 * recipe on the same engine and simulator versions gives a byte-identical
 * result, so anyone can re-run a submitted recipe and check its result hash.
 */
import { ENGINE_VERSION } from "@glassrank/engine";
import {
  MS_PER_DAY,
  PolicySchedule,
  SCHEMA_VERSION,
  assertValid,
  formatTimestamp,
  hashCanonical,
} from "@glassrank/schema";
import { runWorld } from "./harness";
import { computeReport, type Report } from "./metrics";
import { SIM_VERSION, SimulationRecipe, customPlayers, recipeScenario } from "./recipe";
import { generateWorld, scenarioStartMs } from "./world";

export interface PlayerPoint {
  readonly date: string;
  /** 1 for the player's first event. */
  readonly event: number;
  readonly ratingBefore: number;
  readonly rating: number;
  readonly mu: number;
  readonly trueSkill: number;
}

export interface CustomPlayerResult {
  readonly id: string;
  readonly label: string | null;
  readonly points: readonly PlayerPoint[];
}

export interface SystemResult {
  readonly label: string;
  readonly policyId: string;
  /** Hash of the policy schedule this system ran (policy plus overlays). */
  readonly scheduleHash: string;
  readonly report: Report;
  readonly customPlayers: readonly CustomPlayerResult[];
}

export interface SimulationResult {
  readonly recipeHash: string;
  readonly engineVersion: string;
  readonly simVersion: string;
  readonly world: {
    readonly players: number;
    readonly events: number;
    readonly games: number;
    readonly manipulatedGames: number;
  };
  readonly systems: readonly SystemResult[];
  /** Hash of everything above. Two runs agree exactly if and only if their result hashes match. */
  readonly resultHash: string;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Run an already-validated recipe. */
export function simulateRecipeUnchecked(recipe: SimulationRecipe): SimulationResult {
  const scenario = recipeScenario(recipe);
  const startMs = scenarioStartMs(scenario);
  const from = formatTimestamp(startMs);
  const extra = customPlayers(recipe, startMs);
  const world = generateWorld(scenario, extra);
  const customIds = extra.players.map((p) => p.id);
  const labels = new Map(extra.players.map((p) => [p.id, p.label ?? null]));

  const systems: SystemResult[] = recipe.systems.map((system) => {
    const schedule = assertValid(PolicySchedule, {
      schemaVersion: SCHEMA_VERSION,
      policies: [{ effectiveFrom: from, policy: system.policy }],
      overlays: system.overlays,
    });
    const run = runWorld(system.label, world, schedule);
    return {
      label: system.label,
      policyId: system.policy.policyId,
      scheduleHash: hashCanonical(schedule),
      report: computeReport(run, scenario.weeks * 7),
      customPlayers: customIds.map((id) => ({
        id,
        label: labels.get(id) ?? null,
        points: run.playerEvents
          .filter((r) => r.playerId === id)
          .map((r) => ({
            date: formatTimestamp(startMs + r.day * MS_PER_DAY).slice(0, 10),
            event: r.eventNumber,
            ratingBefore: r6(r.ratingBefore),
            rating: r6(r.ratingAfter),
            mu: r6(r.muAfter),
            trueSkill: r6(r.trueSkill),
          })),
      })),
    };
  });

  const body = {
    recipeHash: hashCanonical(recipe),
    engineVersion: ENGINE_VERSION,
    simVersion: SIM_VERSION,
    world: {
      players: world.players.length,
      events: world.events.length,
      games: world.events.reduce((n, e) => n + e.matches.reduce((m, x) => m + x.games.length, 0), 0),
      manipulatedGames: world.truth.manipulated.length,
    },
    systems,
  };
  return { ...body, resultHash: hashCanonical(body) };
}

/** Validate and run a recipe. Throws SchemaError for an invalid recipe. */
export function simulateRecipe(input: unknown): SimulationResult {
  return simulateRecipeUnchecked(assertValid(SimulationRecipe, input));
}
