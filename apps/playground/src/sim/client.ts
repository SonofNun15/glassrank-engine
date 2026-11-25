/** One long-lived simulation worker, shared by every request on the page. */
import type { RequestBody, WorkerResponse } from "./protocol";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: WorkerResponse) => void>();

function getWorker(): Worker {
  if (worker !== null) return worker;
  const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    pending.get(e.data.id)?.(e.data);
    pending.delete(e.data.id);
  };
  w.onerror = (e) => {
    for (const [id, done] of pending) done({ id, ok: false, message: e.message || "The simulation stopped unexpectedly." });
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

export function canSimulate(): boolean {
  return typeof Worker !== "undefined";
}

/** Send a request to the worker. Requests run one at a time, in order. */
export function simulate(body: RequestBody): Promise<WorkerResponse> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage({ ...body, id });
  });
}
