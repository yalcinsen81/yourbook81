import { schedule } from "./schedule";
import type { Project, Schedule, ScheduledTask } from "./types";

/** Etkisiz görevlerin kimlikleri; etkisiz özetin altındaki görevler de etkisizdir */
export function inactiveIds(p: Project): Set<string> {
  const out = new Set<string>();
  let under = -1; // etkisiz özetin anahat düzeyi
  for (const task of p.tasks) {
    if (under >= 0 && task.outline > under) {
      out.add(task.id);
      continue;
    }
    under = -1;
    if (task.inactive) {
      out.add(task.id);
      under = task.outline;
    }
  }
  return out;
}

/**
 * Hesap projesi: satır sırası aynı kalır, etkisiz görevler hesaba katılmaz (süre 0, bağ, kısıt,
 * kaynak ve maliyet yok); öteki görevlerin etkisiz görevlere bağları düşer. Maliyet, kaynak kullanımı,
 * ilerleme eğrileri ve benzetim bu projeyle hesaplanır. Etkisiz görev yoksa aynı nesne döner.
 */
export function calcProject(p: Project): Project {
  const off = inactiveIds(p);
  if (!off.size) return p;
  return {
    ...p,
    tasks: p.tasks.map((t) =>
      off.has(t.id)
        ? {
            ...t,
            duration: 0,
            predecessors: [],
            constraint: undefined,
            deadline: undefined,
            actualStart: undefined,
            actualFinish: undefined,
            assignments: [],
            fixedCost: 0,
            actualCost: undefined,
            estimate: undefined,
            blackouts: undefined,
            levelingDelay: undefined,
          }
        : t.predecessors.some((x) => off.has(x.taskId))
          ? { ...t, predecessors: t.predecessors.filter((x) => !off.has(x.taskId)) }
          : t,
    ),
  };
}

/**
 * Etkisiz görevleri dışarıda bırakarak zamanlar (motorun kendisi değişmez): etkin görevler kendi
 * aralarında zamanlanır, etkisiz görevler planda oldukları yerde (tam zamanlamadaki tarihleriyle)
 * soluk gösterilmek üzere satırlara geri konur; kritik sayılmazlar ve özet/proje bitişini etkilemezler.
 */
export function scheduleActive(p: Project): Schedule {
  const off = inactiveIds(p);
  if (!off.size) return schedule(p);
  const full = schedule(p);
  const tasks = p.tasks.filter((t) => !off.has(t.id)).map((t) => ({ ...t, predecessors: t.predecessors.filter((x) => !off.has(x.taskId)) }));
  const act = schedule({ ...p, tasks });
  const rows: ScheduledTask[] = p.tasks.map((t, i) =>
    off.has(t.id) ? { ...full.rows[i], row: i + 1, critical: false } : { ...act.byId.get(t.id)!, row: i + 1 },
  );
  return {
    ...act,
    rows,
    byId: new Map(rows.map((r) => [r.id, r])),
    capacity: (id, from, to) => (off.has(id) ? full.capacity(id, from, to) : act.capacity(id, from, to)),
    dayCapacity: (id, offset) => (off.has(id) ? full.dayCapacity(id, offset) : act.dayCapacity(id, offset)),
  };
}
