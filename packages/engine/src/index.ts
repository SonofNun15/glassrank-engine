/**
 * @glassrank/engine
 *
 * Pure and deterministic: no I/O, no clock, no randomness. Given prior rating
 * states, an event, and a policy config, it returns new states plus receipts
 * that explain every change. Placeholder until the engine is implemented.
 */
import { SCHEMA_VERSION } from "@glassrank/schema";

export const ENGINE_VERSION = "0.0.0" as const;
export const SUPPORTED_SCHEMA_VERSION = SCHEMA_VERSION;
