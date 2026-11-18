import { EventInput, MS_PER_DAY, Seed, hashCanonical, matchDiscipline, parse, parseTimestamp } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { isActive, trueSkill, type SimPlayer } from "./players";
import { DEFAULT_SCENARIO, type Scenario } from "./scenario";
import { generateWorld, scenarioStartMs, type SimWorld } from "./world";

/** One year keeps the suite fast; the generated golden covers the full default. */
const SMALL: Scenario = { ...DEFAULT_SCENARIO, weeks: 52 };
const world = generateWorld(SMALL);
const byId = new Map(world.players.map((p) => [p.id, p]));
const dayOf = (w: SimWorld, occurredAt: string) =>
  Math.floor((parseTimestamp(occurredAt) - scenarioStartMs(w.scenario)) / MS_PER_DAY);

function participants(w: SimWorld) {
  const rows: { player: SimPlayer; day: number; eventId: string; hostId: string }[] = [];
  for (const e of w.events) {
    const day = dayOf(w, e.occurredAt);
    for (const m of e.matches) {
      for (const team of m.teams) {
        for (const id of team) rows.push({ player: byId.get(id) as SimPlayer, day, eventId: e.eventId, hostId: e.source.hostId });
      }
    }
  }
  return rows;
}

describe("generateWorld", () => {
  it("is deterministic: same scenario, same bytes; different seed, different world", () => {
    const again = generateWorld(SMALL);
    expect(hashCanonical(again.events)).toBe(hashCanonical(world.events));
    expect(hashCanonical(again.seeds)).toBe(hashCanonical(world.seeds));
    const other = generateWorld({ ...SMALL, seed: 2 });
    expect(hashCanonical(other.events)).not.toBe(hashCanonical(world.events));
  });

  it("emits schema-valid events in (occurredAt, eventId) order with unique ids", () => {
    for (const e of world.events) {
      const r = parse(EventInput, e);
      expect(r.ok ? [] : r.issues.slice(0, 3), e.eventId).toEqual([]);
      for (const m of e.matches) expect(matchDiscipline(m)).toBe("doubles");
    }
    const keys = world.events.map((e) => `${e.occurredAt} ${e.eventId}`);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(world.events.map((e) => e.eventId)).size).toBe(world.events.length);
  });

  it("emits one valid seed per player, before the player's first event", () => {
    expect(world.seeds.map((s) => s.playerId)).toEqual(world.players.map((p) => p.id));
    const firstPlayed = new Map<string, string>();
    for (const e of world.events) {
      for (const m of e.matches) for (const t of m.teams) for (const id of t) if (!firstPlayed.has(id)) firstPlayed.set(id, e.occurredAt);
    }
    for (const s of world.seeds) {
      expect(parse(Seed, s).ok).toBe(true);
      const first = firstPlayed.get(s.playerId);
      if (s.source !== "policy_default" && first !== undefined) expect(s.recordedAt <= first).toBe(true);
    }
  });

  it("runs round robins: groups of four, three games each, everyone partners everyone", () => {
    for (const e of world.events) {
      expect(e.matches.length % 3).toBe(0);
      for (let g = 0; g < e.matches.length; g += 3) {
        const group = e.matches.slice(g, g + 3);
        const players = new Set(group.flatMap((m) => m.teams.flat()));
        expect(players.size).toBe(4);
        const partners = new Set(group.flatMap((m) => m.teams.map((t) => [...t].sort().join("+"))));
        expect(partners.size).toBe(6);
      }
    }
  });

  it("only schedules players who have joined and are not on a layoff", () => {
    for (const { player, day } of participants(world)) expect(isActive(player, day)).toBe(true);
    const returners = world.players.filter((p) => p.cohort === "returner" && p.layoff !== null && p.layoff.startDay < 364);
    expect(returners.length).toBeGreaterThan(0);
  });

  it("gives each cohort the intended skill trajectory", () => {
    const rr = SMALL.trajectories.rustRecoveryDays;
    const at = (cohort: string, day: number) => {
      const ps = world.players.filter((p) => p.cohort === cohort);
      return ps.reduce((s, p) => s + trueSkill(p, Math.max(day, p.joinDay), rr), 0) / ps.length;
    };
    expect(at("fast_improver", 360) - at("fast_improver", 0)).toBeGreaterThan(0.3);
    expect(at("steady", 360)).toBeCloseTo(at("steady", 0), 10);
    expect(at("slow_decliner", 360)).toBeLessThan(at("slow_decliner", 0));
    const r = world.players.find((p) => p.cohort === "returner")!;
    const back = r.layoff!.endDay;
    expect(trueSkill(r, back, rr)).toBeCloseTo(r.baseSkill - r.rust, 10);
    expect(trueSkill(r, back + rr, rr)).toBeCloseTo(r.baseSkill, 10);
  });

  it("keeps the older pool mostly isolated, connected only through bridges", () => {
    const olderEvents = world.events.filter((e) => e.source.hostId === "host-older");
    expect(olderEvents.length).toBeGreaterThan(0);
    for (const e of olderEvents) {
      for (const m of e.matches) for (const t of m.teams) for (const id of t) expect(byId.get(id)!.cohort).toBe("older_pool");
    }
    const olderElsewhere = new Set(
      participants(world).filter((r) => r.player.cohort === "older_pool" && r.hostId !== "host-older").map((r) => r.player.id),
    );
    expect(olderElsewhere.size).toBeGreaterThan(0);
    expect(olderElsewhere.size).toBeLessThanOrEqual(SMALL.players.bridgeCount);
  });

  it("labels hosts with their tier, and only the inflating host manipulates scores", () => {
    const tiers = new Map(world.events.map((e) => [e.source.hostId, e.source.tier]));
    expect(tiers.get("host-a")).toBe("verified_host");
    expect(tiers.get("host-f")).toBe("provisional_host");
    expect(world.truth.manipulated.length).toBeGreaterThan(0);
    const events = new Map(world.events.map((e) => [e.eventId, e]));
    for (const m of world.truth.manipulated) {
      const event = events.get(m.eventId)!;
      expect(event.source.hostId).toBe("host-g");
      const match = event.matches.find((x) => x.matchId === m.matchId)!;
      const [a, b] = match.games[0]!.score;
      const [ta, tb] = m.trueScore;
      // The reported winner is the true loser, and that side has a favored player.
      expect(a > b).toBe(ta < tb);
      const winners = a > b ? match.teams[0] : match.teams[1];
      expect(winners.some((id) => byId.get(id)!.favored)).toBe(true);
    }
  });

  it("rejects malformed scenarios", () => {
    expect(() => generateWorld({ ...SMALL, startDate: "2026-01-06" })).toThrow(/Monday/);
    expect(() => generateWorld({ ...SMALL, seeds: { ...SMALL.seeds, mix: { self: 1, host: 1, external_claimed: 0, policy_default: 0 } } })).toThrow(/sum to 1/);
    expect(() => generateWorld({ ...SMALL, clubs: SMALL.clubs.filter((c) => !c.olderPool) })).toThrow(/olderPool/);
  });
});
