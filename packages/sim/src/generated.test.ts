/**
 * Golden summary of the default world. If the generator changes, this file
 * changes too: run `pnpm generate`, and say in the commit why the world moved.
 * A matching hash on another machine shows the run is byte-identical there.
 */
import { join } from "node:path";
import { hashCanonical } from "@glassrank/schema";
import { expect, it } from "vitest";
import { compareSystems } from "./compare";
import { COHORTS, DEFAULT_SCENARIO } from "./scenario";
import { generateWorld } from "./world";

it("default world matches its golden summary", async () => {
  const world = generateWorld(DEFAULT_SCENARIO);
  const cohorts = Object.fromEntries(COHORTS.map((c) => [c, world.players.filter((p) => p.cohort === c).length]));
  const summary = {
    scenarioHash: hashCanonical(DEFAULT_SCENARIO),
    players: world.players.length,
    cohorts,
    events: world.events.length,
    games: world.events.reduce((n, e) => n + e.matches.reduce((g, m) => g + m.games.length, 0), 0),
    manipulatedGames: world.truth.manipulated.length,
    firstEvent: world.events[0]?.occurredAt,
    lastEvent: world.events.at(-1)?.occurredAt,
    seedsHash: hashCanonical(world.seeds),
    eventLogHash: hashCanonical(world.events),
  };
  await expect(`${JSON.stringify(summary, null, 2)}\n`).toMatchFileSnapshot(
    join(import.meta.dirname, "..", "golden", "default-world.json"),
  );
});

it("default comparison matches its golden report", async () => {
  const reports = compareSystems(DEFAULT_SCENARIO);
  await expect(`${JSON.stringify(reports, null, 2)}\n`).toMatchFileSnapshot(
    join(import.meta.dirname, "..", "golden", "default-comparison.json"),
  );
}, 120_000);

it("SimulationRecipe JSON Schema and example recipe match their sources", async () => {
  const { SimulationRecipe, makeRecipe } = await import("./recipe");
  const { GLASSRANK, ELO_BASELINE } = await import("./policies");
  const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:glassrank:sim:0.1.0:SimulationRecipe", ...SimulationRecipe.json };
  await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "json-schema", "SimulationRecipe.schema.json"));
  const example = makeRecipe(
    DEFAULT_SCENARIO,
    [
      { label: "GlassRank v1", policy: GLASSRANK, overlays: [] },
      { label: "Plain Elo", policy: ELO_BASELINE, overlays: [] },
    ],
    [
      {
        label: "Fast climber",
        homeClub: "club-a",
        joinWeek: 0,
        attendance: 0.9,
        startSkill: 3.0,
        improvement: { gain: 1.2, halfLifeDays: 180 },
        claimedStart: { source: "self", rating: 3.25 },
      },
    ],
    "Default community with one fast climber",
  );
  await expect(`${JSON.stringify(example, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "fixtures", "example-recipe.json"));
});

it("v2 default world matches its golden summary", async () => {
  const { DEFAULT_RECIPE_V2, simulateRecipeV2 } = await import("./world-v2");
  const { GLASSRANK } = await import("./policies");
  const result = simulateRecipeV2(DEFAULT_RECIPE_V2, GLASSRANK);
  const summary = {
    recipeHash: result.recipeHash,
    policyId: result.policyId,
    world: result.world,
    eventLogHash: result.eventLogHash,
    resultHash: result.resultHash,
    handMadePlayers: result.players
      .filter((p) => p.group === null)
      .map((p) => ({ id: p.id, events: p.points.length, last: p.points.at(-1) ?? null })),
  };
  await expect(`${JSON.stringify(summary, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "golden", "default-world-v2.json"));
});

it("SimulationRecipeV2 JSON Schema and example recipe match their sources", async () => {
  const { DEFAULT_RECIPE_V2, SimulationRecipeV2, RECIPE_V2_VERSION } = await import("./world-v2");
  const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: `urn:glassrank:sim:${RECIPE_V2_VERSION}:SimulationRecipeV2`, ...SimulationRecipeV2.json };
  await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "json-schema", "SimulationRecipeV2.schema.json"));
  await expect(`${JSON.stringify(DEFAULT_RECIPE_V2, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "fixtures", "example-recipe-v2.json"));
});
