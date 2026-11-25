import { describe, expect, it } from "vitest";
import { FIVE_ROTATIONS, FOUR_ROTATIONS, carryOrder, courtSizes, moveCourts, seatCourts } from "./league";

const pairs = (rots: typeof FOUR_ROTATIONS) => rots.flatMap(([a, b]) => [a, b]).map(([x, y]) => `${Math.min(x, y)}${Math.max(x, y)}`);

describe("league courts", () => {
  it("everyone partners everyone once, on courts of four and five", () => {
    expect(new Set(pairs(FOUR_ROTATIONS)).size).toBe(6);
    const five = pairs(FIVE_ROTATIONS);
    expect(five).toHaveLength(10);
    expect(new Set(five).size).toBe(10);
    const sits = FIVE_ROTATIONS.map(([a, b]) => [0, 1, 2, 3, 4].find((p) => !a.includes(p) && !b.includes(p)));
    expect(new Set(sits).size).toBe(5);
  });

  it("sizes courts, with fives at the bottom and extras sitting out only when needed", () => {
    expect(courtSizes(3)).toEqual({ sizes: [], sitOut: 3 });
    expect(courtSizes(4)).toEqual({ sizes: [4], sitOut: 0 });
    expect(courtSizes(5)).toEqual({ sizes: [5], sitOut: 0 });
    expect(courtSizes(7)).toEqual({ sizes: [5], sitOut: 2 });
    expect(courtSizes(9)).toEqual({ sizes: [4, 5], sitOut: 0 });
    expect(courtSizes(11)).toEqual({ sizes: [5, 5], sitOut: 1 });
    expect(courtSizes(14)).toEqual({ sizes: [4, 5, 5], sitOut: 0 });
  });

  it("keeps last week's order and slots others in by rating", () => {
    const rating: Record<string, number> = { a: 3.0, b: 3.9, c: 3.5, n1: 3.6, n2: 2.5 };
    expect(carryOrder(["a", "b", "c", "gone"], ["c", "b", "a", "n1", "n2"], (id) => rating[id] as number)).toEqual(["n1", "a", "b", "c", "n2"]);
  });

  it("moves top finishers up and bottom finishers down", () => {
    const ranked = [["a1", "a2", "a3", "a4"], ["b1", "b2", "b3", "b4"], ["c1", "c2", "c3", "c4", "c5"]];
    expect(seatCourts(moveCourts(ranked, 1), [4, 4, 5])).toEqual([
      ["a1", "a2", "a3", "b1"],
      ["a4", "b2", "b3", "c1"],
      ["b4", "c2", "c3", "c4", "c5"],
    ]);
    expect(moveCourts(ranked, 0)).toEqual(ranked.flat());
  });
});
