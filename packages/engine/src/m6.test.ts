import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ForecastResponse, VerifyResponse, parse, type PolicyConfig, type RateRequest } from "@glassrank/schema";
import { describe, expect, it } from "vitest";
import { explainReceipt, forecast, rate, standardOutcomes, verify } from "./index";

const fixtures = join(import.meta.dirname, "../../schema/fixtures");
const base: RateRequest = JSON.parse(readFileSync(join(fixtures, "rate-request.json"), "utf8"));
const bayes: PolicyConfig = {
  ...base.policy.base,
  policyId: "test-bayes",
  evidence: { model: "bayes_v0", winScale: 3.2, shareScale: 1.0, marginWeight: 0.5, dynamicsSigma: 0.05, sigmaFloor: 0.08 },
};
const request: RateRequest = { ...base, policy: { base: bayes, overlay: null } };
const clone = <T>(v: T): any => structuredClone(v);

describe("forecast()", () => {
  const match = request.event.matches[0]!;
  const forecastRequest = {
    schemaVersion: "0.1.0",
    occurredAt: request.event.occurredAt,
    source: request.event.source,
    priors: request.priors,
    teams: match.teams,
    gameFormat: match.gameFormat,
    policy: request.policy,
  };

  it("offers a standard set of outcomes, with probabilities that cover wins and losses", () => {
    expect(standardOutcomes(match.gameFormat).map((g) => g[0]!.score)).toEqual([[11, 3], [11, 7], [11, 9], [9, 11], [7, 11], [3, 11]]);
    const out = forecast(forecastRequest);
    expect(parse(ForecastResponse, out).ok).toBe(true);
    expect(out.outcomes).toHaveLength(6);
    const [win, loss] = [out.outcomes[0]!.probability, out.outcomes[5]!.probability];
    expect(win + loss).toBeCloseTo(1, 8);
    // Winning moves teams[0] up; losing moves them down.
    const ava = (i: number) => out.outcomes[i]!.changes.find((c) => c.playerId === "p-ava")!.delta;
    expect(ava(0)).toBeGreaterThan(0);
    expect(ava(5)).toBeLessThan(ava(0));
  });

  it("agrees exactly with rate() for the result that actually happened", () => {
    const happened = forecast({ ...forecastRequest, outcomes: [match.games] }).outcomes[0]!;
    const actual = rate({ ...request, event: { ...request.event, matches: [match] } });
    for (const r of actual.receipts) {
      const c = happened.changes.find((x) => x.playerId === r.playerId)!;
      expect(c.after).toEqual(r.after);
      expect(c.delta).toBe(r.headline.delta);
    }
  });
});

describe("verify()", () => {
  const response = rate(request);

  it("confirms every receipt against its request", () => {
    for (const receipt of response.receipts) {
      const v = verify({ input: request, receipt });
      expect(parse(VerifyResponse, v).ok).toBe(true);
      expect(v).toMatchObject({ ok: true, inputHashMatches: true, mismatches: [] });
    }
  });

  it("points at exactly what was altered", () => {
    const tampered = clone(response.receipts[0]);
    tampered.after.rating = 9.99;
    const v = verify({ input: request, receipt: tampered });
    expect(v.ok).toBe(false);
    expect(v.inputHashMatches).toBe(true);
    expect(v.mismatches).toEqual([{ path: "/after/rating", expected: String(response.receipts[0]!.after.rating), actual: "9.99" }]);
  });

  it("detects a request that is not the one the receipt came from", () => {
    const other = clone(request);
    other.event.matches[0].games[0].score = [3, 11];
    const v = verify({ input: other, receipt: response.receipts[0] });
    expect(v.ok).toBe(false);
    expect(v.inputHashMatches).toBe(false);
    expect(v.mismatches.length).toBeGreaterThan(0);
  });
});

describe("explainReceipt()", () => {
  const response = rate(request);

  it("renders all three tiers for every receipt", () => {
    for (const receipt of response.receipts) {
      const e = explainReceipt(receipt, { eventLabel: "Saturday round robin" });
      expect(e.headline).toMatch(/^[+−±]\d\.\d{3} at Saturday round robin\. /);
      expect(e.summary.length).toBeGreaterThan(0);
      expect(e.details.at(-1)).toMatch(/^Final change: /);
    }
  });

  it("explains a first event and a provisional range", () => {
    const provisional = { ...request, policy: { base: { ...bayes, rules: { ...bayes.rules, provisionalPeriod: { events: 8, rangeSd: 1 } } }, overlay: null } };
    const dee = rate(provisional).receipts.find((r) => r.playerId === "p-dee")!;
    const e = explainReceipt(dee);
    expect(e.headline).toContain("First rated event, starting from 3.00.");
    expect(e.summary.join(" ")).toMatch(/Provisional rating: likely between \d\.\d\d and \d\.\d\d, 7 events until it is established\./);
    expect(e.details.join(" ")).toContain("Provisional event 1 of 8");
  });

  it("is deterministic", () => {
    const r = response.receipts[1]!;
    expect(explainReceipt(r)).toEqual(explainReceipt(clone(r)));
  });
});
