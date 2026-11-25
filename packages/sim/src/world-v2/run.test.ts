import { hashCanonical } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { GLASSRANK } from "../policies";
import { DEFAULT_RECIPE_V2 } from "./default-world";
import type { SimulationRecipeV2 } from "./recipe";
import { runWorldV2, scheduleFromDayZero, startingRatings } from "./run";
import { simulateRecipeV2 } from "./simulate";

const schedule = scheduleFromDayZero(GLASSRANK);
const withDays = (durationDays: number): SimulationRecipeV2 => ({ ...DEFAULT_RECIPE_V2, durationDays });

describe("v2 world run", () => {
  it("is deterministic", () => {
    const a = simulateRecipeV2(withDays(140), GLASSRANK);
    const b = simulateRecipeV2(withDays(140), GLASSRANK);
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.world.events).toBeGreaterThan(0);
  });

  it("leaves every full earlier week unchanged when the run gets longer", () => {
    const short = runWorldV2(withDays(120), schedule);
    const long = runWorldV2(withDays(200), schedule);
    const cutoff = Math.floor(120 / 7) * 7;
    const before = (events: typeof short.events) => events.filter((e) => dayOf(e.occurredAt) < cutoff);
    expect(before(long.events).length).toBeGreaterThan(50);
    expect(hashCanonical(before(long.events))).toBe(hashCanonical(before(short.events)));
  });

  it("never seats a player above an event's max when they sign up (weekly sign-up events)", () => {
    const run = runWorldV2(withDays(200), schedule);
    const series = new Map(DEFAULT_RECIPE_V2.events.map((e) => [e.id, e]));
    let checked = 0;
    for (const points of run.history.values()) {
      points.forEach((pt, i) => {
        const s = series.get(pt.series)!;
        if ((s.format.type === "league" && s.format.season !== undefined) || s.range?.max === undefined) return;
        // Players sign up at the start of the week; an earlier event that week can move them after that.
        const weekStart = Math.floor(pt.day / 7) * 7;
        const atSignup = points.slice(0, i).filter((x) => x.day < weekStart).at(-1)?.rating ?? points[0]!.ratingBefore;
        expect(atSignup).toBeLessThanOrEqual(s.range.max);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("changing one hand-made player leaves other clubs' first week alone (leagues only)", () => {
    // Tournaments mix every club, so this checks the leagues-only world.
    const leagues = { ...withDays(14), events: DEFAULT_RECIPE_V2.events.filter((e) => e.format.type === "league") };
    const base = runWorldV2(leagues, schedule);
    const edited = runWorldV2({ ...leagues, players: DEFAULT_RECIPE_V2.players.map((p) => (p.id === "sam" ? { ...p, volatility: 0.3 } : p)) }, schedule);
    const north = (events: typeof base.events) => events.filter((e) => e.source.hostId === "north");
    expect(hashCanonical(north(edited.events))).toBe(hashCanonical(north(base.events)));
    expect(hashCanonical(edited.events)).not.toBe(hashCanonical(base.events));
  });

  it("follows players' ratings toward true skill", () => {
    const run = runWorldV2(DEFAULT_RECIPE_V2, schedule);
    let start = 0;
    let end = 0;
    let n = 0;
    for (const points of run.history.values()) {
      const first = points[0];
      const last = points.at(-1);
      if (first === undefined || last === undefined || points.length < 20) continue;
      start += Math.abs(first.ratingBefore - first.trueSkill);
      end += Math.abs(last.rating - last.trueSkill);
      n++;
    }
    expect(n).toBeGreaterThan(50);
    expect(end / n).toBeLessThan(start / n);
  });
});

const dayOf = (ts: string) => Math.floor((Date.parse(ts) - Date.parse("2001-01-01T00:00:00Z")) / 86_400_000);

describe("starting ratings", () => {
  it("match the seeds a run starts from", () => {
    const run = runWorldV2(withDays(14), schedule);
    const starts = new Map(startingRatings(withDays(14), 3.0).map((s) => [s.id, s.rating]));
    expect(starts.size).toBe(run.players.length);
    for (const p of run.players) expect(starts.get(p.id)).toBe(p.seed.source === "policy_default" ? 3.0 : p.seed.rating);
  });
});
