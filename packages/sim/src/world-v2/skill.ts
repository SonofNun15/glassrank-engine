/**
 * True skill over time. Presets are evaluated exactly; keyframes are joined
 * by straight lines. Only basic arithmetic, so every runtime agrees.
 */
import type { PlayerSkill } from "./recipe";

export const SKILL_MIN = 2;
export const SKILL_MAX = 8;

const clamp = (x: number) => Math.min(SKILL_MAX, Math.max(SKILL_MIN, x));

/** Keyframe value at `day`: linear between points, flat before the first and after the last. */
export function interpolate(keyframes: readonly (readonly [number, number])[], day: number): number {
  const first = keyframes[0];
  if (first === undefined) throw new RangeError("keyframes must not be empty");
  if (day <= first[0]) return first[1];
  for (let i = 1; i < keyframes.length; i++) {
    const [d1, s1] = keyframes[i] as readonly [number, number];
    if (day <= d1) {
      const [d0, s0] = keyframes[i - 1] as readonly [number, number];
      return s0 + ((s1 - s0) * (day - d0)) / (d1 - d0);
    }
  }
  return (keyframes.at(-1) as readonly [number, number])[1];
}

/**
 * True skill on `day` (days from the start of the run). Preset days count
 * from `joinDay`; keyframe days count from the start of the run.
 */
export function skillAt(skill: PlayerSkill, joinDay: number, day: number): number {
  const d = Math.max(0, day - joinDay);
  switch (skill.preset) {
    case "steady":
      return clamp(skill.level);
    case "gradual_improver":
    case "fast_improver":
      return clamp(skill.start + (skill.gain * d) / (d + skill.halfDays));
    case "slow_decline":
      return clamp(skill.start - (skill.perYear * d) / 365);
    case "break_and_return": {
      const back = skill.breakDay + skill.breakDays;
      if (d < back) return clamp(skill.start);
      return clamp(skill.start - skill.rust * Math.max(0, 1 - (d - back) / skill.recoveryDays));
    }
    case "plateau_then_jump": {
      if (d <= skill.jumpDay) return clamp(skill.start);
      const t = Math.min(1, (d - skill.jumpDay) / skill.jumpDays);
      return clamp(skill.start + skill.jump * t);
    }
    case "keyframes":
      return clamp(interpolate(skill.keyframes, day));
  }
}

/** [start, end) day ranges a preset keeps the player away from play (the break). */
export function presetInactive(skill: PlayerSkill, joinDay: number): [number, number][] {
  if (skill.preset !== "break_and_return") return [];
  const start = joinDay + Math.round(skill.breakDay);
  return [[start, start + Math.round(skill.breakDays)]];
}

/**
 * A preset as editable keyframes (absolute days), for the graph editor: the
 * curve's corners exactly, and improvement curves sampled closely enough to
 * look the same. At most 24 points.
 */
export function toKeyframes(skill: PlayerSkill, joinDay: number, durationDays: number): [number, number][] {
  if (skill.preset === "keyframes") return skill.keyframes.map(([d, s]) => [d, s]);
  const end = durationDays;
  const rel: number[] = [0];
  switch (skill.preset) {
    case "steady":
    case "slow_decline":
      break;
    case "gradual_improver":
    case "fast_improver":
      for (const f of [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]) rel.push(skill.halfDays * f);
      break;
    case "break_and_return": {
      const back = skill.breakDay + skill.breakDays;
      rel.push(skill.breakDay, back - 1, back, back + skill.recoveryDays / 2, back + skill.recoveryDays);
      break;
    }
    case "plateau_then_jump":
      rel.push(skill.jumpDay, skill.jumpDay + skill.jumpDays);
      break;
  }
  const days = [...new Set([...rel.map((r) => Math.round(joinDay + r)), end])]
    .filter((d) => d >= joinDay && d <= end)
    .sort((a, b) => a - b)
    .slice(0, 24);
  const points = days.map((d): [number, number] => [d, Math.round(skillAt(skill, joinDay, d) * 1000) / 1000]);
  // A break drops straight from the old level to the rusty one.
  if (skill.preset === "break_and_return") {
    const back = joinDay + Math.round(skill.breakDay + skill.breakDays);
    const before = points.find(([d]) => d === back - 1);
    if (before !== undefined) before[1] = Math.round(clamp(skill.start) * 1000) / 1000;
  }
  return points;
}
