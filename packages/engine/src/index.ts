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
