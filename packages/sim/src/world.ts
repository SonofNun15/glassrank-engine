/**
 * World generation: weekly doubles round robins at each club, turned into
 * schema-valid events. The output is what a hosted service would hold (seeds
 * and an ordered event log), plus ground truth the engine never sees.
 */
import {
  MS_PER_DAY,
  SCHEMA_VERSION,
  formatTimestamp,
  parseTimestamp,
  type EventInput,
  type Match,
  type Seed,
} from "@glassrank/schema";
import { createPlayers, createSeed, isActive, trueSkill, type SimPlayer } from "./players";
import { Rng } from "./rng";
import type { ClubSpec, Scenario } from "./scenario";
import { playSideOutGame, rallyWinProbability } from "./scores";

export interface ManipulatedGame {
  readonly eventId: string;
  readonly matchId: string;
  /** The score actually played, [teams[0], teams[1]]. */
  readonly trueScore: readonly [number, number];
}

export interface SimWorld {
  readonly scenario: Scenario;
  readonly players: readonly SimPlayer[];
  /** One doubles seed per player, sorted by playerId. */
  readonly seeds: readonly Seed[];
  /** Sorted by (occurredAt, eventId). */
  readonly events: readonly EventInput[];
  readonly truth: {
    /** Games an inflating host reported differently from how they were played. */
    readonly manipulated: readonly ManipulatedGame[];
  };
}

/** Day 0 of the scenario as epoch milliseconds. */
export function scenarioStartMs(scenario: Scenario): number {
  const ms = parseTimestamp(`${scenario.startDate}T00:00:00Z`);
  // 1970-01-01 was a Thursday, so Monday is day 4 modulo 7.
  if ((Math.floor(ms / MS_PER_DAY) + 3) % 7 !== 0) {
    throw new RangeError(`startDate must be a Monday: ${scenario.startDate}`);
  }
  return ms;
}

/** True skill of a player at an instant, for metrics. */
export function trueSkillAt(world: SimWorld, player: SimPlayer, timestampMs: number): number {
  const day = Math.floor((timestampMs - scenarioStartMs(world.scenario)) / MS_PER_DAY);
  return trueSkill(player, day, world.scenario.trajectories.rustRecoveryDays);
}

function validateScenario(s: Scenario): void {
  const { self, host, external_claimed, policy_default } = s.seeds.mix;
  if (Math.abs(self + host + external_claimed + policy_default - 1) > 1e-9) {
    throw new RangeError("seeds.mix must sum to 1");
  }
  const ids = new Set<string>();
  for (const c of s.clubs) {
    if (ids.has(c.id)) throw new RangeError(`duplicate club id ${c.id}`);
    ids.add(c.id);
    if (!Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6) {
      throw new RangeError(`club ${c.id}: weekday must be 0-6`);
    }
    if (!Number.isInteger(c.hourUtc) || c.hourUtc < 0 || c.hourUtc > 23) {
      throw new RangeError(`club ${c.id}: hourUtc must be 0-23`);
    }
  }
  if (!s.clubs.some((c) => !c.olderPool)) throw new RangeError("need at least one regular club");
  if (s.cohorts.older_pool.count > 0 && !s.clubs.some((c) => c.olderPool)) {
    throw new RangeError("older_pool players need an olderPool club");
  }
}

/** The three partner rotations of a group of four. */
const ROTATIONS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
] as const;

function roundRobin(
  scenario: Scenario,
  club: ClubSpec,
  members: readonly SimPlayer[],
  day: number,
  occurredAt: string,
  rng: Rng,
  manipulated: ManipulatedGame[],
): EventInput | null {
  const { play, players: pp, trajectories } = scenario;
  const present = members.filter((p) => isActive(p, day) && rng.chance(p.attendance));
  if (present.length < 4) return null;

  // Extras sit out; the host groups the rest by perceived level.
  const playing = rng.shuffle(present).slice(present.length % 4);
  const ranked = playing
    .map((p) => ({ p, perceived: trueSkill(p, day, trajectories.rustRecoveryDays) + rng.normal(0, play.groupingNoiseSd) }))
    .sort((a, b) => b.perceived - a.perceived || (a.p.id < b.p.id ? -1 : 1))
    .map((x) => x.p);
  const form = new Map(
    ranked.map((p) => [p.id, trueSkill(p, day, trajectories.rustRecoveryDays) + rng.normal(0, pp.formSd)]),
  );

  const eventId = `evt-${club.id}-${occurredAt.slice(0, 10)}`;
  const matches: Match[] = [];
  for (let g = 0; g * 4 < ranked.length; g++) {
    const group = ranked.slice(g * 4, g * 4 + 4);
    ROTATIONS.forEach((rotation, r) => {
      const teams = rotation.map((side) => side.map((i) => group[i] as SimPlayer)) as [SimPlayer[], SimPlayer[]];
      const skill = (team: SimPlayer[]) => team.reduce((sum, p) => sum + (form.get(p.id) as number), 0) / team.length;
      const pA = rallyWinProbability(skill(teams[0]), skill(teams[1]), play.rallyK);
      const played = playSideOutGame(pA, play, rng);
      const matchId = `g${g + 1}-r${r + 1}`;
      let reported: [number, number] = played;

      if (club.inflates) {
        const favoredA = teams[0].some((p) => p.favored);
        const favoredB = teams[1].some((p) => p.favored);
        if (favoredA !== favoredB) {
          const fav = favoredA ? 0 : 1;
          const opp = favoredA ? 1 : 0;
          const margin = played[opp] - played[fav];
          if (margin > 0 && margin <= scenario.inflation.maxMargin) {
            reported = [0, 0];
            reported[fav] = play.target;
            reported[opp] = Math.min(played[fav], play.target - play.winBy);
            manipulated.push({ eventId, matchId, trueScore: played });
          }
        }
      }

      matches.push({
        matchId,
        teams: [teams[0].map((p) => p.id), teams[1].map((p) => p.id)],
        gameFormat: { target: play.target, winBy: play.winBy, scoring: "side_out" },
        games: [{ score: reported }],
        trust: { weight: 1, voided: false },
      });
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    eventId,
    occurredAt,
    format: "round_robin",
    label: `${club.id} weekly round robin`,
    source: { hostId: club.id.replace(/^club-/, "host-"), tier: club.tier },
    matches,
  };
}

export interface ExtraPlayers {
  readonly players: readonly SimPlayer[];
  /** One seed per extra player. */
  readonly seeds: readonly Seed[];
}

/**
 * Generate a world. Pure: the same scenario (and extra players) always yields
 * the same world. Extra players, such as a recipe's custom players, join the
 * clubs they name and play like everyone else.
 */
export function generateWorld(scenario: Scenario, extra: ExtraPlayers = { players: [], seeds: [] }): SimWorld {
  validateScenario(scenario);
  const root = new Rng(scenario.seed);
  const startMs = scenarioStartMs(scenario);
  const generated = createPlayers(scenario, root.fork(1));
  const seedRng = root.fork(2);
  const players = [...generated, ...extra.players];
  const seeds = [...generated.map((p, i) => createSeed(p, scenario, startMs, seedRng.fork(i))), ...extra.seeds].sort(
    (a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
  );

  const manipulated: ManipulatedGame[] = [];
  const events: EventInput[] = [];
  for (let week = 0; week < scenario.weeks; week++) {
    scenario.clubs.forEach((club, clubIndex) => {
      const day = week * 7 + club.weekday;
      const occurredAt = formatTimestamp(startMs + day * MS_PER_DAY + club.hourUtc * 3_600_000);
      const members = players.filter((p) => p.clubs.includes(club.id));
      const event = roundRobin(scenario, club, members, day, occurredAt, root.fork(3, week, clubIndex), manipulated);
      if (event !== null) events.push(event);
    });
  }

  events.sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1
    : a.occurredAt > b.occurredAt ? 1
    : a.eventId < b.eventId ? -1
    : a.eventId > b.eventId ? 1
    : 0,
  );
  return { scenario, players, seeds, events, truth: { manipulated } };
}
