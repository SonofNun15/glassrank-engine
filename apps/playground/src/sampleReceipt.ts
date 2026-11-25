/**
 * A real calculation on a made-up event, computed in the visitor's browser by
 * the open-source engine. The players, club, and games are fictional:
 * the schema's example round robin (with Ava having a strong night, including
 * a win over the higher-rated pair), rated under the simulator's v1 policy.
 */
import { explainReceipt, rate } from "@glassrank/engine";
import type { RateRequest } from "@glassrank/schema";
import { GLASSRANK } from "@glassrank/sim";
import fixture from "../../../packages/schema/fixtures/rate-request.json";

export const SAMPLE_EVENT_LABEL = "Sample round robin (made up)";

export function sampleReceipt() {
  const base = fixture as unknown as RateRequest;
  const scores: readonly [number, number][] = [[11, 4], [11, 6], [11, 8]];
  const event = { ...base.event, matches: base.event.matches.map((m, i) => ({ ...m, games: [{ score: scores[i]! }] })) };
  const request: RateRequest = { ...base, event, policy: { base: GLASSRANK, overlay: null } };
  const response = rate(request);
  const receipt = response.receipts.find((r) => r.playerId === "p-ava")!;
  return {
    receipt,
    explanation: explainReceipt(receipt, { eventLabel: SAMPLE_EVENT_LABEL }),
    date: new Date(`${receipt.occurredAt}`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}
