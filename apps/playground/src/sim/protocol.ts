/** Messages between the Test court page and its simulation worker. */
import type { SimulationRecipeV2, SimulationResultV2 } from "@glassrank/sim";

export interface RunRequest {
  readonly id: number;
  readonly recipe: SimulationRecipeV2;
}

export type RunResponse =
  | { readonly id: number; readonly ok: true; readonly result: SimulationResultV2; readonly computeMs: number }
  | { readonly id: number; readonly ok: false; readonly message: string };
