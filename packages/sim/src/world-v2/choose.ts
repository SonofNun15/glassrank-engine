/**
 * Who may enter an event, and which event a player picks.
 *
 * Eligibility uses the player's current GlassRank rating. Appetite moves the
 * level a player aims for by up to half a rating point (about one bracket),
 * plus week-to-week randomness.
 */
import type { EventSeries } from "./recipe";

/** Appetite reference: how far +1 or -1 moves the target level, in rating units. */
export const APPETITE_REACH = 0.5;
/** Where an open-ended range counts its level, inside the bound it has. */
const OPEN_END_OFFSET = 0.25;

export interface RatingView {
  readonly rating: number;
  /** Top of the provisional range, or the rating once established. */
  readonly high: number;
}

export function isEligible(view: RatingView, series: EventSeries): boolean {
  const range = series.range ?? {};
  const forMax = series.provisional === "high" ? view.high : view.rating;
  if (range.max !== undefined && forMax > range.max) return false;
  if (range.min !== undefined && view.rating < range.min) {
    const rule = series.playUp ?? "open";
    if (rule === "strict") return false;
    if (rule === "margin" && view.rating < range.min - (series.playUpMargin ?? 0)) return false;
  }
  return true;
}

/** The level an event plays at, for a player rated `rating` (all-levels events fit everyone). */
export function eventLevel(series: EventSeries, rating: number): number {
  const { min, max } = series.range ?? {};
  if (min !== undefined && max !== undefined) return (min + max) / 2;
  if (max !== undefined) return max - OPEN_END_OFFSET;
  if (min !== undefined) return min + OPEN_END_OFFSET;
  return rating;
}

export function targetLevel(rating: number, appetite: number, noise: number): number {
  return rating + appetite * APPETITE_REACH + noise;
}

/**
 * Candidates ordered best first: nearest level to the target, then home club
 * events, then by id.
 */
export function rankCandidates<T extends { readonly series: EventSeries }>(
  candidates: readonly T[],
  target: number,
  rating: number,
  home: string,
): T[] {
  const dist = (c: T) => Math.abs(eventLevel(c.series, rating) - target);
  return [...candidates].sort(
    (a, b) =>
      dist(a) - dist(b) ||
      Number(b.series.club === home) - Number(a.series.club === home) ||
      (a.series.id < b.series.id ? -1 : a.series.id > b.series.id ? 1 : 0),
  );
}
