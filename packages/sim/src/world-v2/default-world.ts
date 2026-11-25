/**
 * A small default v2 world: three made-up clubs with rated league ladders,
 * an all-levels night, a monthly tournament in four divisions, every kind of
 * player, and two
 * hand-made players to follow. Used for the golden run and as an example
 * recipe. The Test court's larger default world is sized later, once runs
 * are measured in a browser.
 */
import { RECIPE_V2_VERSION, type PlayerGroup, type SimulationRecipeV2 } from "./recipe";

type Skill = PlayerGroup["skill"];

function groups(home: string, scale: number): PlayerGroup[] {
  const common = {
    home,
    volatility: [0.05, 0.25] as const,
    travel: [0, 0.15] as const,
    appetite: [-0.5, 0.5] as const,
    attendance: [0.4, 0.9] as const,
  };
  const g = (id: string, label: string, count: number, skill: Skill, joinDay: readonly [number, number] = [0, 0]): PlayerGroup => ({
    id: `${home}-${id}`,
    label,
    count: Math.max(1, Math.round(count * scale)),
    skill,
    joinDay,
    ...common,
  });
  return [
    g("steady", "Steady players", 30, { preset: "steady", level: [2.8, 4.6] }),
    g("improvers", "Improvers", 12, { preset: "gradual_improver", start: [2.6, 3.6], gain: [0.6, 1.4], halfDays: [120, 400] }),
    g("newcomers", "Newcomers", 10, { preset: "fast_improver", start: [2.2, 3.0], gain: [0.5, 1.2], halfDays: [60, 200] }, [0, 300]),
    g("decliners", "Slow decliners", 8, { preset: "slow_decline", start: [3.0, 4.4], perYear: [0.05, 0.15] }),
    g("returners", "Back from a break", 6, {
      preset: "break_and_return",
      start: [2.8, 4.2],
      breakDay: [30, 150],
      breakDays: [60, 150],
      rust: [0.1, 0.4],
      recoveryDays: [40, 80],
    }),
  ];
}

export const DEFAULT_RECIPE_V2: SimulationRecipeV2 = {
  recipeVersion: RECIPE_V2_VERSION,
  name: "Three made-up clubs and a monthly tournament, one year",
  seed: 1,
  durationDays: 364,
  world: {
    nightShare: 0.5,
    appetiteSpread: 0.25,
    rallyK: 0.32,
    startingRatings: {
      mix: { self: 0.5, club: 0.2, external: 0.1, default: 0.2 },
      self: { bias: 0.2, sd: 0.4 },
      club: { bias: 0, sd: 0.25 },
      external: { bias: 0.1, sd: 0.3 },
    },
  },
  clubs: [
    { id: "north", label: "Northside Rec (made up)", tier: "verified_host" },
    { id: "south", label: "Southgate Courts (made up)", tier: "verified_host" },
    { id: "east", label: "East End Pickleball (made up)", tier: "provisional_host" },
  ],
  groups: [...groups("north", 1), ...groups("south", 0.7), ...groups("east", 0.5)],
  players: [
    {
      id: "rosa",
      label: "Rosa (made up)",
      home: "north",
      skill: { preset: "fast_improver", start: 3.0, gain: 1.0, halfDays: 120 },
      volatility: 0.15,
      travel: 0.1,
      appetite: 0.5,
      attendance: 0.85,
      joinDay: 0,
      startingRating: { source: "self", rating: 3.5 },
    },
    {
      id: "sam",
      label: "Sam (made up)",
      home: "south",
      skill: { preset: "steady", level: 3.9 },
      volatility: 0.1,
      travel: 0,
      appetite: -1,
      attendance: 0.9,
      joinDay: 0,
      startingRating: { source: "self", rating: 3.2 },
    },
  ],
  events: [
    { id: "north-30", label: "3.0 and under", club: "north", schedule: { kind: "weekly", weekday: 0 }, range: { max: 3.0 }, capacity: 24, format: { type: "league" } },
    {
      id: "north-35",
      label: "3.0–3.5 league",
      club: "north",
      schedule: { kind: "weekly", weekday: 1 },
      range: { min: 3.0, max: 3.5 },
      capacity: 24,
      format: { type: "league", season: { weeks: 10 } },
    },
    { id: "north-40", label: "3.5–4.0", club: "north", schedule: { kind: "weekly", weekday: 2 }, range: { min: 3.5, max: 4.0 }, capacity: 20, format: { type: "league" } },
    { id: "north-open", label: "4.0 and up", club: "north", schedule: { kind: "weekly", weekday: 3 }, range: { min: 4.0 }, capacity: 16, format: { type: "league" } },
    { id: "south-35", label: "3.5 and under", club: "south", schedule: { kind: "weekly", weekday: 1 }, range: { max: 3.5 }, capacity: 24, format: { type: "league" } },
    { id: "south-up", label: "3.5 and up", club: "south", schedule: { kind: "weekly", weekday: 3 }, range: { min: 3.5 }, capacity: 20, format: { type: "league" } },
    // A monthly weekend tournament (every four weeks), in the usual four divisions. A division's number is the
    // top of its range in steps of half a point: a 4.0 can't play the 3.5 division, but anyone
    // may play up.
    ...([
      ["30", "3.0", { max: 3.49 }],
      ["35", "3.5", { max: 3.99 }],
      ["40", "4.0", { max: 4.49 }],
      ["45", "4.5+", { min: 4.5 }],
    ] as const).map(([id, name, range]) => ({
      id: `south-weekend-${id}`,
      label: `Weekend tournament: ${name}`,
      club: "south",
      schedule: { kind: "weekly" as const, weekday: 6, hour: 9, everyWeeks: 4 },
      range,
      capacity: 16,
      format: { type: "tournament" as const, structure: "pools_then_bracket" as const },
    })),
    {
      id: "east-all",
      label: "All levels",
      club: "east",
      schedule: { kind: "weekly", weekday: 5, hour: 10 },
      capacity: 32,
      format: { type: "league" },
    },
  ],
};
