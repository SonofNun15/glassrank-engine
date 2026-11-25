/**
 * Starting values and edits for Design mode. Pure functions over recipes, so
 * every edit is a new recipe and nothing is changed in place.
 */
import type { EventSeries, GroupSkill, PlayerGroup, PlayerSkill, PlayerSpec, SimulationRecipeV2 } from "@glassrank/sim";

export type Preset = PlayerSkill["preset"];

export const PRESETS: readonly { readonly value: Preset; readonly label: string; readonly description: string }[] = [
  { value: "steady", label: "Steady", description: "Plays at the same level the whole time." },
  { value: "gradual_improver", label: "Gradual improver", description: "Gets better over time, quickly at first, then levels off." },
  { value: "fast_improver", label: "Fast improver", description: "Gets better quickly, then levels off." },
  { value: "slow_decline", label: "Slow decline", description: "Loses a little skill each year." },
  { value: "break_and_return", label: "Break and return", description: "Takes a break, comes back rusty, and recovers." },
  { value: "plateau_then_jump", label: "Plateau then jump", description: "Stays level, then jumps up (or drops) to a new level." },
  { value: "keyframes", label: "Custom curve", description: "Points you place on a graph, joined by straight lines." },
];

const ID_OK = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A recipe id from `base`, unique among `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 26) || "item";
  if (!used.has(clean) && ID_OK.test(clean)) return clean;
  for (let n = 2; ; n++) {
    const id = `${clean}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** True skill where a curve starts. */
export function startOf(skill: PlayerSkill): number {
  if (skill.preset === "steady") return skill.level;
  if (skill.preset === "keyframes") return skill.keyframes[0]?.[1] ?? 3.5;
  return skill.start;
}

/** A preset with sensible settings, starting at `start`. Days count from the player's join day. */
export function presetSkill(preset: Preset, start: number, durationDays: number): PlayerSkill {
  switch (preset) {
    case "steady":
      return { preset, level: start };
    case "gradual_improver":
      return { preset, start, gain: 0.8, halfDays: 210 };
    case "fast_improver":
      return { preset, start, gain: 1.0, halfDays: 84 };
    case "slow_decline":
      return { preset, start, perYear: 0.1 };
    case "break_and_return":
      return { preset, start, breakDay: 84, breakDays: 84, rust: 0.3, recoveryDays: 56 };
    case "plateau_then_jump":
      return { preset, start, jumpDay: 140, jump: 0.5, jumpDays: 56 };
    case "keyframes":
      return { preset, keyframes: [[0, start], [Math.max(7, durationDays), start]] };
  }
}

const span = (lo: number, hi: number) => [lo, hi] as const;

/** Group skill for a preset with ranges around [lo, hi]. */
export function presetGroupSkill(preset: Exclude<Preset, "keyframes">, lo: number, hi: number): GroupSkill {
  const start = span(lo, hi);
  switch (preset) {
    case "steady":
      return { preset, level: start };
    case "gradual_improver":
      return { preset, start, gain: span(0.6, 1.4), halfDays: span(120, 400) };
    case "fast_improver":
      return { preset, start, gain: span(0.5, 1.2), halfDays: span(60, 200) };
    case "slow_decline":
      return { preset, start, perYear: span(0.05, 0.15) };
    case "break_and_return":
      return { preset, start, breakDay: span(30, 150), breakDays: span(60, 150), rust: span(0.1, 0.4), recoveryDays: span(40, 80) };
    case "plateau_then_jump":
      return { preset, start, jumpDay: span(60, 240), jump: span(0.3, 0.7), jumpDays: span(30, 90) };
  }
}

/** Where a group's skill starts, as a range. */
export function groupStart(skill: GroupSkill): readonly [number, number] {
  if (skill.preset === "steady") return skill.level;
  if (skill.preset === "keyframes") {
    const s = skill.keyframes[0]?.[1] ?? 3.5;
    return [s, s];
  }
  return skill.start;
}

export const GROUP_TEMPLATES: readonly { readonly preset: Exclude<Preset, "keyframes">; readonly label: string; readonly range: readonly [number, number] }[] = [
  { preset: "steady", label: "Steady players", range: [2.8, 4.6] },
  { preset: "gradual_improver", label: "Improvers", range: [2.6, 3.6] },
  { preset: "fast_improver", label: "Newcomers", range: [2.2, 3.0] },
  { preset: "slow_decline", label: "Slow decliners", range: [3.0, 4.4] },
  { preset: "break_and_return", label: "Back from a break", range: [2.8, 4.2] },
  { preset: "plateau_then_jump", label: "Late bloomers", range: [2.8, 3.8] },
];

const GROUP_TRAITS = {
  volatility: [0.05, 0.25],
  travel: [0, 0.15],
  appetite: [-0.5, 0.5],
  attendance: [0.4, 0.9],
} as const;

export function newGroup(recipe: SimulationRecipeV2, home: string, template = GROUP_TEMPLATES[0]!, count = 10): PlayerGroup {
  return {
    id: uniqueId(`${home}-${template.label}`, recipe.groups.map((g) => g.id)),
    label: template.label,
    count,
    home,
    skill: presetGroupSkill(template.preset, template.range[0], template.range[1]),
    joinDay: template.preset === "fast_improver" ? [0, Math.min(300, recipe.durationDays - 1)] : [0, 0],
    ...GROUP_TRAITS,
  };
}

export function newPlayer(recipe: SimulationRecipeV2): PlayerSpec {
  const n = recipe.players.length + 1;
  const home = recipe.clubs[0]?.id ?? "club";
  return {
    id: uniqueId(`player-${n}`, recipe.players.map((p) => p.id)),
    label: `New player ${n} (made up)`,
    home,
    skill: { preset: "steady", level: 3.5 },
    volatility: 0.1,
    travel: 0.1,
    appetite: 0,
    attendance: 0.8,
    joinDay: 0,
    startingRating: { source: "self", rating: 3.5 },
  };
}

/** A new club with an all-levels league and a group of steady players, so someone plays there. */
export function addClub(recipe: SimulationRecipeV2): SimulationRecipeV2 {
  const n = recipe.clubs.length + 1;
  const id = uniqueId(`club-${n}`, recipe.clubs.map((c) => c.id));
  const event: EventSeries = {
    id: uniqueId(`${id}-all`, recipe.events.map((e) => e.id)),
    label: "All levels",
    club: id,
    schedule: { kind: "weekly", weekday: 4 },
    capacity: 24,
    format: { type: "league" },
  };
  const withClub = { ...recipe, clubs: [...recipe.clubs, { id, label: `New club ${n} (made up)`, tier: "verified_host" as const }] };
  return { ...withClub, events: [...recipe.events, event], groups: [...recipe.groups, newGroup(withClub, id, GROUP_TEMPLATES[0], 20)] };
}

/**
 * Remove a club with its events and groups. Its featured players move to the
 * first remaining club, and it drops out of other events' onlyFrom lists.
 */
export function removeClub(recipe: SimulationRecipeV2, id: string): SimulationRecipeV2 {
  const clubs = recipe.clubs.filter((c) => c.id !== id);
  const fallback = clubs[0]?.id;
  if (fallback === undefined) return recipe;
  return {
    ...recipe,
    clubs,
    events: recipe.events
      .filter((e) => e.club !== id)
      .map((e) => (e.onlyFrom?.includes(id) ? { ...e, onlyFrom: e.onlyFrom.filter((c) => c !== id) } : e)),
    groups: recipe.groups.filter((g) => g.home !== id),
    players: recipe.players.map((p) => (p.home === id ? { ...p, home: fallback } : p)),
  };
}

export const totalPlayers = (r: SimulationRecipeV2) => r.groups.reduce((n, g) => n + g.count, 0) + r.players.length;

export type RangeKind = "all" | "max" | "min" | "between";

export function rangeKind(range: EventSeries["range"]): RangeKind {
  if (range?.min !== undefined && range.max !== undefined) return "between";
  if (range?.max !== undefined) return "max";
  if (range?.min !== undefined) return "min";
  return "all";
}

/** A range of the given kind, keeping what it can from `from`. */
export function withRangeKind(kind: RangeKind, from: EventSeries["range"]): EventSeries["range"] | undefined {
  const min = from?.min ?? (from?.max !== undefined ? from.max - 0.5 : 3.0);
  const max = from?.max ?? (from?.min !== undefined ? from.min + 0.5 : 3.5);
  switch (kind) {
    case "all":
      return undefined;
    case "max":
      return { max };
    case "min":
      return { min };
    case "between":
      return { min: Math.min(min, max), max: Math.max(min, max) };
  }
}

export function rangeName(range: EventSeries["range"]): string {
  if (range?.min !== undefined && range.max !== undefined) return `${range.min.toFixed(1)}–${range.max.toFixed(1)}`;
  if (range?.max !== undefined) return `${range.max.toFixed(1)} and under`;
  if (range?.min !== undefined) return `${range.min.toFixed(1)} and up`;
  return "All levels";
}

export const EVENT_TEMPLATES: readonly { readonly key: string; readonly label: string; readonly range?: EventSeries["range"] }[] = [
  { key: "all", label: "All levels" },
  { key: "between", label: "A bracket (3.0–3.5)", range: { min: 3.0, max: 3.5 } },
  { key: "max", label: "3.5 and under", range: { max: 3.5 } },
  { key: "min", label: "4.0 and up", range: { min: 4.0 } },
];

/** A weekly league for `club`, on a weekday the club doesn't use yet if there is one. */
export function newEvent(recipe: SimulationRecipeV2, club: string, template = EVENT_TEMPLATES[0]!): EventSeries {
  const used = new Set(recipe.events.filter((e) => e.club === club && e.schedule.kind === "weekly").map((e) => (e.schedule.kind === "weekly" ? e.schedule.weekday : -1)));
  const weekday = [0, 1, 2, 3, 4, 5, 6].find((d) => !used.has(d)) ?? 0;
  const label = rangeName(template.range);
  return {
    id: uniqueId(`${club}-${label}`, recipe.events.map((e) => e.id)),
    label,
    club,
    schedule: { kind: "weekly", weekday },
    ...(template.range === undefined ? {} : { range: template.range }),
    capacity: 24,
    format: { type: "league" },
  };
}
