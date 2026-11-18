/**
 * Simulated players: hidden true skill over time, club memberships, and the
 * starting rating each one claims. True skill is ground truth for metrics and
 * never reaches the engine.
 */
import { formatTimestamp, MS_PER_DAY, type Seed } from "@glassrank/schema";
import type { Rng } from "./rng";
import { COHORTS, type Cohort, type Range, type Scenario } from "./scenario";

export const SKILL_MIN = 2;
export const SKILL_MAX = 8;

export interface SimPlayer {
  readonly id: string;
  readonly cohort: Cohort;
  /** Club ids; the first is the home club. */
  readonly clubs: readonly string[];
  readonly joinDay: number;
  readonly attendance: number;
  readonly baseSkill: number;
  /** Improvers and new players: total gain and half-life in days. */
  readonly gain: number;
  readonly halfLifeDays: number;
  /** Decliners and older pool: rating units lost per year. */
  readonly declinePerYear: number;
  /** Returners: days [start, end) without play, and rust on return. */
  readonly layoff: { readonly startDay: number; readonly endDay: number } | null;
  readonly rust: number;
  /** Favored by an inflating host. */
  readonly favored: boolean;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const draw = (rng: Rng, [lo, hi]: Range) => rng.range(lo, hi);
const round2 = (x: number) => Math.round(x * 100) / 100;

/** True skill on `day` (days since the scenario start). */
export function trueSkill(player: SimPlayer, day: number, rustRecoveryDays: number): number {
  const d = Math.max(0, day - player.joinDay);
  let skill = player.baseSkill;
  switch (player.cohort) {
    case "fast_improver":
    case "new_player":
      skill += (player.gain * d) / (d + player.halfLifeDays);
      break;
    case "slow_decliner":
    case "older_pool":
      skill -= (player.declinePerYear * d) / 365;
      break;
    case "returner":
      if (player.layoff !== null && day >= player.layoff.endDay) {
        const recovered = Math.min(1, (day - player.layoff.endDay) / rustRecoveryDays);
        skill -= player.rust * (1 - recovered);
      }
      break;
    case "steady":
      break;
  }
  return clamp(skill, SKILL_MIN, SKILL_MAX);
}

/** Whether the player plays at all on `day`. */
export function isActive(player: SimPlayer, day: number): boolean {
  if (day < player.joinDay) return false;
  const l = player.layoff;
  return l === null || day < l.startDay || day >= l.endDay;
}

/** Create every player, with club memberships and favored flags. */
export function createPlayers(scenario: Scenario, rng: Rng): SimPlayer[] {
  const t = scenario.trajectories;
  const regularClubs = scenario.clubs.filter((c) => !c.olderPool).map((c) => c.id);
  const olderClubs = scenario.clubs.filter((c) => c.olderPool).map((c) => c.id);
  const lastJoinDay = Math.floor(scenario.weeks * 7 * 0.8);

  type Draft = { -readonly [K in keyof SimPlayer]: SimPlayer[K] } & { clubs: string[] };
  const drafts: Draft[] = [];
  let n = 0;
  for (const cohort of COHORTS) {
    const spec = scenario.cohorts[cohort];
    for (let i = 0; i < spec.count; i++) {
      n += 1;
      const r = rng.fork(1, n);
      const older = cohort === "older_pool";
      const home = older ? r.pick(olderClubs) : r.pick(regularClubs);
      const clubs = [home];
      if (!older && regularClubs.length > 1 && r.chance(scenario.players.secondClubChance)) {
        clubs.push(r.pick(regularClubs.filter((c) => c !== home)));
      }
      const improving = cohort === "fast_improver" || cohort === "new_player";
      const isNew = cohort === "new_player";
      const layoffStart = Math.floor(draw(r, t.layoffStartDay));
      drafts.push({
        id: `p-${String(n).padStart(4, "0")}`,
        cohort,
        clubs,
        joinDay: isNew ? r.int(lastJoinDay) : 0,
        attendance: draw(r, scenario.players.attendance),
        baseSkill: draw(r, spec.baseSkill),
        gain: improving ? draw(r, isNew ? t.newPlayerGain : t.improverGain) : 0,
        halfLifeDays: improving ? draw(r, isNew ? t.newPlayerHalfLifeDays : t.improverHalfLifeDays) : 1,
        declinePerYear:
          cohort === "slow_decliner" ? draw(r, t.declinePerYear)
          : older ? draw(r, t.olderDeclinePerYear)
          : 0,
        layoff:
          cohort === "returner"
            ? { startDay: layoffStart, endDay: layoffStart + Math.floor(draw(r, t.layoffDays)) }
            : null,
        rust: cohort === "returner" ? draw(r, t.rust) : 0,
        favored: false,
      });
    }
  }

  // Bridges: a few older-pool players also join a regular club.
  const bridgeRng = rng.fork(2);
  const olderPlayers = bridgeRng.shuffle(drafts.filter((p) => p.cohort === "older_pool"));
  for (const p of olderPlayers.slice(0, scenario.players.bridgeCount)) {
    if (regularClubs.length > 0) p.clubs.push(bridgeRng.pick(regularClubs));
  }

  // Favored members at each inflating club.
  for (const [i, club] of scenario.clubs.entries()) {
    if (!club.inflates) continue;
    const members = drafts.filter((p) => p.clubs[0] === club.id);
    for (const p of rng.fork(3, i).shuffle(members).slice(0, scenario.inflation.favoredCount)) {
      p.favored = true;
    }
  }
  return drafts;
}

/** The seed each player brings to their first event, per the scenario's seed mix. */
export function createSeed(player: SimPlayer, scenario: Scenario, startMs: number, rng: Rng): Seed {
  const mix = scenario.seeds.mix;
  const recordedAt = formatTimestamp(startMs + player.joinDay * MS_PER_DAY);
  const truth = trueSkill(player, player.joinDay, scenario.trajectories.rustRecoveryDays);
  const u = rng.next();
  const base = { playerId: player.id, discipline: "doubles" as const };
  const claimed = (source: "self" | "host" | "external_claimed"): Seed => {
    const { bias, sd } = scenario.seeds[source];
    const rating = round2(clamp(truth + rng.normal(bias, sd), SKILL_MIN, SKILL_MAX));
    return { source, ...base, rating, recordedAt };
  };
  if (u < mix.self) return claimed("self");
  if (u < mix.self + mix.host) return claimed("host");
  if (u < mix.self + mix.host + mix.external_claimed) return claimed("external_claimed");
  return { source: "policy_default", ...base };
}

