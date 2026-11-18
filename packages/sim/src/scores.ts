/**
 * Game scores generated from true skill, rally by rally, under side-out
 * doubles rules. Margins (11-3 vs. 11-9) emerge from the rally model rather
 * than being drawn separately.
 */
import type { Rng } from "./rng";

/**
 * Probability that side A wins a rally, given team skills on the rating
 * scale. A smooth S-curve built from arithmetic only: 0.5 at equal skill,
 * approaching 0 or 1 for large gaps.
 */
export function rallyWinProbability(skillA: number, skillB: number, k: number): number {
  const x = k * (skillA - skillB);
  return 0.5 + (0.5 * x) / (1 + Math.abs(x));
}

export interface GameRules {
  readonly target: number;
  readonly winBy: number;
}

/** Safety stop for pathological inputs; real games end far sooner. */
const MAX_RALLIES = 2000;

/**
 * Play one side-out doubles game. Only the serving side scores. The game
 * starts at 0-0-2 (the first serving side gets one server); after that each
 * side gets two servers before a side out. Side A serves first.
 *
 * Returns [points for A, points for B].
 */
export function playSideOutGame(pA: number, rules: GameRules, rng: Rng): [number, number] {
  const score: [number, number] = [0, 0];
  let serving: 0 | 1 = 0;
  let server: 1 | 2 = 2;
  for (let rally = 0; rally < MAX_RALLIES; rally++) {
    const aWins = rng.next() < pA;
    const servingWins = (serving === 0) === aWins;
    if (servingWins) {
      score[serving] += 1;
      const s = score[serving];
      const o = score[serving === 0 ? 1 : 0];
      if (s >= rules.target && s - o >= rules.winBy) return score;
    } else if (server === 1) {
      server = 2;
    } else {
      serving = serving === 0 ? 1 : 0;
      server = 1;
    }
  }
  throw new Error("game did not finish; check the rally probability");
}
