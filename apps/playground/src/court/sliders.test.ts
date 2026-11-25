import { describe, expect, it } from "vitest";
import { APPETITE_STOPS, VOLATILITY_STOPS, nearestStop, positionOf, valueAt } from "./sliders";

describe("plain-language sliders", () => {
  it("map positions to the design doc's values", () => {
    expect(valueAt(VOLATILITY_STOPS, 0)).toBe(0);
    expect(valueAt(VOLATILITY_STOPS, 67)).toBeCloseTo(0.15, 12);
    expect(valueAt(VOLATILITY_STOPS, 100)).toBeCloseTo(0.3, 12);
    expect(valueAt(APPETITE_STOPS, 50)).toBe(0);
    expect(valueAt(APPETITE_STOPS, 0)).toBe(-1);
  });

  it("round-trip values to positions", () => {
    for (const v of [0, 0.03, 0.1, 0.2, 0.3]) expect(valueAt(VOLATILITY_STOPS, positionOf(VOLATILITY_STOPS, v))).toBeCloseTo(v, 9);
    for (const v of [-1, -0.6, 0, 0.25, 1]) expect(valueAt(APPETITE_STOPS, positionOf(APPETITE_STOPS, v))).toBeCloseTo(v, 9);
  });

  it("label the nearest stop", () => {
    expect(nearestStop(VOLATILITY_STOPS, 90).label).toBe("High");
    expect(nearestStop(APPETITE_STOPS, 20).label).toBe("Leans down");
  });
});
