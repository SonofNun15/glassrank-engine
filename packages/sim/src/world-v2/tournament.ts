/**
 * Tournaments: players enter as teams of two who sign up together, then play
 * pools, a bracket, or a double-elimination draw. See
 * docs/design/sim-world-v2.md, "Tournaments".
 *
 * Every random draw comes from its own keyed stream (STREAM.tournament, ask,
 * breakup, and the occurrence stream with keys league play never uses), so
 * adding tournaments to a world leaves its leagues' draws unchanged.
 */
import type { Match } from "@glassrank/schema";
import type { Rng } from "../rng";
import { playSideOutGame, rallyWinProbability } from "../scores";
import { isEligible, rankCandidates, targetLevel, type RatingView } from "./choose";
import { isActive, trueSkillOf, type WorldPlayer } from "./people";
import type { EventSeries, Scoring, SimulationRecipeV2 } from "./recipe";
import { rankEntrants, type MatchResult } from "./standings";
import { STREAM, idKey } from "./streams";

/** Two player ids, sorted. */
export type Team = readonly [string, string];
export const teamKey = (t: Team) => `${t[0]}+${t[1]}`;
const makeTeam = (a: string, b: string): Team => (a < b ? [a, b] : [b, a]);
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const DEFAULT_TOURNAMENT_SETTINGS = { soloEntry: 0.03, roughBreakup: 0.6, reunion: 0.05 } as const;
const DEFAULT_POOL_SCORING: Scoring = { games: 1, to: 11, winBy: 2 };
const DEFAULT_BRACKET_SCORING: Scoring = { games: 3, to: 11, winBy: 2 };
/** Partners asked before a player gives up and registers alone. */
const MAX_ASKS = 3;
/** Fewest teams a tournament division needs to run. */
export const MIN_TEAMS = 4;

export type TournamentSettings = NonNullable<SimulationRecipeV2["world"]["tournaments"]>;

export interface Partnerships {
  /** Each player's current partner. */
  readonly current: Map<string, string>;
  /** Team keys of pairs who broke up. */
  readonly broken: Set<string>;
}

export interface TournamentSlot {
  readonly series: EventSeries;
  readonly index: number;
  readonly day: number;
}

function tournamentFormat(series: EventSeries) {
  if (series.format.type !== "tournament") throw new TypeError(`${series.id} is not a tournament`);
  return series.format;
}

export function teamEligible(a: RatingView, b: RatingView, series: EventSeries): boolean {
  if (tournamentFormat(series).teamRule === "average") {
    return isEligible({ rating: (a.rating + b.rating) / 2, high: (a.high + b.high) / 2 }, series);
  }
  return isEligible(a, series) && isEligible(b, series);
}

const opensTo = (series: EventSeries, home: string) => series.club === home || (series.onlyFrom?.includes(home) ?? true);

/**
 * Who enters which tournament this week, as teams. Players who want a
 * tournament ask a partner: their fixed partner, then (by loyalty) their
 * current one, then people they already play with whose rating is near the
 * level they're aiming for. A few register alone and are paired by rating.
 */
export function enterTournaments(args: {
  readonly week: number;
  readonly slots: readonly TournamentSlot[];
  readonly players: readonly WorldPlayer[];
  readonly byPlayer: ReadonlyMap<string, WorldPlayer>;
  readonly view: (id: string) => RatingView;
  readonly root: Rng;
  readonly appetiteSpread: number;
  readonly settings: TournamentSettings;
  readonly partnerships: Partnerships;
  readonly acquaintances: ReadonlyMap<string, ReadonlySet<string>>;
  readonly signup: ReadonlyMap<string, number>;
}): Map<TournamentSlot, Team[]> {
  const { week, slots, root, view, partnerships, settings } = args;
  const teams = new Map<TournamentSlot, Team[]>(slots.map((s) => [s, []]));
  const solos = new Map<TournamentSlot, string[]>(slots.map((s) => [s, []]));
  if (slots.length === 0) return teams;

  const byHome = new Map<string, string[]>();
  for (const p of args.players) byHome.set(p.home, [...(byHome.get(p.home) ?? []), p.id]);

  const initiators: { p: WorldPlayer; options: TournamentSlot[]; solo: boolean; target: number }[] = [];
  for (const p of args.players) {
    const tr = root.fork(STREAM.tournament, week, idKey(p.id));
    const wants = tr.chance(p.tournaments);
    const solo = tr.chance(settings.soloEntry);
    const noise = tr.normal(0, args.appetiteSpread);
    // Many more players travel for a tournament than for a league night; their home club's is always an option.
    const travels = tr.chance(p.tournamentTravel);
    if (!wants) continue;
    const v = view(p.id);
    const open = slots.filter((s) => isActive(p, s.day) && (s.series.club === p.home || travels) && opensTo(s.series, p.home) && isEligible(v, s.series));
    if (open.length === 0) continue;
    const target = targetLevel(v.rating, p.appetite, noise);
    initiators.push({ p, options: rankCandidates(open, target, v.rating, p.home), solo, target });
  }
  initiators.sort((a, b) => (args.signup.get(a.p.id) as number) - (args.signup.get(b.p.id) as number) || byId(a.p.id, b.p.id));

  const entered = new Set<string>();
  const full = (s: TournamentSlot) => (teams.get(s) as Team[]).length + Math.floor((solos.get(s) as string[]).length / 2) >= s.series.capacity;

  for (const { p, options, solo, target } of initiators) {
    if (entered.has(p.id)) continue;
    const ask = (c: string) => root.fork(STREAM.ask, week, idKey(p.id), idKey(c));
    /** Whether `c` could play `slot` with p as a team. */
    const available = (c: string, slot: TournamentSlot) => {
      const q = args.byPlayer.get(c);
      return q !== undefined && c !== p.id && !entered.has(c) && isActive(q, slot.day) && opensTo(slot.series, q.home) && teamEligible(view(p.id), view(c), slot.series);
    };
    /** Whether `c` says yes: they want to play, and will travel if it's not at their home club. */
    const agrees = (c: string, slot: TournamentSlot) => {
      const q = args.byPlayer.get(c) as WorldPlayer;
      const r = ask(c);
      const yes = r.chance(q.tournaments);
      const goes = r.chance(q.tournamentTravel);
      return yes && (slot.series.club === q.home || goes);
    };
    const enter = (slot: TournamentSlot, partner: string) => {
      entered.add(p.id);
      entered.add(partner);
      (teams.get(slot) as Team[]).push(makeTeam(p.id, partner));
    };
    // A fixed pair only ever plays together: if the partner can't come, they skip this tournament.
    if (p.partner !== null) {
      const together = options.find((s) => !full(s) && available(p.partner as string, s));
      if (together !== undefined) enter(together, p.partner);
      continue;
    }
    if (!solo) {
      // An established team picks a division they can both play: the current partner, by loyalty.
      const current = partnerships.current.get(p.id);
      const currentIsFree = current !== undefined && (args.byPlayer.get(current) as WorldPlayer).partner === null;
      const loyal = currentIsFree && root.fork(STREAM.ask, week, idKey(p.id), 0).chance(p.loyalty);
      if (loyal && current !== undefined) {
        const together = options.find((s) => !full(s) && available(current, s));
        if (together !== undefined && agrees(current, together)) {
          enter(together, current);
          continue;
        }
      }
    }

    const slot = options.find((s) => !full(s));
    if (slot === undefined) continue;
    if (solo) {
      entered.add(p.id);
      (solos.get(slot) as string[]).push(p.id);
      continue;
    }
    // People they already play with, nearest the level they're aiming for; former partners rarely, and last.
    let partner: string | null = null;
    const current = partnerships.current.get(p.id);
    let asked = current !== undefined ? 1 : 0;
    const pool = new Set([...(args.acquaintances.get(p.id) ?? []), ...(byHome.get(p.home) ?? [])]);
    const candidates = [...pool]
      // Someone with a fixed partner only plays with them.
      .filter((c) => c !== current && c !== p.partner && available(c, slot) && (args.byPlayer.get(c) as WorldPlayer).partner === null)
      .map((c) => {
        const broken = partnerships.broken.has(teamKey(makeTeam(p.id, c)));
        return { c, broken, dist: Math.abs(view(c).rating - target) };
      })
      .filter((x) => !x.broken || root.fork(STREAM.ask, week, idKey(p.id), idKey(x.c), 1).chance(settings.reunion))
      .sort((a, b) => Number(a.broken) - Number(b.broken) || a.dist - b.dist || byId(a.c, b.c));
    for (const { c } of candidates) {
      if (asked >= MAX_ASKS) break;
      asked++;
      if (agrees(c, slot)) {
        partner = c;
        break;
      }
    }
    if (partner === null) {
      entered.add(p.id);
      (solos.get(slot) as string[]).push(p.id);
    } else {
      enter(slot, partner);
    }
  }

  // The organizer pairs players who registered alone, closest in rating; any left over don't play.
  for (const slot of slots) {
    const list = [...(solos.get(slot) as string[])].sort((a, b) => view(b).rating - view(a).rating || byId(a, b));
    const t = teams.get(slot) as Team[];
    for (let i = 0; i + 1 < list.length && t.length < slot.series.capacity; i += 2) t.push(makeTeam(list[i] as string, list[i + 1] as string));
  }
  return teams;
}

export type Stage = "pool" | "bracket" | "main draw" | "back draw" | "final";

export interface TeamResult {
  readonly won: number;
  readonly played: number;
  /** Matches their true skills predicted they'd win (simulation only). */
  readonly expected: number;
}

export interface PlayedTournament {
  readonly matches: Match[];
  /** Pools as lists of players (or one group for a double-elimination draw), best seed first. */
  readonly groups: string[][];
  readonly night: ReadonlyMap<string, number>;
  readonly form: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly stages: ReadonlyMap<string, Stage>;
  readonly results: ReadonlyMap<string, TeamResult>;
  readonly teams: readonly Team[];
}

/**
 * Chance of winning one game for a team-skill gap, read off the rally model:
 * a 0.25 gap wins about 67% of games, 0.5 about 83%, 1.0 about 95%
 * (docs/design/sim-world.md). Used only to judge whether an event went badly.
 */
const GAME_WIN: readonly (readonly [number, number])[] = [
  [0, 0.5],
  [0.25, 0.67],
  [0.5, 0.83],
  [1, 0.95],
  [2, 0.995],
];
export function gameWinChance(gap: number): number {
  const d = Math.abs(gap);
  let p = 0.995;
  for (let i = 1; i < GAME_WIN.length; i++) {
    const [d1, p1] = GAME_WIN[i] as readonly [number, number];
    if (d <= d1) {
      const [d0, p0] = GAME_WIN[i - 1] as readonly [number, number];
      p = p0 + ((p1 - p0) * (d - d0)) / (d1 - d0);
      break;
    }
  }
  return gap >= 0 ? p : 1 - p;
}
export function matchWinChance(game: number, games: number): number {
  return games >= 3 ? game * game * (3 - 2 * game) : game;
}

/** Bracket positions for `size` (a power of two): seed numbers, 1-based, in standard order. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function playTournament(args: {
  readonly series: EventSeries;
  readonly index: number;
  readonly day: number;
  readonly teams: readonly Team[];
  readonly view: (id: string) => RatingView;
  readonly byPlayer: ReadonlyMap<string, WorldPlayer>;
  readonly root: Rng;
  readonly rallyK: number;
  readonly nightSd: number;
  readonly matchSd: number;
}): PlayedTournament | null {
  const { series, day, view, rallyK } = args;
  const fmt = tournamentFormat(series);
  if (args.teams.length < MIN_TEAMS) return null;
  const player = (id: string) => args.byPlayer.get(id) as WorldPlayer;
  const teamRating = (t: Team) => (view(t[0]).rating + view(t[1]).rating) / 2;
  const seeds = [...args.teams].sort((a, b) => teamRating(b) - teamRating(a) || byId(teamKey(a), teamKey(b)));
  const occ = args.root.fork(STREAM.occurrence, idKey(series.id), args.index);
  const allPlayers = seeds.flat();
  const night = new Map(allPlayers.map((id) => [id, occ.fork(1, idKey(id)).normal(0, player(id).volatility * args.nightSd)]));
  const lot = (t: Team) => occ.fork(8, idKey(teamKey(t))).next();

  const matches: Match[] = [];
  const form = new Map<string, Map<string, number>>();
  const stages = new Map<string, Stage>();
  const tally = new Map<string, { won: number; played: number; expected: number }>(seeds.map((t) => [teamKey(t), { won: 0, played: 0, expected: 0 }]));
  let k = 0;

  /** Play one match; returns the winner's index (0 for a, 1 for b) and the points each side scored. */
  const playMatch = (a: Team, b: Team, scoring: Scoring, matchId: string, stage: Stage): { winner: 0 | 1; points: [number, number] } => {
    const n = k++;
    const mf = new Map<string, number>();
    form.set(matchId, mf);
    stages.set(matchId, stage);
    const perf = (id: string) => {
      const f = (night.get(id) as number) + occ.fork(6, n, idKey(id)).normal(0, player(id).volatility * args.matchSd);
      mf.set(id, f);
      return trueSkillOf(player(id), day) + f;
    };
    const side = (t: Team) => (perf(t[0]) + perf(t[1])) / 2;
    const pA = rallyWinProbability(side(a), side(b), rallyK);
    const rally = occ.fork(7, n);
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
    const winner: 0 | 1 = won[0] >= need ? 0 : 1;
    matches.push({
      matchId,
      teams: [[...a], [...b]],
      gameFormat: { target: scoring.to, winBy: scoring.winBy, scoring: "side_out" },
      games,
      trust: { weight: 1, voided: false },
    });
    const truth = (t: Team) => (trueSkillOf(player(t[0]), day) + trueSkillOf(player(t[1]), day)) / 2;
    const pTrue = matchWinChance(gameWinChance(truth(a) - truth(b)), scoring.games);
    for (const [t, isWinner, p] of [
      [a, winner === 0, pTrue],
      [b, winner === 1, 1 - pTrue],
    ] as const) {
      const r = tally.get(teamKey(t)) as { won: number; played: number; expected: number };
      r.played += 1;
      r.expected += p;
      if (isWinner) r.won += 1;
    }
    return { winner, points };
  };

  /** Single elimination from a seed list; returns the champion and each round's losers. */
  const singleElimination = (entrants: readonly Team[], scoring: Scoring, prefix: string, stage: Stage) => {
    let size = 1;
    while (size < entrants.length) size *= 2;
    let round: (Team | null)[] = seedOrder(size).map((s) => entrants[s - 1] ?? null);
    const losers: Team[][] = [];
    let r = 0;
    while (round.length > 1) {
      r++;
      const next: (Team | null)[] = [];
      const lost: Team[] = [];
      for (let i = 0; i < round.length; i += 2) {
        const a = round[i] ?? null;
        const b = round[i + 1] ?? null;
        if (a === null || b === null) {
          next.push(a ?? b);
          continue;
        }
        const { winner } = playMatch(a, b, scoring, `${prefix}${r}-${i / 2 + 1}`, stage);
        next.push(winner === 0 ? a : b);
        lost.push(winner === 0 ? b : a);
      }
      losers.push(lost);
      round = next;
    }
    return { champion: round[0] ?? null, losers };
  };

  const poolScoring = series.scoring ?? DEFAULT_POOL_SCORING;
  const bracketScoring = fmt.bracketScoring ?? DEFAULT_BRACKET_SCORING;
  const groups: string[][] = [];

  if (fmt.structure === "double_elimination") {
    groups.push(allPlayers);
    // Main draw, round by round; losers drop into the back draw, where a second loss ends their day.
    let size = 1;
    while (size < seeds.length) size *= 2;
    let main: (Team | null)[] = seedOrder(size).map((s) => seeds[s - 1] ?? null);
    let back: Team[] = [];
    let r = 0;
    let br = 0;
    const playBack = (entrants: Team[]) => {
      br++;
      const next: Team[] = [];
      for (let i = 0; i < entrants.length; i += 2) {
        const a = entrants[i] as Team;
        const b = entrants[i + 1];
        if (b === undefined) {
          next.push(a);
          continue;
        }
        const { winner } = playMatch(a, b, bracketScoring, `d${br}-${i / 2 + 1}`, "back draw");
        next.push(winner === 0 ? a : b);
      }
      return next;
    };
    while (main.length > 1) {
      r++;
      const next: (Team | null)[] = [];
      const dropped: Team[] = [];
      for (let i = 0; i < main.length; i += 2) {
        const a = main[i] ?? null;
        const b = main[i + 1] ?? null;
        if (a === null || b === null) {
          next.push(a ?? b);
          continue;
        }
        const { winner } = playMatch(a, b, bracketScoring, `m${r}-${i / 2 + 1}`, "main draw");
        next.push(winner === 0 ? a : b);
        dropped.push(winner === 0 ? b : a);
      }
      main = next;
      const waiting = [...back, ...dropped];
      back = waiting.length > 1 ? playBack(waiting) : waiting;
    }
    while (back.length > 1) back = playBack(back);
    const champion = main[0] ?? null;
    const challenger = back[0];
    if (champion !== null && challenger !== undefined) playMatch(champion, challenger, bracketScoring, "final", "final");
  } else {
    // Pools, filled by snake seeding so each pool gets a fair mix.
    const poolSize = fmt.poolSize ?? 4;
    const nPools = Math.max(1, Math.ceil(seeds.length / poolSize));
    const pools: Team[][] = Array.from({ length: nPools }, () => []);
    seeds.forEach((t, s) => {
      const round = Math.floor(s / nPools);
      const pos = s % nPools;
      (pools[round % 2 === 0 ? pos : nPools - 1 - pos] as Team[]).push(t);
    });
    const standings: { team: Team; place: number; wins: number; diff: number }[] = [];
    pools.forEach((pool, pi) => {
      groups.push(pool.flat());
      const results: MatchResult[] = [];
      let m = 0;
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const a = pool[i] as Team;
          const b = pool[j] as Team;
          const { winner, points } = playMatch(a, b, poolScoring, `p${pi + 1}-${++m}`, "pool");
          results.push({ sides: [[teamKey(a)], [teamKey(b)]], points, winner });
        }
      }
      const byKey = new Map(pool.map((t) => [teamKey(t), t]));
      const ranked = rankEntrants([...byKey.keys()], results, (key) => lot(byKey.get(key) as Team));
      ranked.forEach((key, place) => {
        const wins = results.filter((r) => r.sides[r.winner][0] === key).length;
        const diff = results.reduce((d, r) => d + (r.sides[0][0] === key ? r.points[0] - r.points[1] : r.sides[1][0] === key ? r.points[1] - r.points[0] : 0), 0);
        standings.push({ team: byKey.get(key) as Team, place, wins, diff });
      });
    });

    if (fmt.structure === "pools_then_bracket") {
      const advance = fmt.advance ?? 2;
      // Seed the bracket by finishing place, then by wins and point differential across pools.
      const qualifiers = standings
        .filter((s) => s.place < advance)
        .sort((a, b) => a.place - b.place || b.wins - a.wins || b.diff - a.diff || lot(a.team) - lot(b.team))
        .map((s) => s.team);
      if (qualifiers.length >= 2) singleElimination(qualifiers, bracketScoring, "b", "bracket");
    }
  }

  return {
    matches,
    groups,
    night,
    form,
    stages,
    results: new Map([...tally].map(([key, r]) => [key, { ...r }])),
    teams: seeds,
  };
}

/**
 * After a tournament, each team becomes its players' current partnership,
 * and may break up: usually after a rough event, sometimes anyway (by the
 * less loyal partner's loyalty). Fixed partners never break up.
 */
export function updatePartnerships(args: {
  readonly played: PlayedTournament;
  readonly partnerships: Partnerships;
  readonly byPlayer: ReadonlyMap<string, WorldPlayer>;
  readonly root: Rng;
  readonly series: EventSeries;
  readonly index: number;
  readonly settings: TournamentSettings;
}): void {
  const { partnerships } = args;
  for (const team of args.played.teams) {
    const [a, b] = team;
    const key = teamKey(team);
    const pa = args.byPlayer.get(a) as WorldPlayer;
    const pb = args.byPlayer.get(b) as WorldPlayer;
    partnerships.current.set(a, b);
    partnerships.current.set(b, a);
    if (pa.partner === b || pb.partner === a) continue;
    const r = args.played.results.get(key) as TeamResult;
    const rough = r.won < r.played / 3 || r.won <= r.expected - 1.5;
    const chance = rough ? args.settings.roughBreakup : (1 - Math.min(pa.loyalty, pb.loyalty)) * 0.3;
    if (args.root.fork(STREAM.breakup, idKey(args.series.id), args.index, idKey(key)).chance(chance)) {
      partnerships.broken.add(key);
      partnerships.current.delete(a);
      partnerships.current.delete(b);
    }
  }
}
