import { describe, expect, it } from "vitest";
import { rankEntrants, type MatchResult } from "./standings";

const m = (a: string[], b: string[], pa: number, pb: number): MatchResult => ({ sides: [a, b], points: [pa, pb], winner: pa > pb ? 0 : 1 });
const noLot = () => 0;

describe("standings", () => {
  it("ranks by wins first", () => {
    const results = [m(["a"], ["b"], 11, 9), m(["a"], ["c"], 11, 2), m(["b"], ["c"], 11, 5)];
    expect(rankEntrants(["c", "b", "a"], results, noLot)).toEqual(["a", "b", "c"]);
  });

  it("breaks a two-way tie by head-to-head, even against more points", () => {
    const results = [m(["a"], ["b"], 11, 9), m(["b"], ["c"], 11, 0), m(["c"], ["a"], 11, 3)];
    // a, b, c all 1-1; three-way head-to-head is 1 each, so points scored decide: b 20, c 11, a 14.
    expect(rankEntrants(["a", "b", "c"], results, noLot)).toEqual(["b", "a", "c"]);
    const two = [m(["a"], ["b"], 11, 9), m(["b"], ["c"], 11, 0), m(["a"], ["c"], 2, 11), m(["b"], ["d"], 11, 0)];
    // a 1-1, b 2-1, c 1-1: a beat c? no, c beat a, so c ranks above a despite a's points.
    expect(rankEntrants(["a", "c"], two, noLot)).toEqual(["c", "a"]);
  });

  it("then most points scored, then fewest against, then lot", () => {
    const scored = [m(["a"], ["x"], 11, 5), m(["b"], ["y"], 11, 5), m(["a"], ["y"], 3, 11), m(["b"], ["x"], 9, 11)];
    expect(rankEntrants(["a", "b"], scored, noLot)).toEqual(["b", "a"]);
    const against = [m(["a"], ["x"], 11, 9), m(["b"], ["y"], 11, 2)];
    expect(rankEntrants(["a", "b"], against, noLot)).toEqual(["b", "a"]);
    const lot = (id: string) => (id === "b" ? 0.1 : 0.9);
    expect(rankEntrants(["a", "b"], [m(["a"], ["x"], 11, 5), m(["b"], ["y"], 11, 5)], lot)).toEqual(["b", "a"]);
  });

  it("ranks league players individually across rotating partners", () => {
    const results = [m(["a", "b"], ["c", "d"], 11, 7), m(["a", "c"], ["b", "d"], 11, 9), m(["a", "d"], ["b", "c"], 5, 11)];
    // a 2 wins; b, c 2 wins? b: W, L, W = 2; c: L, W, W = 2; d: L, L, L = 0.
    const ranked = rankEntrants(["a", "b", "c", "d"], results, noLot);
    expect(ranked.at(-1)).toBe("d");
    expect(new Set(ranked.slice(0, 3))).toEqual(new Set(["a", "b", "c"]));
  });
});
