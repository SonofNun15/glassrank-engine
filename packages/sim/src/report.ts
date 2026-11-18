/** Plain-text comparison table for one or more reports. */
import type { Report } from "./metrics";
import { COHORTS } from "./scenario";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "never");
const signed = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(3)}`;

export function formatReports(reports: readonly Report[]): string {
  const rows: [string, ...string[]][] = [];
  const add = (label: string, cell: (r: Report) => string) => rows.push([label, ...reports.map(cell)]);
  const section = (label: string) => rows.push([label, ...reports.map(() => "")]);

  section("Prediction (lower is better)");
  add("  log loss, all games", (r) => f(r.calibration.logLoss, 4));
  add("  log loss, established players", (r) => f(r.calibration.establishedLogLoss, 4));
  add("  Brier score", (r) => f(r.calibration.brier, 4));
  section("Bias by cohort (rating - true; - is rated too low)");
  for (const c of COHORTS) add(`  ${c}`, (r) => signed(r.cohorts[c].bias));
  add("  returners, first 3 events back", (r) => signed(r.returners.bias));
  section("Error (RMSE)");
  for (const c of COHORTS) add(`  ${c}`, (r) => f(r.cohorts[c].rmse));
  add("  everyone", (r) => f(r.overall.rmse));
  section("Bad seeds (off by 0.5+)");
  add("  players", (r) => String(r.seeds.badSeeds));
  add("  median events to within 0.25", (r) => f(r.seeds.medianEventsToConverge, 1));
  add("  converged within 10 events", (r) => String(r.seeds.convergedWithin10));
  section("Inflating host (bias)");
  add("  favored players", (r) => signed(r.inflation.favored.bias));
  add("  their clubmates", (r) => signed(r.inflation.clubmates.bias));
  section("Scale drift (mean rating - true)");
  const quarters = reports[0]?.driftByQuarter.length ?? 0;
  for (const q of [3, 7, 11].filter((q) => q < quarters)) add(`  end of year ${Math.floor(q / 4) + 1}`, (r) => signed(r.driftByQuarter[q] ?? 0));
  section("Player experience");
  add("  share of events with a drop", (r) => f(r.experience.dropShare));
  add("  mean drop", (r) => f(r.experience.meanDrop));
  add("  largest single drop", (r) => f(r.experience.largestDrop));

  const header: [string, ...string[]] = ["", ...reports.map((r) => r.name)];
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((row) => (row[i] ?? "").length)));
  return all
    .map((row) => row.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!))).join("   "))
    .join("\n");
}
