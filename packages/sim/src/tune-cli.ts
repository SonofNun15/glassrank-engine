/**
 * `pnpm sim:tune`: tune the evidence layer for prediction, then the rules for
 * tracking, on training seeds; report both on held-out seeds and across
 * community mixes. Progress goes to stderr, the result JSON to stdout.
 */
import { COMMUNITY_MIXES } from "./mixes";
import { GLASSRANK } from "./policies";
import { DEFAULT_SCENARIO } from "./scenario";
import { runSeeds, summarize } from "./sweep";
import { EVIDENCE_KNOBS, RULE_KNOBS, predictionObjective, trackingObjective, tune } from "./tune";

const TRAIN = [1, 2, 3];
const HOLDOUT = [4, 5, 6];
const log = (line: string) => process.stderr.write(`${line}\n`);

log("Tuning evidence layer (prediction)...");
const ev = tune(DEFAULT_SCENARIO, GLASSRANK, EVIDENCE_KNOBS, predictionObjective, TRAIN, 2, log);
log("Tuning rules (tracking, drift, improver lag)...");
const rules = tune(DEFAULT_SCENARIO, ev.policy, RULE_KNOBS, trackingObjective, TRAIN, 2, log);
const tuned = { ...rules.policy, policyId: "sim-glassrank-v1-proposal", title: "Evidence layer with community rules (v1 proposal)" };

log("Held-out seeds and community mixes...");
const holdout = { draft: summarize(runSeeds(DEFAULT_SCENARIO, GLASSRANK, HOLDOUT)), tuned: summarize(runSeeds(DEFAULT_SCENARIO, tuned, HOLDOUT)) };
const mixes = Object.fromEntries(
  Object.entries(COMMUNITY_MIXES).map(([name, scenario]) => {
    log(`  mix ${name}`);
    return [name, { draft: summarize(runSeeds(scenario, GLASSRANK, HOLDOUT)), tuned: summarize(runSeeds(scenario, tuned, HOLDOUT)) }];
  }),
);
process.stdout.write(`${JSON.stringify({ train: TRAIN, holdout: HOLDOUT, evidenceSteps: ev.steps, ruleSteps: rules.steps, tuned, results: { holdout, mixes } }, null, 2)}\n`);
