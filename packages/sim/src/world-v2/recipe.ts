/**
 * Recipe v0.2: clubs, players, and events whose entry is decided by the
 * GlassRank rating. See docs/design/sim-world-v2.md.
 *
 * A recipe holds no rating system: the Test court always runs the official
 * policy, and research tooling passes its own policy when it runs a recipe.
 * Size limits are part of the format so a server can accept uploads safely.
 */
import * as g from "@glassrank/schema";
import { SourceTier } from "@glassrank/schema";

export const RECIPE_V2_VERSION = "0.2.0" as const;
export const SIM_V2_VERSION = "0.2.0" as const;

export const RECIPE_V2_LIMITS = {
  maxDays: 1825,
  maxPlayers: 500,
  maxClubs: 12,
  maxEvents: 40,
  maxGroups: 20,
  maxHandMadePlayers: 20,
  maxKeyframes: 24,
} as const;

const SEMVER = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$";
const Id = g.string({ pattern: "^[a-z0-9][a-z0-9-]{0,31}$", description: "Lowercase letters, digits, and dashes." });
const Label = g.optional(g.string({ maxLength: 60, description: "Display name. User content: made up, never a real person." }));
const Day = g.integer({ minimum: 0, maximum: RECIPE_V2_LIMITS.maxDays });

/** A [low, high] range; values are drawn uniformly from it. low may equal high. */
function span(lo: number, hi: number, description?: string) {
  return g.refine(
    g.tuple([g.number({ minimum: lo, maximum: hi }), g.number({ minimum: lo, maximum: hi })], description === undefined ? {} : { description }),
    "low <= high",
    (r, path, issues) => {
      if (r[0] > r[1]) issues.push({ path, message: "low must not exceed high" });
    },
  );
}
const exact = (lo: number, hi: number, description?: string) =>
  g.number(description === undefined ? { minimum: lo, maximum: hi } : { minimum: lo, maximum: hi, description });

/**
 * True-skill presets. Days in a preset count from the player's join day;
 * keyframe days count from the start of the run.
 */
function skillSchema<N>(n: (lo: number, hi: number, description?: string) => g.Schema<N>) {
  const start = n(2, 8, "True skill when the player joins.");
  const keyframes = g.object({
    preset: g.literal("keyframes"),
    keyframes: g.array(g.tuple([Day, g.number({ minimum: 2, maximum: 8 })]), {
      minItems: 1,
      maxItems: RECIPE_V2_LIMITS.maxKeyframes,
      description: "[day, skill] points, joined by straight lines and held flat before the first and after the last.",
    }),
  });
  const improver = <const P extends string>(preset: P) =>
    g.object({ preset: g.literal(preset), start, gain: n(0, 4, "Total eventual gain."), halfDays: n(1, 3650, "Days to reach half of the gain.") });
  return g.tagged(
    "preset",
    {
      steady: g.object({ preset: g.literal("steady"), level: n(2, 8) }),
      gradual_improver: improver("gradual_improver"),
      fast_improver: improver("fast_improver"),
      slow_decline: g.object({ preset: g.literal("slow_decline"), start, perYear: n(0, 2, "Skill lost per year.") }),
      break_and_return: g.object({
        preset: g.literal("break_and_return"),
        start,
        breakDay: n(0, RECIPE_V2_LIMITS.maxDays, "Days after joining that the break starts."),
        breakDays: n(1, RECIPE_V2_LIMITS.maxDays, "Length of the break."),
        rust: n(0, 3, "Skill lost on return."),
        recoveryDays: n(1, 3650, "Days to recover the rust."),
      }),
      plateau_then_jump: g.object({
        preset: g.literal("plateau_then_jump"),
        start,
        jumpDay: n(0, RECIPE_V2_LIMITS.maxDays, "Days after joining that the jump starts."),
        jump: n(-3, 3, "Size of the jump."),
        jumpDays: n(1, 3650, "How long the jump takes."),
      }),
      keyframes,
    },
    { description: "True skill over time: a preset curve, or keyframes." },
  );
}

/** A player's true skill, with exact values. */
export const PlayerSkill = skillSchema(exact);
/** A group's true skill: preset settings are ranges, drawn per player. */
export const GroupSkill = skillSchema(span);

const BiasSd = g.object({ bias: g.number({ minimum: -3, maximum: 3 }), sd: g.number({ minimum: 0, maximum: 3 }) });

/** How generated players' starting ratings are made. Claimed rating = true skill + Normal(bias, sd). */
export const StartingRatings = g.refine(
  g.object(
    {
      mix: g.object({
        self: exact(0, 1),
        club: exact(0, 1),
        external: exact(0, 1),
        default: exact(0, 1),
      }),
      self: BiasSd,
      club: BiasSd,
      external: BiasSd,
    },
    { description: "Share of players starting from each source, and how far each source's claims miss true skill." },
  ),
  "mix sums to 1",
  (s, path, issues) => {
    const m = s.mix;
    if (Math.abs(m.self + m.club + m.external + m.default - 1) > 1e-6) issues.push({ path: `${path}/mix`, message: "must sum to 1" });
  },
);

export const Club = g.object({
  id: Id,
  label: Label,
  tier: SourceTier,
});

export const PlayerGroup = g.object(
  {
    id: Id,
    label: Label,
    count: g.integer({ minimum: 1, maximum: RECIPE_V2_LIMITS.maxPlayers }),
    home: Id,
    skill: GroupSkill,
    volatility: span(0, 1, "How far, typically, a player plays above or below true skill (standard deviation)."),
    travel: span(0, 1, "Chance, each week, of considering events at other clubs."),
    appetite: span(-1, 1, "-1 plays down, 0 at their level, +1 plays up."),
    attendance: span(0, 1, "Chance of playing in a given week."),
    joinDay: span(0, RECIPE_V2_LIMITS.maxDays),
    startingRatings: g.optional(StartingRatings),
  },
  { description: "Many players drawn from ranges. Player ids are `<group id>.<n>`." },
);

export const PlayerSpec = g.object(
  {
    id: Id,
    label: Label,
    home: Id,
    skill: PlayerSkill,
    volatility: exact(0, 1),
    travel: exact(0, 1),
    appetite: exact(-1, 1),
    attendance: exact(0, 1),
    joinDay: Day,
    inactive: g.optional(g.array(g.tuple([Day, Day]), { maxItems: 8, description: "[start, end) day ranges away from play." })),
    startingRating: g.tagged("source", {
      self: g.object({ source: g.literal("self"), rating: g.Rating }),
      club: g.object({ source: g.literal("club"), rating: g.Rating }),
      external: g.object({ source: g.literal("external"), rating: g.Rating }),
      default: g.object({ source: g.literal("default") }),
    }),
  },
  { description: "A hand-made player, followed by name in results. Player id is `p.<id>`." },
);

export const EventSchedule = g.tagged("kind", {
  weekly: g.object({
    kind: g.literal("weekly"),
    weekday: g.integer({ minimum: 0, maximum: 6, description: "0 = Monday ... 6 = Sunday." }),
    hour: g.optional(g.integer({ minimum: 0, maximum: 23 })),
    everyWeeks: g.optional(g.integer({ minimum: 1, maximum: 52 })),
    firstWeek: g.optional(g.integer({ minimum: 0, maximum: 260 })),
    lastWeek: g.optional(g.integer({ minimum: 0, maximum: 260 })),
  }),
  once: g.object({ kind: g.literal("once"), day: Day, hour: g.optional(g.integer({ minimum: 0, maximum: 23 })) }),
});

export const EventFormatSpec = g.tagged("type", {
  league: g.object({
    type: g.literal("league"),
    movesPerCourt: g.optional(g.integer({ minimum: 0, maximum: 2, description: "Players who move up or down a court each week. Default 1." })),
    season: g.optional(g.object({ weeks: g.integer({ minimum: 1, maximum: 52 }) }, { description: "Register for this many occurrences; eligibility is checked at registration." })),
  }),
});

export const Scoring = g.refine(
  g.object({
    games: g.integer({ minimum: 1, maximum: 5, description: "Games per match: 1, 3, or 5 (best of)." }),
    to: g.integer({ minimum: 5, maximum: 25 }),
    winBy: g.integer({ minimum: 1, maximum: 5 }),
  }),
  "games is odd",
  (s, path, issues) => {
    if (s.games % 2 === 0) issues.push({ path: `${path}/games`, message: "must be odd" });
  },
);

export const EventSeries = g.refine(
  g.object({
    id: Id,
    label: Label,
    club: Id,
    invites: g.optional(g.array(Id, { maxItems: RECIPE_V2_LIMITS.maxClubs, description: "Other clubs whose players may enter." })),
    schedule: EventSchedule,
    range: g.optional(g.object({ min: g.optional(g.Rating), max: g.optional(g.Rating) })),
    playUp: g.optional(g.enumOf(["open", "margin", "strict"], { description: "Below `min`: open (default), within `playUpMargin`, or not at all." })),
    playUpMargin: g.optional(g.number({ minimum: 0, maximum: 3 })),
    provisional: g.optional(g.enumOf(["rating", "high"], { description: "Which provisional value meets `max`: the rating (default) or the top of the range." })),
    capacity: g.integer({ minimum: 4, maximum: RECIPE_V2_LIMITS.maxPlayers }),
    rated: g.optional(g.boolean({ description: "Submitted to GlassRank. Default true." })),
    format: EventFormatSpec,
    scoring: g.optional(Scoring),
  }),
  "range min <= max; playUp margin needs playUpMargin",
  (e, path, issues) => {
    const r = e.range;
    if (r?.min !== undefined && r.max !== undefined && r.min > r.max) issues.push({ path: `${path}/range`, message: "min must not exceed max" });
    if (e.playUp === "margin" && e.playUpMargin === undefined) issues.push({ path: `${path}/playUpMargin`, message: "required when playUp is margin" });
  },
);

export const WorldSettings = g.object({
  nightShare: exact(0, 1, "Share of volatility drawn once per event (a good or bad night); the rest is per match."),
  appetiteSpread: exact(0, 1, "Week-to-week randomness in the level a player aims for."),
  rallyK: g.number({ exclusiveMinimum: 0, maximum: 5, description: "Rally-win curve steepness: 0.5 + 0.5*k*d/(1+k*|d|)." }),
  startingRatings: StartingRatings,
});

export const SimulationRecipeV2 = g.refine(
  g.object(
    {
      recipeVersion: g.string({ pattern: SEMVER }),
      name: g.optional(g.string({ maxLength: 80 })),
      seed: g.integer({ minimum: 0, maximum: 4_294_967_295 }),
      durationDays: g.integer({ minimum: 7, maximum: RECIPE_V2_LIMITS.maxDays }),
      world: WorldSettings,
      clubs: g.array(Club, { minItems: 1, maxItems: RECIPE_V2_LIMITS.maxClubs }),
      groups: g.array(PlayerGroup, { maxItems: RECIPE_V2_LIMITS.maxGroups }),
      players: g.array(PlayerSpec, { maxItems: RECIPE_V2_LIMITS.maxHandMadePlayers }),
      events: g.array(EventSeries, { minItems: 1, maxItems: RECIPE_V2_LIMITS.maxEvents }),
      createdWith: g.optional(
        g.object({ engineVersion: g.string({ pattern: SEMVER }), simVersion: g.string({ pattern: SEMVER }), policyId: g.optional(g.PolicyId) }),
      ),
    },
    { title: "SimulationRecipeV2", description: "A simulated world of clubs, players, and events, reproducible exactly." },
  ),
  `recipeVersion is compatible with ${RECIPE_V2_VERSION}; ids are unique within clubs, groups, players, and events; ` +
    `every home, club, and invite names a club; at most ${RECIPE_V2_LIMITS.maxPlayers} players; keyframes are in day order ` +
    "within the run; inactive ranges have start < end",
  (r, path, issues) => {
    const [maj, min] = r.recipeVersion.split(".");
    const [cmaj, cmin] = RECIPE_V2_VERSION.split(".");
    if (maj !== cmaj || (cmaj === "0" && min !== cmin)) {
      issues.push({ path: `${path}/recipeVersion`, message: `recipe version ${r.recipeVersion} is not compatible with ${RECIPE_V2_VERSION}` });
    }
    const unique = (list: readonly { id: string }[], where: string) => {
      const seen = new Set<string>();
      list.forEach((x, i) => {
        if (seen.has(x.id)) issues.push({ path: `${path}/${where}/${i}/id`, message: `duplicate id ${x.id}` });
        seen.add(x.id);
      });
    };
    unique(r.clubs, "clubs");
    unique(r.groups, "groups");
    unique(r.players, "players");
    unique(r.events, "events");
    const clubs = new Set(r.clubs.map((c) => c.id));
    const known = (id: string, at: string) => {
      if (!clubs.has(id)) issues.push({ path: at, message: `unknown club ${id}` });
    };
    r.groups.forEach((gr, i) => known(gr.home, `${path}/groups/${i}/home`));
    r.players.forEach((p, i) => known(p.home, `${path}/players/${i}/home`));
    r.events.forEach((e, i) => {
      known(e.club, `${path}/events/${i}/club`);
      (e.invites ?? []).forEach((c, j) => known(c, `${path}/events/${i}/invites/${j}`));
    });
    const total = r.groups.reduce((n, gr) => n + gr.count, 0) + r.players.length;
    if (total > RECIPE_V2_LIMITS.maxPlayers) issues.push({ path: `${path}/groups`, message: `${total} players; the limit is ${RECIPE_V2_LIMITS.maxPlayers}` });
    const checkKeyframes = (skill: { preset: string; keyframes?: readonly (readonly [number, number])[] }, at: string) => {
      if (skill.preset !== "keyframes" || skill.keyframes === undefined) return;
      skill.keyframes.forEach(([day], i) => {
        if (day > r.durationDays) issues.push({ path: `${at}/keyframes/${i}`, message: "day is after the end of the run" });
        const prev = skill.keyframes?.[i - 1];
        if (prev !== undefined && prev[0] >= day) issues.push({ path: `${at}/keyframes/${i}`, message: "days must increase" });
      });
    };
    r.groups.forEach((gr, i) => checkKeyframes(gr.skill, `${path}/groups/${i}/skill`));
    r.players.forEach((p, i) => {
      checkKeyframes(p.skill, `${path}/players/${i}/skill`);
      (p.inactive ?? []).forEach(([a, b], j) => {
        if (a >= b) issues.push({ path: `${path}/players/${i}/inactive/${j}`, message: "start must be before end" });
      });
    });
  },
);

export type PlayerSkill = g.Infer<typeof PlayerSkill>;
export type GroupSkill = g.Infer<typeof GroupSkill>;
export type StartingRatings = g.Infer<typeof StartingRatings>;
export type Club = g.Infer<typeof Club>;
export type PlayerGroup = g.Infer<typeof PlayerGroup>;
export type PlayerSpec = g.Infer<typeof PlayerSpec>;
export type EventSchedule = g.Infer<typeof EventSchedule>;
export type EventSeries = g.Infer<typeof EventSeries>;
export type Scoring = g.Infer<typeof Scoring>;
export type WorldSettings = g.Infer<typeof WorldSettings>;
export type SimulationRecipeV2 = g.Infer<typeof SimulationRecipeV2>;
