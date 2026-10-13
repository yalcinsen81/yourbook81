import { formatDateLocal, formatPercent, t } from "../i18n";
import { isLate } from "./reports";
import type { Project, Schedule } from "./types";

// Görev doğrulama uyarıları (saf): gecikme ve tarih aralığı hataları. Zamanlamayı engellemez, göstergede ve görev
// bilgisinde gösterilir. Negatif süre ve bitişi başlangıçtan önce gerçekleşen tarih girişte reddedilir (ops.ts).

export type WarningKind = "late" | "deadlineBeforeStart" | "constraintBeforeProject" | "actualInFuture" | "actualCostNoProgress";

export interface TaskWarning {
  kind: WarningKind;
  text: string;
}

export function taskWarnings(p: Project, s: Schedule, i: number, today: string): TaskWarning[] {
  const task = p.tasks[i];
  const r = s.rows[i];
  if (!task || !r) return [];
  const out: TaskWarning[] = [];
  if (isLate(p, s, i, today)) {
    out.push({ kind: "late", text: t("valid.late", { date: formatDateLocal(task.actualFinish ?? r.finishDate), pct: formatPercent(task.percent) }) });
  }
  if (task.deadline && task.deadline < r.startDate) {
    out.push({ kind: "deadlineBeforeStart", text: t("valid.deadlineBeforeStart", { deadline: formatDateLocal(task.deadline), start: formatDateLocal(r.startDate) }) });
  }
  const c = task.constraint;
  if (c?.date && c.date < p.start && !r.isSummary) {
    out.push({ kind: "constraintBeforeProject", text: t("valid.constraintBeforeProject", { date: formatDateLocal(c.date), start: formatDateLocal(p.start) }) });
  }
  const future = [task.actualStart, task.actualFinish].find((d) => d && d > today);
  if (future) out.push({ kind: "actualInFuture", text: t("valid.actualInFuture", { date: formatDateLocal(future) }) });
  if (task.actualCost && !task.percent && !task.actualStart) out.push({ kind: "actualCostNoProgress", text: t("valid.actualCostNoProgress") });
  return out;
}

/** Tüm görevlerin uyarıları (görev kimliğine göre) */
export function allWarnings(p: Project, s: Schedule, today: string): Map<string, TaskWarning[]> {
  const m = new Map<string, TaskWarning[]>();
  p.tasks.forEach((x, i) => {
    const w = taskWarnings(p, s, i, today);
    if (w.length) m.set(x.id, w);
  });
  return m;
}
