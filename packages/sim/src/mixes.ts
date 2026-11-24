/**
 * Community mixes: the same clubs and rules with different populations, so
 * results can be checked across the kinds of communities GlassRank will meet.
 */
import { DEFAULT_SCENARIO, type Scenario } from "./scenario";

const withCohorts = (counts: Partial<Record<keyof Scenario["cohorts"], number>>): Scenario["cohorts"] => {
  const out = { ...DEFAULT_SCENARIO.cohorts };
  for (const [cohort, count] of Object.entries(counts) as [keyof Scenario["cohorts"], number][]) {
    out[cohort] = { ...out[cohort], count };
  }
  return out;
};

export const COMMUNITY_MIXES: Readonly<Record<string, Scenario>> = {
  /** The default world: a mix of improvers, steady players, decliners, newcomers, returners, and an older pool. */
  typical: DEFAULT_SCENARIO,
  /** A fast-growing scene: many newcomers and improvers. */
  growing: {
    ...DEFAULT_SCENARIO,
    cohorts: withCohorts({ fast_improver: 70, steady: 50, slow_decliner: 15, new_player: 110, returner: 15, older_pool: 20 }),
  },
  /** An established scene: mostly steady players and slow decliners, few newcomers. */
  mature: {
    ...DEFAULT_SCENARIO,
    cohorts: withCohorts({ fast_improver: 10, steady: 120, slow_decliner: 60, new_player: 15, returner: 30, older_pool: 40 }),
  },
  /** The typical population, but self-reported starting ratings run about 0.5 high. */
  overclaiming: {
    ...DEFAULT_SCENARIO,
    seeds: { ...DEFAULT_SCENARIO.seeds, self: { bias: 0.5, sd: 0.5 }, external_claimed: { bias: 0.4, sd: 0.4 } },
  },
};
