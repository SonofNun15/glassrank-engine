/**
 * Evidence layer: what the results alone say about each player's skill.
 *
 * Every model evaluates the whole event against frozen pre-event estimates,
 * so the order of games inside an event never matters.
 */
import type { EvidenceConfig, NumberMap } from "@glassrank/schema";
import { LN10, PI_SQUARED, logistic, sqrt } from "./math";

export interface Estimate {
  readonly mu: number;
  readonly sigma: number;
}

/** One game from one player's side. */
export interface PlayerGame {
  readonly matchId: string;
  readonly gameIndex: number;
  readonly partners: readonly string[];
  readonly opponents: readonly string[];
  /** [for, against] */
  readonly score: readonly [number, number];
  /** Source-tier weight times the match's trust weight. */
  readonly weight: number;
}

export interface GameResult {
  readonly game: PlayerGame;
  readonly winProbability: number;
  readonly expectedShare: number;
  readonly actualShare: number;
  /** This game's share of the evidence change in mu. */
  readonly contribution: number;
}

export interface EvidenceUpdate {
  readonly mu: number;
  readonly sigma: number;
  /** Uncertainty used for this event, after any per-event dynamics. */
  readonly sigmaUsed: number;
  readonly games: readonly GameResult[];
}

export interface Matchup {
  readonly winProbability: number;
  readonly expectedShare: number;
}

export function modelParams(config: EvidenceConfig): NumberMap {
  switch (config.model) {
    case "elo_baseline":
      return { k_factor: config.kFactor, spread: config.spread, use_margin: config.useMargin ? 1 : 0 };
    case "bayes_v0":
      return {
        win_scale: config.winScale,
        share_scale: config.shareScale,
        margin_weight: config.marginWeight,
        dynamics_sigma: config.dynamicsSigma,
        sigma_floor: config.sigmaFloor,
      };
  }
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function actualShare([pf, pa]: readonly [number, number]): number {
  return pf + pa === 0 ? 0.5 : pf / (pf + pa);
}

function winValue([pf, pa]: readonly [number, number]): number {
  return pf > pa ? 1 : pf < pa ? 0 : 0.5;
}

/**
 * Glicko's attenuation for uncertainty in the other players: a surprising
 * result against players we know little about tells us less.
 */
function attenuation(scale: number, variance: number): number {
  return 1 / sqrt(1 + (3 * scale * scale * variance) / PI_SQUARED);
}

/** Probabilities for side A against side B, from current estimates. */
export function matchup(config: EvidenceConfig, a: readonly Estimate[], b: readonly Estimate[]): Matchup {
  const gap = mean(a.map((e) => e.mu)) - mean(b.map((e) => e.mu));
  switch (config.model) {
    case "elo_baseline": {
      const p = logistic((gap * LN10) / config.spread);
      return { winProbability: p, expectedShare: p };
    }
    case "bayes_v0": {
      const n = a.length;
      const variance = [...a, ...b].reduce((s, e) => s + e.sigma * e.sigma, 0) / (n * n);
      const pw = logistic(config.winScale * attenuation(config.winScale, variance) * gap);
      const ps = logistic(config.shareScale * attenuation(config.shareScale, variance) * gap);
      return { winProbability: pw, expectedShare: ps };
    }
  }
}

/**
 * Update one player's estimate from all their games in the event.
 * `estimates` holds frozen pre-event values (already widened for time away).
 */
export function updatePlayer(
  config: EvidenceConfig,
  playerId: string,
  games: readonly PlayerGame[],
  estimates: ReadonlyMap<string, Estimate>,
): EvidenceUpdate {
  const self = estimates.get(playerId) as Estimate;
  const est = (id: string) => estimates.get(id) as Estimate;

  if (games.length === 0) return { mu: self.mu, sigma: self.sigma, sigmaUsed: self.sigma, games: [] };

  switch (config.model) {
    case "elo_baseline": {
      const results = games.map((g) => {
        const team = [self, ...g.partners.map(est)];
        const { winProbability: p } = matchup(config, team, g.opponents.map(est));
        const actual = config.useMargin ? actualShare(g.score) : winValue(g.score);
        return {
          game: g,
          winProbability: p,
          expectedShare: p,
          actualShare: actualShare(g.score),
          contribution: config.kFactor * g.weight * (actual - p),
        };
      });
      const mu = self.mu + results.reduce((s, r) => s + r.contribution, 0);
      return { mu, sigma: self.sigma, sigmaUsed: self.sigma, games: results };
    }

    case "bayes_v0": {
      const { winScale: cw, shareScale: cs, marginWeight: m } = config;
      const sigmaUsed = sqrt(self.sigma * self.sigma + config.dynamicsSigma * config.dynamicsSigma);
      const priorVariance = sigmaUsed * sigmaUsed;

      const parts = games.map((g) => {
        const team = [self, ...g.partners.map(est)];
        const opponents = g.opponents.map(est);
        const n = team.length;
        const gap = mean(team.map((e) => e.mu)) - mean(opponents.map((e) => e.mu));
        // Variance of the gap from everyone except this player.
        const others = [...g.partners.map(est), ...opponents].reduce((s, e) => s + e.sigma * e.sigma, 0) / (n * n);
        const gw = attenuation(cw, others);
        const gs = attenuation(cs, others);
        const pw = logistic(cw * gw * gap);
        const ps = logistic(cs * gs * gap);
        const sw = winValue(g.score);
        const ss = actualShare(g.score);
        const gradient = (g.weight * ((1 - m) * cw * gw * (sw - pw) + m * cs * gs * (ss - ps))) / n;
        const information =
          (g.weight * ((1 - m) * cw * cw * gw * gw * pw * (1 - pw) + m * cs * cs * gs * gs * ps * (1 - ps))) / (n * n);
        return { g, pw, ps, ss, gradient, information };
      });

      const posteriorVariance = 1 / (1 / priorVariance + parts.reduce((s, p) => s + p.information, 0));
      const results = parts.map((p) => ({
        game: p.g,
        winProbability: p.pw,
        expectedShare: p.ps,
        actualShare: p.ss,
        contribution: posteriorVariance * p.gradient,
      }));
      const mu = self.mu + results.reduce((s, r) => s + r.contribution, 0);
      const sigma = Math.max(config.sigmaFloor, sqrt(posteriorVariance));
      return { mu, sigma, sigmaUsed, games: results };
    }
  }
}
