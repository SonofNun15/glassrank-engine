import { describe, expect, it } from "vitest";
import { headlineBody } from "./components";
import { formatDelta, formatRange, formatRating } from "./format";

describe("formats", () => {
  it("follows the brand book", () => {
    expect(formatRating(3.4817)).toBe("3.482");
    expect(formatDelta(0.06)).toBe("+0.060");
    expect(formatDelta(-0.0531)).toBe("−0.053");
    expect(formatDelta(0.0002)).toBe("±0.000");
    expect(formatRange(2.712, 4.1)).toBe("2.71–4.10");
  });

  it("strips the delta and event from engine headlines", () => {
    expect(headlineBody("+0.071 at Riverside Courts, Tuesday round robin. Beat 1 higher-rated team.")).toBe("Beat 1 higher-rated team.");
    expect(headlineBody("−0.053. Won 0 of 3 games, below the 1.3 expected.")).toBe("Won 0 of 3 games, below the 1.3 expected.");
    // Event labels with periods: bracket names, abbreviations.
    expect(headlineBody("−0.098 at 3.5 and under, Southgate Courts. Won 0 of 3 games.")).toBe("Won 0 of 3 games.");
    expect(headlineBody("+0.010 at St. Mary's 3.0 night. Won 2 of 3 games.", "St. Mary's 3.0 night")).toBe("Won 2 of 3 games.");
  });
});
