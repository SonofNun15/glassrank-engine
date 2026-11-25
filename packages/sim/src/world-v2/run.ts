/**
 * Run a v2 world through the engine, week by week. Ratings decide who may
 * enter which event, so the world and the ratings move together (closed
 * loop): every rating change can change who plays where next week.
 *
 * Pure: the same recipe and policy schedule always give the same run.
 */
import { rateUnchecked, resolvePolicy } from "@glassrank/engine";
import {
  MS_PER_DAY,
  SCHEMA_VERSION,
  formatTimestamp,
  parseTimestamp,
  type EventInput,
  type Match,
  type PolicyConfig,
  type PolicySchedule,
  type Prior,
  type RatingState,
  type Receipt,
} from "@glassrank/schema";
import { scheduleOf } from "../policies";
import { Rng } from "../rng";
import { playSideOutGame, rallyWinProbability } from "../scores";
import { isEligible, rankCandidates, targetLevel, type RatingView } from "./choose";
import { FIVE_ROTATIONS, FOUR_ROTATIONS, carryOrder, courtSizes, moveCourts, seatCourts } from "./league";
import { createWorldPlayers, isActive, trueSkillOf, type WorldPlayer } from "./people";
import type { Club, EventSeries, Scoring, SimulationRecipeV2 } from "./recipe";
import { rankEntrants, type MatchResult } from "./standings";
import { STREAM, idKey } from "./streams";

/** Day 0 behind the scenes: a Monday. Never shown; the Test court shows relative days. */
export const EPOCH_DATE = "2001-01-01";
export const EPOCH_MS = parseTimestamp(`${EPOCH_DATE}T00:00:00Z`);
const DEFAULT_HOUR = 18;
const DEFAULT_SCORING: Scoring = { games: 1, to: 11, winBy: 2 };

/** A policy in force from day 0, for running recipes. */
export function scheduleFromDayZero(policy: PolicyConfig): PolicySchedule {
  return scheduleOf(policy, formatTimestamp(EPOCH_MS));
}

export interface RatingPoint {
  readonly eventId: string;
  readonly series: string;
  readonly day: number;
  readonly ratingBefore: number;
  readonly rating: number;
  readonly trueSkill: number;
  /** Likely range while provisional, else null. */
  readonly provisional: { readonly low: number; readonly high: number; readonly eventsRemaining: number } | null;
}

export interface Occurrence {
  readonly eventId: string;
  readonly series: string;
  readonly club: string;
  readonly day: number;
  readonly rated: boolean;
  /** Player ids, best court first. */
  readonly players: readonly string[];
  /** Ratings when players chose the event, and true skill on the day. */
  readonly meanRating: number;
  readonly meanTrueSkill: number;
}

/** Someone who shared a court with the followed player. */
export interface CourtMate {
  readonly id: string;
  /** GlassRank rating going into the event. */
  readonly rating: number;
  readonly trueSkill: number;
}

export interface FollowedMatch {
  readonly matchId: string;
  readonly partners: readonly CourtMate[];
  readonly opponents: readonly CourtMate[];
  /** Each game as [points for, points against] from the followed player's side. */
  readonly games: readonly (readonly [number, number])[];
  readonly won: boolean;
  /** How the followed player played in this match, relative to their true skill (simulation only). */
  readonly form: number;
}

/** One event from the followed player's side, with what only a simulation knows. */
export interface FollowedEvent {
  readonly eventId: string;
  readonly series: string;
  readonly day: number;
  readonly rated: boolean;
  /** 1 is the top court. */
  readonly court: number;
  readonly courts: number;
  readonly ratingBefore: number;
  readonly rating: number;
  readonly trueSkill: number;
  /** The night's share of their form: how far above (+) or below (-) true skill they played all evening. */
  readonly nightForm: number;
  readonly matches: readonly FollowedMatch[];
  /** GlassRank's receipt for this player at this event, or null if unrated. */
  readonly receipt: Receipt | null;
}

export interface RunOptions {
  /** Record full detail for this player id (see FollowedEvent). */
  readonly follow?: string;
}

export interface WorldRunV2 {
  readonly players: readonly WorldPlayer[];
  /** Every event played, rated or not, in the order it happened. */
  readonly events: readonly EventInput[];
  readonly occurrences: readonly Occurrence[];
  /** Rating history per player id (rated events only). */
  readonly history: ReadonlyMap<string, readonly RatingPoint[]>;
  readonly finalStates: readonly RatingState[];
  /** Detail for `options.follow`, in event order; empty when not following anyone. */
  readonly followed: readonly FollowedEvent[];
}

interface SeriesState {
  occurrences: number;
  /** Last occurrence's finishing order, best court first. */
  order: string[];
  /** Registered players for the current season. */
  roster: Set<string>;
}

interface Slot {
  readonly series: EventSeries;
  readonly club: Club;
  readonly index: number;
  readonly day: number;
  readonly occurredAt: string;
  readonly seasonStart: boolean;
  readonly entrants: string[];
}

function occursThisWeek(series: EventSeries, week: number, durationDays: number): number | null {
  const s = series.schedule;
  let day: number;
  if (s.kind === "weekly") {
    const first = s.firstWeek ?? 0;
    if (week < first || (s.lastWeek !== undefined && week > s.lastWeek) || (week - first) % (s.everyWeeks ?? 1) !== 0) return null;
    day = week * 7 + s.weekday;
  } else {
    if (Math.floor(s.day / 7) !== week) return null;
    day = s.day;
  }
  return day < durationDays ? day : null;
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function runWorldV2(recipe: SimulationRecipeV2, schedule: PolicySchedule, options: RunOptions = {}): WorldRunV2 {
  const root = new Rng(recipe.seed);
  const players = createWorldPlayers(recipe, root, EPOCH_MS);
  const byPlayer = new Map(players.map((p) => [p.id, p]));
  const clubs = new Map(recipe.clubs.map((c) => [c.id, c]));
  const seriesList = [...recipe.events].sort((a, b) => byId(a.id, b.id));
  const states = new Map<string, SeriesState>(seriesList.map((s) => [s.id, { occurrences: 0, order: [], roster: new Set() }]));
  const latest = new Map<string, Prior>(players.map((p) => [p.id, { kind: "seed", seed: p.seed }]));
  const history = new Map<string, RatingPoint[]>(players.map((p) => [p.id, []]));
  const events: EventInput[] = [];
  const occurrences: Occurrence[] = [];
  const followed: FollowedEvent[] = [];
  const follow = options.follow;
  const { nightShare, appetiteSpread, rallyK } = recipe.world;
  const nightSd = Math.sqrt(nightShare);
  const matchSd = Math.sqrt(1 - nightShare);

  const weeks = Math.ceil(recipe.durationDays / 7);
  for (let week = 0; week < weeks; week++) {
    // This week's event occurrences.
    const slots: Slot[] = [];
    for (const series of seriesList) {
      const day = occursThisWeek(series, week, recipe.durationDays);
      if (day === null) continue;
      const state = states.get(series.id) as SeriesState;
      const index = state.occurrences++;
      const season = series.format.season;
      const seasonStart = season === undefined || index % season.weeks === 0;
      if (season !== undefined && seasonStart) state.roster = new Set();
      const hour = series.schedule.hour ?? DEFAULT_HOUR;
      slots.push({
        series,
        club: clubs.get(series.club) as Club,
        index,
        day,
        occurredAt: formatTimestamp(EPOCH_MS + day * MS_PER_DAY + hour * 3_600_000),
        seasonStart,
        entrants: [],
      });
    }
    if (slots.length === 0) continue;

    // Ratings as players see them when they sign up for the week.
    const weekAt = formatTimestamp(EPOCH_MS + week * 7 * MS_PER_DAY);
    const policyNow = resolvePolicy(schedule, weekAt);
    const fallback = policyNow === null ? 0 : (policyNow.overlay?.adjust.defaultRating ?? policyNow.base.seeding.defaultRating);
    const view = (id: string): RatingView => {
      const prior = latest.get(id) as Prior;
      if (prior.kind === "state") return { rating: prior.state.rating, high: prior.state.provisional?.high ?? prior.state.rating };
      const r = prior.seed.source === "policy_default" ? fallback : prior.seed.rating;
      return { rating: r, high: r };
    };

    // Each player's week: show up, maybe look further afield, aim for a level.
    const signup = new Map<string, number>();
    const committed: { player: WorldPlayer; slot: Slot }[] = [];
    const choosers: { player: WorldPlayer; options: Slot[] }[] = [];
    for (const p of players) {
      const wr = root.fork(STREAM.week, week, idKey(p.id));
      const attends = wr.chance(p.attendance);
      const travels = wr.chance(p.travel);
      const noise = wr.normal(0, appetiteSpread);
      signup.set(p.id, root.fork(STREAM.signup, week, idKey(p.id)).next());
      if (!attends) continue;

      const registered = slots.find((s) => !s.seasonStart && (states.get(s.series.id) as SeriesState).roster.has(p.id));
      if (registered !== undefined) {
        if (isActive(p, registered.day)) committed.push({ player: p, slot: registered });
        continue;
      }
      const v = view(p.id);
      const open = slots.filter(
        (s) =>
          isActive(p, s.day) &&
          s.seasonStart &&
          (s.series.club === p.home || (travels && (s.series.onlyFrom?.includes(p.home) ?? true))) &&
          isEligible(v, s.series),
      );
      if (open.length === 0) continue;
      choosers.push({ player: p, options: rankCandidates(open, targetLevel(v.rating, p.appetite, noise), v.rating, p.home) });
    }

    for (const { player, slot } of committed) slot.entrants.push(player.id);
    choosers.sort((a, b) => (signup.get(a.player.id) as number) - (signup.get(b.player.id) as number) || byId(a.player.id, b.player.id));
    for (const { player, options } of choosers) {
      const slot = options.find((s) => s.entrants.length < s.series.capacity);
      if (slot === undefined) continue;
      slot.entrants.push(player.id);
      if (slot.series.format.season !== undefined) (states.get(slot.series.id) as SeriesState).roster.add(player.id);
    }

    // Play, in time order; ratings update between events.
    slots.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : byId(a.series.id, b.series.id)));
    for (const slot of slots) {
      const state = states.get(slot.series.id) as SeriesState;
      const played = playLeague(slot, state, view, signup, byPlayer, root, rallyK, nightSd, matchSd);
      if (played === null) continue;
      const rated = slot.series.rated ?? true;
      events.push(played.event);
      occurrences.push({
        eventId: played.event.eventId,
        series: slot.series.id,
        club: slot.club.id,
        day: slot.day,
        rated,
        players: played.order,
        meanRating: played.order.reduce((s, id) => s + view(id).rating, 0) / played.order.length,
        meanTrueSkill: played.order.reduce((s, id) => s + trueSkillOf(byPlayer.get(id) as WorldPlayer, slot.day), 0) / played.order.length,
      });
      const policy = rated ? resolvePolicy(schedule, slot.occurredAt) : null;
      const ids = [...played.order].sort(byId);
      const result =
        policy === null ? null : rateUnchecked({ schemaVersion: SCHEMA_VERSION, priors: ids.map((id) => latest.get(id) as Prior), event: played.event, policy });
      const before = new Map(result?.receipts.map((r) => [r.playerId, r.before.rating]) ?? []);
      if (follow !== undefined && played.order.includes(follow)) {
        const mate = (id: string): CourtMate => ({ id, rating: before.get(id) ?? view(id).rating, trueSkill: trueSkillOf(byPlayer.get(id) as WorldPlayer, slot.day) });
        const court = played.courts.findIndex((c) => c.includes(follow));
        const after = result?.states.find((st) => st.playerId === follow)?.rating;
        const ratingBefore = before.get(follow) ?? view(follow).rating;
        followed.push({
          eventId: played.event.eventId,
          series: slot.series.id,
          day: slot.day,
          rated: result !== null,
          court: court + 1,
          courts: played.courts.length,
          ratingBefore,
          rating: after ?? ratingBefore,
          trueSkill: trueSkillOf(byPlayer.get(follow) as WorldPlayer, slot.day),
          nightForm: played.night.get(follow) as number,
          matches: played.event.matches.flatMap((m) => {
            const side = m.teams[0].includes(follow) ? 0 : m.teams[1].includes(follow) ? 1 : -1;
            if (side === -1) return [];
            const other = side === 0 ? 1 : 0;
            const games = m.games.map((gm) => [gm.score[side], gm.score[other]] as const);
            const wins = games.filter(([a, b]) => a > b).length;
            return [
              {
                matchId: m.matchId,
                partners: m.teams[side].filter((id) => id !== follow).map(mate),
                opponents: m.teams[other].map(mate),
                games,
                won: wins > games.length - wins,
                form: (played.form.get(m.matchId) as Map<string, number>).get(follow) as number,
              },
            ];
          }),
          receipt: result?.receipts.find((r) => r.playerId === follow) ?? null,
        });
      }
      if (result === null) continue;
      for (const st of result.states) {
        latest.set(st.playerId, { kind: "state", state: st });
        (history.get(st.playerId) as RatingPoint[]).push({
          eventId: played.event.eventId,
          series: slot.series.id,
          day: slot.day,
          ratingBefore: before.get(st.playerId) as number,
          rating: st.rating,
          trueSkill: trueSkillOf(byPlayer.get(st.playerId) as WorldPlayer, slot.day),
          provisional: st.provisional === null ? null : { low: st.provisional.low, high: st.provisional.high, eventsRemaining: st.provisional.eventsRemaining },
        });
      }
    }
  }

  const finalStates = [...latest.values()].flatMap((p) => (p.kind === "state" ? [p.state] : []));
  return { players, events, occurrences, history, finalStates, followed };
}

/** One league night. Returns null if fewer than four players came. */
function playLeague(
  slot: Slot,
  state: SeriesState,
  view: (id: string) => RatingView,
  signup: ReadonlyMap<string, number>,
  byPlayer: ReadonlyMap<string, WorldPlayer>,
  root: Rng,
  rallyK: number,
  nightSd: number,
  matchSd: number,
): {
  event: EventInput;
  order: string[];
  courts: string[][];
  night: ReadonlyMap<string, number>;
  /** matchId -> player -> performance minus true skill. */
  form: ReadonlyMap<string, ReadonlyMap<string, number>>;
} | null {
  const { series, day } = slot;
  const fmt = series.format;
  const scoring = series.scoring ?? DEFAULT_SCORING;
  let order = carryOrder(state.order, slot.entrants, (id) => view(id).rating);
  const { sizes, sitOut } = courtSizes(order.length);
  if (sizes.length === 0) return null;
  if (sitOut > 0) {
    // The last to sign up sit out.
    const last = new Set([...order].sort((a, b) => (signup.get(b) as number) - (signup.get(a) as number) || byId(a, b)).slice(0, sitOut));
    order = order.filter((id) => !last.has(id));
  }
  const courts = seatCourts(order, sizes);
  const occ = root.fork(STREAM.occurrence, idKey(series.id), slot.index);
  const player = (id: string) => byPlayer.get(id) as WorldPlayer;
  const night = new Map(order.map((id) => [id, occ.fork(1, idKey(id)).normal(0, player(id).volatility * nightSd)]));

  const matches: Match[] = [];
  const ranked: string[][] = [];
  const form = new Map<string, Map<string, number>>();
  courts.forEach((court, c) => {
    const rotations = court.length === 5 ? FIVE_ROTATIONS : FOUR_ROTATIONS;
    const results: MatchResult[] = [];
    rotations.forEach((rotation, r) => {
      const teams = rotation.map((side) => side.map((seat) => court[seat] as string)) as [string[], string[]];
      // Each draw has its own keyed stream, so recording it changes nothing.
      const matchForm = new Map<string, number>();
      form.set(`c${c + 1}-r${r + 1}`, matchForm);
      const perf = (id: string) => {
        const f = (night.get(id) as number) + occ.fork(2, c, r, idKey(id)).normal(0, player(id).volatility * matchSd);
        matchForm.set(id, f);
        return trueSkillOf(player(id), day) + f;
      };
      const team = (ids: string[]) => ids.reduce((s, id) => s + perf(id), 0) / ids.length;
      const pA = rallyWinProbability(team(teams[0]), team(teams[1]), rallyK);
      const rally = occ.fork(3, c, r);
      const need = Math.ceil(scoring.games / 2);
      const won: [number, number] = [0, 0];
      const points: [number, number] = [0, 0];
      const games: { score: [number, number] }[] = [];
      while (won[0] < need && won[1] < need) {
        const score = playSideOutGame(pA, { target: scoring.to, winBy: scoring.winBy }, rally);
        games.push({ score });
        points[0] += score[0];
        points[1] += score[1];
        won[score[0] > score[1] ? 0 : 1] += 1;
      }
      matches.push({
        matchId: `c${c + 1}-r${r + 1}`,
        teams,
        gameFormat: { target: scoring.to, winBy: scoring.winBy, scoring: "side_out" },
        games,
        trust: { weight: 1, voided: false },
      });
      results.push({ sides: teams, points, winner: won[0] >= need ? 0 : 1 });
    });
    ranked.push(rankEntrants(court, results, (id) => occ.fork(4, idKey(id)).next()));
  });
  state.order = moveCourts(ranked, fmt.movesPerCourt ?? 1);

  const event: EventInput = {
    schemaVersion: SCHEMA_VERSION,
    eventId: `${series.id}.${slot.index + 1}`,
    occurredAt: slot.occurredAt,
    format: "league",
    label: series.label ?? series.id,
    source: { hostId: slot.club.id, tier: slot.club.tier },
    matches,
  };
  return { event, order, courts, night, form };
}

/**
 * Every player's starting rating, as a club would see it before anyone plays:
 * the rating they bring, or the policy's default for new players. Cheap (no
 * games are played) and identical to the players a run creates.
 */
export function startingRatings(recipe: SimulationRecipeV2, defaultRating: number): { readonly id: string; readonly home: string; readonly rating: number }[] {
  return createWorldPlayers(recipe, new Rng(recipe.seed), EPOCH_MS).map((p) => ({
    id: p.id,
    home: p.home,
    rating: p.seed.source === "policy_default" ? defaultRating : p.seed.rating,
  }));
}
