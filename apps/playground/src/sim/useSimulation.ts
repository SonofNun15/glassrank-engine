/** Run a recipe in a Web Worker and track its progress. */
import type { SimulationRecipeV2, SimulationResultV2 } from "@glassrank/sim";
import { useEffect, useState } from "react";
import type { RunResponse } from "./protocol";

export type SimulationState =
  | { readonly status: "running" }
  | { readonly status: "done"; readonly result: SimulationResultV2; readonly computeMs: number; readonly totalMs: number }
  | { readonly status: "error"; readonly message: string };

let nextId = 1;

export function useSimulation(recipe: SimulationRecipeV2): SimulationState {
  const [state, setState] = useState<SimulationState>({ status: "running" });

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setState({ status: "error", message: "This browser can't run the simulation in the background." });
      return;
    }
    setState({ status: "running" });
    const id = nextId++;
    const started = performance.now();
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<RunResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      setState(msg.ok ? { status: "done", result: msg.result, computeMs: msg.computeMs, totalMs: performance.now() - started } : { status: "error", message: msg.message });
      worker.terminate();
    };
    worker.onerror = (e) => {
      setState({ status: "error", message: e.message || "The simulation stopped unexpectedly." });
      worker.terminate();
    };
    worker.postMessage({ id, recipe });
    return () => worker.terminate();
  }, [recipe]);

  return state;
}
