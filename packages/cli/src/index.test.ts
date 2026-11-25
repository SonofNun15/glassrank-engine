import { describe, expect, it } from "vitest";
import { formatOutput, runCommand, runCommandText } from "./index";

describe("runCommand", () => {
  it("reports versions", () => {
    expect(runCommand("version", null)).toEqual({ exitCode: 0, output: { cliVersion: "0.1.0", engineVersion: "0.1.0", schemaVersion: "0.1.0" } });
  });

  it("returns structured errors with exit code 2 for bad input, JSON, or commands", () => {
    const bad = runCommand("rate", { nope: true });
    expect(bad.exitCode).toBe(2);
    expect(bad.output).toMatchObject({ error: { code: "invalid_input", issues: expect.arrayContaining([{ path: "/nope", message: "unknown property" }]) } });
    expect(runCommandText("predict", "not json")).toMatchObject({ exitCode: 2, output: { error: { code: "invalid_json" } } });
    expect(runCommandText("nope", "")).toMatchObject({ exitCode: 2, output: { error: { code: "unknown_command" } } });
    expect(runCommand("explain", { receipt: {} }).exitCode).toBe(2);
  });

  it("writes canonical JSON by default, so equal results are equal bytes", () => {
    expect(formatOutput({ b: 1, a: [1, 2] })).toBe('{"a":[1,2],"b":1}\n');
    expect(formatOutput({ a: 1 }, true)).toBe('{\n  "a": 1\n}\n');
  });
});
