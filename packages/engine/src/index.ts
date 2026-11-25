/**
 * @glassrank/engine
 *
 * Pure and deterministic: no I/O, no clock, no randomness. Given prior rating
 * states, an event, and a policy, it returns new states plus receipts that
 * explain every change.
 */
import { SCHEMA_VERSION } from "@glassrank/schema";

export { ENGINE_VERSION } from "./version";
export const SUPPORTED_SCHEMA_VERSION = SCHEMA_VERSION;

export { rate, rateUnchecked } from "./rate";
export { predict, predictUnchecked } from "./predict";
export { replay, replayUnchecked } from "./replay";
export { resolvePolicy } from "./policy";
/** Deterministic exp and natural log (identical bits on every JavaScript engine). */
export { exp, log } from "./math";
export { forecast, forecastUnchecked, standardOutcomes } from "./forecast";
export { verify, verifyUnchecked } from "./verify";
export { explainReceipt } from "./explain";
export type { ExplainOptions, Explanation } from "./explain";
