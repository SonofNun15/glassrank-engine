/** Number formats from the brand book: three decimals, true minus sign, en dash ranges. */

export function formatRating(rating: number): string {
  return rating.toFixed(3);
}

export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 1000) / 1000;
  if (rounded === 0) return "±0.000";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(3)}`;
}

export function formatRange(low: number, high: number): string {
  return `${low.toFixed(2)}–${high.toFixed(2)}`;
}
