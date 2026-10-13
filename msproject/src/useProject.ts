import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, nextWorkday } from "./model/calendar";
import { sampleProject } from "./model/sample";
import { schedule } from "./model/schedule";
import { loadProject, saveProject } from "./model/storage";
import { initHistory, push, redo as redoStep, undo as undoStep, type History } from "./model/history";
import type { Project } from "./model/types";

export function todayIso(): string {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Proje durumu: geri al / yinele geçmişi ve localStorage'a otomatik kayıt. */
export function useProject() {
  const [history, setHistory] = useState<History<Project>>(() => initHistory(loadProject() ?? sampleProject(nextWorkday(todayIso()))));
  const project = history.present;

  useEffect(() => saveProject(project), [project]);

  const update = useCallback((fn: (p: Project) => Project) => {
    setHistory((h) => push(h, fn(h.present)));
  }, []);

  const undo = useCallback(() => {
    setHistory(undoStep);
  }, []);

  const redo = useCallback(() => {
    setHistory(redoStep);
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
