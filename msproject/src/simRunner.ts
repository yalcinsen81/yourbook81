import { simulate } from "./model/simulation";
import type { Project, SimulationSettings, SimulationSummary } from "./model/types";

export interface SimJob {
  promise: Promise<SimulationSummary | null>;
  cancel: () => void;
}

/** Benzetimi Web Worker'da çalıştırır; worker yoksa (eski tarayıcı, test) ana iş parçacığında parça parça çalıştırır. */
export function runSimulation(project: Project, settings: SimulationSettings, onProgress: (done: number, total: number) => void): SimJob {
  if (typeof Worker !== "undefined") {
    let worker: Worker | null = null;
    let settle: (v: SimulationSummary | null) => void = () => {};
    const promise = new Promise<SimulationSummary | null>((resolve, reject) => {
      settle = resolve;
      try {
        worker = new Worker(new URL("./simWorker.ts", import.meta.url), { type: "module" });
      } catch {
        worker = null;
      }
      if (!worker) {
        resolve(simulateInline(project, settings, onProgress));
        return;
      }
      worker.onmessage = (e: MessageEvent<{ type: string; done?: number; total?: number; summary?: SimulationSummary | null; message?: string }>) => {
        const m = e.data;
        if (m.type === "progress") onProgress(m.done!, m.total!);
        else if (m.type === "done") {
          worker?.terminate();
          resolve(m.summary ?? null);
        } else {
          worker?.terminate();
          reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        worker?.terminate();
        reject(new Error(e.message));
      };
      worker.postMessage({ project, settings });
    });
    return {
      promise,
      cancel: () => {
        worker?.terminate();
        settle(null);
      },
    };
  }
  let cancelled = false;
  return {
    promise: Promise.resolve().then(() => simulateInline(project, settings, onProgress, () => cancelled)),
    cancel: () => {
      cancelled = true;
    },
  };
}

function simulateInline(project: Project, settings: SimulationSettings, onProgress: (done: number, total: number) => void, cancelled = () => false): SimulationSummary | null {
  const run = simulate(project, settings, {
    onProgress: (done, total) => {
      onProgress(done, total);
      return !cancelled();
    },
  });
  return run?.summary ?? null;
}
