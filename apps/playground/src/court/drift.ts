/**
 * How far GlassRank ratings ended from true skill, across every player.
 *
 * Gap = rating - true skill after the player's last rated event: positive
 * means rated too high, negative too low. Players still provisional at the
 * end are left out (their rating is shown as a range, not a number).
 */
import type { PlayerHistory } from "@glassrank/sim";

/** Half a rating point: about one event bracket. */
export const OUTLIER_GAP = 0.5;
export const CLOSE_GAP = 0.25;
export const BIN = 0.1;

export interface PlayerGap {
  readonly player: PlayerHistory;
  readonly rating: number;
  readonly trueSkill: number;
  readonly gap: number;
  readonly events: number;
}

export interface ClubDrift {
  readonly club: string;
  readonly players: number;
  readonly meanGap: number;
  readonly medianAbsGap: number;
}

export interface Bin {
  /** Lower edge, inclusive. */
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

export interface DriftSummary {
  readonly measured: number;
  /** Still provisional at the end, or never played a rated event. */
  readonly leftOut: number;
  readonly medianAbsGap: number;
  readonly closeShare: number;
  readonly meanGap: number;
  readonly outliers: readonly PlayerGap[];
  readonly bins: readonly Bin[];
  readonly clubs: readonly ClubDrift[];
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function summarizeDrift(players: readonly PlayerHistory[]): DriftSummary {
  const gaps: PlayerGap[] = [];
  for (const player of players) {
    const last = player.points.at(-1);
    if (last === undefined || last.provisional !== null) continue;
    gaps.push({ player, rating: last.rating, trueSkill: last.trueSkill, gap: last.rating - last.trueSkill, events: player.points.length });
  }
  const abs = gaps.map((g) => Math.abs(g.gap));

  // Bins of 0.1, symmetric around zero, wide enough for every gap.
  const reach = Math.max(OUTLIER_GAP + BIN, Math.ceil(Math.max(0, ...abs) / BIN) * BIN);
  const steps = Math.round(reach / BIN);
  const bins: Bin[] = [];
  for (let i = -steps; i < steps; i++) {
    const from = Math.round(i * BIN * 10) / 10;
    const to = Math.round((i + 1) * BIN * 10) / 10;
    bins.push({ from, to, count: gaps.filter((g) => g.gap >= from && (g.gap < to || (i === steps - 1 && g.gap <= to))).length });
  }

  const byClub = new Map<string, PlayerGap[]>();
  for (const g of gaps) byClub.set(g.player.home, [...(byClub.get(g.player.home) ?? []), g]);

  return {
    measured: gaps.length,
    leftOut: players.length - gaps.length,
    medianAbsGap: median(abs),
    closeShare: gaps.length === 0 ? 0 : abs.filter((a) => a <= CLOSE_GAP).length / gaps.length,
    meanGap: mean(gaps.map((g) => g.gap)),
    outliers: gaps.filter((g) => Math.abs(g.gap) >= OUTLIER_GAP).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || (a.player.id < b.player.id ? -1 : 1)),
    bins,
    clubs: [...byClub].map(([club, list]) => ({
      club,
      players: list.length,
      meanGap: mean(list.map((g) => g.gap)),
      medianAbsGap: median(list.map((g) => Math.abs(g.gap))),
    })),
  };
}
