/**
 * Players: groups drawn from ranges, plus hand-made players taken as given.
 */
import { MS_PER_DAY, formatTimestamp, type Seed } from "@glassrank/schema";
import type { Rng } from "../rng";
import type { GroupSkill, PlayerGroup, PlayerSkill, PlayerSpec, SimulationRecipeV2, StartingRatings } from "./recipe";
import { SKILL_MAX, SKILL_MIN, presetInactive, skillAt } from "./skill";
import { STREAM, idKey } from "./streams";

export interface WorldPlayer {
  /** Engine player id: `<group>.<n>` for generated players, `p.<id>` for hand-made ones. */
  readonly id: string;
  readonly label: string | null;
  readonly home: string;
  /** Group id, or null for a hand-made player. */
  readonly group: string | null;
  readonly skill: PlayerSkill;
  readonly joinDay: number;
  /** [start, end) day ranges away from play. */
  readonly inactive: readonly (readonly [number, number])[];
  readonly volatility: number;
  readonly travel: number;
  readonly appetite: number;
  readonly attendance: number;
  /** Chance of entering, or agreeing to partner in, a tournament they could play in. */
  readonly tournaments: number;
  /** How much they stick with one tournament partner. */
  readonly loyalty: number;
  /** A fixed tournament partner's player id (hand-made players only), or null. */
  readonly partner: string | null;
  readonly seed: Seed;
}

/** Defaults for recipes that don't set tournament behavior. */
export const DEFAULT_TOURNAMENTS: readonly [number, number] = [0.05, 0.4];
export const DEFAULT_LOYALTY: readonly [number, number] = [0.3, 0.9];
const DEFAULT_PLAYER_TOURNAMENTS = 0.2;
const DEFAULT_PLAYER_LOYALTY = 0.6;

/** Settings each preset draws, in draw order. */
const PRESET_PARAMS = {
  steady: ["level"],
  gradual_improver: ["start", "gain", "halfDays"],
  fast_improver: ["start", "gain", "halfDays"],
  slow_decline: ["start", "perYear"],
  break_and_return: ["start", "breakDay", "breakDays", "rust", "recoveryDays"],
  plateau_then_jump: ["start", "jumpDay", "jump", "jumpDays"],
} as const;

const draw = (rng: Rng, [lo, hi]: readonly [number, number]) => (lo === hi ? lo : rng.range(lo, hi));
const round2 = (x: number) => Math.round(x * 100) / 100;

function drawSkill(skill: GroupSkill, rng: Rng): PlayerSkill {
  if (skill.preset === "keyframes") return skill;
  const ranges = skill as unknown as Record<string, readonly [number, number]>;
  const out: Record<string, unknown> = { preset: skill.preset };
  for (const k of PRESET_PARAMS[skill.preset]) out[k] = draw(rng, ranges[k] as readonly [number, number]);
  return out as unknown as PlayerSkill;
}

export function isActive(p: WorldPlayer, day: number): boolean {
  return day >= p.joinDay && !p.inactive.some(([a, b]) => day >= a && day < b);
}

export function trueSkillOf(p: WorldPlayer, day: number): number {
  return skillAt(p.skill, p.joinDay, day);
}

function generatedSeed(id: string, truth: number, sr: StartingRatings, recordedAt: string, rng: Rng): Seed {
  const base = { playerId: id, discipline: "doubles" as const };
  const u = rng.next();
  const claimed = (source: "self" | "host" | "external_claimed", { bias, sd }: { bias: number; sd: number }): Seed => ({
    source,
    ...base,
    rating: round2(Math.min(SKILL_MAX, Math.max(SKILL_MIN, truth + rng.normal(bias, sd)))),
    recordedAt,
  });
  const m = sr.mix;
  if (u < m.self) return claimed("self", sr.self);
  if (u < m.self + m.club) return claimed("host", sr.club);
  if (u < m.self + m.club + m.external) return claimed("external_claimed", sr.external);
  return { source: "policy_default", ...base };
}

function groupPlayers(group: PlayerGroup, recipe: SimulationRecipeV2, root: Rng, epochMs: number): WorldPlayer[] {
  const players: WorldPlayer[] = [];
  const width = String(group.count).length;
  for (let i = 0; i < group.count; i++) {
    const id = `${group.id}.${String(i + 1).padStart(width, "0")}`;
    const r = root.fork(STREAM.traits, idKey(group.id), i);
    const skill = drawSkill(group.skill, r);
    const volatility = draw(r, group.volatility);
    const travel = draw(r, group.travel);
    const appetite = draw(r, group.appetite);
    const attendance = draw(r, group.attendance);
    const joinDay = Math.floor(draw(r, group.joinDay));
    // Drawn after everything above, so adding them changed no earlier draw.
    const tournaments = draw(r, group.tournaments ?? DEFAULT_TOURNAMENTS);
    const loyalty = draw(r, group.loyalty ?? DEFAULT_LOYALTY);
    const recordedAt = formatTimestamp(epochMs + joinDay * MS_PER_DAY);
    const seed = generatedSeed(
      id,
      skillAt(skill, joinDay, joinDay),
      group.startingRatings ?? recipe.world.startingRatings,
      recordedAt,
      root.fork(STREAM.seed, idKey(id)),
    );
    players.push({
      id,
      label: null,
      home: group.home,
      group: group.id,
      skill,
      joinDay,
      inactive: presetInactive(skill, joinDay),
      volatility,
      travel,
      appetite,
      attendance,
      tournaments,
      loyalty,
      partner: null,
      seed,
    });
  }
  return players;
}

function handMade(p: PlayerSpec, epochMs: number): WorldPlayer {
  const id = `p.${p.id}`;
  const base = { playerId: id, discipline: "doubles" as const };
  const recordedAt = formatTimestamp(epochMs + p.joinDay * MS_PER_DAY);
  const sr = p.startingRating;
  const seed: Seed =
    sr.source === "default" ? { source: "policy_default", ...base }
    : { source: sr.source === "self" ? "self" : sr.source === "club" ? "host" : "external_claimed", ...base, rating: sr.rating, recordedAt };
  return {
    id,
    label: p.label ?? null,
    home: p.home,
    group: null,
    skill: p.skill,
    joinDay: p.joinDay,
    inactive: [...presetInactive(p.skill, p.joinDay), ...(p.inactive ?? [])],
    volatility: p.volatility,
    travel: p.travel,
    appetite: p.appetite,
    attendance: p.attendance,
    tournaments: p.tournaments ?? DEFAULT_PLAYER_TOURNAMENTS,
    loyalty: p.loyalty ?? DEFAULT_PLAYER_LOYALTY,
    partner: p.partner === undefined ? null : `p.${p.partner}`,
    seed,
  };
}

/** Every player in the recipe, sorted by id. */
export function createWorldPlayers(recipe: SimulationRecipeV2, root: Rng, epochMs: number): WorldPlayer[] {
  const players = [...recipe.groups.flatMap((gr) => groupPlayers(gr, recipe, root, epochMs)), ...recipe.players.map((p) => handMade(p, epochMs))];
  return players.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
