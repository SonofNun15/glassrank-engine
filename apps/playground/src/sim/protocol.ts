/** Messages between the Test court page and its simulation worker. */
import type { PlayerReport, SimulationRecipeV2, SimulationResultV2 } from "@glassrank/sim";

export type WorkerRequest =
  | { readonly id: number; readonly kind: "run"; readonly recipe: SimulationRecipeV2 }
  | {
      readonly id: number;
      readonly kind: "follow";
      readonly recipe: SimulationRecipeV2;
      readonly playerId: string;
      /** Series id -> display label, for receipt explanations. */
      readonly eventLabels: Readonly<Record<string, string>>;
    };

export type WorkerResponse =
  | { readonly id: number; readonly ok: true; readonly kind: "run"; readonly result: SimulationResultV2; readonly computeMs: number }
  | { readonly id: number; readonly ok: true; readonly kind: "follow"; readonly report: PlayerReport; readonly computeMs: number }
  | { readonly id: number; readonly ok: false; readonly message: string };

/** A request without its id; the client assigns one. */
export type RequestBody = WorkerRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;
