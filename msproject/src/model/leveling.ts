import { taskCost } from "./costs";
import { resourceUsage } from "./resources";
import { schedule } from "./schedule";
import type { Project, Schedule, Task } from "./types";

// Kaynak seviyeleme (saf): aşırı yükü bulur ve üç çözüm önerir. Hiçbiri kendiliğinden uygulanmaz; arayüz önce
// önizlemeyi gösterir, kullanıcı onaylarsa önerinin `project`'i kullanılır.
//  - delay: çakışan görevlerden bolluğu en fazla olanı geciktirilir (seviyeleme gecikmesi), tekrar edilir
//  - units: aşırı yüklü kaynağın görevlerindeki birim düşürülür, iş korunsun diye süre uzar
//  - capacity: kaynağın kapasitesi en yüksek yüke çıkarılır (tarihler değişmez)

export type LevelingKind = "delay" | "units" | "capacity";

export interface LevelingChange {
  kind: LevelingKind;
  /** Görev satırı (kapasite önerisinde 0) */
  row: number;
  /** Görev ya da kaynak adı */
  name: string;
  /** delay: gecikme (iş günü); units: birim %; capacity: kapasite % */
  before: number;
  after: number;
  /** delay/units: görevin önceki ve sonraki tarihleri */
  startBefore?: string;
  startAfter?: string;
  finishBefore?: string;
  finishAfter?: string;
  /** units: kaynağın adı */
  resource?: string;
}

export interface LevelingOption {
  kind: LevelingKind;
  project: Project;
  changes: LevelingChange[];
  finishBefore: string;
  finishAfter: string;
  costBefore: number;
  costAfter: number;
  /** Öneriden sonra hâlâ aşırı yüklü kalan kaynak sayısı */
  remainingOver: number;
}

export interface Overallocation {
  resourceId: string;
  name: string;
  /** Aşırı yüklü iş günü sayısı */
  days: number;
  peak: number;
  maxUnits: number;
  firstDate: string;
}

export function overallocations(p: Project, s: Schedule = schedule(p)): Overallocation[] {
  return resourceUsage(p, s)
    .filter((u) => u.overDays.length && u.resource.type !== "material")
    .map((u) => ({
      resourceId: u.resource.id,
      name: u.resource.name,
      days: u.overDays.length,
      peak: u.peak,
      maxUnits: u.resource.maxUnits,
      firstDate: s.calendar.toDate(u.overDays[0]),
    }));
}

/** Görev seviyelemeyle oynatılabilir mi: başlamamış, tarihe sabitlenmemiş */
function movable(t: Task): boolean {
  return !t.actualStart && t.percent === 0 && t.constraint?.type !== "MSO" && t.constraint?.type !== "MFO";
}

const totalCost = (p: Project, s: Schedule) => p.tasks.reduce((sum, t, i) => sum + (s.rows[i].isSummary ? 0 : taskCost(t, p)), 0);

/** Tüm seviyeleme gecikmelerini kaldırır */
export function clearLeveling(p: Project): Project {
  if (!p.tasks.some((t) => t.levelingDelay)) return p;
  return {
    ...p,
    tasks: p.tasks.map((t) => {
      if (!t.levelingDelay) return t;
      const { levelingDelay: _, ...rest } = t;
      return rest;
    }),
  };
}

/** Geciktirerek seviyeleme. `maxSteps` her adımda bir görevi geciktirir (1000 görevde süre sınırı). */
export function levelByDelay(p: Project, maxSteps = 400): Project {
  let cur = p;
  const skip = new Set<string>();
  for (let step = 0; step < maxSteps; step++) {
    const s = schedule(cur);
    const usage = resourceUsage(cur, s);
    // En erken aşırı yük (çözülemeyenler atlanır)
    let best: { res: string; day: number } | null = null;
    for (const u of usage) {
      if (u.resource.type === "material") continue;
      const day = u.overDays.find((d) => !skip.has(`${u.resource.id}:${d}`));
      if (day !== undefined && (!best || day < best.day)) best = { res: u.resource.id, day };
    }
    if (!best) break;
    const { res, day } = best;
    const active = cur.tasks.flatMap((t, i) => {
      const r = s.rows[i];
      if (r.isSummary || r.es > day || r.ef <= day || s.dayCapacity(t.id, day) <= 0) return [];
      if (!t.assignments?.some((a) => a.resourceId === res)) return [];
      return [{ t, i, r }];
    });
    // Öncelik: bolluğu az, erken başlayan, üst satırdaki görev yerinde kalır
    active.sort((a, b) => a.r.slack - b.r.slack || a.r.es - b.r.es || a.i - b.i);
    const candidates = active.slice(1).filter((x) => movable(x.t));
    if (active.length < 2 || !candidates.length) {
      skip.add(`${res}:${day}`);
      continue;
    }
    const chosen = candidates[candidates.length - 1];
    const others = active.filter((x) => x !== chosen);
    const until = Math.min(...others.map((x) => x.r.ef));
    const delta = Math.max(1, Math.round(s.capacity(chosen.t.id, chosen.r.es, until)));
    cur = {
      ...cur,
      tasks: cur.tasks.map((t, i) => (i === chosen.i ? { ...t, levelingDelay: (t.levelingDelay ?? 0) + delta } : t)),
    };
  }
  return cur;
}

/** Birim düşürerek seviyeleme: iş (birim × süre) korunur */
export function levelByUnits(p: Project): Project {
  const s = schedule(p);
  const usage = resourceUsage(p, s);
  let tasks = p.tasks;
  for (const u of usage) {
    if (!u.overDays.length || u.resource.type === "material") continue;
    const over = new Set(u.overTasks);
    tasks = tasks.map((t, i) => {
      if (!over.has(t.id) || !movable(t)) return t;
      const r = s.rows[i];
      let peak = 0;
      for (let d = Math.max(0, r.es); d < r.ef && d < u.load.length; d++) peak = Math.max(peak, u.load[d]);
      if (peak <= u.resource.maxUnits) return t;
      const assignments = t.assignments!.map((a) => {
        if (a.resourceId !== u.resource.id) return a;
        return { ...a, units: Math.max(1, Math.floor((a.units * u.resource.maxUnits) / peak)) };
      });
      const old = t.assignments!.find((a) => a.resourceId === u.resource.id)!.units;
      const now = assignments.find((a) => a.resourceId === u.resource.id)!.units;
      const duration = Math.max(t.duration, Math.ceil((t.duration * old) / now - 1e-9));
      return { ...t, assignments, duration };
    });
  }
  return tasks === p.tasks ? p : { ...p, tasks };
}

/** Kapasiteyi artırarak: aşırı yüklü kaynağın kapasitesi en yüksek yüke çıkar */
export function levelByCapacity(p: Project): Project {
  const s = schedule(p);
  const peak = new Map(resourceUsage(p, s).filter((u) => u.overDays.length).map((u) => [u.resource.id, u.peak]));
  if (!peak.size) return p;
  return { ...p, resources: p.resources.map((r) => (peak.has(r.id) && r.type !== "material" ? { ...r, maxUnits: peak.get(r.id)! } : r)) };
}

/** Üç öneriyi önizlemesiyle üretir; aşırı yük yoksa boş liste */
export function proposeLeveling(p: Project): LevelingOption[] {
  const s0 = schedule(p);
  if (!overallocations(p, s0).length) return [];
  const cost0 = totalCost(p, s0);
  const build = (kind: LevelingKind, next: Project): LevelingOption => {
    const s1 = schedule(next);
    const changes: LevelingChange[] = [];
    if (kind === "capacity") {
      next.resources.forEach((r, i) => {
        const before = p.resources[i];
        if (before && before.maxUnits !== r.maxUnits) changes.push({ kind, row: 0, name: r.name, before: before.maxUnits, after: r.maxUnits });
      });
    } else {
      next.tasks.forEach((t, i) => {
        const old = p.tasks[i];
        const dates = {
          startBefore: s0.rows[i].startDate,
          startAfter: s1.rows[i].startDate,
          finishBefore: s0.rows[i].finishDate,
          finishAfter: s1.rows[i].finishDate,
        };
        if (kind === "delay" && (t.levelingDelay ?? 0) !== (old.levelingDelay ?? 0)) {
          changes.push({ kind, row: i + 1, name: t.name, before: old.levelingDelay ?? 0, after: t.levelingDelay ?? 0, ...dates });
        }
        if (kind === "units") {
          for (const a of t.assignments ?? []) {
            const b = old.assignments?.find((x) => x.resourceId === a.resourceId);
            if (b && b.units !== a.units) {
              const resource = p.resources.find((r) => r.id === a.resourceId)?.name;
              changes.push({ kind, row: i + 1, name: t.name, before: b.units, after: a.units, resource, ...dates });
            }
          }
        }
      });
    }
    return {
      kind,
      project: next,
      changes,
      finishBefore: s0.finishDate,
      finishAfter: s1.finishDate,
      costBefore: cost0,
      costAfter: totalCost(next, s1),
      remainingOver: overallocations(next, s1).length,
    };
  };
  return [build("delay", levelByDelay(p)), build("units", levelByUnits(p)), build("capacity", levelByCapacity(p))];
}
