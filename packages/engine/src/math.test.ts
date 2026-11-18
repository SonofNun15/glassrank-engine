import { describe, expect, it } from "vitest";
import { exp, log, logistic, pow10, quantize, sqrt } from "./math";

const relErr = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), Number.MIN_VALUE);

describe("deterministic math", () => {
  it("exp matches Math.exp to within a few ulps", () => {
    for (let x = -50; x <= 50; x += 0.137) expect(relErr(exp(x), Math.exp(x))).toBeLessThan(1e-14);
    expect(exp(0)).toBe(1);
    expect(exp(800)).toBe(Number.POSITIVE_INFINITY);
    expect(exp(-800)).toBe(0);
  });

  it("log matches Math.log to within a few ulps", () => {
    for (let x = 1e-6; x < 1e6; x *= 1.37) expect(relErr(log(x), Math.log(x)) < 1e-14 || Math.abs(log(x) - Math.log(x)) < 1e-15).toBe(true);
    expect(log(1)).toBe(0);
    expect(log(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(log(-1))).toBe(true);
  });

  it("sqrt matches Math.sqrt", () => {
    for (let x = 1e-8; x < 1e8; x *= 1.53) expect(sqrt(x)).toBe(Math.sqrt(x));
    expect(sqrt(4)).toBe(2);
    expect(sqrt(0)).toBe(0);
  });

  it("logistic is symmetric and stable at the extremes", () => {
    expect(logistic(0)).toBe(0.5);
    expect(logistic(2) + logistic(-2)).toBeCloseTo(1, 15);
    expect(logistic(800)).toBe(1);
    expect(logistic(-800)).toBe(0);
    expect(relErr(pow10(1.5), 10 ** 1.5)).toBeLessThan(1e-14);
  });

  it("quantizes to 1e-9 and never returns -0", () => {
    expect(quantize(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(quantize(-1e-12), 0)).toBe(true);
  });

  it("produces fixed bits for fixed inputs (locks the implementation)", () => {
    expect([exp(1), log(10), sqrt(2), logistic(0.75)]).toMatchInlineSnapshot(`
      [
        2.7182818284590455,
        2.302585092994046,
        1.4142135623730951,
        0.679178699175393,
      ]
    `);
  });
});
