import { describe, expect, it } from "vitest";
import { SIM_TARGET_ENGINE_VERSION } from "./index";

describe("sim", () => {
  it("targets the current engine version", () => {
    expect(SIM_TARGET_ENGINE_VERSION).toBe("0.1.0");
  });
});
