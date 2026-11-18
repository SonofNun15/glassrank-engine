/**
 * Top-level documents that cross a seam, published as standalone JSON Schema
 * files under `packages/schema/json-schema/`.
 */
import type { JsonSchema, Schema } from "./builder";
import { EventInput } from "../models/event";
import { CorrectionOverlay, EffectivePolicy, PolicyConfig, PolicySchedule } from "../models/policy";
import { SCHEMA_VERSION } from "../models/primitives";
import { Prior, RatingState, Seed } from "../models/rating";
import { Receipt } from "../models/receipt";
import {
  ForecastRequest,
  ForecastResponse,
  PredictRequest,
  PredictResponse,
  RateRequest,
  RateResponse,
  ReplayRequest,
  ReplayResponse,
  VerifyRequest,
  VerifyResponse,
} from "../models/requests";

const DOCUMENTS: Readonly<Record<string, Schema<unknown>>> = {
  EventInput,
  Seed,
  RatingState,
  Prior,
  PolicyConfig,
  CorrectionOverlay,
  PolicySchedule,
  EffectivePolicy,
  Receipt,
  RateRequest,
  RateResponse,
  PredictRequest,
  PredictResponse,
  ForecastRequest,
  ForecastResponse,
  ReplayRequest,
  ReplayResponse,
  VerifyRequest,
  VerifyResponse,
};

/** `{ fileName: jsonSchema }` for every top-level document, sorted by name. */
export function jsonSchemaDocuments(): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const name of Object.keys(DOCUMENTS).sort()) {
    out[`${name}.schema.json`] = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `urn:glassrank:schema:${SCHEMA_VERSION}:${name}`,
      title: name,
      ...(DOCUMENTS[name] as Schema<unknown>).json,
    };
  }
  return out;
}
