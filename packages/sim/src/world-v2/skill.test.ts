import { describe, expect, it } from "vitest";
import { interpolate, presetInactive, skillAt, toKeyframes } from "./skill";

describe("true skill", () => {
  it("interpolates keyframes and holds flat outside them", () => {
    const k = [[10, 3], [20, 4], [40, 3.5]] as const;
    expect(interpolate(k, 0)).toBe(3);
    expect(interpolate(k, 15)).toBe(3.5);
    expect(interpolate(k, 30)).toBe(3.75);
    expect(interpolate(k, 100)).toBe(3.5);
  });

  it("evaluates presets from the join day", () => {
    expect(skillAt({ preset: "steady", level: 3.4 }, 50, 0)).toBe(3.4);
    const imp = { preset: "gradual_improver", start: 3, gain: 1, halfDays: 100 } as const;
    expect(skillAt(imp, 50, 50)).toBe(3);
    expect(skillAt(imp, 50, 150)).toBe(3.5);
    expect(skillAt({ preset: "slow_decline", start: 4, perYear: 0.365 }, 0, 100)).toBeCloseTo(3.9, 12);
    const jump = { preset: "plateau_then_jump", start: 3, jumpDay: 100, jump: 0.5, jumpDays: 50 } as const;
    expect(skillAt(jump, 0, 100)).toBe(3);
    expect(skillAt(jump, 0, 125)).toBe(3.25);
    expect(skillAt(jump, 0, 300)).toBe(3.5);
  });

  it("models a break: away, then rusty, then recovered", () => {
    const b = { preset: "break_and_return", start: 3.6, breakDay: 30, breakDays: 60, rust: 0.4, recoveryDays: 40 } as const;
    expect(presetInactive(b, 10)).toEqual([[40, 100]]);
    expect(skillAt(b, 10, 100)).toBeCloseTo(3.2, 12);
    expect(skillAt(b, 10, 120)).toBeCloseTo(3.4, 12);
    expect(skillAt(b, 10, 200)).toBe(3.6);
  });

  it("clamps to the skill scale", () => {
    expect(skillAt({ preset: "gradual_improver", start: 7.5, gain: 4, halfDays: 1 }, 0, 1000)).toBe(8);
  });

  it("converts presets to keyframes that follow the curve", () => {
    const imp = { preset: "fast_improver", start: 3, gain: 1, halfDays: 60 } as const;
    const kf = toKeyframes(imp, 20, 365);
    expect(kf.length).toBeLessThanOrEqual(24);
    expect(kf[0]).toEqual([20, 3]);
    expect(kf.at(-1)?.[0]).toBe(365);
    for (const [d, s] of kf) expect(s).toBeCloseTo(skillAt(imp, 20, d), 3);
    for (let d = 20; d <= 365; d += 5) expect(Math.abs(interpolate(kf, d) - skillAt(imp, 20, d))).toBeLessThan(0.05);
  });
});
