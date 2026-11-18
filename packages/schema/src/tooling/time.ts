/**
 * Timestamps cross the seam as RFC 3339 UTC strings with whole seconds, e.g.
 * `2026-11-14T09:00:00Z`. One spelling per instant keeps hashes stable.
 *
 * Date math uses date-fns on `UTCDate` values from `@date-fns/utc`, so every
 * calculation happens in UTC regardless of the host time zone. Plain `Date`
 * values would make day counts shift across a local daylight-saving change.
 */
import { UTCDate } from "@date-fns/utc";
import { differenceInDays, formatISO, isValid, parseISO } from "date-fns";

export const TIMESTAMP_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$";

const TIMESTAMP_RE = new RegExp(TIMESTAMP_PATTERN);

export const MS_PER_DAY = 86_400_000;

/** Epoch milliseconds for a timestamp string, or `undefined` if it is not a real UTC instant. */
export function tryParseTimestamp(text: string): number | undefined {
  if (!TIMESTAMP_RE.test(text)) return undefined;
  const date = parseISO(text, { in: (value) => new UTCDate(value) });
  if (!isValid(date)) return undefined;
  const ms = date.getTime();
  // parseISO accepts hour 24 and rolls it into the next day, so require an exact round trip.
  if (ms < 0 || formatTimestamp(ms) !== text) return undefined;
  return ms;
}

export function parseTimestamp(text: string): number {
  const ms = tryParseTimestamp(text);
  if (ms === undefined) throw new RangeError(`invalid timestamp: ${text}`);
  return ms;
}

/** Inverse of `parseTimestamp`. Sub-second precision is truncated. */
export function formatTimestamp(epochMs: number): string {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) {
    throw new RangeError(`invalid epoch milliseconds: ${epochMs}`);
  }
  return formatISO(new UTCDate(epochMs - (epochMs % 1000)));
}

/**
 * Whole 24-hour days elapsed from `fromMs` to `toMs`, truncated toward zero
 * (23.5 hours is 0 days; -25 hours is -1 day).
 */
export function daysBetween(fromMs: number, toMs: number): number {
  return differenceInDays(new UTCDate(toMs), new UTCDate(fromMs));
}
