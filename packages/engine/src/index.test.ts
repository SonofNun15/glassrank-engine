import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, SUPPORTED_SCHEMA_VERSION } from "./index";

describe("engine", () => {
  it("exposes engine and schema versions", () => {
    expect(ENGINE_VERSION).toBe("0.0.0");
    expect(SUPPORTED_SCHEMA_VERSION).toBe("0.1.0");
  });
});
