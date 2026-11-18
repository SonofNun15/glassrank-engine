/**
 * The standard comparison: one world, four rating systems.
 */
import { MS_PER_DAY, formatTimestamp } from "@glassrank/schema";
import { runWorld } from "./harness";
import { computeReport, type Report } from "./metrics";
import { ELO_BASELINE, EVIDENCE_ONLY, GLASSRANK, correctionOverlay, scheduleOf } from "./policies";
import type { Scenario } from "./scenario";
import { generateWorld, scenarioStartMs } from "./world";

export function compareSystems(scenario: Scenario): Report[] {
  const world = generateWorld(scenario);
  const startMs = scenarioStartMs(scenario);
  const from = formatTimestamp(startMs);
  const at = (week: number) => formatTimestamp(startMs + week * 7 * MS_PER_DAY);
  const totalDays = scenario.weeks * 7;
  const dial = correctionOverlay(at(44), at(52), at(104));
  const runs = [
    runWorld("elo baseline", world, scheduleOf(ELO_BASELINE, from)),
    runWorld("evidence only", world, scheduleOf(EVIDENCE_ONLY, from)),
    runWorld("glassrank", world, scheduleOf(GLASSRANK, from)),
    runWorld("glassrank + dial (yr 2)", world, scheduleOf(GLASSRANK, from, [dial])),
  ];
  return runs.map((r) => computeReport(r, totalDays));
}
