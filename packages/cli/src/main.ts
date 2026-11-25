#!/usr/bin/env node
/**
 * glassrank <command> [input.json] [--pretty]
 *
 * Reads a JSON request from the file, or from stdin if no file is given, and
 * writes the JSON response to stdout. Output is canonical JSON (RFC 8785), so
 * identical requests give byte-identical responses; --pretty indents it.
 *
 * Exit codes: 0 success, 1 internal error, 2 invalid input or usage.
 */
import { readFileSync } from "node:fs";
import { COMMANDS, formatOutput, runCommandText } from "./index";

const args = process.argv.slice(2);
const pretty = args.includes("--pretty");
const [command, file] = args.filter((a) => a !== "--pretty");

if (command === undefined || command === "--help" || command === "-h") {
  process.stderr.write(`usage: glassrank <${COMMANDS.join("|")}> [input.json] [--pretty]\n`);
  process.exit(command === undefined ? 2 : 0);
}

const needsInput = command !== "version" && (COMMANDS as readonly string[]).includes(command);
const text = needsInput ? readFileSync(file ?? 0, "utf8") : "";
const result = runCommandText(command, text);
process.stdout.write(formatOutput(result.output, pretty));
process.exitCode = result.exitCode;
