/**
 * Runs simulations off the main thread, so the page stays responsive. The
 * worker runs the same open-source engine and simulator as the tests.
 */
import { GLASSRANK, followPlayer, simulateRecipeV2 } from "@glassrank/sim";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

scope.onmessage = (e) => {
  const req = e.data;
  try {
    const start = performance.now();
    if (req.kind === "run") {
      const result = simulateRecipeV2(req.recipe, GLASSRANK);
      scope.postMessage({ id: req.id, ok: true, kind: "run", result, computeMs: performance.now() - start });
    } else {
      const report = followPlayer(req.recipe, GLASSRANK, req.playerId, (s) => req.eventLabels[s] ?? s);
      scope.postMessage({ id: req.id, ok: true, kind: "follow", report, computeMs: performance.now() - start });
    }
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
};
