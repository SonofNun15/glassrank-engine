/**
 * Run a simulated world through the engine's public API, event by event,
 * recording what metrics need: the pre-event prediction for every game and
 * each participant's rating after each event, next to the hidden truth.
 */
import { predictUnchecked, rateUnchecked, resolvePolicy } from "@glassrank/engine";
import {
  MS_PER_DAY,
  SCHEMA_VERSION,
  parseTimestamp,
  type PolicySchedule,
  type Prior,
  type RatingState,
} from "@glassrank/schema";
import { trueSkill, type SimPlayer } from "./players";
import type { Cohort } from "./scenario";
import { scenarioStartMs, type SimWorld } from "./world";

export interface GameRecord {
  readonly eventId: string;
  readonly hostId: string;
  readonly day: number;
  /** Predicted probability that teams[0] wins, from pre-event states. */
  readonly predicted: number;
  /** Reported result for teams[0]: 1 win, 0 loss, 0.5 tie. */
  readonly outcome: number;
  readonly manipulated: boolean;
  /** Every player in the game had at least five prior events. */
  readonly established: boolean;
}

export interface PlayerEventRecord {
  readonly playerId: string;
  readonly cohort: Cohort;
  readonly day: number;
  /** 1 for the player's first event. */
  readonly eventNumber: number;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly muAfter: number;
  readonly trueSkill: number;
  readonly favored: boolean;
  readonly homeClub: string;
  /** Days since the player's previous event (0 for the first). */
  readonly daysAway: number;
}

export interface RunResult {
  readonly name: string;
  readonly games: readonly GameRecord[];
  readonly playerEvents: readonly PlayerEventRecord[];
  readonly finalStates: readonly RatingState[];
}

const key = (id: string) => `doubles\u0000${id}`;

export function runWorld(name: string, world: SimWorld, schedule: PolicySchedule): RunResult {
  const startMs = scenarioStartMs(world.scenario);
  const rr = world.scenario.trajectories.rustRecoveryDays;
  const players = new Map<string, SimPlayer>(world.players.map((p) => [p.id, p]));
  const latest = new Map<string, Prior>(world.seeds.map((seed) => [key(seed.playerId), { kind: "seed", seed }]));
  const eventCount = new Map<string, number>();
  const lastDay = new Map<string, number>();
  const manipulated = new Set(world.truth.manipulated.map((m) => `${m.eventId}/${m.matchId}`));
  const games: GameRecord[] = [];
  const playerEvents: PlayerEventRecord[] = [];

  for (const event of world.events) {
    const policy = resolvePolicy(schedule, event.occurredAt);
    if (policy === null) continue;
    const day = Math.floor((parseTimestamp(event.occurredAt) - startMs) / MS_PER_DAY);
    const ids = [...new Set(event.matches.flatMap((m) => m.teams.flat()))].sort();
    const priors = ids.map((id) => latest.get(key(id)) as Prior);
    const priorById = new Map(ids.map((id, i) => [id, priors[i] as Prior]));

    for (const match of event.matches) {
      const teams = match.teams;
      const matchPriors = [...teams[0], ...teams[1]].sort().map((id) => priorById.get(id) as Prior);
      const { prediction } = predictUnchecked({
        schemaVersion: SCHEMA_VERSION,
        at: event.occurredAt,
        priors: matchPriors,
        teams,
        gameFormat: match.gameFormat,
        policy,
      });
      for (const game of match.games) {
        const [a, b] = game.score;
        games.push({
          eventId: event.eventId,
          hostId: event.source.hostId,
          day,
          predicted: prediction.gameWinProbability,
          outcome: a > b ? 1 : a < b ? 0 : 0.5,
          manipulated: manipulated.has(`${event.eventId}/${match.matchId}`),
          established: [...teams[0], ...teams[1]].every((id) => (eventCount.get(id) ?? 0) >= 5),
        });
      }
    }

    const result = rateUnchecked({ schemaVersion: SCHEMA_VERSION, priors, event, policy });
    for (const state of result.states) {
      const p = players.get(state.playerId) as SimPlayer;
      const prior = priorById.get(state.playerId) as Prior;
      const n = (eventCount.get(p.id) ?? 0) + 1;
      eventCount.set(p.id, n);
      const before = result.receipts.find((r) => r.playerId === p.id)!.before.rating;
      playerEvents.push({
        playerId: p.id,
        cohort: p.cohort,
        day,
        eventNumber: n,
        ratingBefore: before,
        ratingAfter: state.rating,
        muAfter: state.evidence.mu,
        trueSkill: trueSkill(p, day, rr),
        favored: p.favored,
        homeClub: p.clubs[0] as string,
        daysAway: prior.kind === "seed" ? 0 : day - (lastDay.get(p.id) ?? day),
      });
      lastDay.set(p.id, day);
      latest.set(key(p.id), { kind: "state", state });
    }
  }

  const finalStates = [...latest.values()].flatMap((p) => (p.kind === "state" ? [p.state] : []));
  return { name, games, playerEvents, finalStates };
}
