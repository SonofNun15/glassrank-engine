/**
 * Seeded random numbers for the simulator.
 *
 * sfc32 generator seeded through splitmix32. Only 32-bit integer operations and
 * basic float arithmetic are used (no Math.exp/log/cos, whose last bits may
 * differ between JavaScript engines), so a seed produces the same sequence on
 * every runtime.
 */

function splitmix32(state: number): [next: number, output: number] {
  const next = (state + 0x9e3779b9) | 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  z ^= z >>> 16;
  return [next, z >>> 0];
}

/** Mix a seed with a path of integer keys into one 32-bit seed. */
function deriveSeed(seed: number, keys: readonly number[]): number {
  let state = seed | 0;
  let out = 0;
  for (const k of [...keys, keys.length]) {
    [state, out] = splitmix32((state ^ Math.imul(k | 0, 0x27d4eb2f)) | 0);
    state = out | 0;
  }
  return out;
}

export class Rng {
  readonly seed: number;
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) throw new RangeError(`seed must be an integer: ${seed}`);
    this.seed = seed >>> 0;
    let state = this.seed;
    const words: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [next, out] = splitmix32(state);
      state = next;
      words.push(out);
    }
    [this.a, this.b, this.c, this.d] = words as [number, number, number, number];
    for (let i = 0; i < 12; i++) this.nextU32(); // warm up
  }

  /** Independent child stream, stable for a given (seed, keys). */
  fork(...keys: number[]): Rng {
    return new Rng(deriveSeed(this.seed, keys));
  }

  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextU32() / 4_294_967_296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Approximately normal (Irwin-Hall: sum of 12 uniforms). Tails stop at
   * +/-6 sd, which is fine for simulation noise and avoids transcendental math.
   */
  normal(mean = 0, sd = 1): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.next();
    return mean + sd * (sum - 6);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("cannot pick from an empty list");
    return items[this.int(items.length)] as T;
  }

  /** Shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}
