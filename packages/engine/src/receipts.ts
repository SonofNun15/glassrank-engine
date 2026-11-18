/**
 * Receipt builder: turns one player's evidence update and rule applications
 * into the three-tier structured receipt.
 */
import type {
  EffectivePolicy,
  EventInput,
  NumberMap,
  Provenance,
  RatingState,
  ReasonCode,
  Receipt,
  RuleApplication,
} from "@glassrank/schema";
import { SCHEMA_VERSION } from "@glassrank/schema";
import type { EvidenceUpdate, PlayerGame } from "./evidence";
import { quantize } from "./math";
import type { PreState } from "./rate";
import type { RuleOutput } from "./rules";

export interface ReceiptInput {
  readonly event: EventInput;
  readonly policy: EffectivePolicy;
  readonly pre: PreState;
  readonly state: RatingState;
  readonly daysAway: number;
  readonly sigmaWidened: number;
  readonly evidence: EvidenceUpdate;
  readonly evidenceParams: NumberMap;
  readonly rules: RuleOutput | null;
  readonly playerGames: readonly PlayerGame[];
  readonly voidedMatches: number;
  /** Displayed ratings before the event, by player, for "beat higher-rated" facts. */
  readonly ratingsBefore: ReadonlyMap<string, number>;
  readonly provenance: Provenance;
}

/** Rating gap (displayed) that counts as "higher-rated" in headlines. */
const NOTABLE_GAP = 0.1;
/** Evidence change below this size counts as "as expected". */
const AS_EXPECTED = 0.005;

const q = quantize;
const avg = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function quantizeParams(params: NumberMap): NumberMap {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, q(v)]));
}

function quantizeRule(a: RuleApplication): RuleApplication {
  return { ...a, before: q(a.before), after: q(a.after), params: quantizeParams(a.params) };
}

export function buildReceipt(input: ReceiptInput): Receipt {
  const { pre, state, evidence, rules, event, policy } = input;
  const games = evidence.games;
  const delta = q(state.rating - pre.rating);
  const evidenceChange = evidence.mu - pre.mu;
  const rating = (id: string) => input.ratingsBefore.get(id) ?? 0;

  let gamesWon = 0;
  let higherRatedWins = 0;
  let lowerRatedLosses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const r of games) {
    const [pf, pa] = r.game.score;
    pointsFor += pf;
    pointsAgainst += pa;
    const ownTeam = avg([pre.rating, ...r.game.partners.map(rating)]);
    const opponents = avg(r.game.opponents.map(rating));
    if (pf > pa) {
      gamesWon++;
      if (opponents - ownTeam >= NOTABLE_GAP) higherRatedWins++;
    } else if (pf < pa && ownTeam - opponents >= NOTABLE_GAP) {
      lowerRatedLosses++;
    }
  }

  const fired = new Set(rules?.fired ?? []);
  const reasons: ReasonCode[] = [];
  const add = (r: ReasonCode, when: boolean) => {
    if (when && reasons.length < 4) reasons.push(r);
  };
  add("first_event", pre.isNew);
  add("beat_higher_rated", higherRatedWins > 0 && evidenceChange > 0);
  add("lost_to_lower_rated", lowerRatedLosses > 0 && evidenceChange < 0);
  add(
    evidenceChange > AS_EXPECTED ? "above_expected" : evidenceChange < -AS_EXPECTED ? "below_expected" : "as_expected",
    games.length > 0,
  );
  add("returning_after_break", fired.has("returning_protection"));
  add("decline_damped", fired.has("decline_damping"));
  add("decline_capped", fired.has("decline_cap"));
  add("gain_held", fired.has("large_gain_hold"));
  add("gain_released", fired.has("held_gain_release") && state.heldGain < pre.heldGain && delta > 0);
  add("correction_active", fired.has("correction_overlay"));
  add("correction_exempt", policy.overlay !== null && rules?.exemptFromOverlay === true);
  add("matches_voided", input.voidedMatches > 0);
  add("reduced_source_weight", policy.base.sourceWeights[event.source.tier] < 1);
  if (reasons.length === 0) reasons.push("as_expected");

  const keyGames = [...games]
    .sort(
      (a, b) =>
        Math.abs(b.contribution) - Math.abs(a.contribution) ||
        (a.game.matchId < b.game.matchId ? -1 : a.game.matchId > b.game.matchId ? 1 : a.game.gameIndex - b.game.gameIndex),
    )
    .slice(0, 3)
    .map((r) => ({ matchId: r.game.matchId, gameIndex: r.game.gameIndex, impact: q(r.contribution) }));

  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: event.eventId,
    playerId: pre.playerId,
    discipline: pre.discipline,
    occurredAt: event.occurredAt,
    before: { rating: q(pre.rating), mu: q(pre.mu), sigma: q(pre.sigma) },
    after: { rating: state.rating, mu: state.evidence.mu, sigma: state.evidence.sigma },
    headline: {
      delta,
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "none",
      reasons,
      facts: {
        games_played: games.length,
        games_won: gamesWon,
        higher_rated_wins: higherRatedWins,
        lower_rated_losses: lowerRatedLosses,
        voided_matches: input.voidedMatches,
      },
    },
    summary: {
      gamesPlayed: games.length,
      gamesWon,
      expectedGamesWon: q(games.reduce((s, r) => s + r.winProbability, 0)),
      pointsFor,
      pointsAgainst,
      expectedPointShare: games.length === 0 ? 0.5 : q(avg(games.map((r) => r.expectedShare))),
      actualPointShare: pointsFor + pointsAgainst === 0 ? 0.5 : q(pointsFor / (pointsFor + pointsAgainst)),
      voidedMatches: input.voidedMatches,
      keyGames,
      protections: rules?.fired ?? [],
    },
    technical: {
      evidenceModel: policy.base.evidence.model,
      evidenceParams: quantizeParams(input.evidenceParams),
      sigmaWidening: { daysAway: input.daysAway, sigmaBefore: q(pre.sigma), sigmaAfter: q(input.sigmaWidened) },
      games: games.map((r) => ({
        matchId: r.game.matchId,
        gameIndex: r.game.gameIndex,
        partners: [...r.game.partners],
        opponents: [...r.game.opponents],
        score: [r.game.score[0], r.game.score[1]],
        weight: q(r.game.weight),
        expectedShare: q(r.expectedShare),
        actualShare: q(r.actualShare),
        contribution: q(r.contribution),
      })),
      evidenceDelta: { mu: q(state.evidence.mu - pre.mu), sigma: q(state.evidence.sigma - pre.sigma) },
      rules: (rules?.applications ?? []).map(quantizeRule),
    },
    provenance: input.provenance,
  };
}
