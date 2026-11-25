/**
 * Runs a simulation off the main thread, so the page stays responsive. The
 * worker runs the same open-source engine and simulator as the tests.
 */
import { GLASSRANK, simulateRecipeV2 } from "@glassrank/sim";
import type { RunRequest, RunResponse } from "./protocol";

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<RunRequest>) => void) | null;
  postMessage(message: RunResponse): void;
};

scope.onmessage = (e) => {
  const { id, recipe } = e.data;
  try {
    const start = performance.now();
    const result = simulateRecipeV2(recipe, GLASSRANK);
    scope.postMessage({ id, ok: true, result, computeMs: performance.now() - start });
  } catch (err) {
    scope.postMessage({ id, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
};
