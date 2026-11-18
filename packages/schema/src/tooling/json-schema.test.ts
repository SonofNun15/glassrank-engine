/**
 * Conformance of the published JSON Schema files, checked with Ajv, an
 * independent JSON Schema validator. This is what a service in another
 * language relies on, so it is tested against the committed files rather than
 * the in-memory definitions.
 *
 * The JSON Schema covers structure only. Rules listed under
 * `x-glassrank-rules` (unique ids, ordering, real dates) are enforced by the
 * TypeScript validator and must be re-implemented by other ports.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse, type Schema } from "./builder";
import { EventInput } from "../models/event";
import { CorrectionOverlay, PolicyConfig } from "../models/policy";
import { Prior } from "../models/rating";
import { Receipt } from "../models/receipt";
import { RateRequest } from "../models/requests";

const pkg = join(import.meta.dirname, "../..");
const load = (dir: string, file: string): any => JSON.parse(readFileSync(join(pkg, dir, file), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addKeyword({ keyword: "x-glassrank-rules", schemaType: "array" });

const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
function ajvValidator(document: string) {
  let validate = compiled.get(document);
  if (validate === undefined) {
    validate = ajv.compile(load("json-schema", `${document}.schema.json`));
    compiled.set(document, validate);
  }
  return validate;
}

const CASES = [
  { file: "event.json", document: "EventInput", schema: EventInput },
  { file: "policy.json", document: "PolicyConfig", schema: PolicyConfig },
  { file: "overlay.json", document: "CorrectionOverlay", schema: CorrectionOverlay },
  { file: "rate-request.json", document: "RateRequest", schema: RateRequest },
  { file: "receipt.json", document: "Receipt", schema: Receipt },
] as const;

describe("published JSON Schema", () => {
  it.each(CASES)("accepts fixtures/$file as $document", ({ file, document }) => {
    const validate = ajvValidator(document);
    const ok = validate(load("fixtures", file));
    expect(validate.errors ?? [], file).toEqual([]);
    expect(ok).toBe(true);
  });

  it("accepts every prior in fixtures/priors.json", () => {
    const validate = ajvValidator("Prior");
    for (const prior of load("fixtures", "priors.json")) {
      expect(validate(prior), JSON.stringify(validate.errors)).toBe(true);
    }
  });
});

/**
 * Structural mutations: both validators must reject each one. A mismatch
 * means the emitted JSON Schema and the TypeScript validator disagree.
 */
type Mutation = { name: string; file: string; document: string; schema: Schema<unknown>; mutate: (v: any) => void };

const MUTATIONS: Mutation[] = [
  { name: "unknown property", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.venueName = "x"; } },
  { name: "missing required property", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { delete e.source; } },
  { name: "format outside enum", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.format = "open_play"; } },
  { name: "source tier outside enum", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.source.tier = "player_reported"; } },
  { name: "three-player team", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches[0].teams[0].push("p-zed"); } },
  { name: "game score with three entries", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches[0].games[0].score = [11, 7, 1]; } },
  { name: "non-integer score", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches[0].games[0].score = [11.5, 7]; } },
  { name: "trust weight above 1", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches[0].trust.weight = 1.5; } },
  { name: "email as player id", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches[0].teams[0][0] = "ava@example.com"; } },
  { name: "timestamp with offset", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.occurredAt = "2026-11-14T14:00:00+00:00"; } },
  { name: "schema version not semver", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.schemaVersion = "v0.1"; } },
  { name: "empty matches", file: "event.json", document: "EventInput", schema: EventInput, mutate: (e) => { e.matches = []; } },
  { name: "unknown evidence model", file: "policy.json", document: "PolicyConfig", schema: PolicyConfig, mutate: (p) => { p.evidence.model = "trueskill"; } },
  { name: "loss multiplier above 1", file: "policy.json", document: "PolicyConfig", schema: PolicyConfig, mutate: (p) => { p.rules.declineDamping.lossMultiplier = 1.2; } },
  { name: "overlay adjusting the decline cap", file: "overlay.json", document: "CorrectionOverlay", schema: CorrectionOverlay, mutate: (o) => { o.adjust.declineCapAmount = 0.5; } },
  { name: "overlay with http rationale", file: "overlay.json", document: "CorrectionOverlay", schema: CorrectionOverlay, mutate: (o) => { o.rationaleUrl = "http://example.org"; } },
  { name: "seed with birth year", file: "rate-request.json", document: "RateRequest", schema: RateRequest, mutate: (r) => { r.priors[2].seed.birthYear = 1970; } },
  { name: "prior with unknown kind", file: "rate-request.json", document: "RateRequest", schema: RateRequest, mutate: (r) => { r.priors[0].kind = "guess"; } },
  { name: "headline with too many reasons", file: "receipt.json", document: "Receipt", schema: Receipt, mutate: (r) => { r.headline.reasons = ["above_expected", "as_expected", "gain_held", "gain_released", "first_event"]; } },
  { name: "rule name outside enum", file: "receipt.json", document: "Receipt", schema: Receipt, mutate: (r) => { r.technical.rules[0].rule = "secret_rule"; } },
];

describe("JSON Schema agrees with the TypeScript validator", () => {
  it.each(MUTATIONS)("both reject: $name", ({ file, document, schema, mutate }) => {
    const value = load("fixtures", file);
    mutate(value);
    expect(parse(schema, value).ok, "TypeScript validator").toBe(false);
    expect(ajvValidator(document)(value), "JSON Schema").toBe(false);
  });

  it("leaves rules listed in x-glassrank-rules to the TypeScript validator", () => {
    const event = load("fixtures", "event.json");
    event.matches[1].matchId = "m1"; // duplicate id: a semantic rule, not structural
    expect(parse(EventInput, event).ok).toBe(false);
    expect(ajvValidator("EventInput")(event)).toBe(true);
    expect(load("json-schema", "EventInput.schema.json")["x-glassrank-rules"]).toContain(
      "matchId values are unique within the event",
    );
  });
});
