import { parse } from "@glassrank/schema";
import { DEFAULT_RECIPE_V2, SimulationRecipeV2, type SimulationRecipeV2 as Recipe } from "@glassrank/sim";
import { describe, expect, it } from "vitest";
import { draftProblems, pairPlayers } from "./Design";
import {
  EVENT_TEMPLATES,
  GROUP_TEMPLATES,
  PRESETS,
  addClub,
  newEvent,
  newGroup,
  newWeekendTournament,
  newPlayer,
  presetGroupSkill,
  presetSkill,
  rangeKind,
  rangeName,
  removeClub,
  totalPlayers,
  uniqueId,
  withRangeKind,
} from "./defaults";

const valid = (r: Recipe) => parse(SimulationRecipeV2, r).ok;

describe("design edits", () => {
  it("makes unique, valid ids", () => {
    expect(uniqueId("North Side!", [])).toBe("north-side");
    expect(uniqueId("club-1", ["club-1", "club-1-2"])).toBe("club-1-3");
  });

  it("adds a valid featured player with a unique id", () => {
    const one = { ...DEFAULT_RECIPE_V2, players: [...DEFAULT_RECIPE_V2.players, newPlayer(DEFAULT_RECIPE_V2)] };
    const two = { ...one, players: [...one.players, newPlayer(one)] };
    expect(valid(two)).toBe(true);
    expect(new Set(two.players.map((p) => p.id)).size).toBe(two.players.length);
  });

  it("every preset is valid for players and groups", () => {
    for (const { value } of PRESETS) {
      const player = { ...newPlayer(DEFAULT_RECIPE_V2), skill: presetSkill(value, 3.4, DEFAULT_RECIPE_V2.durationDays) };
      expect(valid({ ...DEFAULT_RECIPE_V2, players: [player] }), value).toBe(true);
      if (value === "keyframes") continue;
      const group = { ...newGroup(DEFAULT_RECIPE_V2, "north"), skill: presetGroupSkill(value, 3, 3.5) };
      expect(valid({ ...DEFAULT_RECIPE_V2, groups: [...DEFAULT_RECIPE_V2.groups, group] }), value).toBe(true);
    }
  });

  it("adds a club with an event and players, and every group template is valid", () => {
    const r = addClub(DEFAULT_RECIPE_V2);
    expect(r.clubs).toHaveLength(4);
    const id = r.clubs[3]!.id;
    expect(r.events.some((e) => e.club === id)).toBe(true);
    expect(totalPlayers(r)).toBe(totalPlayers(DEFAULT_RECIPE_V2) + 20);
    let withGroups = r;
    for (const t of GROUP_TEMPLATES) withGroups = { ...withGroups, groups: [...withGroups.groups, newGroup(withGroups, id, t)] };
    expect(valid(withGroups)).toBe(true);
  });

  it("removes a club with its events and groups, rehoming featured players and dropping it from entry lists", () => {
    const r = removeClub(DEFAULT_RECIPE_V2, "north");
    expect(valid(r)).toBe(true);
    expect(r.clubs.map((c) => c.id)).toEqual(["south", "east"]);
    expect(r.events.some((e) => e.club === "north" || e.onlyFrom?.includes("north"))).toBe(false);
    expect(r.groups.some((g) => g.home === "north")).toBe(false);
    expect(r.players.find((p) => p.id === "rosa")?.home).toBe("south");
    expect(removeClub({ ...r, clubs: [r.clubs[0]!] }, r.clubs[0]!.id).clubs).toHaveLength(1);
  });

  it("explains problems in plain words", () => {
    expect(draftProblems(DEFAULT_RECIPE_V2)).toEqual([]);
    const late = { ...DEFAULT_RECIPE_V2, players: [{ ...DEFAULT_RECIPE_V2.players[0]!, skill: { preset: "keyframes" as const, keyframes: [[0, 3], [400, 3.5]] as [number, number][] } }] };
    expect(draftProblems(late)[0]).toMatch(/^Rosa \(made up\): a true-skill point is after the end of the run/);
    expect(draftProblems({ ...DEFAULT_RECIPE_V2, events: [] })[0]).toMatch(/at least one event/);
  });

  it("adds valid events on a day the club doesn't use yet", () => {
    let r = DEFAULT_RECIPE_V2;
    for (const t of EVENT_TEMPLATES) r = { ...r, events: [...r.events, newEvent(r, "south", t)] };
    expect(valid(r)).toBe(true);
    // Leagues only: a tournament's divisions deliberately share a day.
    const days = r.events.filter((e) => e.club === "south" && e.format.type === "league").map((e) => (e.schedule.kind === "weekly" ? e.schedule.weekday : -1));
    expect(new Set(days).size).toBe(days.length);
    expect(r.events.at(-1)?.label).toBe("4.0 and up");
  });

  it("switches between range kinds, keeping what it can", () => {
    expect(withRangeKind("all", { min: 3, max: 3.5 })).toBeUndefined();
    expect(withRangeKind("max", { min: 3 })).toEqual({ max: 3.5 });
    expect(withRangeKind("min", { max: 3.5 })).toEqual({ min: 3 });
    expect(withRangeKind("between", { max: 4 })).toEqual({ min: 3.5, max: 4 });
    expect(rangeKind(undefined)).toBe("all");
    expect(rangeName({ min: 3, max: 3.5 })).toBe("3.0–3.5");
  });

  it("splitting a wide league into two brackets is a valid world", () => {
    const events = DEFAULT_RECIPE_V2.events.flatMap((e) =>
      e.id === "south-35"
        ? [
            { ...e, label: "3.0 and under", range: { max: 3.0 } },
            { ...e, id: "south-30-35", label: "3.0–3.5", range: { min: 3.0, max: 3.5 }, schedule: { kind: "weekly" as const, weekday: 2 } },
          ]
        : [e],
    );
    expect(valid({ ...DEFAULT_RECIPE_V2, events })).toBe(true);
  });

  it("adds a valid weekend tournament in four divisions", () => {
    const divisions = newWeekendTournament(DEFAULT_RECIPE_V2, "north");
    expect(divisions.map((d) => d.label)).toEqual(["Weekend tournament: 3.0", "Weekend tournament: 3.5", "Weekend tournament: 4.0", "Weekend tournament: 4.5+"]);
    expect(divisions[1]!.range).toEqual({ max: 3.99 });
    expect(valid({ ...DEFAULT_RECIPE_V2, events: [...DEFAULT_RECIPE_V2.events, ...divisions] })).toBe(true);
    // A second one at the same club goes on the other weekend day, with its own ids.
    const once = { ...DEFAULT_RECIPE_V2, events: [...DEFAULT_RECIPE_V2.events, ...divisions] };
    const again = newWeekendTournament(once, "north");
    expect(again[0]!.schedule).toMatchObject({ weekday: 6 });
    expect(valid({ ...once, events: [...once.events, ...again] })).toBe(true);
  });

  it("pairs featured players both ways, and re-pairing frees the old partners", () => {
    const players = [
      { ...newPlayer(DEFAULT_RECIPE_V2), id: "a" },
      { ...newPlayer(DEFAULT_RECIPE_V2), id: "b" },
      { ...newPlayer(DEFAULT_RECIPE_V2), id: "c" },
    ];
    const ab = pairPlayers(players, "a", "b");
    expect(ab.map((p) => p.partner)).toEqual(["b", "a", undefined]);
    const ac = pairPlayers(ab, "a", "c");
    expect(ac.map((p) => p.partner)).toEqual(["c", undefined, "a"]);
    expect(pairPlayers(ac, "c", null).map((p) => p.partner)).toEqual([undefined, undefined, undefined]);
    expect(valid({ ...DEFAULT_RECIPE_V2, players: ac })).toBe(true);
  });
});
