import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CorrectionOverlay, EffectivePolicy, PolicyConfig } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { applyRules, type RuleInput } from "./rules";

const fixtures = join(import.meta.dirname, "../../schema/fixtures");
const base: PolicyConfig = JSON.parse(readFileSync(join(fixtures, "policy.json"), "utf8"));
const overlay: CorrectionOverlay = JSON.parse(readFileSync(join(fixtures, "overlay.json"), "utf8"));
// gainMultiplier 1.25, lossMultiplier 0.6, returning: 60 days / 3 events / 0.5,
// cap 0.15 per 30 days, large gain 0.25 unless 6+ games.
const policy: EffectivePolicy = { base, overlay: null };

function run(overrides: Partial<RuleInput>) {
  return applyRules({
    policy,
    occurredAt: "2026-11-14T14:00:00Z",
    eventId: "evt",
    ratingBefore: 3.5,
    muBefore: 3.5,
    muAfter: 3.5,
    heldGain: 0,
    recentDeclines: [],
    protectedEvents: 0,
    daysAway: 7,
    gamesPlayed: 3,
    priorEvents: 20,
    ...overrides,
  });
}

describe("policy rules", () => {
  it("gains: full catch-up plus a bonus on this event's evidence gain", () => {
    const r = run({ muAfter: 3.6 });
    expect(r.rating).toBeCloseTo(3.5 + 0.1 + 0.25 * 0.1, 12);
    expect(r.fired).toEqual(["upward_bias"]);
  });

  it("catches up to evidence that was already higher, without a bonus if this event was flat", () => {
    const r = run({ ratingBefore: 3.4, muBefore: 3.5, muAfter: 3.5 });
    expect(r.rating).toBeCloseTo(3.5, 12);
  });

  it("drops: no drop after an at-or-above-expected event", () => {
    const r = run({ ratingBefore: 3.8, muBefore: 3.5, muAfter: 3.55 });
    expect(r.rating).toBe(3.8);
    expect(r.fired).toContain("decline_damping");
  });

  it("drops: a below-expected event moves the rating part of the way to the evidence", () => {
    const r = run({ muAfter: 3.4 });
    expect(r.rating).toBeCloseTo(3.5 - 0.1 * 0.6, 12);
    expect(r.recentDeclines).toEqual([{ at: "2026-11-14T14:00:00Z", eventId: "evt", amount: expect.closeTo(0.06, 12) }]);
  });

  it("returning players drop more slowly", () => {
    const r = run({ muAfter: 3.4, protectedEvents: 3, daysAway: 90 });
    expect(r.rating).toBeCloseTo(3.5 - 0.1 * 0.6 * 0.5, 12);
    expect(r.fired).toContain("returning_protection");
  });

  it("caps total decline inside the rolling window", () => {
    const r = run({
      muAfter: 3.0,
      recentDeclines: [
        { at: "2026-10-01T14:00:00Z", eventId: "old", amount: 0.5 }, // outside the 30-day window
        { at: "2026-11-07T14:00:00Z", eventId: "recent", amount: 0.1 },
      ],
    });
    expect(r.rating).toBeCloseTo(3.5 - 0.05, 12);
    expect(r.fired).toContain("decline_cap");
    expect(r.recentDeclines.map((d) => d.eventId)).toEqual(["recent", "evt"]);
  });

  it("holds a large gain until there is enough evidence, then releases it", () => {
    const held = run({ muAfter: 4.0 });
    expect(held.rating).toBeCloseTo(3.75, 12);
    expect(held.heldGain).toBeCloseTo(0.5 + 0.25 * 0.5 - 0.25, 12);
    const released = run({ ratingBefore: 3.75, muBefore: 4.0, muAfter: 4.05, heldGain: held.heldGain, gamesPlayed: 6 });
    expect(released.rating).toBeGreaterThan(4.0);
    expect(released.heldGain).toBe(0);
    expect(released.fired).toContain("held_gain_release");
  });

  it("forfeits held gain when the evidence turns down", () => {
    const r = run({ heldGain: 0.2, muAfter: 3.45 });
    expect(r.heldGain).toBeCloseTo(0.15, 12);
  });

  it("a correction overlay replaces the loss multiplier, except for exempt returners", () => {
    const corrected = applyRules({ ...baseInput(), policy: { base, overlay } });
    expect(corrected.rating).toBeCloseTo(3.5 - 0.1 * 0.8, 12);
    expect(corrected.fired).toContain("correction_overlay");
    const exempt = applyRules({ ...baseInput(), policy: { base, overlay }, daysAway: 90, protectedEvents: 3 });
    expect(exempt.rating).toBeCloseTo(3.5 - 0.1 * 0.6 * 0.5, 12);
    expect(exempt.exemptFromOverlay).toBe(true);
  });

  it("provisional period: early events follow the evidence at face value", () => {
    const provisional: EffectivePolicy = { base: { ...base, rules: { ...base.rules, provisionalPeriod: { events: 8 } } }, overlay: null };
    const drop = applyRules({ ...baseInput(), policy: provisional, muAfter: 3.0, priorEvents: 2 });
    expect(drop.rating).toBeCloseTo(3.0, 12); // no damping, no cap
    expect(drop.fired).toEqual(["provisional_period"]);
    const later = applyRules({ ...baseInput(), policy: provisional, muAfter: 3.0, priorEvents: 8 });
    expect(later.rating).toBeGreaterThan(3.0);
    expect(later.fired).not.toContain("provisional_period");
  });

  it("keeps the rating inside the scale", () => {
    const r = run({ ratingBefore: 7.95, muBefore: 7.95, muAfter: 8.1, gamesPlayed: 6 });
    expect(r.rating).toBe(8);
    expect(r.fired).toContain("scale_bounds");
  });
});

function baseInput(): RuleInput {
  return {
    policy,
    occurredAt: "2026-11-14T14:00:00Z",
    eventId: "evt",
    ratingBefore: 3.5,
    muBefore: 3.5,
    muAfter: 3.4,
    heldGain: 0,
    recentDeclines: [],
    protectedEvents: 0,
    daysAway: 7,
    gamesPlayed: 3,
    priorEvents: 20,
  };
}
