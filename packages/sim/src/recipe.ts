/**
 * Simulation recipes: everything needed to reproduce a simulated run exactly.
 *
 * A run is a pure function of its recipe, so a few kilobytes of JSON stand in
 * for megabytes of results. The same recipe can be downloaded, shared as a
 * link, or attached to feedback, and anyone can re-run it to see exactly what
 * the author saw. Size limits are part of the format so a server can accept
 * uploads without risking very long runs.
 */
import { ENGINE_VERSION } from "@glassrank/engine";
import * as g from "@glassrank/schema";
import { CorrectionOverlay, PolicyConfig, Rating, SourceTier } from "@glassrank/schema";
import type { Seed } from "@glassrank/schema";
import { MS_PER_DAY } from "@glassrank/schema";
import type { SimPlayer } from "./players";
import { COHORTS, type Scenario } from "./scenario";

export const RECIPE_VERSION = "0.1.0" as const;
export const SIM_VERSION = "0.1.0" as const;

/** Hard limits that keep any accepted recipe quick to run. */
export const RECIPE_LIMITS = {
  maxWeeks: 260,
  maxPlayers: 500,
  maxCustomPlayers: 20,
  maxClubs: 12,
  maxSystems: 4,
} as const;

const SEMVER = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$";

function range(lo: number, hi: number, description?: string) {
  return g.refine(
    g.tuple([g.number({ minimum: lo, maximum: hi }), g.number({ minimum: lo, maximum: hi })], description === undefined ? {} : { description }),
    "low <= high",
    (r, path, issues) => {
      if (r[0] > r[1]) issues.push({ path, message: "low must not exceed high" });
    },
  );
}

const unit = () => g.number({ minimum: 0, maximum: 1 });

const CohortSpec = g.object({
  count: g.integer({ minimum: 0, maximum: RECIPE_LIMITS.maxPlayers }),
  baseSkill: range(2, 8, "True skill when the player joins, drawn uniformly from [low, high)."),
});

const ClubSpec = g.object({
  id: g.string({ pattern: "^[a-z0-9][a-z0-9-]{0,31}$" }),
  tier: SourceTier,
  weekday: g.integer({ minimum: 0, maximum: 6, description: "0 = Monday ... 6 = Sunday." }),
  hourUtc: g.integer({ minimum: 0, maximum: 23 }),
  olderPool: g.optional(g.boolean()),
  inflates: g.optional(g.boolean({ description: "Reports close losses of a few favored members as wins." })),
});

const BiasSd = g.object({ bias: g.number({ minimum: -3, maximum: 3 }), sd: g.number({ minimum: 0, maximum: 3 }) });

/** Everything about the simulated community except seed, start date, and length. */
export const Community = g.object(
  {
    cohorts: g.object(Object.fromEntries(COHORTS.map((c) => [c, CohortSpec])) as Record<(typeof COHORTS)[number], typeof CohortSpec>),
    clubs: g.array(ClubSpec, { minItems: 1, maxItems: RECIPE_LIMITS.maxClubs }),
    players: g.object({
      secondClubChance: unit(),
      attendance: range(0, 1),
      bridgeCount: g.integer({ minimum: 0, maximum: 100 }),
      formSd: g.number({ minimum: 0, maximum: 2 }),
    }),
    trajectories: g.object({
      improverGain: range(0, 4),
      improverHalfLifeDays: range(1, 3650),
      newPlayerGain: range(0, 4),
      newPlayerHalfLifeDays: range(1, 3650),
      declinePerYear: range(0, 2),
      olderDeclinePerYear: range(0, 2),
      layoffStartDay: range(0, 3650),
      layoffDays: range(1, 3650),
      rust: range(0, 3),
      rustRecoveryDays: g.number({ exclusiveMinimum: 0, maximum: 3650 }),
    }),
    seeds: g.object({
      mix: g.object({ self: unit(), host: unit(), external_claimed: unit(), policy_default: unit() }),
      self: BiasSd,
      host: BiasSd,
      external_claimed: BiasSd,
    }),
    play: g.object({
      rallyK: g.number({ exclusiveMinimum: 0, maximum: 5 }),
      groupingNoiseSd: g.number({ minimum: 0, maximum: 3 }),
      target: g.integer({ minimum: 1, maximum: 50 }),
      winBy: g.integer({ minimum: 1, maximum: 5 }),
    }),
    inflation: g.object({
      favoredCount: g.integer({ minimum: 0, maximum: 100 }),
      maxMargin: g.integer({ minimum: 0, maximum: 50 }),
    }),
  },
  { description: "The simulated community: cohorts, clubs, and how play and starting ratings are generated." },
);

/** A player the recipe's author defines by hand, to follow through the run. */
export const CustomPlayer = g.object(
  {
    label: g.optional(g.string({ maxLength: 40, description: "Display name. User content: avoid real names." })),
    homeClub: g.string({ pattern: "^[a-z0-9][a-z0-9-]{0,31}$" }),
    otherClubs: g.optional(g.array(g.string({ pattern: "^[a-z0-9][a-z0-9-]{0,31}$" }), { maxItems: 3 })),
    joinWeek: g.integer({ minimum: 0, maximum: RECIPE_LIMITS.maxWeeks - 1 }),
    attendance: g.number({ minimum: 0.05, maximum: 1, description: "Chance of showing up to each weekly event." }),
    startSkill: Rating,
    improvement: g.optional(
      g.object({
        gain: g.number({ minimum: 0, maximum: 4, description: "Total eventual gain in true skill." }),
        halfLifeDays: g.number({ minimum: 1, maximum: 3650, description: "Days to reach half of the gain." }),
      }),
    ),
    declinePerYear: g.optional(g.number({ minimum: 0, maximum: 2 })),
    layoff: g.optional(
      g.object({
        startWeek: g.integer({ minimum: 0, maximum: RECIPE_LIMITS.maxWeeks }),
        weeks: g.integer({ minimum: 1, maximum: 156 }),
        rust: g.number({ minimum: 0, maximum: 3, description: "Skill lost on return, recovered over the scenario's rustRecoveryDays." }),
      }),
    ),
    claimedStart: g.tagged("source", {
      self: g.object({ source: g.literal("self"), rating: Rating }),
      host: g.object({ source: g.literal("host"), rating: Rating }),
      external_claimed: g.object({ source: g.literal("external_claimed"), rating: Rating }),
      policy_default: g.object({ source: g.literal("policy_default") }),
    }),
    favored: g.optional(g.boolean({ description: "Favored by an inflating home club." })),
  },
  { description: "A hand-defined player. True skill = startSkill, plus improvement, minus decline, minus rust after a layoff." },
);

/** One rating system to run over the world. */
export const RatingSystem = g.object({
  label: g.string({ minLength: 1, maxLength: 40 }),
  policy: PolicyConfig,
  overlays: g.array(CorrectionOverlay, { maxItems: 4, description: "Correction overlays, in effect at their own dates." }),
});

export const SimulationRecipe = g.refine(
  g.object(
    {
      recipeVersion: g.string({ pattern: SEMVER }),
      name: g.optional(g.string({ maxLength: 80 })),
      seed: g.integer({ minimum: 0, maximum: 4_294_967_295 }),
      startDate: g.string({ pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "A Monday; week 0 starts here." }),
      weeks: g.integer({ minimum: 1, maximum: RECIPE_LIMITS.maxWeeks }),
      community: Community,
      customPlayers: g.array(CustomPlayer, { maxItems: RECIPE_LIMITS.maxCustomPlayers }),
      systems: g.array(RatingSystem, { minItems: 1, maxItems: RECIPE_LIMITS.maxSystems }),
      createdWith: g.optional(g.object({ engineVersion: g.string({ pattern: SEMVER }), simVersion: g.string({ pattern: SEMVER }) })),
    },
    { title: "SimulationRecipe", description: "Everything needed to reproduce a simulated run exactly." },
  ),
  `recipeVersion is compatible with ${RECIPE_VERSION}; startDate is a real Monday; at most ${RECIPE_LIMITS.maxPlayers} players in total; ` +
    "seed mix sums to 1; club ids are unique and custom players' clubs exist; at least one regular club, and an older-pool club if " +
    "older_pool players exist; custom players join before the run ends; system labels are unique",
  (r, path, issues) => {
    const [maj, min] = r.recipeVersion.split(".");
    const [cmaj, cmin] = RECIPE_VERSION.split(".");
    if (maj !== cmaj || (cmaj === "0" && min !== cmin)) {
      issues.push({ path: `${path}/recipeVersion`, message: `recipe version ${r.recipeVersion} is not compatible with ${RECIPE_VERSION}` });
    }
    const start = g.tryParseTimestamp(`${r.startDate}T00:00:00Z`);
    if (start === undefined || (Math.floor(start / MS_PER_DAY) + 3) % 7 !== 0) {
      issues.push({ path: `${path}/startDate`, message: "must be a real date that falls on a Monday" });
    }
    const total = COHORTS.reduce((n, c) => n + r.community.cohorts[c].count, 0) + r.customPlayers.length;
    if (total > RECIPE_LIMITS.maxPlayers) {
      issues.push({ path: `${path}/community/cohorts`, message: `${total} players; the limit is ${RECIPE_LIMITS.maxPlayers}` });
    }
    const m = r.community.seeds.mix;
    if (Math.abs(m.self + m.host + m.external_claimed + m.policy_default - 1) > 1e-6) {
      issues.push({ path: `${path}/community/seeds/mix`, message: "must sum to 1" });
    }
    const ids = new Set<string>();
    r.community.clubs.forEach((c, i) => {
      if (ids.has(c.id)) issues.push({ path: `${path}/community/clubs/${i}/id`, message: `duplicate club id ${c.id}` });
      ids.add(c.id);
    });
    if (!r.community.clubs.some((c) => !c.olderPool)) {
      issues.push({ path: `${path}/community/clubs`, message: "need at least one regular (non-older-pool) club" });
    }
    if (r.community.cohorts.older_pool.count > 0 && !r.community.clubs.some((c) => c.olderPool)) {
      issues.push({ path: `${path}/community/clubs`, message: "older_pool players need an olderPool club" });
    }
    r.customPlayers.forEach((p, i) => {
      for (const club of [p.homeClub, ...(p.otherClubs ?? [])]) {
        if (!ids.has(club)) issues.push({ path: `${path}/customPlayers/${i}`, message: `unknown club ${club}` });
      }
      if (p.joinWeek >= r.weeks) issues.push({ path: `${path}/customPlayers/${i}/joinWeek`, message: "must be before the run ends" });
    });
    const labels = new Set<string>();
    r.systems.forEach((s, i) => {
      if (labels.has(s.label)) issues.push({ path: `${path}/systems/${i}/label`, message: `duplicate label ${s.label}` });
      labels.add(s.label);
    });
  },
);

export type Community = g.Infer<typeof Community>;
export type CustomPlayer = g.Infer<typeof CustomPlayer>;
export type RatingSystem = g.Infer<typeof RatingSystem>;
export type SimulationRecipe = g.Infer<typeof SimulationRecipe>;

/** The scenario a recipe describes. */
export function recipeScenario(r: SimulationRecipe): Scenario {
  return { seed: r.seed, startDate: r.startDate, weeks: r.weeks, ...r.community };
}

/** Custom players as simulator players plus their seeds. Ids are c-01, c-02, ... */
export function customPlayers(r: SimulationRecipe, startMs: number): { players: SimPlayer[]; seeds: Seed[] } {
  const players: SimPlayer[] = [];
  const seeds: Seed[] = [];
  r.customPlayers.forEach((c, i) => {
    const id = `c-${String(i + 1).padStart(2, "0")}`;
    const joinDay = c.joinWeek * 7;
    players.push({
      id,
      cohort: "custom",
      clubs: [c.homeClub, ...(c.otherClubs ?? []).filter((x) => x !== c.homeClub)],
      joinDay,
      attendance: c.attendance,
      baseSkill: c.startSkill,
      gain: c.improvement?.gain ?? 0,
      halfLifeDays: c.improvement?.halfLifeDays ?? 1,
      declinePerYear: c.declinePerYear ?? 0,
      layoff: c.layoff === undefined ? null : { startDay: c.layoff.startWeek * 7, endDay: (c.layoff.startWeek + c.layoff.weeks) * 7 },
      rust: c.layoff?.rust ?? 0,
      favored: c.favored ?? false,
      ...(c.label === undefined ? {} : { label: c.label }),
    });
    const recordedAt = g.formatTimestamp(startMs + joinDay * MS_PER_DAY);
    const claim = c.claimedStart;
    seeds.push(
      claim.source === "policy_default"
        ? { source: "policy_default", playerId: id, discipline: "doubles" }
        : { source: claim.source, playerId: id, discipline: "doubles", rating: claim.rating, recordedAt },
    );
  });
  return { players, seeds };
}

/** Build a recipe from a scenario, rating systems, and custom players. */
export function makeRecipe(
  scenario: Scenario,
  systems: readonly RatingSystem[],
  custom: readonly CustomPlayer[] = [],
  name?: string,
): SimulationRecipe {
  const { seed, startDate, weeks, ...community } = scenario;
  return {
    recipeVersion: RECIPE_VERSION,
    ...(name === undefined ? {} : { name }),
    seed,
    startDate,
    weeks,
    community,
    customPlayers: [...custom],
    systems: [...systems],
    createdWith: { engineVersion: ENGINE_VERSION, simVersion: SIM_VERSION },
  };
}
