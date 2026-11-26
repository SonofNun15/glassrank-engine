/**
 * Generate a world from a few plain dials, so visitors start from something
 * meaningful instead of an empty page. Deterministic: the same dials and seed
 * always make the same world, and the result is an ordinary recipe to edit,
 * run, and share.
 */
import { DEFAULT_RECIPE_V2, RECIPE_V2_LIMITS, RECIPE_V2_VERSION, Rng, type EventSeries, type PlayerGroup, type PlayerSpec, type SimulationRecipeV2 } from "@glassrank/sim";
import { GROUP_TEMPLATES, newTournament, presetGroupSkill, rangeName, uniqueId } from "./defaults";

export type ClubSize = "small" | "medium" | "large" | "mixed";
export type Level = "beginners" | "mixed" | "strong";
export type TournamentCulture = "none" | "one" | "several";
export type Travel = "homebodies" | "some" | "road-trippers";

export interface GenerateOptions {
  readonly clubs: number;
  readonly size: ClubSize;
  readonly level: Level;
  readonly tournaments: TournamentCulture;
  readonly travel: Travel;
  readonly weeks: number;
  /** Add two featured players with a story to follow. */
  readonly featured: boolean;
  readonly seed: number;
}

export const DEFAULT_OPTIONS: Omit<GenerateOptions, "seed"> = {
  clubs: 3,
  size: "mixed",
  level: "mixed",
  tournaments: "one",
  travel: "some",
  weeks: 52,
  featured: true,
};

const PLACES = ["Riverbend", "Maple Street", "Lakeview", "Cedar Hill", "Oak Park", "Harbor", "Pine Ridge", "Westfield", "Brookside", "Summit", "Willow Creek", "Stonegate"];
const KINDS = ["Courts", "Rec", "Pickleball Club", "Racquet Center", "Athletic Club"];
const NAMES = ["Alex", "Jordan", "Casey", "Riley", "Morgan", "Taylor", "Quinn", "Avery"];

const PLAYERS: Readonly<Record<Exclude<ClubSize, "mixed">, number>> = { small: 25, medium: 45, large: 70 };
const LEAGUES: Readonly<Record<Exclude<ClubSize, "mixed">, number>> = { small: 2, medium: 3, large: 4 };
const CENTER: Readonly<Record<Level, number>> = { beginners: 2.9, mixed: 3.4, strong: 3.9 };
const TRAVEL: Readonly<Record<Travel, { leagues: readonly [number, number]; tournaments: readonly [number, number] }>> = {
  homebodies: { leagues: [0, 0.05], tournaments: [0.1, 0.4] },
  some: { leagues: [0, 0.15], tournaments: [0.3, 0.8] },
  "road-trippers": { leagues: [0.05, 0.35], tournaments: [0.6, 1] },
};
/** Base share of each group template (steady, improvers, newcomers, decliners, back from a break), jittered per club. */
const MIX = [0.45, 0.2, 0.15, 0.1, 0.1] as const;

const round2 = (x: number) => Math.round(x * 100) / 100;
const half = (x: number) => Math.round(x * 2) / 2;
const clampSkill = (x: number) => Math.min(6.5, Math.max(2, x));
const span = (lo: number, hi: number) => [round2(clampSkill(lo)), round2(clampSkill(Math.max(lo, hi)))] as const;

/** A ladder of half-point brackets around a club's level: "3.0 and under", "3.0–3.5", ..., "4.0 and up". */
function ladder(center: number, n: number): EventSeries["range"][] {
  const lowest = half(center - 0.25 * (n - 2));
  const ranges: EventSeries["range"][] = [{ max: lowest }];
  for (let i = 0; i < n - 2; i++) ranges.push({ min: lowest + 0.5 * i, max: lowest + 0.5 * (i + 1) });
  ranges.push({ min: lowest + 0.5 * (n - 2) });
  return ranges;
}

/** How a group's skill is set up around a club's level, per template. */
function groupSkill(template: number, c: number): PlayerGroup["skill"] {
  const preset = GROUP_TEMPLATES[template]!.preset;
  const ranges: readonly (readonly [number, number])[] = [
    span(c - 0.7, c + 0.8),
    span(c - 0.6, c + 0.2),
    span(c - 1.0, c - 0.3),
    span(c - 0.3, c + 0.8),
    span(c - 0.5, c + 0.6),
  ];
  const [lo, hi] = ranges[template]!;
  return presetGroupSkill(preset, lo, hi);
}

export function generateWorld(options: GenerateOptions): SimulationRecipeV2 {
  const rng = new Rng(options.seed);
  const durationDays = options.weeks * 7;
  const travel = TRAVEL[options.travel];
  const places = rng.shuffle(PLACES);
  let recipe: SimulationRecipeV2 = {
    recipeVersion: RECIPE_V2_VERSION,
    name: `Generated world ${options.seed}`,
    seed: options.seed,
    durationDays,
    world: DEFAULT_RECIPE_V2.world,
    clubs: [],
    groups: [],
    players: [],
    events: [],
  };

  const centers = new Map<string, number>();
  for (let i = 0; i < Math.max(1, Math.min(6, options.clubs)); i++) {
    const label = `${places[i % places.length]} ${rng.pick(KINDS)} (made up)`;
    const id = uniqueId(label.replace(" (made up)", ""), recipe.clubs.map((c) => c.id));
    const size: Exclude<ClubSize, "mixed"> = options.size === "mixed" ? rng.pick(["small", "medium", "large"] as const) : options.size;
    const center = round2(CENTER[options.level] + rng.range(-0.3, 0.3));
    centers.set(id, center);
    recipe = { ...recipe, clubs: [...recipe.clubs, { id, label, tier: rng.chance(0.25) ? "provisional_host" : "verified_host" }] };

    // Leagues: a ladder fitted to the club, sometimes with an all-levels night.
    const taken = recipe.events.map((e) => e.id);
    const leagues: EventSeries[] = ladder(center, LEAGUES[size]).map((range, d) => {
      const eventId = uniqueId(`${id}-${rangeName(range)}`, taken);
      taken.push(eventId);
      return {
        id: eventId,
        label: rangeName(range),
        club: id,
        schedule: { kind: "weekly", weekday: d },
        ...(range === undefined ? {} : { range }),
        capacity: size === "small" ? 16 : size === "medium" ? 20 : 24,
        format: { type: "league" },
      };
    });
    if (rng.chance(0.3)) {
      leagues.push({
        id: uniqueId(`${id}-all`, taken),
        label: "All levels",
        club: id,
        schedule: { kind: "weekly", weekday: 4 },
        capacity: 24,
        format: { type: "league" },
      });
    }
    recipe = { ...recipe, events: [...recipe.events, ...leagues] };

    // Players: every kind, in proportions that vary from club to club.
    const weights = MIX.map((w) => w * rng.range(0.6, 1.4));
    const total = weights.reduce((a, b) => a + b, 0);
    const players = Math.round(PLAYERS[size] * rng.range(0.85, 1.15));
    weights.forEach((w, t) => {
      const count = Math.max(1, Math.round((players * w) / total));
      const template = GROUP_TEMPLATES[t]!;
      const group: PlayerGroup = {
        id: uniqueId(`${id}-${template.label}`, recipe.groups.map((g) => g.id)),
        label: template.label,
        count,
        home: id,
        skill: groupSkill(t, center),
        volatility: [0.05, 0.25],
        travel: travel.leagues,
        appetite: [-0.5, 0.5],
        attendance: [0.4, 0.9],
        joinDay: t === 2 ? [0, Math.min(300, durationDays - 1)] : [0, 0],
        tournamentTravel: travel.tournaments,
      };
      recipe = { ...recipe, groups: [...recipe.groups, group] };
    });
  }

  // Tournaments: monthly, on staggered weekends so they don't compete.
  if (options.tournaments !== "none") {
    const hosts = options.tournaments === "one" ? [rng.pick(recipe.clubs)] : recipe.clubs.filter((_, i) => i === 0 || rng.chance(0.5)).slice(0, 3);
    hosts.forEach((club, k) => {
      const divisions = newTournament(recipe, club.id).map((d) => ({ ...d, schedule: { ...d.schedule, ...(k === 0 ? {} : { firstWeek: k }) } as EventSeries["schedule"] }));
      if (recipe.events.length + divisions.length <= RECIPE_V2_LIMITS.maxEvents) recipe = { ...recipe, events: [...recipe.events, ...divisions] };
    });
  }

  // Featured players with a story to follow.
  if (options.featured) {
    const names = rng.shuffle(NAMES);
    const [a, b] = [rng.pick(recipe.clubs), rng.pick(recipe.clubs)];
    const ca = centers.get(a!.id) as number;
    const cb = centers.get(b!.id) as number;
    const overClaimer: PlayerSpec = {
      id: "over-claimer",
      label: `${names[0]} (made up)`,
      home: a!.id,
      skill: { preset: "steady", level: round2(clampSkill(ca)) },
      volatility: 0.15,
      travel: 0.05,
      appetite: -0.8,
      attendance: 0.85,
      joinDay: 0,
      startingRating: { source: "self", rating: round2(clampSkill(ca + 0.6)) },
    };
    const climber: PlayerSpec = {
      id: "fast-climber",
      label: `${names[1]} (made up)`,
      home: b!.id,
      skill: { preset: "fast_improver", start: round2(clampSkill(cb - 0.6)), gain: 1.0, halfDays: 90 },
      volatility: 0.15,
      travel: 0.1,
      appetite: 0.6,
      attendance: 0.85,
      joinDay: 0,
      startingRating: { source: "self", rating: round2(clampSkill(cb - 0.6)) },
      tournaments: 0.5,
    };
    recipe = { ...recipe, players: [overClaimer, climber] };
  }
  return recipe;
}
