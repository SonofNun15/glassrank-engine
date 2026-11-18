/**
 * Metrics that score a rating system against the simulator's hidden truth.
 *
 * Signed errors are rating minus true skill: negative means rated too low
 * (an improver left behind), positive means rated too high (inflation, or a
 * protected decline).
 */
import type { GameRecord, PlayerEventRecord, RunResult } from "./harness";
import { COHORTS, type Cohort } from "./scenario";

export interface ErrorStats {
  readonly n: number;
  /** Mean of (rating - true skill). */
  readonly bias: number;
  /** Root mean squared error. */
  readonly rmse: number;
}

export interface Report {
  readonly name: string;
  readonly calibration: {
    readonly games: number;
    /** Mean negative log-likelihood of the reported winner; 0.693 is a coin flip. */
    readonly logLoss: number;
    readonly brier: number;
    /** Same, only games where every player had five or more prior events. */
    readonly establishedLogLoss: number;
  };
  /** Error at every rated appearance in the final two thirds of the run, by cohort. */
  readonly cohorts: { readonly [C in Cohort]: ErrorStats };
  readonly overall: ErrorStats;
  readonly seeds: {
    /** Players whose starting rating was off by at least 0.5. */
    readonly badSeeds: number;
    /** Median events until within 0.25 of true skill (Infinity if never). */
    readonly medianEventsToConverge: number;
    readonly convergedWithin10: number;
  };
  /** Mean (rating - true) across all appearances, per 13-week quarter. */
  readonly driftByQuarter: readonly number[];
  readonly returners: ErrorStats;
  readonly inflation: { readonly favored: ErrorStats; readonly clubmates: ErrorStats };
  readonly experience: {
    /** Share of rated appearances where the displayed rating went down. */
    readonly dropShare: number;
    readonly meanDrop: number;
    readonly largestDrop: number;
  };
}

const round = (x: number, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

function errorStats(rows: readonly PlayerEventRecord[]): ErrorStats {
  if (rows.length === 0) return { n: 0, bias: 0, rmse: 0 };
  let sum = 0;
  let sq = 0;
  for (const r of rows) {
    const e = r.ratingAfter - r.trueSkill;
    sum += e;
    sq += e * e;
  }
  return { n: rows.length, bias: round(sum / rows.length), rmse: round(Math.sqrt(sq / rows.length)) };
}

function calibration(games: readonly GameRecord[], keep: (g: GameRecord) => boolean) {
  let ll = 0;
  let brier = 0;
  let n = 0;
  for (const g of games) {
    if (!keep(g)) continue;
    const p = Math.min(1 - 1e-6, Math.max(1e-6, g.predicted));
    ll -= g.outcome * Math.log(p) + (1 - g.outcome) * Math.log(1 - p);
    brier += (p - g.outcome) ** 2;
    n++;
  }
  return { n, logLoss: n === 0 ? 0 : ll / n, brier: n === 0 ? 0 : brier / n };
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function computeReport(run: RunResult, totalDays: number): Report {
  const pe = run.playerEvents;

  const all = calibration(run.games, () => true);
  const established = calibration(run.games, (g) => g.established);

  // Tracking error after the first third, when every system has had time to settle.
  const settled = pe.filter((r) => r.day >= totalDays / 3);
  const cohorts = Object.fromEntries(COHORTS.map((c) => [c, errorStats(settled.filter((r) => r.cohort === c))])) as Report["cohorts"];

  // Bad seeds: first-event rating (the seed) far from truth; events until within 0.25.
  const byPlayer = new Map<string, PlayerEventRecord[]>();
  for (const r of pe) {
    if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
    byPlayer.get(r.playerId)!.push(r);
  }
  const toConverge: number[] = [];
  for (const rows of byPlayer.values()) {
    const first = rows[0]!;
    if (Math.abs(first.ratingBefore - first.trueSkill) < 0.5) continue;
    const hit = rows.findIndex((r) => Math.abs(r.ratingAfter - r.trueSkill) < 0.25);
    toConverge.push(hit === -1 ? Number.POSITIVE_INFINITY : hit + 1);
  }

  // Drift per quarter.
  const quarters = Math.ceil(totalDays / 91);
  const driftByQuarter = Array.from({ length: quarters }, (_, q) => {
    const rows = pe.filter((r) => Math.floor(r.day / 91) === q);
    return rows.length === 0 ? 0 : round(rows.reduce((s, r) => s + r.ratingAfter - r.trueSkill, 0) / rows.length);
  });

  // Returners: first three events after a break of 60+ days.
  const returnerRows: PlayerEventRecord[] = [];
  for (const rows of byPlayer.values()) {
    rows.forEach((r, i) => {
      if (r.cohort !== "returner") return;
      const back = rows.slice(0, i + 1).reverse().findIndex((x) => x.daysAway >= 60);
      if (back !== -1 && back < 3) returnerRows.push(r);
    });
  }

  // Inflating host: favored players vs. their non-favored clubmates.
  const favoredClubs = new Set(pe.filter((r) => r.favored).map((r) => r.homeClub));
  const inflation = {
    favored: errorStats(settled.filter((r) => r.favored)),
    clubmates: errorStats(settled.filter((r) => !r.favored && favoredClubs.has(r.homeClub))),
  };

  const changes = pe.map((r) => r.ratingAfter - r.ratingBefore);
  const drops = changes.filter((d) => d < -1e-9);
  return {
    name: run.name,
    calibration: {
      games: all.n,
      logLoss: round(all.logLoss),
      brier: round(all.brier),
      establishedLogLoss: round(established.logLoss),
    },
    cohorts,
    overall: errorStats(settled),
    seeds: {
      badSeeds: toConverge.length,
      medianEventsToConverge: median(toConverge),
      convergedWithin10: toConverge.filter((n) => n <= 10).length,
    },
    driftByQuarter,
    returners: errorStats(returnerRows),
    inflation,
    experience: {
      dropShare: round(drops.length / Math.max(1, changes.length)),
      meanDrop: round(drops.length === 0 ? 0 : -drops.reduce((s, d) => s + d, 0) / drops.length),
      largestDrop: round(drops.length === 0 ? 0 : -Math.min(...drops)),
    },
  };
}
