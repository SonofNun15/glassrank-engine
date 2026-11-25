#!/usr/bin/env node
// Check an implementation against the conformance cases.
//
//   node conformance/check.mjs                      # this repo's CLI (after `pnpm build`)
//   node conformance/check.mjs -- my-port --flag    # any command that takes `<command>` and reads stdin
//
// For each case in cases.json, runs `<impl> <command>` with the case's input on
// stdin and requires the exact expected stdout bytes and exit code.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sep = process.argv.indexOf("--");
const impl = sep === -1 ? ["node", join(here, "..", "packages", "cli", "dist", "main.js")] : process.argv.slice(sep + 1);
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));

let failed = 0;
for (const { command, name, exitCode } of cases) {
  const dir = join(here, "cases", command);
  const input = readFileSync(join(dir, `${name}.input.json`), "utf8");
  const expected = readFileSync(join(dir, `${name}.output.json`), "utf8");
  const run = spawnSync(impl[0], [...impl.slice(1), command], { input, encoding: "utf8" });
  const ok = run.status === exitCode && run.stdout === expected;
  if (!ok) {
    failed++;
    console.log(`FAIL ${command}/${name}: exit ${run.status} (expected ${exitCode})${run.stdout === expected ? "" : ", output differs"}`);
    if (run.stderr) console.log(run.stderr.trim());
  } else {
    console.log(`ok   ${command}/${name}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} cases passed`);
process.exitCode = failed === 0 ? 0 : 1;
