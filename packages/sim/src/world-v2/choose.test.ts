import { describe, expect, it } from "vitest";
import { eventLevel, isEligible, rankCandidates, targetLevel } from "./choose";
import type { EventSeries } from "./recipe";

const series = (over: Partial<EventSeries>): EventSeries => ({
  id: "e",
  club: "home",
  schedule: { kind: "weekly", weekday: 0 },
  capacity: 16,
  format: { type: "league" },
  ...over,
});
const view = (rating: number, high = rating) => ({ rating, high });

describe("eligibility", () => {
  it("never lets a player above max in", () => {
    const e = series({ range: { min: 3.0, max: 3.5 } });
    expect(isEligible(view(3.5), e)).toBe(true);
    expect(isEligible(view(3.51), e)).toBe(false);
  });

  it("lets players up by default, within a margin, or not at all", () => {
    const range = { min: 3.5, max: 4.0 };
    expect(isEligible(view(2.5), series({ range }))).toBe(true);
    expect(isEligible(view(3.3), series({ range, playUp: "margin", playUpMargin: 0.25 }))).toBe(true);
    expect(isEligible(view(3.2), series({ range, playUp: "margin", playUpMargin: 0.25 }))).toBe(false);
    expect(isEligible(view(3.49), series({ range, playUp: "strict" }))).toBe(false);
  });

  it("can hold provisional players to the top of their range", () => {
    const e = series({ range: { max: 3.5 } });
    expect(isEligible(view(3.3, 3.8), e)).toBe(true);
    expect(isEligible(view(3.3, 3.8), { ...e, provisional: "high" })).toBe(false);
  });
});

describe("choice", () => {
  it("places an event's level inside its range", () => {
    expect(eventLevel(series({ range: { min: 3, max: 3.5 } }), 9)).toBe(3.25);
    expect(eventLevel(series({ range: { max: 3.5 } }), 9)).toBe(3.25);
    expect(eventLevel(series({ range: { min: 4 } }), 9)).toBe(4.25);
    expect(eventLevel(series({}), 3.7)).toBe(3.7);
  });

  it("aims up to half a point away and picks the nearest level, home first on ties", () => {
    expect(targetLevel(3.4, 1, 0)).toBeCloseTo(3.9, 12);
    expect(targetLevel(3.4, -1, 0.1)).toBeCloseTo(3.0, 12);
    const options = [
      { series: series({ id: "low", range: { max: 3.5 } }) },
      { series: series({ id: "mid", range: { min: 3.5, max: 4.0 } }) },
      { series: series({ id: "away", club: "other", range: { min: 3.5, max: 4.0 } }) },
    ];
    expect(rankCandidates(options, 3.9, 3.4, "home").map((o) => o.series.id)).toEqual(["mid", "away", "low"]);
    expect(rankCandidates(options, 3.0, 3.4, "home")[0]?.series.id).toBe("low");
  });
});
