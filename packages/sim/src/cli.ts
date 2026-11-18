/**
 * `pnpm sim`: run the standard comparison on the default world and print it.
 * Pass `--json` for the full reports, or `--seed N` / `--weeks N` to vary the world.
 */
import { compareSystems } from "./compare";
import { formatReports } from "./report";
import { DEFAULT_SCENARIO } from "./scenario";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : Number(args[i + 1]);
};
const scenario = {
  ...DEFAULT_SCENARIO,
  seed: option("--seed") ?? DEFAULT_SCENARIO.seed,
  weeks: option("--weeks") ?? DEFAULT_SCENARIO.weeks,
};
const reports = compareSystems(scenario);
process.stdout.write(args.includes("--json") ? `${JSON.stringify(reports, null, 2)}\n` : `${formatReports(reports)}\n`);
