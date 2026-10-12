import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, nextWorkday } from "./model/calendar";
import { sampleProject } from "./model/sample";
import { schedule } from "./model/schedule";
import { loadProject, saveProject } from "./model/storage";
import type { Project } from "./model/types";

const HISTORY_LIMIT = 100;

interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

export function todayIso(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Proje durumu: geri al / yinele geçmişi ve localStorage'a otomatik kayıt. */
export function useProject() {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: loadProject() ?? sampleProject(nextWorkday(todayIso())),
    future: [],
  }));
  const project = history.present;

  useEffect(() => saveProject(project), [project]);

  const update = useCallback((fn: (p: Project) => Project) => {
    setHistory((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      return { past: [...h.past.slice(-HISTORY_LIMIT + 1), h.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) =>
      h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h,
    );
  }, []);

  const redo = useCallback(() => {
    setHistory((h) =>
      h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h,
    );
  }, []);

  const sched = useMemo(() => schedule(project), [project]);

  return {
    project,
    schedule: sched,
    update,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
