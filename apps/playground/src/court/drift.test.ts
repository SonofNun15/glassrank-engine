import type { PlayerHistory, RatingPoint } from "@glassrank/sim";
import { describe, expect, it } from "vitest";
import { summarizeDrift } from "./drift";

const pt = (rating: number, trueSkill: number, provisional = false): RatingPoint => ({
  eventId: "e.1",
  series: "e",
  day: 0,
  ratingBefore: rating,
  rating,
  trueSkill,
  provisional: provisional ? { low: rating - 0.5, high: rating + 0.5, eventsRemaining: 3 } : null,
});
const player = (id: string, home: string, points: RatingPoint[]): PlayerHistory => ({ id, label: null, group: "g", home, points });

describe("drift summary", () => {
  const players = [
    player("a", "north", [pt(3.0, 3.1)]),
    player("b", "north", [pt(3.5, 3.3)]),
    player("c", "south", [pt(3.0, 3.8)]),
    player("d", "south", [pt(4.5, 3.9)]),
    player("e", "south", [pt(3.2, 3.2, true)]),
    player("f", "south", []),
  ];
  const d = summarizeDrift(players);

  it("measures established players only", () => {
    expect(d.measured).toBe(4);
    expect(d.leftOut).toBe(2);
  });

  it("summarizes gaps", () => {
    // |gaps| = 0.1, 0.2, 0.8, 0.6 -> median 0.4; within 0.25: 2 of 4; mean (-0.1 + 0.2 - 0.8 + 0.6) / 4 = -0.025.
    expect(d.medianAbsGap).toBeCloseTo(0.4, 12);
    expect(d.closeShare).toBe(0.5);
    expect(d.meanGap).toBeCloseTo(-0.025, 12);
  });

  it("lists outliers furthest first", () => {
    expect(d.outliers.map((o) => o.player.id)).toEqual(["c", "d"]);
  });

  it("bins every measured player, symmetric around zero", () => {
    expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(4);
    expect(d.bins[0]!.from).toBe(-d.bins.at(-1)!.to);
    expect(d.bins.find((b) => b.from === -0.8)?.count).toBe(1);
  });

  it("breaks down by club", () => {
    const north = d.clubs.find((c) => c.club === "north")!;
    expect(north.players).toBe(2);
    expect(north.meanGap).toBeCloseTo(0.05, 12);
  });
});
