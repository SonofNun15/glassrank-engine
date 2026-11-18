/**
 * rate(): one event in, new states and one receipt per participant out.
 */
import {
  RateRequest,
  SCHEMA_VERSION,
  assertValid,
  daysBetween,
  hashCanonical,
  matchDiscipline,
  parseTimestamp,
  type Diagnostic,
  type Discipline,
  type EffectivePolicy,
  type EventInput,
  type Prior,
  type RateResponse,
  type RatingState,
  type Receipt,
  type SeedSource,
} from "@glassrank/schema";
import { modelParams, updatePlayer, type Estimate, type PlayerGame } from "./evidence";
import { clamp, quantize } from "./math";
import { defaultRating } from "./policy";
import { buildReceipt } from "./receipts";
import { applyRules } from "./rules";
import { ENGINE_VERSION } from "./version";

/** A player's position before the event, whether from stored state or a seed. */
export interface PreState {
  readonly playerId: string;
  readonly discipline: Discipline;
  readonly rating: number;
  readonly mu: number;
  readonly sigma: number;
  readonly heldGain: number;
  readonly protectedEventsRemaining: number;
  readonly recentDeclines: RatingState["recentDeclines"];
  readonly counts: RatingState["counts"];
  readonly origin: { readonly source: SeedSource; readonly rating: number };
  readonly firstRatedAt: string | null;
  readonly lastPlayedAt: string | null;
  readonly isNew: boolean;
}

export const key = (discipline: string, playerId: string) => `${discipline}\u0000${playerId}`;

export function preState(prior: Prior, policy: EffectivePolicy): PreState {
  if (prior.kind === "state") {
    const s = prior.state;
    return { ...s, mu: s.evidence.mu, sigma: s.evidence.sigma, isNew: false };
  }
  const seed = prior.seed;
  const seeding = policy.base.seeding;
  const rating = clamp(
    seed.source === "policy_default" ? defaultRating(policy) : seed.rating,
    policy.base.scale.min,
    policy.base.scale.max,
  );
  const sigma = seed.source === "policy_default" ? seeding.defaultSigma : seeding.sigmaBySource[seed.source];
  return {
    playerId: seed.playerId,
    discipline: seed.discipline,
    rating,
    mu: rating,
    sigma,
    heldGain: 0,
    protectedEventsRemaining: 0,
    recentDeclines: [],
    counts: { events: 0, matches: 0, games: 0 },
    origin: { source: seed.source, rating },
    firstRatedAt: null,
    lastPlayedAt: null,
    isNew: true,
  };
}

/** Days since last play at `at`, and uncertainty widened for that time away. */
export function widen(pre: PreState, policy: EffectivePolicy, at: string): { daysAway: number; sigma: number } {
  if (pre.lastPlayedAt === null) return { daysAway: 0, sigma: pre.sigma };
  const daysAway = Math.max(0, daysBetween(parseTimestamp(pre.lastPlayedAt), parseTimestamp(at)));
  const inactivity = policy.base.inactivity;
  const extra = Math.max(0, daysAway - inactivity.graceDays) * inactivity.sigmaGrowthPerDay;
  return { daysAway, sigma: extra > 0 ? Math.max(pre.sigma, Math.min(inactivity.sigmaMax, pre.sigma + extra)) : pre.sigma };
}

/** Every game in the event, from each participant's side. Voided matches are skipped. */
function gamesByPlayer(event: EventInput, policy: EffectivePolicy): Map<string, PlayerGame[]> {
  const sourceWeight = policy.base.sourceWeights[event.source.tier];
  const out = new Map<string, PlayerGame[]>();
  for (const match of event.matches) {
    const discipline = matchDiscipline(match);
    for (const team of match.teams) for (const p of team) if (!out.has(key(discipline, p))) out.set(key(discipline, p), []);
    if (match.trust.voided) continue;
    const weight = sourceWeight * match.trust.weight;
    match.games.forEach((game, gameIndex) => {
      match.teams.forEach((team, side) => {
        const opponents = match.teams[side === 0 ? 1 : 0];
        const score: [number, number] = side === 0 ? [game.score[0], game.score[1]] : [game.score[1], game.score[0]];
        for (const p of team) {
          out.get(key(discipline, p))!.push({
            matchId: match.matchId,
            gameIndex,
            partners: team.filter((x) => x !== p),
            opponents,
            score,
            weight,
          });
        }
      });
    });
  }
  return out;
}

/**
 * Core of rate() without input validation. Callers inside the engine
 * (replay, forecast) pass requests they built themselves; the public
 * `rate()` validates first. Both run this same code.
 */
export function rateUnchecked(request: RateRequest): RateResponse {
  const { event, policy } = request;
  const config = policy.base.evidence;
  const inputHash = hashCanonical(request);
  const policyHash = hashCanonical(policy);
  const diagnostics: Diagnostic[] = [];

  const pre = new Map(request.priors.map((p) => {
    const s = preState(p, policy);
    return [key(s.discipline, s.playerId), s] as const;
  }));
  const widened = new Map<string, { daysAway: number; sigma: number }>();
  const estimates = new Map<string, Map<string, Estimate>>(); // per discipline: playerId -> estimate
  for (const [k, s] of pre) {
    if (s.lastPlayedAt !== null && s.lastPlayedAt > event.occurredAt) {
      diagnostics.push({
        level: "warning",
        code: "event_before_last_play",
        message: `${s.playerId} last played at ${s.lastPlayedAt}, after this event; treated as 0 days away`,
      });
    }
    const w = widen(s, policy, event.occurredAt);
    widened.set(k, w);
    if (!estimates.has(s.discipline)) estimates.set(s.discipline, new Map());
    estimates.get(s.discipline)!.set(s.playerId, { mu: s.mu, sigma: w.sigma });
  }

  const games = gamesByPlayer(event, policy);
  const states: RatingState[] = [];
  const receipts: Receipt[] = [];

  for (const [k, s] of [...pre].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const playerGames = games.get(k) ?? [];
    const w = widened.get(k)!;
    const returning = !s.isNew && w.daysAway >= policy.base.rules.returningProtection.awayDays;
    const protectedEvents = returning ? policy.base.rules.returningProtection.events : s.protectedEventsRemaining;
    const evidence = updatePlayer(config, s.playerId, playerGames, estimates.get(s.discipline)!);
    const played = playerGames.length > 0;

    const rules = played
      ? applyRules({
          policy,
          occurredAt: event.occurredAt,
          eventId: event.eventId,
          ratingBefore: s.rating,
          muBefore: s.mu,
          muAfter: evidence.mu,
          heldGain: s.heldGain,
          recentDeclines: s.recentDeclines,
          protectedEvents,
          daysAway: w.daysAway,
          gamesPlayed: playerGames.length,
          priorEvents: s.counts.events,
        })
      : null;

    const matchIds = new Set(playerGames.map((g) => g.matchId));
    const state: RatingState = {
      schemaVersion: SCHEMA_VERSION,
      playerId: s.playerId,
      discipline: s.discipline,
      rating: quantize(rules?.rating ?? s.rating),
      evidence: played
        ? { mu: quantize(evidence.mu), sigma: quantize(evidence.sigma) }
        : { mu: quantize(s.mu), sigma: quantize(s.sigma) },
      heldGain: quantize(rules?.heldGain ?? s.heldGain),
      protectedEventsRemaining: played ? Math.max(0, protectedEvents - 1) : s.protectedEventsRemaining,
      recentDeclines: (rules?.recentDeclines ?? s.recentDeclines).map((d) => ({ ...d, amount: quantize(d.amount) })),
      counts: {
        events: s.counts.events + (played ? 1 : 0),
        matches: s.counts.matches + matchIds.size,
        games: s.counts.games + playerGames.length,
      },
      origin: s.origin,
      firstRatedAt: s.firstRatedAt ?? event.occurredAt,
      lastPlayedAt: played ? event.occurredAt : (s.lastPlayedAt ?? event.occurredAt),
      lastUpdate: { eventId: event.eventId, engineVersion: ENGINE_VERSION, policyId: policy.base.policyId, policyHash, inputHash },
    };
    states.push(state);
    receipts.push(
      buildReceipt({
        event,
        policy,
        pre: s,
        state,
        daysAway: w.daysAway,
        sigmaWidened: w.sigma,
        evidence,
        evidenceParams: modelParams(config),
        rules,
        playerGames,
        voidedMatches: event.matches.filter((m) => m.trust.voided && m.teams.some((t) => t.includes(s.playerId))).length,
        ratingsBefore: new Map([...pre.values()].filter((p) => p.discipline === s.discipline).map((p) => [p.playerId, p.rating])),
        provenance: { schemaVersion: SCHEMA_VERSION, engineVersion: ENGINE_VERSION, policyId: policy.base.policyId, policyHash, overlayId: policy.overlay?.overlayId ?? null, inputHash },
      }),
    );
  }
  return { schemaVersion: SCHEMA_VERSION, inputHash, states, receipts, diagnostics };
}

/** Rate one event. Validates the request (throws `SchemaError` if invalid). */
export function rate(request: unknown): RateResponse {
  return rateUnchecked(assertValid(RateRequest, request));
}
