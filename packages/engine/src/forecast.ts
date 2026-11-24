/**
 * forecast(): how ratings would change under different results of a planned
 * match, before it is played.
 *
 * Each outcome becomes a hypothetical one-match event that runs through
 * rateUnchecked(), the same code path as real updates, so a forecast can never
 * disagree with what rate() would do for that result.
 */
import {
  ForecastRequest,
  SCHEMA_VERSION,
  assertValid,
  hashCanonical,
  type EventInput,
  type ForecastOutcome,
  type ForecastResponse,
  type Game,
  type GameFormat,
} from "@glassrank/schema";
import { quantize } from "./math";
import { predictUnchecked } from "./predict";
import { rateUnchecked } from "./rate";

/**
 * The outcomes shown when the caller does not choose: one game, won and lost
 * by a wide, medium, and narrow margin (for a game to 11: 11-3, 11-7, 11-9,
 * 9-11, 7-11, 3-11).
 */
export function standardOutcomes(format: GameFormat): Game[][] {
  const t = format.target;
  const losers = [t - 8, t - 4, t - format.winBy].map((x) => Math.max(0, x));
  const wins = losers.map((l): Game[] => [{ score: [t, l] }]);
  const losses = [...losers].reverse().map((l): Game[] => [{ score: [l, t] }]);
  return [...wins, ...losses];
}

export function forecastUnchecked(request: ForecastRequest): ForecastResponse {
  const { prediction } = predictUnchecked({
    schemaVersion: SCHEMA_VERSION,
    at: request.occurredAt,
    priors: request.priors,
    teams: request.teams,
    gameFormat: request.gameFormat,
    policy: request.policy,
  });
  const pWin = prediction.gameWinProbability;

  const outcomes: ForecastOutcome[] = (request.outcomes ?? standardOutcomes(request.gameFormat)).map((games) => {
    const event: EventInput = {
      schemaVersion: SCHEMA_VERSION,
      eventId: "forecast",
      occurredAt: request.occurredAt,
      format: "other",
      source: request.source,
      matches: [
        {
          matchId: "forecast",
          teams: request.teams,
          gameFormat: request.gameFormat,
          games,
          trust: { weight: 1, voided: false },
        },
      ],
    };
    const result = rateUnchecked({ schemaVersion: SCHEMA_VERSION, priors: request.priors, event, policy: request.policy });
    // Probability of this win/loss pattern, from teams[0]'s side. Exact scores
    // are not modeled; a tied game has probability 0.
    const probability = games.reduce((p, g) => {
      const [a, b] = g.score;
      return p * (a > b ? pWin : a < b ? 1 - pWin : 0);
    }, 1);
    return {
      games: [...games],
      probability: quantize(probability),
      changes: result.receipts.map((r) => ({
        playerId: r.playerId,
        discipline: r.discipline,
        before: r.before,
        after: r.after,
        delta: r.headline.delta,
        rulesFired: [...r.summary.protections],
      })),
    };
  });

  return { schemaVersion: SCHEMA_VERSION, inputHash: hashCanonical(request), prediction, outcomes };
}

/** Forecast rating changes for possible results of a planned match. Validates the request. */
export function forecast(request: unknown): ForecastResponse {
  return forecastUnchecked(assertValid(ForecastRequest, request));
}
