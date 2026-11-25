/** Run a recipe, or follow one player through it, in the simulation worker. */
import type { PlayerReport, SimulationRecipeV2, SimulationResultV2 } from "@glassrank/sim";
import { useEffect, useState } from "react";
import { canSimulate, simulate } from "./client";

export type SimulationState =
  | { readonly status: "running" }
  | { readonly status: "done"; readonly result: SimulationResultV2; readonly computeMs: number }
  | { readonly status: "error"; readonly message: string };

const NO_WORKER = "This browser can't run the simulation in the background.";

export function useSimulation(recipe: SimulationRecipeV2): SimulationState {
  const [state, setState] = useState<SimulationState>({ status: "running" });
  useEffect(() => {
    if (!canSimulate()) {
      setState({ status: "error", message: NO_WORKER });
      return;
    }
    let current = true;
    setState({ status: "running" });
    void simulate({ kind: "run", recipe }).then((r) => {
      if (!current) return;
      if (!r.ok) setState({ status: "error", message: r.message });
      else if (r.kind === "run") setState({ status: "done", result: r.result, computeMs: r.computeMs });
    });
    return () => {
      current = false;
    };
  }, [recipe]);
  return state;
}

export type FollowState =
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly report: PlayerReport }
  | { readonly status: "error"; readonly message: string };

export function useFollow(recipe: SimulationRecipeV2, playerId: string, eventLabels: Readonly<Record<string, string>>): FollowState {
  const [state, setState] = useState<FollowState>({ status: "loading" });
  useEffect(() => {
    if (!canSimulate()) {
      setState({ status: "error", message: NO_WORKER });
      return;
    }
    let current = true;
    setState({ status: "loading" });
    void simulate({ kind: "follow", recipe, playerId, eventLabels }).then((r) => {
      if (!current) return;
      if (!r.ok) setState({ status: "error", message: r.message });
      else if (r.kind === "follow") setState({ status: "done", report: r.report });
    });
    return () => {
      current = false;
    };
  }, [recipe, playerId, eventLabels]);
  return state;
}
