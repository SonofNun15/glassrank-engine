import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { playSideOutGame, rallyWinProbability } from "./scores";

const RULES = { target: 11, winBy: 2 };
const K = 0.32;

function simulate(gap: number, n: number, seed = 1) {
  const rng = new Rng(seed);
  const p = rallyWinProbability(3.5 + gap, 3.5, K);
  let wins = 0;
  let margin = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = playSideOutGame(p, RULES, rng);
    if (a > b) wins++;
    margin += a - b;
  }
  return { winRate: wins / n, avgMargin: margin / n };
}

describe("rallyWinProbability", () => {
  it("is 0.5 at equal skill, symmetric, increasing, and bounded", () => {
    expect(rallyWinProbability(3.5, 3.5, K)).toBe(0.5);
    expect(rallyWinProbability(4, 3.5, K) + rallyWinProbability(3.5, 4, K)).toBeCloseTo(1, 12);
    let prev = 0;
    for (let gap = -6; gap <= 6; gap += 0.5) {
      const p = rallyWinProbability(3.5 + gap, 3.5, K);
      expect(p).toBeGreaterThan(prev);
      expect(p > 0 && p < 1).toBe(true);
      prev = p;
    }
  });
});

describe("playSideOutGame", () => {
  it("always ends in a legal final score", () => {
    const rng = new Rng(2);
    for (const p of [0.2, 0.45, 0.5, 0.55, 0.8]) {
      for (let i = 0; i < 2000; i++) {
        const [a, b] = playSideOutGame(p, RULES, rng);
        const [hi, lo] = a > b ? [a, b] : [b, a];
        expect(hi).toBeGreaterThanOrEqual(11);
        expect(hi - lo).toBeGreaterThanOrEqual(2);
        // Past 11, a game only continues from deuce, so it ends exactly 2 apart.
        if (hi > 11) expect(hi - lo).toBe(2);
      }
    }
  });

  it("is a coin flip at equal skill", () => {
    const { winRate, avgMargin } = simulate(0, 6000);
    expect(winRate).toBeGreaterThan(0.47);
    expect(winRate).toBeLessThan(0.53);
    expect(Math.abs(avgMargin)).toBeLessThan(0.4);
  });

  it("favors the stronger side more, and by more points, as the gap grows", () => {
    const results = [0.25, 0.5, 1.0].map((gap) => simulate(gap, 4000, 3));
    expect(results.map((r) => r.winRate)).toEqual([...results.map((r) => r.winRate)].sort((a, b) => a - b));
    expect(results.map((r) => r.avgMargin)).toEqual([...results.map((r) => r.avgMargin)].sort((a, b) => a - b));
    expect(results[0]!.winRate).toBeGreaterThan(0.6);
    expect(results[2]!.winRate).toBeGreaterThan(0.9);
  });
});
