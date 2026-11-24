import { describe, expect, it } from "vitest";
import { COMMUNITY_MIXES } from "./mixes";
import { GLASSRANK } from "./policies";
import { DEFAULT_SCENARIO } from "./scenario";
import { runSeeds, summarize } from "./sweep";
import { RULE_KNOBS, trackingObjective, tune } from "./tune";

const short = { ...DEFAULT_SCENARIO, weeks: 12 };

describe("tuning tools", () => {
  it("summarizes a metric across seeds as mean and sd", () => {
    const s = summarize(runSeeds(short, GLASSRANK, [1, 2]));
    expect(s.logLoss.mean).toBeGreaterThan(0);
    expect(s.logLoss.sd).toBeGreaterThanOrEqual(0);
  });

  it("only moves a knob when the objective improves, and never past its grid", () => {
    const knob = RULE_KNOBS.find((k) => k.name === "gainMultiplier")!;
    const result = tune(short, GLASSRANK, [knob], trackingObjective, [1], 1);
    expect(knob.values).toContain(knob.get(result.policy));
    expect(result.score).toBeLessThanOrEqual(trackingObjective(runSeeds(short, GLASSRANK, [1])) + 1e-12);
  });

  it("defines distinct community mixes", () => {
    expect(Object.keys(COMMUNITY_MIXES)).toEqual(["typical", "growing", "mature", "overclaiming"]);
    expect(COMMUNITY_MIXES["growing"]!.cohorts.new_player.count).toBeGreaterThan(DEFAULT_SCENARIO.cohorts.new_player.count);
  });
});
