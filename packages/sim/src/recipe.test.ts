import { SchemaError, parse } from "@glassrank/schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ELO_BASELINE, GLASSRANK } from "./policies";
import { type Community, type CustomPlayer, SimulationRecipe, makeRecipe } from "./recipe";
import { DEFAULT_SCENARIO, type Scenario } from "./scenario";
import { simulateRecipe } from "./simulate";
import { generateWorld } from "./world";
import { hashCanonical } from "@glassrank/schema";

/** A small community so tests stay quick. */
const SMALL: Scenario = {
  ...DEFAULT_SCENARIO,
  weeks: 20,
  cohorts: {
    fast_improver: { count: 8, baseSkill: [2.6, 3.6] },
    steady: { count: 16, baseSkill: [2.8, 4.6] },
    slow_decliner: { count: 6, baseSkill: [3.0, 4.4] },
    new_player: { count: 8, baseSkill: [2.2, 3.0] },
    returner: { count: 4, baseSkill: [2.8, 4.2] },
    older_pool: { count: 6, baseSkill: [2.8, 4.0] },
  },
};
const custom: CustomPlayer[] = [
  {
    label: "Fast climber",
    homeClub: "club-a",
    joinWeek: 0,
    attendance: 0.95,
    startSkill: 3.0,
    improvement: { gain: 1.0, halfLifeDays: 60 },
    claimedStart: { source: "self", rating: 3.0 },
  },
  {
    label: "Back from injury",
    homeClub: "club-b",
    otherClubs: ["club-c"],
    joinWeek: 0,
    attendance: 0.9,
    startSkill: 3.8,
    layoff: { startWeek: 4, weeks: 8, rust: 0.4 },
    claimedStart: { source: "policy_default" },
  },
];
const systems = [
  { label: "GlassRank v1", policy: GLASSRANK, overlays: [] },
  { label: "Plain Elo", policy: ELO_BASELINE, overlays: [] },
];
const recipe = makeRecipe(SMALL, systems, custom, "Test recipe");
const result = simulateRecipe(recipe);

describe("SimulationRecipe", () => {
  it("describes exactly the simulator's Scenario (minus seed, start, and length)", () => {
    expectTypeOf<Community>().toEqualTypeOf<Omit<Scenario, "seed" | "startDate" | "weeks">>();
  });

  it("built recipes are valid, and survive a JSON round trip unchanged", () => {
    expect(parse(SimulationRecipe, recipe).ok).toBe(true);
    const downloaded = JSON.parse(JSON.stringify(recipe));
    expect(simulateRecipe(downloaded).resultHash).toBe(result.resultHash);
  });

  it("is deterministic, and any change to the recipe changes the result", () => {
    expect(simulateRecipe(recipe)).toEqual(result);
    const tweaked = { ...recipe, seed: recipe.seed + 1 };
    expect(simulateRecipe(tweaked).resultHash).not.toBe(result.resultHash);
    expect(result.recipeHash).toBe(hashCanonical(recipe));
  });

  it("leaves the simulated world unchanged when there are no custom players", () => {
    const plain = makeRecipe(SMALL, systems);
    const r = simulateRecipe(plain);
    const world = generateWorld(SMALL);
    expect(r.world.events).toBe(world.events.length);
    expect(r.world.players).toBe(world.players.length);
  });

  it("plays custom players as defined and reports their history per system", () => {
    expect(result.systems.map((s) => s.label)).toEqual(["GlassRank v1", "Plain Elo"]);
    for (const system of result.systems) {
      expect(system.customPlayers.map((p) => [p.id, p.label])).toEqual([["c-01", "Fast climber"], ["c-02", "Back from injury"]]);
    }
    const [climber, returner] = result.systems[0]!.customPlayers;
    // The climber's true skill rises; the returner plays nothing during the layoff (weeks 4-11).
    expect(climber!.points.at(-1)!.trueSkill).toBeGreaterThan(climber!.points[0]!.trueSkill + 0.3);
    const away = returner!.points.filter((p) => p.date >= "2026-02-02" && p.date < "2026-03-30");
    expect(away).toEqual([]);
    expect(returner!.points.length).toBeGreaterThan(3);
    expect(returner!.points[0]!.ratingBefore).toBe(GLASSRANK.seeding.defaultRating);
  });

  it("rejects recipes that break the rules, with paths", () => {
    const bad = (patch: object) => {
      const r = parse(SimulationRecipe, { ...recipe, ...patch });
      return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
    };
    expect(bad({ startDate: "2026-01-06" })).toEqual(["/startDate: must be a real date that falls on a Monday"]);
    expect(bad({ recipeVersion: "0.2.0" })).toEqual(["/recipeVersion: recipe version 0.2.0 is not compatible with 0.1.0"]);
    expect(bad({ customPlayers: [{ ...custom[0], homeClub: "club-zzz" }] })).toEqual(["/customPlayers/0: unknown club club-zzz"]);
    expect(bad({ systems: [systems[0], systems[0]] })).toEqual(["/systems/1/label: duplicate label GlassRank v1"]);
    expect(bad({ weeks: 261 })).toEqual(["/weeks: must be <= 260"]);
    const crowded = { ...recipe.community, cohorts: { ...recipe.community.cohorts, steady: { count: 499, baseSkill: [3, 4] } } };
    expect(bad({ community: crowded })[0]).toMatch(/players; the limit is 500/);
    expect(() => simulateRecipe({ ...recipe, seed: -1 })).toThrow(SchemaError);
  });
});
