import { simulate } from "./model/simulation";
import type { Project, SimulationSettings } from "./model/types";

// Benzetim arka planda çalışır; arayüz donmaz. İptal: ana iş parçacığı worker'ı sonlandırır.
self.onmessage = (e: MessageEvent<{ project: Project; settings: SimulationSettings }>) => {
  const { project, settings } = e.data;
  try {
    const run = simulate(project, settings, {
      every: 100,
      onProgress: (done, total) => {
        self.postMessage({ type: "progress", done, total });
      },
    });
    self.postMessage({ type: "done", summary: run?.summary ?? null });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
