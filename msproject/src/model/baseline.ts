import { t } from "../i18n";
import { WorkCalendar } from "./calendar";
import { taskCost } from "./costs";
import { nonWorkingDates } from "./holidays";
import { subtreeEnd } from "./outline";
import { BASELINE_SLOTS, type Baseline, type Project, type Schedule } from "./types";

// Referans planlar (baseline): planın o anki tarihleri, süresi ve maliyeti saklanır; güncel planla karşılaştırılır.

/** Planı `index` numaralı referans plana kaydeder (varsa üzerine yazar) */
export function saveBaseline(p: Project, s: Schedule, index: number, today: string, name?: string): Project {
  if (!Number.isInteger(index) || index < 0 || index >= BASELINE_SLOTS) throw new RangeError(`baseline ${index}`);
  const leafCost = p.tasks.map((task, i) => (s.rows[i].isSummary ? 0 : taskCost(task, p)));
  const tasks: Baseline["tasks"] = {};
  p.tasks.forEach((task, i) => {
    const r = s.rows[i];
    const cost = r.isSummary ? leafCost.slice(i + 1, subtreeEnd(p.tasks, i)).reduce((a, b) => a + b, 0) : leafCost[i];
    tasks[task.id] = { start: r.startDate, finish: r.finishDate, duration: r.duration, cost: Math.round(cost * 100) / 100 };
  });
  const baseline: Baseline = {
    index,
    name: name?.trim() || `${t("baseline.default")} ${index + 1}`,
    savedAt: today,
    finish: s.finishDate,
    tasks,
  };
  const others = (p.baselines ?? []).filter((b) => b.index !== index);
  return { ...p, baselines: [...others, baseline].sort((a, b) => a.index - b.index) };
}

export function clearBaseline(p: Project, index: number): Project {
  const rest = (p.baselines ?? []).filter((b) => b.index !== index);
  const next: Project = { ...p, baselines: rest };
  if (!rest.length) delete next.baselines;
  return next;
}

export function getBaseline(p: Project, index: number): Baseline | undefined {
  return p.baselines?.find((b) => b.index === index);
}

export interface Variance {
  /** Başlangıç sapması (proje iş günü; pozitif = geç) */
  start: number;
  /** Bitiş sapması (proje iş günü; pozitif = geç) */
  finish: number;
  duration: number;
  cost: number;
}

/** Proje takviminde iki tarih arası iş günü farkı (b − a) */
export function projectWorkdayDiff(p: Project, a: string, b: string): number {
  const cal = new WorkCalendar(p.start, nonWorkingDates(p.holidays), p.workdays);
  return cal.toOffset(b) - cal.toOffset(a);
}

/** Her görevin referans plana göre sapması (referans planda olmayan görev listede yer almaz) */
export function baselineVariance(p: Project, s: Schedule, index: number): Map<string, Variance> {
  const b = getBaseline(p, index);
  const out = new Map<string, Variance>();
  if (!b) return out;
  const cal = new WorkCalendar(p.start, nonWorkingDates(p.holidays), p.workdays);
  const leafCost = p.tasks.map((task, i) => (s.rows[i].isSummary ? 0 : taskCost(task, p)));
  p.tasks.forEach((task, i) => {
    const row = b.tasks[task.id];
    if (!row) return;
    const r = s.rows[i];
    const cost = r.isSummary ? leafCost.slice(i + 1, subtreeEnd(p.tasks, i)).reduce((x, y) => x + y, 0) : leafCost[i];
    out.set(task.id, {
      start: cal.toOffset(r.startDate) - cal.toOffset(row.start),
      finish: cal.toOffset(r.finishDate) - cal.toOffset(row.finish),
      duration: r.duration - row.duration,
      cost: Math.round((cost - row.cost) * 100) / 100,
    });
  });
  return out;
}
