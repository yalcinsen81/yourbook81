import type { Assignment, Project, Resource, Schedule, Task } from "./types";

// Kaynak atama, kaynak yükü (histogram), maliyet ve ilerleme eğrileri. Hepsi saf hesaplamadır.
// Yük iş günü ofsetleri üzerinden tutulur: görev es..ef-1 günlerinde atandığı birimi harcar.

export function newResourceId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const key = (name: string) => name.trim().toLocaleLowerCase("tr");

export interface ParsedAssignments {
  assignments: Assignment[];
  /** Listede olmayan adlar için oluşturulan yeni kaynaklar (MS Project de böyle yapar) */
  created: Resource[];
  errors: string[];
}

/** "Ali[50%]; Vinç; Kalıp ekibi[200]" → atamalar. Birim yazılmazsa %100. */
export function parseAssignments(text: string, resources: Resource[]): ParsedAssignments {
  const byName = new Map(resources.map((r) => [key(r.name), r]));
  const assignments: Assignment[] = [];
  const created: Resource[] = [];
  const errors: string[] = [];
  for (const raw of text.split(/[;,]/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(.*?)\s*(?:\[\s*(\d+(?:[.,]\d+)?)\s*%?\s*\])?$/.exec(part);
    const name = m?.[1].trim() ?? "";
    const units = m?.[2] ? Math.round(Number(m[2].replace(",", "."))) : 100;
    if (!name || units <= 0 || units > 10_000) {
      errors.push(part);
      continue;
    }
    let res = byName.get(key(name));
    if (!res) {
      res = { id: newResourceId(), name, maxUnits: 100, rate: 0 };
      byName.set(key(name), res);
      created.push(res);
    }
    const existing = assignments.find((a) => a.resourceId === res.id);
    if (existing) existing.units = units;
    else assignments.push({ resourceId: res.id, units });
  }
  return { assignments, created, errors };
}

export function formatAssignments(assignments: Assignment[] | undefined, resources: Resource[]): string {
  if (!assignments?.length) return "";
  const byId = new Map(resources.map((r) => [r.id, r]));
  return assignments
    .flatMap((a) => {
      const r = byId.get(a.resourceId);
      return r ? [a.units === 100 ? r.name : `${r.name}[${a.units}%]`] : [];
    })
    .join("; ");
}

/** Metni göreve uygular: yeni adlar kaynak listesine eklenir. Hatalıysa errors dolu döner, proje değişmez. */
export function assignFromText(project: Project, taskId: string, text: string): { project: Project; errors: string[]; created: Resource[] } {
  const { assignments, created, errors } = parseAssignments(text, project.resources);
  if (errors.length) return { project, errors, created: [] };
  return {
    project: {
      ...project,
      resources: [...project.resources, ...created],
      tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, assignments } : t)),
    },
    errors,
    created,
  };
}

/** Kaynağı siler; görevlerdeki atamaları da kalkar. */
export function removeResource(project: Project, resourceId: string): Project {
  return {
    ...project,
    resources: project.resources.filter((r) => r.id !== resourceId),
    tasks: project.tasks.map((t) =>
      t.assignments?.some((a) => a.resourceId === resourceId)
        ? { ...t, assignments: t.assignments.filter((a) => a.resourceId !== resourceId) }
        : t,
    ),
  };
}

/** Atamalar yalnızca yaprak, süresi olan görevlerde geçerlidir */
function activeTasks(project: Project, schedule: Schedule): { task: Task; es: number; ef: number }[] {
  return project.tasks.flatMap((task, i) => {
    const r = schedule.rows[i];
    if (!r || r.isSummary || r.ef <= r.es || !task.assignments?.length) return [];
    return [{ task, es: r.es, ef: r.ef }];
  });
}

export function taskCost(task: Task, resources: Resource[], duration = task.duration): number {
  if (!task.assignments?.length) return 0;
  const byId = new Map(resources.map((r) => [r.id, r]));
  let cost = 0;
  for (const a of task.assignments) cost += ((byId.get(a.resourceId)?.rate ?? 0) * a.units * duration) / 100;
  return cost;
}

export interface ResourceUsage {
  resource: Resource;
  /** İş günü ofsetine göre toplam yük (%) */
  load: number[];
  /** Toplam iş (adam-gün) */
  work: number;
  cost: number;
  peak: number;
  /** Kapasitenin aşıldığı iş günü ofsetleri */
  overDays: number[];
  /** Aşırı yüklü günlerde çalışan görevler */
  overTasks: string[];
}

export function resourceUsage(project: Project, schedule: Schedule): ResourceUsage[] {
  const days = Math.max(schedule.finish, 0);
  const usage = new Map<string, ResourceUsage>(
    project.resources.map((r) => [
      r.id,
      { resource: r, load: new Array<number>(days).fill(0), work: 0, cost: 0, peak: 0, overDays: [], overTasks: [] },
    ]),
  );
  const active = activeTasks(project, schedule);
  for (const { task, es, ef } of active) {
    for (const a of task.assignments!) {
      const u = usage.get(a.resourceId);
      if (!u) continue;
      for (let d = Math.max(0, es); d < ef && d < days; d++) u.load[d] += a.units;
      u.work += (a.units * (ef - es)) / 100;
      u.cost += (u.resource.rate * a.units * (ef - es)) / 100;
    }
  }
  for (const u of usage.values()) {
    u.peak = u.load.reduce((m, v) => Math.max(m, v), 0);
    u.load.forEach((v, d) => {
      if (v > u.resource.maxUnits) u.overDays.push(d);
    });
    if (u.overDays.length) {
      const over = new Set(u.overDays);
      for (const { task, es, ef } of active) {
        if (!task.assignments!.some((a) => a.resourceId === u.resource.id)) continue;
        for (let d = es; d < ef; d++)
          if (over.has(d)) {
            u.overTasks.push(task.id);
            break;
          }
      }
    }
  }
  return project.resources.map((r) => usage.get(r.id)!);
}

/** Aşırı yüklü bir kaynağın aşırı yüklü gününde çalışan görevler */
export function overallocatedTasks(usage: ResourceUsage[]): Set<string> {
  return new Set(usage.flatMap((u) => u.overTasks));
}

export interface CurvePoint {
  /** İş günü ofseti; nokta o günün sonunu gösterir */
  day: number;
  date: string;
  /** Planlanan kümülatif ilerleme (%) */
  planned: number;
  /** Planlanan kümülatif maliyet */
  cost: number;
}

export interface Curves {
  points: CurvePoint[];
  totalCost: number;
  /** Bugüne kadar gerçekleşen (girilen yüzdelere göre) ilerleme ve kazanılan değer */
  earnedPercent: number;
  earnedCost: number;
  /** Bugünün iş günü ofseti (projenin dışında olabilir) */
  todayDay: number;
}

/**
 * S eğrisi: süreye göre ağırlıklı planlanan ilerleme (MS Project'teki % tamamlanma ile aynı ağırlık) ve
 * kümülatif maliyet. Görevin işi ve maliyeti süresine eşit dağılır.
 */
export function progressCurves(project: Project, schedule: Schedule, today: string): Curves {
  const days = schedule.finish;
  const dailyWork = new Array<number>(days).fill(0);
  const dailyCost = new Array<number>(days).fill(0);
  let totalWork = 0;
  let totalCost = 0;
  let earnedWork = 0;
  let earnedCost = 0;
  project.tasks.forEach((t, i) => {
    const r = schedule.rows[i];
    if (!r || r.isSummary || r.ef <= r.es) return;
    const len = r.ef - r.es;
    const cost = taskCost(t, project.resources, len);
    totalWork += len;
    totalCost += cost;
    earnedWork += (len * t.percent) / 100;
    earnedCost += (cost * t.percent) / 100;
    for (let d = r.es; d < r.ef && d < days; d++) {
      dailyWork[d] += 1;
      dailyCost[d] += cost / len;
    }
  });
  const points: CurvePoint[] = [{ day: -1, date: schedule.calendar.toDate(0), planned: 0, cost: 0 }];
  let w = 0;
  let c = 0;
  for (let d = 0; d < days; d++) {
    w += dailyWork[d];
    c += dailyCost[d];
    points.push({ day: d, date: schedule.calendar.toDate(d), planned: totalWork ? (w / totalWork) * 100 : 0, cost: c });
  }
  return {
    points,
    totalCost,
    earnedPercent: totalWork ? (earnedWork / totalWork) * 100 : 0,
    earnedCost,
    todayDay: schedule.calendar.toOffset(today),
  };
}

/** Bir tarihte planlanan ilerleme (gün sonu) */
export function plannedAt(curves: Curves, day: number): number {
  if (day < 0) return 0;
  const p = curves.points[Math.min(day + 1, curves.points.length - 1)];
  return p?.planned ?? 0;
}

export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString("tr-TR")} ₺`;
}
