/**
 * Coordinate search over policy parameters. Each pass tries every grid value
 * for one parameter at a time, keeping the best, scored on training seeds.
 * Results are only as good as the simulated world they were tuned on.
 */
import type { PolicyConfig } from "@glassrank/schema";
import type { Report } from "./metrics";
import type { Scenario } from "./scenario";
import { keyMetrics, runSeeds } from "./sweep";

export interface Knob {
  readonly name: string;
  readonly values: readonly number[];
  readonly get: (p: PolicyConfig) => number;
  readonly set: (p: PolicyConfig, v: number) => PolicyConfig;
}

export type Objective = (reports: readonly Report[]) => number;

export interface TuneStep {
  readonly knob: string;
  readonly value: number;
  readonly score: number;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Prediction quality only: mean log loss. */
export const predictionObjective: Objective = (reports) => mean(reports.map((r) => r.calibration.logLoss));

/** Tracking: error, plus average drift of the whole scale, plus half the improvers' lag. */
export const trackingObjective: Objective = (reports) =>
  mean(
    reports.map((r) => {
      const k = keyMetrics(r);
      return k.rmse + k.meanAbsDrift + 0.5 * Math.abs(k.improverBias);
    }),
  );

export function tune(
  scenario: Scenario,
  start: PolicyConfig,
  knobs: readonly Knob[],
  objective: Objective,
  seeds: readonly number[],
  passes = 2,
  log: (line: string) => void = () => {},
): { policy: PolicyConfig; score: number; steps: TuneStep[] } {
  const cache = new Map<string, number>();
  const score = (p: PolicyConfig) => {
    const key = JSON.stringify(knobs.map((k) => k.get(p)));
    let s = cache.get(key);
    if (s === undefined) {
      s = objective(runSeeds(scenario, p, seeds));
      cache.set(key, s);
    }
    return s;
  };
  let best = start;
  let bestScore = score(start);
  const steps: TuneStep[] = [];
  log(`start ${bestScore.toFixed(5)}`);
  for (let pass = 0; pass < passes; pass++) {
    for (const knob of knobs) {
      for (const v of knob.values) {
        const candidate = knob.set(best, v);
        const s = score(candidate);
        if (s < bestScore - 1e-6) {
          best = candidate;
          bestScore = s;
          steps.push({ knob: knob.name, value: v, score: s });
          log(`pass ${pass + 1}: ${knob.name} = ${v} -> ${s.toFixed(5)}`);
        }
      }
    }
  }
  return { policy: best, score: bestScore, steps };
}

const evidence = (p: PolicyConfig) => {
  if (p.evidence.model !== "bayes_v0") throw new Error("evidence knobs need bayes_v0");
  return p.evidence;
};
const setEvidence = (p: PolicyConfig, patch: object): PolicyConfig => ({ ...p, evidence: { ...evidence(p), ...patch } });
const setRules = (p: PolicyConfig, patch: Partial<PolicyConfig["rules"]>): PolicyConfig => ({ ...p, rules: { ...p.rules, ...patch } });

export const EVIDENCE_KNOBS: readonly Knob[] = [
  { name: "winScale", values: [2.4, 2.8, 3.2, 3.6, 4.0], get: (p) => evidence(p).winScale, set: (p, v) => setEvidence(p, { winScale: v }) },
  { name: "shareScale", values: [0.6, 0.8, 1.0, 1.3, 1.6], get: (p) => evidence(p).shareScale, set: (p, v) => setEvidence(p, { shareScale: v }) },
  { name: "marginWeight", values: [0.2, 0.35, 0.5, 0.65, 0.8], get: (p) => evidence(p).marginWeight, set: (p, v) => setEvidence(p, { marginWeight: v }) },
  { name: "dynamicsSigma", values: [0.02, 0.035, 0.05, 0.07, 0.1], get: (p) => evidence(p).dynamicsSigma, set: (p, v) => setEvidence(p, { dynamicsSigma: v }) },
];

/** Rule knobs, limited to values that keep declines gentle. */
export const RULE_KNOBS: readonly Knob[] = [
  { name: "gainMultiplier", values: [1.0, 1.1, 1.2, 1.35, 1.5], get: (p) => p.rules.upwardBias.gainMultiplier, set: (p, v) => setRules(p, { upwardBias: { gainMultiplier: v } }) },
  { name: "lossMultiplier", values: [0.4, 0.5, 0.6, 0.7, 0.8], get: (p) => p.rules.declineDamping.lossMultiplier, set: (p, v) => setRules(p, { declineDamping: { lossMultiplier: v } }) },
  { name: "declineCap", values: [0.1, 0.15, 0.2, 0.25], get: (p) => p.rules.declineCap.amount, set: (p, v) => setRules(p, { declineCap: { ...p.rules.declineCap, amount: v } }) },
  { name: "provisionalEvents", values: [5, 8, 12], get: (p) => p.rules.provisionalPeriod.events, set: (p, v) => setRules(p, { provisionalPeriod: { ...p.rules.provisionalPeriod, events: v } }) },
  { name: "largeGainThreshold", values: [0.2, 0.3, 0.45], get: (p) => p.rules.largeGain.perEventThreshold, set: (p, v) => setRules(p, { largeGain: { ...p.rules.largeGain, perEventThreshold: v } }) },
];
