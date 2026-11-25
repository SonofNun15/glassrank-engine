/**
 * Conformance cases: inputs and exact expected outputs for every command,
 * written to conformance/ at the repo root. Any implementation (this CLI, or
 * a port in another language) conforms if it reproduces every output byte for
 * byte with the same exit code: see conformance/README.md and check.mjs.
 * Regenerate with `pnpm generate` only when behavior changes on purpose.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PolicyConfig, RateRequest } from "@glassrank/schema";
import { expect, it } from "vitest";
import { formatOutput, runCommand } from "./index";

const root = join(import.meta.dirname, "../../..");
const fixture = (f: string): any => JSON.parse(readFileSync(join(root, "packages/schema/fixtures", f), "utf8"));
const clone = <T>(v: T): any => structuredClone(v);

const elo: RateRequest = fixture("rate-request.json");
const bayes: PolicyConfig = {
  ...elo.policy.base,
  policyId: "conformance-bayes",
  evidence: { model: "bayes_v0", winScale: 3.2, shareScale: 1.0, marginWeight: 0.5, dynamicsSigma: 0.05, sigmaFloor: 0.08 },
  rules: { ...elo.policy.base.rules, provisionalPeriod: { events: 8, rangeSd: 1 } },
};
const bayesRequest = { ...elo, policy: { base: bayes, overlay: null } };
const correction = {
  ...fixture("overlay.json"),
  announcedAt: "2026-11-01T00:00:00Z",
  effectiveFrom: "2026-11-10T00:00:00Z",
  expiresAt: "2027-02-01T00:00:00Z",
};
// Ava (established) loses every game, so the active correction changes her drop.
const correctionRequest = { ...clone(bayesRequest), policy: { base: bayes, overlay: correction } };
correctionRequest.event.matches[0].games = [{ score: [3, 11] }];
correctionRequest.event.matches[1].games = [{ score: [5, 11] }];
const voided = clone(bayesRequest);
voided.event.matches[1].trust = { weight: 1, voided: true, reason: "dispute_upheld" };
const missingPrior = clone(elo);
missingPrior.priors.pop();
const match = elo.event.matches[0]!;
const secondEvent = { ...clone(elo.event), eventId: "evt-2026-11-21-oakridge-rr", occurredAt: "2026-11-21T14:00:00Z" };
const bayesReceipts = (runCommand("rate", bayesRequest).output as { receipts: any[] }).receipts;
const tampered = clone(bayesReceipts[0]);
tampered.after.rating = 9.99;

const CASES: Record<string, Record<string, unknown>> = {
  rate: {
    "elo-basic": elo,
    "bayes-provisional-newcomers": bayesRequest,
    "bayes-correction-active": correctionRequest,
    "voided-match": voided,
    "error-missing-prior": missingPrior,
  },
  predict: {
    doubles: { schemaVersion: "0.1.0", at: elo.event.occurredAt, priors: elo.priors, teams: match.teams, gameFormat: match.gameFormat, policy: bayesRequest.policy },
  },
  forecast: {
    "standard-outcomes": { schemaVersion: "0.1.0", occurredAt: elo.event.occurredAt, source: elo.event.source, priors: elo.priors, teams: match.teams, gameFormat: match.gameFormat, policy: bayesRequest.policy },
  },
  replay: {
    "two-events": {
      schemaVersion: "0.1.0",
      initial: elo.priors,
      events: [elo.event, secondEvent],
      schedule: { schemaVersion: "0.1.0", policies: [{ effectiveFrom: "2026-01-01T00:00:00Z", policy: bayes }], overlays: [] },
    },
  },
  verify: {
    ok: { input: bayesRequest, receipt: bayesReceipts[0] },
    tampered: { input: bayesRequest, receipt: tampered },
  },
  explain: {
    "newcomer-receipt": { receipt: bayesReceipts.find((r) => r.playerId === "p-dee"), eventLabel: "Saturday round robin" },
  },
  version: { current: null },
};

const manifest: { command: string; name: string; exitCode: number }[] = [];
for (const [command, cases] of Object.entries(CASES)) {
  for (const [name, input] of Object.entries(cases)) {
    const result = runCommand(command, input);
    manifest.push({ command, name, exitCode: result.exitCode });
    it(`${command}/${name}`, async () => {
      const dir = join(root, "conformance", "cases", command);
      await expect(`${JSON.stringify(input, null, 2)}\n`).toMatchFileSnapshot(join(dir, `${name}.input.json`));
      await expect(formatOutput(result.output)).toMatchFileSnapshot(join(dir, `${name}.output.json`));
    });
  }
}

it("manifest lists every case and its exit code", async () => {
  expect(manifest.find((m) => m.name === "error-missing-prior")?.exitCode).toBe(2);
  expect(manifest.filter((m) => m.name !== "error-missing-prior").every((m) => m.exitCode === 0)).toBe(true);
  await expect(`${JSON.stringify(manifest, null, 2)}\n`).toMatchFileSnapshot(join(root, "conformance", "cases.json"));
});
