import { describe, expect, it } from "vitest";
import { daysBetween, formatTimestamp, parseTimestamp, tryParseTimestamp } from "./time";

describe("timestamps", () => {
  it("parses to the same epoch milliseconds as Date.UTC", () => {
    const cases: [string, number][] = [
      ["1970-01-01T00:00:00Z", 0],
      ["2000-02-29T12:34:56Z", Date.UTC(2000, 1, 29, 12, 34, 56)],
      ["2026-11-14T14:00:00Z", Date.UTC(2026, 10, 14, 14, 0, 0)],
      ["2100-03-01T00:00:00Z", Date.UTC(2100, 2, 1)],
      ["2399-12-31T23:59:59Z", Date.UTC(2399, 11, 31, 23, 59, 59)],
    ];
    for (const [text, ms] of cases) {
      expect(parseTimestamp(text)).toBe(ms);
      expect(formatTimestamp(ms)).toBe(text);
    }
  });

  it("round-trips every day across several leap cycles", () => {
    const start = Date.UTC(1999, 0, 1);
    for (let d = 0; d < 365 * 9; d++) {
      const ms = start + d * 86_400_000 + 3_723_000;
      expect(parseTimestamp(formatTimestamp(ms))).toBe(ms);
      expect(formatTimestamp(ms)).toBe(new Date(ms).toISOString().replace(".000Z", "Z"));
    }
  });

  it("rejects impossible or non-canonical spellings", () => {
    for (const bad of [
      "2027-02-29T00:00:00Z",
      "2026-13-01T00:00:00Z",
      "2026-11-31T00:00:00Z",
      "2026-11-14T24:00:00Z",
      "2026-11-14T14:00:00.000Z",
      "2026-11-14T14:00:00+00:00",
      "2026-11-14 14:00:00Z",
      "1969-12-31T23:59:59Z",
    ]) {
      expect(tryParseTimestamp(bad), bad).toBeUndefined();
    }
  });

  it("counts whole UTC days, unaffected by the host's daylight-saving changes", () => {
    // The suite runs with TZ=America/New_York (see vitest.config.ts); clocks moved on 2026-03-08.
    expect(process.env["TZ"]).toBe("America/New_York");
    const before = parseTimestamp("2026-03-07T12:00:00Z");
    expect(daysBetween(before, parseTimestamp("2026-03-08T11:30:00Z"))).toBe(0);
    expect(daysBetween(before, parseTimestamp("2026-03-08T12:00:00Z"))).toBe(1);
    expect(daysBetween(before, parseTimestamp("2026-04-06T12:00:00Z"))).toBe(30);
    expect(daysBetween(parseTimestamp("2026-03-08T13:00:00Z"), before)).toBe(-1);
    expect(daysBetween(before, before)).toBe(0);
  });

  it("formats and parses the same in a non-UTC host time zone", () => {
    expect(formatTimestamp(Date.UTC(2026, 2, 8, 7, 30, 0))).toBe("2026-03-08T07:30:00Z");
    expect(parseTimestamp("2026-03-08T07:30:00Z")).toBe(Date.UTC(2026, 2, 8, 7, 30, 0));
  });
});
