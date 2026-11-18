import { describe, expect, it } from "vitest";
import { runWorld } from "./harness";
import { computeReport } from "./metrics";
import { ELO_BASELINE, GLASSRANK, scheduleOf } from "./policies";
import { DEFAULT_SCENARIO } from "./scenario";
import { generateWorld } from "./world";

const scenario = { ...DEFAULT_SCENARIO, weeks: 26 };
const world = generateWorld(scenario);
const from = "2026-01-05T00:00:00Z";

describe("runWorld", () => {
  const run = runWorld("glassrank", world, scheduleOf(GLASSRANK, from));

  it("predicts every game and rates every appearance", () => {
    const games = world.events.reduce((n, e) => n + e.matches.reduce((g, m) => g + m.games.length, 0), 0);
    expect(run.games).toHaveLength(games);
    const appearances = world.events.reduce((n, e) => n + new Set(e.matches.flatMap((m) => m.teams.flat())).size, 0);
    expect(run.playerEvents).toHaveLength(appearances);
    for (const g of run.games) expect(g.predicted > 0 && g.predicted < 1).toBe(true);
  });

  it("is deterministic", () => {
    const again = runWorld("glassrank", world, scheduleOf(GLASSRANK, from));
    expect(again.finalStates).toEqual(run.finalStates);
  });

  it("produces a report that beats a coin flip", () => {
    const report = computeReport(run, scenario.weeks * 7);
    expect(report.calibration.logLoss).toBeLessThan(Math.log(2));
    expect(report.overall.n).toBeGreaterThan(0);
    expect(report.driftByQuarter).toHaveLength(2);
  });

  it("after the provisional period, never drops a rating by more than the decline cap", () => {
    const capped = runWorld("glassrank", world, scheduleOf(GLASSRANK, from));
    for (const r of capped.playerEvents.filter((x) => x.eventNumber > GLASSRANK.rules.provisionalPeriod.events)) {
      expect(r.ratingBefore - r.ratingAfter).toBeLessThanOrEqual(GLASSRANK.rules.declineCap.amount + 1e-9);
    }
    const elo = runWorld("elo", world, scheduleOf(ELO_BASELINE, from));
    expect(elo.games.map((g) => g.outcome)).toEqual(capped.games.map((g) => g.outcome));
  });
});
