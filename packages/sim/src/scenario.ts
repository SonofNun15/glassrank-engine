/**
 * Scenario: everything that defines a simulated world. A world is a pure
 * function of its scenario, so a scenario plus a seed reproduces a run.
 */
import type { SourceTier } from "@glassrank/schema";

export const COHORTS = [
  "fast_improver",
  "steady",
  "slow_decliner",
  "new_player",
  "returner",
  "older_pool",
] as const;
/** The simulated cohorts a scenario populates by count. */
export type CohortName = (typeof COHORTS)[number];
/** A player's cohort: a simulated cohort, or "custom" for a player defined in a recipe. */
export type Cohort = CohortName | "custom";

/** A [low, high) range; values are drawn uniformly from it. */
export type Range = readonly [low: number, high: number];

export interface CohortSpec {
  readonly count: number;
  /** True skill when the player joins. */
  readonly baseSkill: Range;
}

export interface ClubSpec {
  readonly id: string;
  readonly tier: SourceTier;
  /** 0 = Monday ... 6 = Sunday. */
  readonly weekday: number;
  /** Event start time, hour of day in UTC. */
  readonly hourUtc: number;
  /** Older-pool club: only older-pool players are members, plus bridges. */
  readonly olderPool?: boolean;
  /** Reports close losses of a few favored members as wins. */
  readonly inflates?: boolean;
}

export interface Scenario {
  readonly seed: number;
  /** A Monday, `YYYY-MM-DD`. Week 0 starts here. */
  readonly startDate: string;
  readonly weeks: number;
  readonly cohorts: { readonly [C in CohortName]: CohortSpec };
  readonly clubs: readonly ClubSpec[];
  readonly players: {
    /** Chance a regular player is also a member of a second club. */
    readonly secondClubChance: number;
    /** Weekly attendance probability, drawn per player. */
    readonly attendance: Range;
    /** Older-pool players who also belong to a regular club. */
    readonly bridgeCount: number;
    /** Per-event skill noise (a good night or a bad one). */
    readonly formSd: number;
  };
  readonly trajectories: {
    /** Fast improvers: total gain and days to reach half of it. */
    readonly improverGain: Range;
    readonly improverHalfLifeDays: Range;
    /** New players improve too, from a lower start. */
    readonly newPlayerGain: Range;
    readonly newPlayerHalfLifeDays: Range;
    /** Rating units lost per year. */
    readonly declinePerYear: Range;
    readonly olderDeclinePerYear: Range;
    /** Returners: when the layoff starts and how long it lasts, in days. */
    readonly layoffStartDay: Range;
    readonly layoffDays: Range;
    /** Skill lost to rust on return, recovered linearly over `rustRecoveryDays`. */
    readonly rust: Range;
    readonly rustRecoveryDays: number;
  };
  readonly seeds: {
    /** Probability of each seed source; must sum to 1. */
    readonly mix: {
      readonly self: number;
      readonly host: number;
      readonly external_claimed: number;
      readonly policy_default: number;
    };
    /** Seed = true skill + normal(bias, sd), rounded to 0.01. */
    readonly self: { readonly bias: number; readonly sd: number };
    readonly host: { readonly bias: number; readonly sd: number };
    readonly external_claimed: { readonly bias: number; readonly sd: number };
  };
  readonly play: {
    /**
     * Rally-win probability for a team-skill gap d (rating units):
     * 0.5 + 0.5 * k*d / (1 + k*|d|).
     */
    readonly rallyK: number;
    /** How well a host's grouping tracks true skill (sd of perception noise). */
    readonly groupingNoiseSd: number;
    readonly target: number;
    readonly winBy: number;
  };
  readonly inflation: {
    /** Favored members at an inflating club. */
    readonly favoredCount: number;
    /** Losses by this many points or fewer are reported as wins. */
    readonly maxMargin: number;
  };
}

export const DEFAULT_SCENARIO: Scenario = {
  seed: 1,
  startDate: "2026-01-05",
  weeks: 156,
  cohorts: {
    fast_improver: { count: 40, baseSkill: [2.6, 3.6] },
    steady: { count: 80, baseSkill: [2.8, 4.6] },
    slow_decliner: { count: 30, baseSkill: [3.0, 4.4] },
    new_player: { count: 50, baseSkill: [2.2, 3.0] },
    returner: { count: 25, baseSkill: [2.8, 4.2] },
    older_pool: { count: 30, baseSkill: [2.8, 4.0] },
  },
  clubs: [
    { id: "club-a", tier: "verified_host", weekday: 1, hourUtc: 23 },
    { id: "club-b", tier: "verified_host", weekday: 2, hourUtc: 23 },
    { id: "club-c", tier: "verified_host", weekday: 3, hourUtc: 23 },
    { id: "club-d", tier: "verified_host", weekday: 5, hourUtc: 14 },
    { id: "club-e", tier: "verified_host", weekday: 6, hourUtc: 14 },
    { id: "club-f", tier: "provisional_host", weekday: 4, hourUtc: 23 },
    { id: "club-g", tier: "provisional_host", weekday: 0, hourUtc: 23, inflates: true },
    { id: "club-older", tier: "verified_host", weekday: 2, hourUtc: 15, olderPool: true },
  ],
  players: {
    secondClubChance: 0.2,
    attendance: [0.4, 0.9],
    bridgeCount: 3,
    formSd: 0.15,
  },
  trajectories: {
    improverGain: [0.8, 1.5],
    improverHalfLifeDays: [120, 400],
    newPlayerGain: [0.5, 1.2],
    newPlayerHalfLifeDays: [90, 300],
    declinePerYear: [0.05, 0.15],
    olderDeclinePerYear: [0.02, 0.08],
    layoffStartDay: [120, 400],
    layoffDays: [90, 240],
    rust: [0.1, 0.4],
    rustRecoveryDays: 60,
  },
  seeds: {
    mix: { self: 0.5, host: 0.2, external_claimed: 0.1, policy_default: 0.2 },
    self: { bias: 0.2, sd: 0.4 },
    host: { bias: 0, sd: 0.25 },
    external_claimed: { bias: 0.1, sd: 0.3 },
  },
  play: {
    rallyK: 0.32,
    groupingNoiseSd: 0.3,
    target: 11,
    winBy: 2,
  },
  inflation: {
    favoredCount: 4,
    maxMargin: 4,
  },
};
