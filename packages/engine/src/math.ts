/**
 * Deterministic math.
 *
 * ECMAScript lets engines approximate Math.exp, Math.log, Math.pow and the
 * trig functions, so their last bits may differ between runtimes. The engine
 * uses stdlib-js's pure-JavaScript ports of FreeBSD msun for exp and ln
 * instead, which are built from exactly specified IEEE 754 operations and so
 * give the same bits everywhere. Math.sqrt is safe to use directly: the spec
 * requires it to be correctly rounded.
 */
import stdlibExp from "@stdlib/math-base-special-exp";
import expit from "@stdlib/math-base-special-expit";
import stdlibLn from "@stdlib/math-base-special-ln";

export const LN10 = 2.302585092994046;
export const PI_SQUARED = 9.869604401089358;

export const exp: (x: number) => number = stdlibExp;
export const log: (x: number) => number = stdlibLn;
export const sqrt: (x: number) => number = Math.sqrt;

/** 1 / (1 + e^-z) */
export const logistic: (z: number) => number = expit;

/** 10^x */
export function pow10(x: number): number {
  return exp(x * LN10);
}

/** Round to 1e-9, so stored numbers carry no noise from summation order. */
export function quantize(x: number): number {
  const q = Math.round(x * 1e9) / 1e9;
  return q === 0 ? 0 : q;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
