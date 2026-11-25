/**
 * @glassrank/sim
 *
 * Synthetic players with hidden "true skill" trajectories and clubs running
 * weekly round robins, producing schema-valid seeds and events. Metrics that
 * score the engine against ground truth arrive in milestone 3.
 */
import { ENGINE_VERSION } from "@glassrank/engine";

export const SIM_TARGET_ENGINE_VERSION = ENGINE_VERSION;

export { Rng } from "./rng";
export { COHORTS, DEFAULT_SCENARIO } from "./scenario";
export type { ClubSpec, Cohort, CohortSpec, Range, Scenario } from "./scenario";
export { SKILL_MAX, SKILL_MIN, isActive, trueSkill } from "./players";
export type { SimPlayer } from "./players";
export { playSideOutGame, rallyWinProbability } from "./scores";
export type { GameRules } from "./scores";
export { generateWorld, scenarioStartMs, trueSkillAt } from "./world";
export type { ManipulatedGame, SimWorld } from "./world";
export { runWorld } from "./harness";
export type { GameRecord, PlayerEventRecord, RunResult } from "./harness";
export { computeReport } from "./metrics";
export type { ErrorStats, Report } from "./metrics";
export { formatReports } from "./report";
export { compareSystems } from "./compare";
export { ELO_BASELINE, EVIDENCE_ONLY, GLASSRANK, GLASSRANK_RULES, NEUTRAL_RULES, correctionOverlay, scheduleOf } from "./policies";
export { COMMUNITY_MIXES } from "./mixes";
export { keyMetrics, runSeeds, summarize } from "./sweep";
export type { KeyMetrics, Summary } from "./sweep";
export { EVIDENCE_KNOBS, RULE_KNOBS, predictionObjective, trackingObjective, tune } from "./tune";
export type { Knob, Objective, TuneStep } from "./tune";
export { Community, CustomPlayer, RECIPE_LIMITS, RECIPE_VERSION, RatingSystem, SIM_VERSION, SimulationRecipe, customPlayers, makeRecipe, recipeScenario } from "./recipe";
export { simulateRecipe, simulateRecipeUnchecked } from "./simulate";
export type { CustomPlayerResult, PlayerPoint, SimulationResult, SystemResult } from "./simulate";
export type { CohortName } from "./scenario";
export type { ExtraPlayers } from "./world";
export * from "./world-v2";
