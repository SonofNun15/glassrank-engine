/**
 * Follow one player: re-run the world (runs are deterministic, so this is the
 * same run) and record everything needed to explain where their rating ended:
 * their settings, where and against whom they played, how they performed
 * against their true skill, and GlassRank's receipt for every event.
 */
import { explainReceipt, type Explanation } from "@glassrank/engine";
import { assertValid, type PolicyConfig, type SeedSource } from "@glassrank/schema";
import type { PlayerSkill } from "./recipe";
import { SimulationRecipeV2 } from "./recipe";
import { runWorldV2, scheduleFromDayZero, type FollowedEvent } from "./run";

export interface FollowedEventReport extends Omit<FollowedEvent, "receipt"> {
  /** GlassRank's explanation of the rating change, or null if the event wasn't rated. */
  readonly explanation: Explanation | null;
  readonly gamesWon: number;
  readonly gamesPlayed: number;
  /** Games the ratings expected them to win, from the receipt; null if unrated. */
  readonly expectedGamesWon: number | null;
  /** Rules that changed the outcome. */
  readonly protections: readonly string[];
}

export interface PlayerReport {
  readonly id: string;
  readonly label: string | null;
  readonly home: string;
  readonly group: string | null;
  readonly profile: {
    readonly volatility: number;
    readonly appetite: number;
    readonly travel: number;
    readonly attendance: number;
    readonly joinDay: number;
    readonly skill: PlayerSkill;
    readonly startingRating: { readonly source: SeedSource; readonly rating: number | null };
  };
  readonly events: readonly FollowedEventReport[];
  readonly summary: {
    readonly events: number;
    readonly gamesPlayed: number;
    readonly gamesWon: number;
    /** Over rated events only. */
    readonly expectedGamesWon: number;
    readonly ratedGamesPlayed: number;
    readonly ratedGamesWon: number;
    /** Events per league, most first. */
    readonly leagues: readonly { readonly series: string; readonly events: number }[];
    /** Events per court position (1 = top court). */
    readonly courts: readonly { readonly court: number; readonly events: number }[];
    /** Their true skill minus their court-mates', on average: how much stronger they really were than who they played. */
    readonly edge: number;
    /** How they played relative to their true skill, on average across matches. */
    readonly form: number;
    /** Court-mates' rating minus true skill, on average: below zero means they played in a pool rated too low. */
    readonly poolGap: number;
    /** Their own rating minus true skill going into events, on average. */
    readonly ownGap: number;
  };
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function followPlayer(input: unknown, policy: PolicyConfig, playerId: string, eventLabel: (seriesId: string) => string = (s) => s): PlayerReport {
  const recipe = assertValid(SimulationRecipeV2, input);
  const run = runWorldV2(recipe, scheduleFromDayZero(policy), { follow: playerId });
  const player = run.players.find((p) => p.id === playerId);
  if (player === undefined) throw new RangeError(`no player ${playerId}`);

  const events: FollowedEventReport[] = run.followed.map(({ receipt, ...e }) => {
    const gamesPlayed = e.matches.reduce((n, m) => n + m.games.length, 0);
    const gamesWon = e.matches.reduce((n, m) => n + m.games.filter(([a, b]) => a > b).length, 0);
    return {
      ...e,
      explanation: receipt === null ? null : explainReceipt(receipt, { eventLabel: eventLabel(e.series) }),
      gamesPlayed,
      gamesWon,
      expectedGamesWon: receipt?.summary.expectedGamesWon ?? null,
      protections: receipt?.summary.protections ?? [],
    };
  });

  const rated = events.filter((e) => e.rated);
  const count = (keys: readonly (string | number)[]) => {
    const m = new Map<string | number, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const mates = events.flatMap((e) => {
    const seen = new Map<string, { rating: number; trueSkill: number }>();
    for (const m of e.matches) for (const p of [...m.partners, ...m.opponents]) seen.set(p.id, p);
    return [...seen.values()].map((p) => ({ ...p, self: e.trueSkill }));
  });

  return {
    id: player.id,
    label: player.label,
    home: player.home,
    group: player.group,
    profile: {
      volatility: player.volatility,
      appetite: player.appetite,
      travel: player.travel,
      attendance: player.attendance,
      joinDay: player.joinDay,
      skill: player.skill,
      startingRating: { source: player.seed.source, rating: "rating" in player.seed ? player.seed.rating : null },
    },
    events,
    summary: {
      events: events.length,
      gamesPlayed: events.reduce((n, e) => n + e.gamesPlayed, 0),
      gamesWon: events.reduce((n, e) => n + e.gamesWon, 0),
      expectedGamesWon: rated.reduce((n, e) => n + (e.expectedGamesWon ?? 0), 0),
      ratedGamesPlayed: rated.reduce((n, e) => n + e.gamesPlayed, 0),
      ratedGamesWon: rated.reduce((n, e) => n + e.gamesWon, 0),
      leagues: [...count(events.map((e) => e.series))]
        .map(([series, n]) => ({ series: series as string, events: n }))
        .sort((a, b) => b.events - a.events || (a.series < b.series ? -1 : 1)),
      courts: [...count(events.map((e) => e.court))].map(([court, n]) => ({ court: court as number, events: n })).sort((a, b) => a.court - b.court),
      edge: mean(mates.map((m) => m.self - m.trueSkill)),
      form: mean(events.flatMap((e) => e.matches.map((m) => m.form))),
      poolGap: mean(mates.map((m) => m.rating - m.trueSkill)),
      ownGap: mean(events.map((e) => e.ratingBefore - e.trueSkill)),
    },
  };
}
