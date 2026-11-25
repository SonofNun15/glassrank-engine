/**
 * @glassrank/cli
 *
 * `runCommand(command, input)` is the whole CLI without I/O: JSON in, JSON
 * out, plus an exit code. `glassrank` (src/main.ts) wraps it with stdin,
 * stdout, and process exit codes.
 */
import {
  ENGINE_VERSION,
  explainReceipt,
  forecast,
  predict,
  rate,
  replay,
  verify,
} from "@glassrank/engine";
import { Receipt, SCHEMA_VERSION, SchemaError, assertValid, canonicalJson, type Issue } from "@glassrank/schema";

export const CLI_VERSION = "0.1.0" as const;

export const COMMANDS = ["rate", "predict", "forecast", "replay", "verify", "explain", "version"] as const;
export type Command = (typeof COMMANDS)[number];

/** 0 success; 1 internal error (a bug); 2 bad input or usage. */
export type ExitCode = 0 | 1 | 2;

export interface CliResult {
  readonly exitCode: ExitCode;
  /** The JSON document to write to stdout. */
  readonly output: unknown;
}

export interface CliError {
  readonly error: {
    readonly code: "invalid_input" | "invalid_json" | "unknown_command" | "internal_error";
    readonly message: string;
    readonly issues?: readonly Issue[];
  };
}

const fail = (exitCode: ExitCode, code: CliError["error"]["code"], message: string, issues?: readonly Issue[]): CliResult => ({
  exitCode,
  output: { error: { code, message, ...(issues === undefined ? {} : { issues }) } } satisfies CliError,
});

function explain(input: unknown) {
  const o = (typeof input === "object" && input !== null ? input : {}) as { receipt?: unknown; eventLabel?: unknown };
  const receipt = assertValid(Receipt, o.receipt);
  if (o.eventLabel !== undefined && typeof o.eventLabel !== "string") {
    throw new SchemaError([{ path: "/eventLabel", message: "expected string" }]);
  }
  return explainReceipt(receipt, o.eventLabel === undefined ? {} : { eventLabel: o.eventLabel });
}

/** Run one command on a parsed JSON input. Never throws. */
export function runCommand(command: string, input: unknown): CliResult {
  try {
    switch (command) {
      case "rate":
        return { exitCode: 0, output: rate(input) };
      case "predict":
        return { exitCode: 0, output: predict(input) };
      case "forecast":
        return { exitCode: 0, output: forecast(input) };
      case "replay":
        return { exitCode: 0, output: replay(input) };
      case "verify":
        return { exitCode: 0, output: verify(input) };
      case "explain":
        return { exitCode: 0, output: explain(input) };
      case "version":
        return { exitCode: 0, output: { cliVersion: CLI_VERSION, engineVersion: ENGINE_VERSION, schemaVersion: SCHEMA_VERSION } };
      default:
        return fail(2, "unknown_command", `unknown command "${command}"; expected one of ${COMMANDS.join(", ")}`);
    }
  } catch (err) {
    if (err instanceof SchemaError) return fail(2, "invalid_input", "input does not match the schema", err.issues);
    return fail(1, "internal_error", err instanceof Error ? err.message : String(err));
  }
}

/** Parse JSON text and run a command; invalid JSON is a usage error. */
export function runCommandText(command: string, text: string): CliResult {
  if (command === "version" || !(COMMANDS as readonly string[]).includes(command)) return runCommand(command, null);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (err) {
    return fail(2, "invalid_json", `input is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return runCommand(command, input);
}

/** Canonical JSON (RFC 8785) plus a newline: byte-stable output for comparisons. */
export function formatOutput(output: unknown, pretty = false): string {
  return `${pretty ? JSON.stringify(output, null, 2) : canonicalJson(output)}\n`;
}
