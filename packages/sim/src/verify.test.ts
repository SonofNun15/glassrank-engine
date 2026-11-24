/**
 * M6 exit criterion: every receipt from a simulated run verifies against the
 * request that produced it, and every receipt renders to text.
 */
import { explainReceipt, rateUnchecked, resolvePolicy, verifyUnchecked } from "@glassrank/engine";
import { SCHEMA_VERSION, type Prior } from "@glassrank/schema";
import { expect, it } from "vitest";
import { GLASSRANK, scheduleOf } from "./policies";
import { DEFAULT_SCENARIO } from "./scenario";
import { generateWorld } from "./world";

it("every receipt from a year of simulated play verifies and renders", () => {
  const world = generateWorld({ ...DEFAULT_SCENARIO, weeks: 52 });
  const schedule = scheduleOf(GLASSRANK, "2026-01-05T00:00:00Z");
  const latest = new Map<string, Prior>(world.seeds.map((seed) => [seed.playerId, { kind: "seed", seed }]));
  let receipts = 0;
  const failures: string[] = [];

  for (const event of world.events) {
    const policy = resolvePolicy(schedule, event.occurredAt)!;
    const ids = [...new Set(event.matches.flatMap((m) => m.teams.flat()))].sort();
    const request = { schemaVersion: SCHEMA_VERSION, priors: ids.map((id) => latest.get(id) as Prior), event, policy };
    const response = rateUnchecked(request);
    for (const receipt of response.receipts) {
      receipts++;
      const v = verifyUnchecked({ input: request, receipt });
      if (!v.ok) failures.push(`${event.eventId}/${receipt.playerId}: ${v.mismatches[0]?.path}`);
      expect(explainReceipt(receipt).headline.length).toBeGreaterThan(0);
    }
    for (const state of response.states) latest.set(state.playerId, { kind: "state", state });
  }

  expect(failures).toEqual([]);
  expect(receipts).toBeGreaterThan(5000);
}, 300_000);
