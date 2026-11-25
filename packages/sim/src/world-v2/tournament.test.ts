import { hashCanonical } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { GLASSRANK } from "../policies";
import { DEFAULT_RECIPE_V2 } from "./default-world";
import type { EventSeries, SimulationRecipeV2 } from "./recipe";
import { runWorldV2, scheduleFromDayZero } from "./run";
import { gameWinChance, matchWinChance, seedOrder } from "./tournament";

const schedule = scheduleFromDayZero(GLASSRANK);

/** The default world plus a quarterly Saturday tournament in three divisions. */
function withTournaments(durationDays = 364, extra: Partial<SimulationRecipeV2> = {}): SimulationRecipeV2 {
  const division = (id: string, label: string, range: EventSeries["range"], structure: "pools" | "pools_then_bracket" | "double_elimination"): EventSeries => ({
    id,
    label,
    club: "east",
    schedule: { kind: "weekly", weekday: 5, hour: 9, everyWeeks: 13, firstWeek: 6 },
    ...(range === undefined ? {} : { range }),
    capacity: 16,
    format: { type: "tournament", structure },
  });
  return {
    ...DEFAULT_RECIPE_V2,
    durationDays,
    events: [
      // The default world's leagues only: its own tournament would share these weeks.
      ...DEFAULT_RECIPE_V2.events.filter((e) => e.format.type === "league"),
      division("open-30", "3.0 and under", { max: 3.0 }, "pools"),
      division("open-35", "3.5 and under", { max: 3.5 }, "pools_then_bracket"),
      division("open-up", "3.5 and up", { min: 3.5 }, "double_elimination"),
    ],
    ...extra,
  };
}

describe("tournament helpers", () => {
  it("seeds brackets in standard order", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("reads game and match win chances off the rally model", () => {
    expect(gameWinChance(0)).toBe(0.5);
    expect(gameWinChance(0.25)).toBeCloseTo(0.67, 12);
    expect(gameWinChance(-0.5)).toBeCloseTo(0.17, 12);
    expect(matchWinChance(0.67, 1)).toBe(0.67);
    expect(matchWinChance(0.67, 3)).toBeGreaterThan(0.67);
  });
});

describe("tournaments in a world", () => {
  const recipe = withTournaments();
  const run = runWorldV2(recipe, schedule);
  const tournaments = run.events.filter((e) => e.format === "tournament");
  const series = new Map(recipe.events.map((e) => [e.id, e]));

  it("run every quarter, in each division", () => {
    expect(tournaments.length).toBeGreaterThanOrEqual(9);
    expect(new Set(tournaments.map((e) => e.eventId.split(".")[0]))).toEqual(new Set(["open-30", "open-35", "open-up"]));
  });

  it("keep partners fixed within an event", () => {
    for (const e of tournaments) {
      const partnerOf = new Map<string, string>();
      for (const m of e.matches) {
        for (const team of m.teams) {
          expect(team).toHaveLength(2);
          const [a, b] = team as [string, string];
          expect(partnerOf.get(a) ?? b).toBe(b);
          expect(partnerOf.get(b) ?? a).toBe(a);
          partnerOf.set(a, b);
          partnerOf.set(b, a);
        }
      }
    }
  });

  it("play the structure each division asks for", () => {
    const prefixes = (id: string) => new Set(tournaments.filter((e) => e.eventId.startsWith(`${id}.`)).flatMap((e) => e.matches.map((m) => m.matchId.replace(/\d.*$/, ""))));
    expect(prefixes("open-30")).toEqual(new Set(["p"]));
    expect(prefixes("open-35")).toEqual(new Set(["p", "b"]));
    expect(prefixes("open-up")).toEqual(new Set(["m", "d", "final"]));
  });

  it("only seat teams whose players are both eligible when they sign up", () => {
    let checked = 0;
    for (const points of run.history.values()) {
      points.forEach((pt, i) => {
        const max = series.get(pt.series)?.range?.max;
        if (series.get(pt.series)?.format.type !== "tournament" || max === undefined) return;
        // Players sign up at the start of the week, so a league night earlier that week doesn't count.
        const weekStart = Math.floor(pt.day / 7) * 7;
        const earlier = points.slice(0, i).filter((x) => x.day < weekStart);
        const atSignup = earlier.at(-1)?.rating ?? points[0]!.ratingBefore;
        expect(atSignup).toBeLessThanOrEqual(max);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("partnerships carry over between tournaments, and some change", () => {
    const teamsByEvent = tournaments.map((e) => new Set(e.matches.flatMap((m) => m.teams.map((t) => [...t].sort().join("+")))));
    const seen = new Map<string, number>();
    for (const teams of teamsByEvent) for (const t of teams) seen.set(t, (seen.get(t) ?? 0) + 1);
    const repeated = [...seen.values()].filter((n) => n > 1).length;
    expect(repeated).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThan(repeated);
  });

  it("a fixed partner is always the partner", () => {
    const players = recipe.players.map((p) => (p.id === "rosa" ? { ...p, partner: "sam", tournaments: 1 } : p.id === "sam" ? { ...p, partner: "rosa" } : p));
    const r = runWorldV2(withTournaments(364, { players }), schedule);
    let together = 0;
    for (const e of r.events.filter((x) => x.format === "tournament")) {
      for (const m of e.matches) {
        for (const t of m.teams) {
          if (t.includes("p.rosa")) {
            expect(t).toContain("p.sam");
            together++;
          }
        }
      }
    }
    expect(together).toBeGreaterThan(0);
  });

  it("is deterministic, and lengthening the run keeps earlier weeks", () => {
    const again = runWorldV2(recipe, schedule);
    expect(hashCanonical(again.events)).toBe(hashCanonical(run.events));
    const short = runWorldV2(withTournaments(200), schedule);
    const cutoff = Math.floor(200 / 7) * 7;
    const day = (ts: string) => Math.floor((Date.parse(ts) - Date.parse("2001-01-01T00:00:00Z")) / 86_400_000);
    const before = (events: typeof run.events) => events.filter((e) => day(e.occurredAt) < cutoff);
    expect(before(run.events).some((e) => e.format === "tournament")).toBe(true);
    expect(hashCanonical(before(short.events))).toBe(hashCanonical(before(run.events)));
  });
});
