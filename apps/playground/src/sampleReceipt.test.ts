import { headlineBody } from "@glassrank/design";
import { expect, it } from "vitest";
import { EVIDENCE } from "./evidence";
import { sampleReceipt } from "./sampleReceipt";

it("computes a real receipt for the landing page", () => {
  const s = sampleReceipt();
  expect(s.explanation.headline.length).toBeGreaterThan(0);
  expect(headlineBody(s.explanation.headline)).not.toMatch(/^[+−±]/);
  expect(s.explanation.summary.length).toBeGreaterThan(0);
  expect(s.receipt.headline.delta).toBeGreaterThan(0);
  expect(s.explanation.headline).toContain("Beat 1 higher-rated team.");
});

it("reads landing-page evidence from the simulator's golden comparison", () => {
  expect(EVIDENCE.closerToTruePct).toBeGreaterThan(0);
  expect(EVIDENCE.logLoss.glassrank).toBeLessThan(EVIDENCE.logLoss.elo);
  expect(EVIDENCE.improversCloserPct).toBeGreaterThan(0);
});
