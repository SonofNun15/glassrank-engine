import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PredictResponse,
  RateResponse,
  ReplayResponse,
  hashCanonical,
  parse,
  type EventInput,
  type PolicyConfig,
  type Prior,
  type RateRequest,
} from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { predict, rate, replay } from "./index";

const fixtures = join(import.meta.dirname, "../../schema/fixtures");
const load = (f: string): any => JSON.parse(readFileSync(join(fixtures, f), "utf8"));
const clone = <T>(v: T): any => structuredClone(v);

const baseRequest: RateRequest = load("rate-request.json");
const eloPolicy: PolicyConfig = load("policy.json");
const bayesPolicy: PolicyConfig = {
  ...eloPolicy,
  policyId: "test-bayes",
  evidence: { model: "bayes_v0", winScale: 3.2, shareScale: 1.0, marginWeight: 0.5, dynamicsSigma: 0.05, sigmaFloor: 0.08 },
};
const NEUTRAL_RULES: PolicyConfig["rules"] = {
  provisionalPeriod: { events: 0, rangeSd: 1 },
  upwardBias: { gainMultiplier: 1 },
  declineDamping: { lossMultiplier: 1 },
  returningProtection: { awayDays: 3650, events: 1, lossMultiplier: 1 },
  declineCap: { amount: 10, windowDays: 30 },
  largeGain: { perEventThreshold: 10, minGamesToExceed: 1 },
};
const withPolicy = (req: RateRequest, base: PolicyConfig): any => ({ ...clone(req), policy: { base, overlay: null } });
const byPlayer = (res: { states: readonly { playerId: string }[] }) => new Map(res.states.map((s) => [s.playerId, s as any]));

describe("rate()", () => {
  it.each([
    ["elo_baseline", eloPolicy],
    ["bayes_v0", bayesPolicy],
  ])("returns a schema-valid response with one state and receipt per participant (%s)", (_m, policy) => {
    const res = rate(withPolicy(baseRequest, policy));
    const check = parse(RateResponse, res);
    expect(check.ok ? [] : check.issues.slice(0, 5)).toEqual([]);
    expect(res.states.map((s) => s.playerId)).toEqual(["p-ava", "p-ben", "p-cam", "p-dee"]);
    expect(res.receipts.map((r) => r.playerId)).toEqual(["p-ava", "p-ben", "p-cam", "p-dee"]);
    expect(res.inputHash).toBe(hashCanonical(withPolicy(baseRequest, policy)));
  });

  it("is deterministic and ignores match order within the event", () => {
    const req = withPolicy(baseRequest, bayesPolicy);
    const a = rate(req);
    expect(hashCanonical(rate(clone(req)).states)).toBe(hashCanonical(a.states));
    const shuffled = clone(req);
    shuffled.event.matches.reverse();
    expect(hashCanonical(rate(shuffled).states.map((s: any) => ({ ...s, lastUpdate: null })))).toBe(
      hashCanonical(a.states.map((s) => ({ ...s, lastUpdate: null }))),
    );
  });

  it("rejects invalid input with a SchemaError", () => {
    const bad = withPolicy(baseRequest, eloPolicy);
    bad.priors.pop();
    expect(() => rate(bad)).toThrow(/missing prior for p-dee/);
  });

  it("Elo is zero-sum across a doubles event", () => {
    const res = rate(withPolicy(baseRequest, { ...eloPolicy, rules: NEUTRAL_RULES }));
    const total = res.receipts.reduce((s, r) => s + r.technical.evidenceDelta.mu, 0);
    expect(Math.abs(total)).toBeLessThan(1e-8);
  });

  it("with neutral rules, a rating that starts at the evidence estimate stays there", () => {
    const req = withPolicy(baseRequest, { ...bayesPolicy, rules: NEUTRAL_RULES });
    for (const p of req.priors) if (p.kind === "state") p.state.rating = p.state.evidence.mu;
    const res = rate(req);
    for (const s of res.states) expect(s.rating).toBeCloseTo(s.evidence.mu, 8);
  });

  it("moves winners up and losers down, and uncertain players more", () => {
    const req = withPolicy(baseRequest, { ...bayesPolicy, rules: NEUTRAL_RULES });
    // One match only: ava+ben beat cam+dee 11-3.
    req.event.matches = [{ ...req.event.matches[0], games: [{ score: [11, 3] }] }];
    const res = byPlayer(rate(req));
    const d = (id: string, prior: any) => res.get(id).evidence.mu - prior;
    const pri = new Map<string, any>(req.priors.map((p: Prior) => [p.kind === "state" ? p.state.playerId : p.seed.playerId, p]));
    expect(d("p-ava", pri.get("p-ava").state.evidence.mu)).toBeGreaterThan(0);
    expect(d("p-cam", 3.5)).toBeLessThan(0);
    // p-dee (default seed, sigma 1.0) moves more than p-cam (self seed, sigma 0.9).
    expect(Math.abs(d("p-dee", 3.0))).toBeGreaterThan(Math.abs(d("p-cam", 3.5)));
  });

  it("ignores voided matches and weight-zero evidence, and says so in the receipt", () => {
    const req = withPolicy(baseRequest, bayesPolicy);
    req.event.matches = req.event.matches.map((m: any) => ({ ...m, trust: { weight: 1, voided: true, reason: "dispute_upheld" } }));
    const res = rate(req);
    for (const r of res.receipts) {
      expect(r.headline.delta).toBe(0);
      expect(r.summary.voidedMatches).toBeGreaterThan(0);
      expect(r.headline.reasons).toContain("matches_voided");
    }
    const zero = withPolicy(baseRequest, bayesPolicy);
    zero.event.matches = zero.event.matches.map((m: any) => ({ ...m, trust: { weight: 0, voided: false } }));
    for (const r of rate(zero).receipts) expect(r.technical.evidenceDelta.mu).toBe(0);
  });

  it("explains every change: rules recorded in order, contributions sum to the evidence change", () => {
    const res = rate(withPolicy(baseRequest, bayesPolicy));
    for (const r of res.receipts) {
      expect(r.technical.rules.map((a) => a.rule)).toEqual([
        "provisional_period",
        "upward_bias",
        "decline_damping",
        "returning_protection",
        "correction_overlay",
        "large_gain_hold",
        "held_gain_release",
        "decline_cap",
        "scale_bounds",
      ]);
      const sum = r.technical.games.reduce((s, g) => s + g.contribution, 0);
      expect(sum).toBeCloseTo(r.technical.evidenceDelta.mu, 6);
      expect(r.technical.rules.at(-1)!.after).toBeCloseTo(r.headline.delta, 8);
    }
  });
});

describe("provisional status", () => {
  it("shows a narrowing range for new players and clears after the provisional period", () => {
    const base = { ...bayesPolicy, rules: { ...bayesPolicy.rules, provisionalPeriod: { events: 3, rangeSd: 1 } } };
    let priors: readonly unknown[] = baseRequest.priors;
    const widths: number[] = [];
    for (let i = 0; i < 3; i++) {
      const event = { ...clone(baseRequest.event), eventId: `evt-${i}`, occurredAt: `2026-11-${14 + 7 * i}T14:00:00Z` };
      const res = rate({ schemaVersion: "0.1.0", priors, event, policy: { base, overlay: null } });
      const dee = res.states.find((s) => s.playerId === "p-dee")!;
      const receipt = res.receipts.find((r) => r.playerId === "p-dee")!;
      expect(receipt.headline.provisional).toEqual(dee.provisional);
      // Established players (14 and 22 prior events) are never provisional.
      expect(res.states.find((s) => s.playerId === "p-ava")!.provisional).toBeNull();
      if (i < 2) {
        expect(dee.provisional).toEqual({ eventsRemaining: 2 - i, low: expect.any(Number), high: expect.any(Number) });
        expect(dee.provisional!.low).toBeLessThan(dee.evidence.mu);
        expect(dee.provisional!.high).toBeGreaterThan(dee.evidence.mu);
        // Plus or minus one sd, clamped to the 2.0-8.0 scale (this player sits near the bottom).
        expect(dee.provisional!.high).toBeCloseTo(dee.evidence.mu + dee.evidence.sigma, 8);
        expect(dee.provisional!.low).toBeCloseTo(Math.max(2, dee.evidence.mu - dee.evidence.sigma), 8);
        widths.push(dee.provisional!.high - dee.provisional!.low);
      } else {
        expect(dee.provisional).toBeNull();
      }
      priors = res.states.map((state) => ({ kind: "state", state }));
    }
    expect(widths[1]).toBeLessThan(widths[0]!);
  });
});

describe("predict()", () => {
  const request = (teams: [string[], string[]]) => ({
    schemaVersion: "0.1.0",
    at: "2026-11-21T14:00:00Z",
    priors: baseRequest.priors,
    teams,
    gameFormat: { target: 11, winBy: 2, scoring: "side_out" },
    policy: { base: bayesPolicy, overlay: null },
  });

  it("is symmetric and favors the higher-rated side", () => {
    const ab = predict(request([["p-ava", "p-ben"], ["p-cam", "p-dee"]]));
    const ba = predict(request([["p-cam", "p-dee"], ["p-ava", "p-ben"]]));
    expect(parse(PredictResponse, ab).ok).toBe(true);
    expect(ab.prediction.gameWinProbability + ba.prediction.gameWinProbability).toBeCloseTo(1, 8);
    expect(ab.prediction.gameWinProbability).toBeGreaterThan(0.5);
    expect(ab.prediction.expectedScore[0]).toBe(11);
  });
});

describe("replay()", () => {
  it("matches calling rate() event by event", () => {
    const e1: EventInput = baseRequest.event;
    const e2: EventInput = { ...clone(e1), eventId: "evt-2", occurredAt: "2026-11-21T14:00:00Z" };
    const schedule = { schemaVersion: "0.1.0", policies: [{ effectiveFrom: "2026-01-01T00:00:00Z", policy: bayesPolicy }], overlays: [] };
    const out = replay({ schemaVersion: "0.1.0", initial: baseRequest.priors, events: [e1, e2], schedule });
    expect(parse(ReplayResponse, out).ok).toBe(true);
    expect(out.receipts).toHaveLength(8);

    const first = rate({ schemaVersion: "0.1.0", priors: baseRequest.priors, event: e1, policy: { base: bayesPolicy, overlay: null } });
    const second = rate({
      schemaVersion: "0.1.0",
      priors: first.states.map((state) => ({ kind: "state", state })),
      event: e2,
      policy: { base: bayesPolicy, overlay: null },
    });
    expect(hashCanonical(out.states)).toBe(hashCanonical(second.states));
  });
});
