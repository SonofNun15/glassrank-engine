import { describe, expect, it } from "vitest";
import { Rng } from "./rng";

describe("Rng", () => {
  it("produces a fixed sequence for a seed (locks the algorithm)", () => {
    const rng = new Rng(1);
    expect(Array.from({ length: 4 }, () => rng.nextU32())).toMatchInlineSnapshot(`
      [
        1828152527,
        3394835397,
        2967886022,
        2251045104,
      ]
    `);
  });

  it("repeats exactly for the same seed and differs across seeds", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const seqA = Array.from({ length: 100 }, () => a.nextU32());
    expect(Array.from({ length: 100 }, () => b.nextU32())).toEqual(seqA);
    expect(Array.from({ length: 100 }, () => c.nextU32())).not.toEqual(seqA);
  });

  it("forks stable, independent streams", () => {
    const root = new Rng(7);
    const x1 = root.fork(3, 1).nextU32();
    root.nextU32(); // advancing the parent does not change its forks
    expect(new Rng(7).fork(3, 1).nextU32()).toBe(x1);
    expect(root.fork(3, 2).nextU32()).not.toBe(x1);
    expect(root.fork(3, 1, 0).nextU32()).not.toBe(x1);
  });

  it("draws uniforms in [0, 1) and integers in range", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 10_000; i++) {
      const u = rng.next();
      expect(u >= 0 && u < 1).toBe(true);
      const k = rng.int(6);
      expect(Number.isInteger(k) && k >= 0 && k < 6).toBe(true);
    }
  });

  it("draws approximately normal values", () => {
    const rng = new Rng(11);
    const n = 20_000;
    const xs = Array.from({ length: n }, () => rng.normal(2, 0.5));
    const mean = xs.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    expect(mean).toBeCloseTo(2, 1);
    expect(sd).toBeCloseTo(0.5, 1);
  });

  it("shuffles into a permutation without changing the input", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new Rng(3).shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});
