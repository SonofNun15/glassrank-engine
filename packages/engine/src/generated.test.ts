/**
 * Golden vectors: full engine outputs for fixed inputs. Another platform or a
 * port in another language should reproduce these files byte for byte.
 * Regenerate with `pnpm generate` only when rating math changes on purpose.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PolicyConfig, RateRequest } from "@glassrank/schema";
import { expect, it } from "vitest";
import { rate } from "./index";

const fixtures = join(import.meta.dirname, "../../schema/fixtures");
const request: RateRequest = JSON.parse(readFileSync(join(fixtures, "rate-request.json"), "utf8"));
const overlay = JSON.parse(readFileSync(join(fixtures, "overlay.json"), "utf8"));
const elo: PolicyConfig = request.policy.base;
const bayes: PolicyConfig = {
  ...elo,
  policyId: "golden-bayes",
  evidence: { model: "bayes_v0", winScale: 3.2, shareScale: 1.0, marginWeight: 0.5, dynamicsSigma: 0.05, sigmaFloor: 0.08 },
};

const cases: Record<string, RateRequest> = {
  "rate-elo": request,
  "rate-bayes": { ...request, policy: { base: bayes, overlay: null } },
  "rate-bayes-overlay": {
    ...request,
    event: { ...request.event, eventId: "evt-2027-01-09-oakridge-rr", occurredAt: "2027-01-09T14:00:00Z" },
    policy: { base: bayes, overlay },
  },
};

it.each(Object.keys(cases))("%s matches its golden output", async (name) => {
  const out = { input: cases[name], output: rate(cases[name]) };
  await expect(`${JSON.stringify(out, null, 2)}\n`).toMatchFileSnapshot(join(import.meta.dirname, "..", "golden", `${name}.json`));
});
