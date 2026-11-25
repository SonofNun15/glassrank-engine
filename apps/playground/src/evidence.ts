/**
 * Headline numbers for the landing page, read from the simulator's committed
 * golden comparison (packages/sim/golden/default-comparison.json), so the page
 * always matches what `pnpm sim` produces.
 */
import comparison from "../../../packages/sim/golden/default-comparison.json";

interface Row {
  name: string;
  calibration: { logLoss: number };
  overall: { rmse: number };
  cohorts: { fast_improver: { rmse: number } };
}
const rows = comparison as unknown as Row[];
const find = (name: string) => rows.find((r) => r.name === name)!;
const glass = find("glassrank");
const elo = find("elo baseline");

export const EVIDENCE = {
  players: 255,
  seasons: 3,
  closerToTruePct: Math.round((1 - glass.overall.rmse / elo.overall.rmse) * 100),
  logLoss: { glassrank: glass.calibration.logLoss, elo: elo.calibration.logLoss },
  improversCloserPct: Math.round((1 - glass.cohorts.fast_improver.rmse / elo.cohorts.fast_improver.rmse) * 100),
};
