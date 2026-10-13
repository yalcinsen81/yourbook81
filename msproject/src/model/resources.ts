import { addDays, parseDate, type WorkCalendar } from "./calendar";
import { accrualShares, assignmentCost, taskCost } from "./costs";
import type { Assignment, ProgressWeight, Project, Resource, Schedule, Task } from "./types";

export { taskCost } from "./costs";

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
    const given = m?.[2] ? Number(m[2].replace(",", ".")) : NaN;
    // Malzeme kaynağında köşeli paranteze miktar yazılır (küsuratlı olabilir); diğerlerinde birim %
    const known = byName.get(key(name));
    const material = known?.type === "material";
    const units = Number.isNaN(given) ? (material ? 1 : 100) : material ? Math.round(given * 100) / 100 : Math.round(given);
    if (!name || units <= 0 || units > (material ? 1_000_000 : 10_000)) {
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
      if (!r) return [];
      if (r.type === "material") return [`${r.name}[${a.units}${r.unitLabel ? ` ${r.unitLabel}` : ""}]`];
      return [a.units === 100 ? r.name : `${r.name}[${a.units}%]`];
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

export interface ResourceUsage {
  resource: Resource;
  /** İş günü ofsetine göre toplam yük (%) */
  load: number[];
  /** Toplam iş (adam-gün); malzemede toplam miktar */
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
  const hpd = project.hoursPerDay ?? 8;
  for (const { task, es, ef } of active) {
    for (const a of task.assignments!) {
      const u = usage.get(a.resourceId);
      if (!u) continue;
      u.cost += assignmentCost(a, u.resource, task.duration, hpd);
      // Malzeme kapasite tüketmez; yükü ve aşırı yükü yoktur
      if (u.resource.type === "material") {
        u.work += a.units;
        continue;
      }
      for (let d = Math.max(0, es); d < ef && d < days; d++) if (schedule.dayCapacity(task.id, d) > 0) u.load[d] += a.units;
      u.work += (a.units * task.duration) / 100;
    }
  }
  for (const u of usage.values()) {
    if (u.resource.type === "material") continue;
    u.peak = u.load.reduce((m, v) => Math.max(m, v), 0);
    u.load.forEach((v, d) => {
      if (v > u.resource.maxUnits) u.overDays.push(d);
    });
    if (u.overDays.length) {
      const over = new Set(u.overDays);
      for (const { task, es, ef } of active) {
        if (!task.assignments!.some((a) => a.resourceId === u.resource.id)) continue;
        for (let d = es; d < ef; d++)
          if (over.has(d) && schedule.dayCapacity(task.id, d) > 0) {
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
  /** Planlanan kümülatif ilerleme (%), seçili ağırlığa göre */
  planned: number;
  /** Planlanan kümülatif maliyet */
  cost: number;
}

export interface Curves {
  points: CurvePoint[];
  totalCost: number;
  /** Bugüne kadar gerçekleşen (girilen yüzdelere göre, planlananla aynı ağırlıkla) ilerleme */
  earnedPercent: number;
  /** Kazanılan değer: Σ görev maliyeti × % tamamlanma (para; ağırlık seçiminden bağımsız) */
  earnedCost: number;
  /** Bugünün iş günü ofseti (projenin dışında olabilir) */
  todayDay: number;
  /** Kullanılan ağırlık; seçilen ağırlığın toplamı 0 ise süreye düşülür */
  weight: ProgressWeight;
  /** Seçilen ağırlık kullanılamadı (toplamı 0), süreye düşüldü */
  weightFallback: boolean;
  /** Maliyeti 0 olan süreli yaprak görevlerin satır numaraları (maliyet ağırlığında ilerleme ağırlıkları 0) */
  zeroCostRows: number[];
}

interface WeightedTask {
  row: number;
  es: number;
  ef: number;
  /** Süre (iş günü) */
  dur: number;
  cost: number;
  work: number;
  percent: number;
  /** Gün başına pay (eşit dağılım, kapasiteyle orantılı) ve maliyet payı (maliyet dağılım türüne göre) */
  shares: number[];
  costShares: number[];
}

/** Ağırlığa göre görev değeri: maliyet (₺), iş (adam-gün) ya da süre (iş günü) */
function weightOf(t: WeightedTask, mode: ProgressWeight): number {
  return mode === "cost" ? t.cost : mode === "work" ? t.work : t.dur;
}

export function projectWeight(project: Project): ProgressWeight {
  return project.progressWeight ?? "cost";
}

/**
 * S eğrisi ve ilerleme: planlanan %, gerçekleşen % ve sapma tek bir ağırlıkla hesaplanır (varsayılan maliyet).
 * Görevin ağırlığı iş günlerine eşit dağılır (yarım gün yarım pay); maliyet görevin maliyet dağılımına göre (eşit,
 * başta, sonda). Maliyet ağırlığında planlanan % maliyet eğrisini izler. Özet görevler ve kilometre taşları sayılmaz;
 * yalnızca sabit maliyetli ya da malzemeli kilometre taşının maliyeti o güne yazılır.
 */
export function progressCurves(project: Project, schedule: Schedule, today: string, mode: ProgressWeight = projectWeight(project)): Curves {
  const days = schedule.finish;
  const items: WeightedTask[] = [];
  const byId = new Map(project.resources.map((r) => [r.id, r]));
  project.tasks.forEach((t, i) => {
    const r = schedule.rows[i];
    if (!r || r.isSummary) return;
    if (r.ef <= r.es) {
      // Kilometre taşının sabit maliyeti ya da malzemesi varsa o güne yazılır
      const cost = taskCost(t, project);
      const day = r.atDayEnd ? r.es - 1 : r.es;
      if (cost > 0) items.push({ row: i + 1, es: day, ef: day + 1, dur: 0, cost, work: 0, percent: t.percent, shares: [1], costShares: [1] });
      return;
    }
    const work = (t.assignments ?? []).reduce((sum, a) => {
      const res = byId.get(a.resourceId);
      return sum + (res && res.type !== "material" ? (a.units * t.duration) / 100 : 0);
    }, 0);
    const caps: number[] = [];
    for (let d = r.es; d < r.ef; d++) caps.push(schedule.dayCapacity(t.id, d));
    items.push({
      row: i + 1,
      es: r.es,
      ef: r.ef,
      dur: t.duration,
      cost: taskCost(t, project),
      work,
      percent: t.percent,
      shares: accrualShares(caps),
      costShares: accrualShares(caps, t.costAccrual),
    });
  });
  let weight = mode;
  if (!items.some((t) => weightOf(t, mode) > 0)) weight = "duration";

  const dailyWeight = new Array<number>(days).fill(0);
  const dailyCost = new Array<number>(days).fill(0);
  let totalWeight = 0;
  let totalCost = 0;
  let earnedWeight = 0;
  let earnedCost = 0;
  for (const t of items) {
    const w = weightOf(t, weight);
    totalWeight += w;
    totalCost += t.cost;
    earnedWeight += (w * t.percent) / 100;
    earnedCost += (t.cost * t.percent) / 100;
    const shares = weight === "cost" ? t.costShares : t.shares;
    for (let d = t.es; d < t.ef && d < days; d++) {
      if (d < 0) continue;
      dailyWeight[d] += w * shares[d - t.es];
      dailyCost[d] += t.cost * t.costShares[d - t.es];
    }
  }
  const points: CurvePoint[] = [{ day: -1, date: schedule.calendar.toDate(0), planned: 0, cost: 0 }];
  let w = 0;
  let c = 0;
  for (let d = 0; d < days; d++) {
    w += dailyWeight[d];
    c += dailyCost[d];
    points.push({ day: d, date: schedule.calendar.toDate(d), planned: totalWeight ? (w / totalWeight) * 100 : 0, cost: c });
  }
  // Kayan nokta birikimi son noktada tam %100 / toplam maliyet olsun
  if (days > 0 && totalWeight) points[points.length - 1] = { ...points[points.length - 1], planned: 100, cost: totalCost };
  return {
    points,
    totalCost,
    earnedPercent: totalWeight ? (earnedWeight / totalWeight) * 100 : 0,
    earnedCost,
    todayDay: schedule.calendar.toOffset(today),
    weight,
    weightFallback: weight !== mode && items.length > 0,
    zeroCostRows: items.filter((t) => t.cost <= 0 && t.dur > 0).map((t) => t.row),
  };
}

/** Bir iş günü ofsetinde (gün sonu) planlanan ilerleme */
export function plannedAt(curves: Curves, day: number): number {
  if (day < 0) return 0;
  const p = curves.points[Math.min(day + 1, curves.points.length - 1)];
  return p?.planned ?? 0;
}

/** Takvim tarihinin gün sonundaki eğri noktası (tatil / hafta sonu ise önceki iş gününün sonu) */
export function curveAtDate(curves: Curves, calendar: WorkCalendar, date: string): { planned: number; cost: number } {
  // date dahil o güne kadarki iş günü sayısı = date'ten sonraki ilk iş gününün ofseti
  const done = calendar.toOffset(addDays(date, 1));
  const p = curves.points[Math.max(0, Math.min(done, curves.points.length - 1))];
  return { planned: p?.planned ?? 0, cost: p?.cost ?? 0 };
}

export interface CurveSample {
  date: string;
  plannedPercent: number;
  plannedCost: number;
}

/**
 * Eğri örnekleri takvim haftasına sabitlenir: proje başlangıcı (%0), aradaki her cuma (tatil olsa da takvim
 * tarihi), proje bitişi (%100) ve aralıktaysa bugün. Tarihler artan sırada ve tekrarsızdır.
 */
export function curveSamples(curves: Curves, schedule: Schedule, today?: string): CurveSample[] {
  if (schedule.finish <= 0) return [];
  const start = schedule.calendar.base;
  const finish = schedule.finishDate;
  const dates = new Set<string>([start, finish]);
  // İlk cuma: başlangıçtan sonraki (ya da başlangıç günü olan) cuma
  let friday = addDays(start, (5 - parseDate(start).getUTCDay() + 7) % 7);
  for (; friday < finish; friday = addDays(friday, 7)) dates.add(friday);
  if (today && today > start && today < finish) dates.add(today);
  return [...dates].sort().map((date) => {
    if (date === start) return { date, plannedPercent: 0, plannedCost: 0 };
    const v = date === finish ? curves.points[curves.points.length - 1] : curveAtDate(curves, schedule.calendar, date);
    return { date, plannedPercent: v.planned, plannedCost: v.cost };
  });
}

/** Boş ya da geçersiz değer "—" gösterilir (arayüz çökmesin). Dil ve proje para birimine göre biçimlenir. */
export { formatMoney } from "../i18n";
