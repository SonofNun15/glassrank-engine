import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, isCompatibleSchemaVersion } from "./primitives";

describe("schema version", () => {
  it("is 0.1.0", () => {
    expect(SCHEMA_VERSION).toBe("0.1.0");
  });

  it("accepts any patch of the same 0.x minor and rejects other minors and majors", () => {
    expect(isCompatibleSchemaVersion("0.1.0")).toBe(true);
    expect(isCompatibleSchemaVersion("0.1.7")).toBe(true);
    expect(isCompatibleSchemaVersion("0.2.0")).toBe(false);
    expect(isCompatibleSchemaVersion("1.1.0")).toBe(false);
    expect(isCompatibleSchemaVersion("0.1")).toBe(false);
    expect(isCompatibleSchemaVersion("00.1.0")).toBe(false);
  });
});
