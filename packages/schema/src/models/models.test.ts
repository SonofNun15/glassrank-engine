import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CorrectionOverlay,
  EventInput,
  PolicyConfig,
  PolicySchedule,
  Prior,
  RateRequest,
  Receipt,
  ReplayRequest,
  Seed,
  parse,
  type Schema,
} from "../index";

const root = join(import.meta.dirname, "../..");
const fixture = (name: string): unknown => JSON.parse(readFileSync(join(root, "fixtures", name), "utf8"));
/** Deep, mutable copy for building invalid variants. */
const clone = <T>(v: T): any => structuredClone(v);

function messages<T>(schema: Schema<T>, value: unknown): string[] {
  const r = parse(schema, value);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
}

const event = fixture("event.json");
const policy = fixture("policy.json");
const overlay = fixture("overlay.json");
const priors = fixture("priors.json") as unknown[];
const request = fixture("rate-request.json");
const receipt = fixture("receipt.json");

describe("fixtures", () => {
  it.each([
    ["event.json", EventInput, event],
    ["policy.json", PolicyConfig, policy],
    ["overlay.json", CorrectionOverlay, overlay],
    ["rate-request.json", RateRequest, request],
    ["receipt.json", Receipt, receipt],
  ] as const)("%s is valid", (_name, schema, value) => {
    expect(messages(schema as Schema<unknown>, value)).toEqual([]);
  });

  it("priors.json holds valid priors: two rating states and two seeds", () => {
    priors.forEach((p, i) => expect(messages(Prior, p), `prior ${i}`).toEqual([]));
    expect(priors.map((p) => (p as { kind: string }).kind)).toEqual(["state", "state", "seed", "seed"]);
  });
});

describe("EventInput rules", () => {
  it("rejects duplicate match ids", () => {
    const e = clone(event);
    e.matches[1].matchId = "m1";
    expect(messages(EventInput, e)).toEqual(["/matches/1/matchId: duplicate matchId m1"]);
  });

  it("rejects a player on both teams, a doubled-up team, and mixed team sizes", () => {
    const e = clone(event);
    e.matches[0].teams = [["p-ava", "p-ben"], ["p-ben", "p-dee"]];
    e.matches[1].teams = [["p-ava", "p-ava"], ["p-ben", "p-dee"]];
    e.matches[2].teams = [["p-ava"], ["p-ben", "p-cam"]];
    expect(messages(EventInput, e)).toEqual([
      "/matches/0/teams: player p-ben is on both teams",
      "/matches/1/teams/0: a team cannot list the same player twice",
      "/matches/2/teams: teams must be the same size",
    ]);
  });

  it("does not accept open play as a rated event format", () => {
    expect(messages(EventInput, { ...clone(event), format: "open_play" })).toEqual([
      "/format: expected one of round_robin, ladder, league, tournament, other",
    ]);
  });

  it("does not accept player-reported results", () => {
    const e = clone(event);
    e.source.tier = "player_reported";
    expect(messages(EventInput, e)).toEqual([
      "/source/tier: expected one of verified_host, provisional_host, video_verified",
    ]);
  });

  it("rejects an incompatible schema version", () => {
    expect(messages(EventInput, { ...clone(event), schemaVersion: "0.2.0" })).toEqual([
      "/schemaVersion: schema version 0.2.0 is not compatible with 0.1.0",
    ]);
  });

  it("has no place for names, contact details, or age", () => {
    const e = clone(event);
    e.matches[0].teams[0][0] = "ava@example.com";
    expect(messages(EventInput, e)[0]).toMatch(/^\/matches\/0\/teams\/0\/0: must match pattern/);
    const seed = { source: "self", playerId: "p-x", discipline: "doubles", rating: 3, recordedAt: "2026-01-01T00:00:00Z", birthYear: 1970 };
    expect(messages(Seed, seed)).toEqual(["/birthYear: unknown property"]);
  });
});

describe("RateRequest rules", () => {
  it("requires exactly one prior per participant", () => {
    const r = clone(request);
    r.priors.splice(3, 1);
    r.priors.push({ kind: "seed", seed: { source: "policy_default", playerId: "p-zed", discipline: "doubles" } });
    expect(messages(RateRequest, r)).toEqual([
      "/priors: missing prior for p-dee (doubles)",
      "/priors/3: prior for a player not in this request",
    ]);
  });

  it("requires priors sorted by (discipline, playerId)", () => {
    const r = clone(request);
    r.priors.reverse();
    expect(messages(RateRequest, r)).toContain(
      "/priors/1: priors must be sorted by (discipline, playerId) and unique",
    );
  });

  it("rejects an overlay that is not active at the event time", () => {
    const r = clone(request);
    r.policy.overlay = overlay;
    expect(messages(RateRequest, r)).toEqual(["/policy/overlay: overlay is not active at event.occurredAt"]);
    r.event.occurredAt = "2027-01-09T14:00:00Z";
    expect(messages(RateRequest, r)).toEqual([]);
  });
});

describe("policy rules", () => {
  it("rejects an overlay that changes nothing or ends before it starts", () => {
    const o = clone(overlay);
    o.adjust = {};
    o.expiresAt = o.effectiveFrom;
    expect(messages(CorrectionOverlay, o)).toEqual([
      "/expiresAt: must be after effectiveFrom",
      "/adjust: must set at least one lever",
    ]);
  });

  it("does not let an overlay touch the decline cap", () => {
    const o = clone(overlay);
    o.adjust.declineCapAmount = 0.5;
    expect(messages(CorrectionOverlay, o)).toEqual(["/adjust/declineCapAmount: unknown property"]);
  });

  it("rejects overlapping overlays in a schedule", () => {
    const second = { ...clone(overlay), overlayId: "correction-2027q1b", effectiveFrom: "2027-03-01T00:00:00Z", expiresAt: "2027-05-01T00:00:00Z" };
    const sched = {
      schemaVersion: "0.1.0",
      policies: [{ effectiveFrom: "2026-01-01T00:00:00Z", policy }],
      overlays: [overlay, second],
    };
    expect(messages(PolicySchedule, sched)).toEqual(["/overlays/1/effectiveFrom: overlaps the previous overlay"]);
  });

  it("rejects an inverted scale", () => {
    const p = clone(policy);
    p.scale.min = 8;
    p.scale.max = 2;
    expect(messages(PolicyConfig, p)).toEqual(["/scale: min must be below max"]);
  });
});

describe("ReplayRequest rules", () => {
  it("requires events in (occurredAt, eventId) order", () => {
    const later = { ...clone(event), eventId: "evt-later", occurredAt: "2026-11-21T14:00:00Z" };
    const base = {
      schemaVersion: "0.1.0",
      initial: [],
      schedule: { schemaVersion: "0.1.0", policies: [{ effectiveFrom: "2026-01-01T00:00:00Z", policy }], overlays: [] },
    };
    expect(messages(ReplayRequest, { ...base, events: [event, later] })).toEqual([]);
    expect(messages(ReplayRequest, { ...base, events: [later, event] })).toEqual([
      "/events/1: events must be sorted by (occurredAt, eventId) and unique",
    ]);
  });
});
