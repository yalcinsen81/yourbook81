import type { Assignment, Project, Resource, Task } from "./types";

// Maliyet modeli (saf): kaynak ücreti (gün / saat / kullanım başına), malzeme (miktar × birim fiyat), görevin sabit
// maliyeti ve proje genel gider yüzdesi. Tutarlar proje para birimindedir, dönüştürülmez.

export interface CostBreakdown {
  /** İşgücü kaynakları */
  labor: number;
  equipment: number;
  material: number;
  fixed: number;
  /** Genel gider (yukarıdakilerin toplamı × genel gider %) */
  overhead: number;
  total: number;
}

export const isMaterial = (r: Resource | undefined) => r?.type === "material";

/** Bir atamanın maliyeti. `duration` görevin süresi (iş günü). */
export function assignmentCost(a: Assignment, r: Resource, duration: number, hoursPerDay = 8): number {
  if (r.type === "material") return a.units * r.rate;
  switch (r.rateType ?? "day") {
    case "use":
      return r.rate;
    case "hour":
      return (r.rate * hoursPerDay * a.units * duration) / 100;
    default:
      return (r.rate * a.units * duration) / 100;
  }
}

export function taskCostBreakdown(task: Task, project: Pick<Project, "resources" | "overheadPercent" | "hoursPerDay">, duration = task.duration): CostBreakdown {
  const byId = new Map(project.resources.map((r) => [r.id, r]));
  const out: CostBreakdown = { labor: 0, equipment: 0, material: 0, fixed: Math.max(0, task.fixedCost ?? 0), overhead: 0, total: 0 };
  for (const a of task.assignments ?? []) {
    const r = byId.get(a.resourceId);
    if (!r) continue;
    const c = assignmentCost(a, r, duration, project.hoursPerDay ?? 8);
    if (r.type === "material") out.material += c;
    else if (r.type === "equipment") out.equipment += c;
    else out.labor += c;
  }
  const base = out.labor + out.equipment + out.material + out.fixed;
  out.overhead = (base * Math.max(0, project.overheadPercent ?? 0)) / 100;
  out.total = base + out.overhead;
  return out;
}

/** Görevin toplam maliyeti (genel gider dahil) */
export function taskCost(task: Task, project: Pick<Project, "resources" | "overheadPercent" | "hoursPerDay">, duration = task.duration): number {
  return taskCostBreakdown(task, project, duration).total;
}

/**
 * Maliyetin görev günlerine dağılımı: `caps` her günün kapasitesi (0 çalışılmayan gün). Eşit dağılımda kapasiteyle
 * orantılı, "start"ta ilk çalışılan güne, "end"de son çalışılan güne yazılır. Toplam her zaman 1'dir.
 */
export function accrualShares(caps: number[], accrual: Task["costAccrual"] = "prorated"): number[] {
  const shares = caps.map(() => 0);
  const working = caps.flatMap((c, i) => (c > 0 ? [i] : []));
  if (!working.length) {
    if (caps.length) shares[0] = 1;
    return shares;
  }
  if (accrual === "start") shares[working[0]] = 1;
  else if (accrual === "end") shares[working[working.length - 1]] = 1;
  else {
    const total = caps.reduce((a, b) => a + b, 0);
    caps.forEach((c, i) => (shares[i] = c / total));
  }
  return shares;
}
