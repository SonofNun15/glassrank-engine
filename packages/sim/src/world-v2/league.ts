/**
 * League round robin: courts of four (five when the numbers don't divide),
 * everyone partners everyone on their court once, and courts carry over week
 * to week with the top finishers moving up and the bottom finishers down.
 */

/** Partner rotations for a court of four: [team A, team B] by seat. */
export const FOUR_ROTATIONS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/**
 * Five-player court: five games, each player sits out once and partners
 * every other player exactly once.
 */
export const FIVE_ROTATIONS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[1, 4], [2, 3]],
  [[0, 2], [3, 4]],
  [[0, 4], [1, 3]],
  [[0, 1], [2, 4]],
  [[0, 3], [1, 2]],
];

/**
 * Court sizes, top court first, for `n` players. Courts of four; leftover
 * players turn courts into fives from the bottom up. When there are more
 * leftovers than courts (6, 7, or 11 players), the extras sit out.
 */
export function courtSizes(n: number): { sizes: number[]; sitOut: number } {
  const courts = Math.floor(n / 4);
  if (courts === 0) return { sizes: [], sitOut: n };
  const extra = n - courts * 4;
  const fives = Math.min(extra, courts);
  const sizes = Array.from({ length: courts }, (_, i) => (i >= courts - fives ? 5 : 4));
  return { sizes, sitOut: extra - fives };
}

/**
 * This week's order, best court first. Players who played the previous
 * occurrence keep their order; everyone else (new, or back after missing
 * weeks) slots in by rating, ahead of the first carried player rated lower.
 */
export function carryOrder(previous: readonly string[], present: readonly string[], rating: (id: string) => number): string[] {
  const here = new Set(present);
  const carried = previous.filter((id) => here.has(id));
  const known = new Set(carried);
  const byRating = (a: string, b: string) => rating(b) - rating(a) || (a < b ? -1 : a > b ? 1 : 0);
  const newcomers = present.filter((id) => !known.has(id)).sort(byRating);
  const order = [...carried];
  for (const id of newcomers) {
    const r = rating(id);
    const at = order.findIndex((other) => rating(other) < r);
    order.splice(at === -1 ? order.length : at, 0, id);
  }
  return order;
}

/** Split an order into courts of the given sizes. */
export function seatCourts(order: readonly string[], sizes: readonly number[]): string[][] {
  const courts: string[][] = [];
  let i = 0;
  for (const size of sizes) {
    courts.push(order.slice(i, i + size));
    i += size;
  }
  return courts;
}

/**
 * Next week's order from each court's finishing order (best first): the top
 * `moves` on each court swap with the bottom `moves` of the court above.
 */
export function moveCourts(ranked: readonly (readonly string[])[], moves: number): string[] {
  const courts = ranked.map((c) => [...c]);
  for (let k = 0; k + 1 < courts.length; k++) {
    const upper = courts[k] as string[];
    const lower = courts[k + 1] as string[];
    const m = Math.min(moves, upper.length, lower.length);
    if (m === 0) continue;
    const down = upper.splice(upper.length - m, m);
    const up = lower.splice(0, m);
    upper.push(...up);
    lower.unshift(...down);
  }
  return courts.flat();
}
