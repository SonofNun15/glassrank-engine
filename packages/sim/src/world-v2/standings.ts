/**
 * Standings, in the standard pickleball order:
 *   1. most wins
 *   2. head-to-head wins among the tied entrants only
 *   3. most points scored
 *   4. fewest points scored against
 *   5. drawn by lot
 *
 * Entrants are players (league courts, where partners rotate) or teams
 * (tournaments). Head-to-head counts only results where tied entrants were
 * on opposite sides.
 */

export interface MatchResult {
  /** Entrant ids on each side. In a league each player is an entrant. */
  readonly sides: readonly [readonly string[], readonly string[]];
  /** Total points for each side across the match's games. */
  readonly points: readonly [number, number];
  readonly winner: 0 | 1;
}

interface Tally {
  wins: number;
  scored: number;
  against: number;
}

/**
 * Entrants ranked best first. `lot` gives each entrant a number for the final
 * tiebreak (lower ranks higher); it must be distinct per entrant.
 */
export function rankEntrants(entrants: readonly string[], results: readonly MatchResult[], lot: (id: string) => number): string[] {
  const tally = new Map<string, Tally>(entrants.map((id) => [id, { wins: 0, scored: 0, against: 0 }]));
  for (const r of results) {
    for (const side of [0, 1] as const) {
      const other = side === 0 ? 1 : 0;
      for (const id of r.sides[side]) {
        const t = tally.get(id);
        if (t === undefined) continue;
        if (r.winner === side) t.wins += 1;
        t.scored += r.points[side];
        t.against += r.points[other];
      }
    }
  }
  const t = (id: string) => tally.get(id) as Tally;

  const byWins = new Map<number, string[]>();
  for (const id of entrants) byWins.set(t(id).wins, [...(byWins.get(t(id).wins) ?? []), id]);
  const out: string[] = [];
  for (const wins of [...byWins.keys()].sort((a, b) => b - a)) {
    const tied = byWins.get(wins) as string[];
    const tiedSet = new Set(tied);
    const h2h = new Map<string, number>(tied.map((id) => [id, 0]));
    if (tied.length > 1) {
      for (const r of results) {
        const winners = r.sides[r.winner];
        const losers = r.sides[r.winner === 0 ? 1 : 0];
        if (!losers.some((id) => tiedSet.has(id))) continue;
        for (const id of winners) if (tiedSet.has(id)) h2h.set(id, (h2h.get(id) as number) + 1);
      }
    }
    tied.sort(
      (a, b) =>
        (h2h.get(b) as number) - (h2h.get(a) as number) ||
        t(b).scored - t(a).scored ||
        t(a).against - t(b).against ||
        lot(a) - lot(b) ||
        (a < b ? -1 : a > b ? 1 : 0),
    );
    out.push(...tied);
  }
  return out;
}
