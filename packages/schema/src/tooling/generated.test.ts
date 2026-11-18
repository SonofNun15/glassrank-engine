/**
 * Generated files, kept in sync with their sources by file snapshots.
 *
 * Each test builds the file's expected contents from source and compares them
 * with the committed file. When a source changes, run `pnpm generate` (vitest
 * with `--update`) to rewrite the committed files, then review the diff.
 *
 * Sources:
 *   - JSON Schema files come from the model definitions in `src/models/`.
 *   - `fixtures/rate-request.json` is assembled from the hand-written
 *     `priors.json`, `event.json`, and `policy.json`.
 *   - `fixtures/receipt.json` is hand-written except `provenance.inputHash`
 *     and `provenance.policyHash`, which are computed here.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../models/primitives";
import { hashCanonical } from "./canonical";
import { jsonSchemaDocuments } from "./documents";

const pkg = join(import.meta.dirname, "../..");
const read = (file: string): any => JSON.parse(readFileSync(join(pkg, "fixtures", file), "utf8"));
const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe("JSON Schema files", () => {
  const docs = jsonSchemaDocuments();

  it("has exactly one file per published document", () => {
    const onDisk = readdirSync(join(pkg, "json-schema")).filter((f) => f.endsWith(".schema.json")).sort();
    expect(onDisk, "delete files for documents that no longer exist").toEqual(Object.keys(docs));
  });

  it.each(Object.keys(docs))("%s matches the model definition", async (name) => {
    await expect(pretty(docs[name])).toMatchFileSnapshot(join(pkg, "json-schema", name));
  });
});

describe("derived fixtures", () => {
  const request = {
    schemaVersion: SCHEMA_VERSION,
    priors: read("priors.json"),
    event: read("event.json"),
    policy: { base: read("policy.json"), overlay: null },
  };

  it("rate-request.json is assembled from priors, event, and policy", async () => {
    await expect(pretty(request)).toMatchFileSnapshot(join(pkg, "fixtures", "rate-request.json"));
  });

  it("receipt.json carries the true input and policy hashes", async () => {
    const receipt = read("receipt.json");
    const expected = {
      ...receipt,
      provenance: {
        ...receipt.provenance,
        inputHash: hashCanonical(request),
        policyHash: hashCanonical(request.policy),
      },
    };
    await expect(pretty(expected)).toMatchFileSnapshot(join(pkg, "fixtures", "receipt.json"));
  });
});
