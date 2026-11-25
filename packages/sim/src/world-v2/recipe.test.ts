import { parse } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { DEFAULT_RECIPE_V2 } from "./default-world";
import { SimulationRecipeV2, type SimulationRecipeV2 as Recipe } from "./recipe";

const issues = (r: unknown) => {
  const res = parse(SimulationRecipeV2, r);
  return res.ok ? [] : res.issues.map((i) => `${i.path}: ${i.message}`);
};
const clone = (): Recipe => JSON.parse(JSON.stringify(DEFAULT_RECIPE_V2)) as Recipe;

describe("recipe v0.2", () => {
  it("accepts the default world", () => {
    expect(issues(DEFAULT_RECIPE_V2)).toEqual([]);
  });

  it("rejects duplicate ids and unknown clubs", () => {
    const r = clone();
    const events = [...r.events, { ...r.events[0]!, club: "nowhere", onlyFrom: ["also-nowhere"] }];
    const out = issues({ ...r, events });
    expect(out.some((m) => m.includes("duplicate id north-30"))).toBe(true);
    expect(out.some((m) => m.includes("unknown club nowhere"))).toBe(true);
    expect(out.some((m) => m.includes("unknown club also-nowhere"))).toBe(true);
  });

  it("limits total players", () => {
    const r = clone();
    const out = issues({ ...r, groups: [{ ...r.groups[0]!, count: 500 }, ...r.groups.slice(1)] });
    expect(out.some((m) => m.includes("the limit is 500"))).toBe(true);
  });

  it("requires keyframes in day order within the run", () => {
    const r = clone();
    const p = { ...r.players[0]!, skill: { preset: "keyframes" as const, keyframes: [[0, 3], [0, 3.2], [400, 3.5]] as [number, number][] } };
    const out = issues({ ...r, players: [p] });
    expect(out.some((m) => m.includes("days must increase"))).toBe(true);
    expect(out.some((m) => m.includes("after the end of the run"))).toBe(true);
  });

  it("checks ranges, play-up margins, scoring, and version", () => {
    const r = clone();
    const base = r.events[0]!;
    const has = (recipe: unknown, text: string) => issues(recipe).some((m) => m.includes(text));
    expect(has({ ...r, events: [{ ...base, range: { min: 4, max: 3 } }] }, "min must not exceed max")).toBe(true);
    expect(has({ ...r, events: [{ ...base, playUp: "margin" }] }, "required when playUp is margin")).toBe(true);
    expect(has({ ...r, events: [{ ...base, scoring: { games: 2, to: 11, winBy: 2 } }] }, "must be odd")).toBe(true);
    expect(has({ ...r, recipeVersion: "0.1.0" }, "not compatible")).toBe(true);
  });
});
