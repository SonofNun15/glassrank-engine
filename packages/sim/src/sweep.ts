/**
 * Run a policy over several seeds and summarize each metric as mean and
 * standard deviation, so conclusions do not rest on one random world.
 */
import { formatTimestamp, type PolicyConfig } from "@glassrank/schema";
import { runWorld } from "./harness";
import { computeReport, type Report } from "./metrics";
import { scheduleOf } from "./policies";
import type { Scenario } from "./scenario";
import { generateWorld, scenarioStartMs } from "./world";

export interface Summary {
  readonly mean: number;
  readonly sd: number;
}

/** The headline numbers used for tuning and the published results. */
export interface KeyMetrics {
  readonly logLoss: number;
  readonly rmse: number;
  readonly finalDrift: number;
  readonly meanAbsDrift: number;
  readonly improverBias: number;
  readonly newPlayerBias: number;
  readonly declinerBias: number;
  readonly returnerBias: number;
  readonly favoredBias: number;
  readonly seedMedianEvents: number;
  readonly largestDrop: number;
}

export function keyMetrics(report: Report): KeyMetrics {
  const drift = report.driftByQuarter;
  return {
    logLoss: report.calibration.logLoss,
    rmse: report.overall.rmse,
    finalDrift: drift.at(-1) ?? 0,
    meanAbsDrift: drift.reduce((s, d) => s + Math.abs(d), 0) / Math.max(1, drift.length),
    improverBias: report.cohorts.fast_improver.bias,
    newPlayerBias: report.cohorts.new_player.bias,
    declinerBias: report.cohorts.slow_decliner.bias,
    returnerBias: report.returners.bias,
    favoredBias: report.inflation.favored.bias,
    seedMedianEvents: Number.isFinite(report.seeds.medianEventsToConverge) ? report.seeds.medianEventsToConverge : 999,
    largestDrop: report.experience.largestDrop,
  };
}

/** Run one policy on one scenario under several seeds. */
export function runSeeds(scenario: Scenario, policy: PolicyConfig, seeds: readonly number[]): Report[] {
  return seeds.map((seed) => {
    const s = { ...scenario, seed };
    const world = generateWorld(s);
    const from = formatTimestamp(scenarioStartMs(s));
    return computeReport(runWorld(policy.policyId, world, scheduleOf(policy, from)), s.weeks * 7);
  });
}

export function summarize(reports: readonly Report[]): Record<keyof KeyMetrics, Summary> {
  const rows = reports.map(keyMetrics);
  const keys = Object.keys(rows[0]!) as (keyof KeyMetrics)[];
  return Object.fromEntries(
    keys.map((k) => {
      const xs = rows.map((r) => r[k]);
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, xs.length - 1));
      return [k, { mean: Math.round(mean * 10_000) / 10_000, sd: Math.round(sd * 10_000) / 10_000 }];
    }),
  ) as Record<keyof KeyMetrics, Summary>;
}
