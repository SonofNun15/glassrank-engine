import { describe, expect, it } from "vitest";
import { GLASSRANK } from "../policies";
import { DEFAULT_RECIPE_V2 } from "./default-world";
import { followPlayer } from "./follow";
import { runWorldV2, scheduleFromDayZero } from "./run";

const recipe = { ...DEFAULT_RECIPE_V2, durationDays: 140 };

describe("following a player", () => {
  const run = runWorldV2(recipe, scheduleFromDayZero(GLASSRANK));
  const report = followPlayer(recipe, GLASSRANK, "p.sam", (s) => `${s} (made up)`);

  it("is the same run: every event matches the rating history", () => {
    const history = run.history.get("p.sam")!;
    expect(report.events.map((e) => [e.eventId, e.ratingBefore, e.rating])).toEqual(history.map((h) => [h.eventId, h.ratingBefore, h.rating]));
  });

  it("records partners, opponents, scores, and the receipt's explanation", () => {
    const e = report.events[0]!;
    expect(e.matches.length).toBeGreaterThanOrEqual(3);
    for (const m of e.matches) {
      expect(m.opponents).toHaveLength(2);
      expect(m.partners).toHaveLength(1);
      expect(m.partners.some((p) => p.id === "p.sam")).toBe(false);
      expect(m.won).toBe(m.games.filter(([a, b]) => a > b).length * 2 > m.games.length);
    }
    expect(e.explanation?.headline).toContain("(made up)");
    expect(e.expectedGamesWon).not.toBeNull();
  });

  it("summarizes where they played and the pool they played in", () => {
    const s = report.summary;
    expect(s.events).toBe(report.events.length);
    expect(s.leagues.reduce((n, l) => n + l.events, 0)).toBe(s.events);
    expect(s.courts.reduce((n, c) => n + c.events, 0)).toBe(s.events);
    expect(s.gamesWon).toBeLessThanOrEqual(s.gamesPlayed);
    expect(report.profile.appetite).toBe(-1);
    expect(report.profile.startingRating).toEqual({ source: "self", rating: 3.2 });
    // Sam (true 3.9) starts rated 3.2 and plays down, so they're stronger than who they play.
    expect(s.edge).toBeGreaterThan(0);
    expect(s.ownGap).toBeLessThan(0);
  });

  it("rejects unknown players", () => {
    expect(() => followPlayer(recipe, GLASSRANK, "p.nobody")).toThrow(/no player/);
  });
});
