import { getBaseline } from "./baseline";
import { ancestorsOf } from "./outline";
import type { Project, Schedule } from "./types";

// Plan kalite denetimi (saf): DCMA 14 nokta denetiminin takvime dayalı maddeleri. Benzetimden önce planın mantığının
// sağlam olup olmadığını gösterir; hiçbir şeyi engellemez. Eşikler DCMA'nın önerdiği değerlerdir (44 iş günü ≈ 2 ay).

export type QualityKey =
  | "logic"
  | "leads"
  | "lags"
  | "relationTypes"
  | "hardConstraints"
  | "highFloat"
  | "negativeFloat"
  | "highDuration"
  | "invalidDates"
  | "resources"
  | "missedTasks";

export interface QualityCheck {
  key: QualityKey;
  /** Sorunlu öğe sayısı ve paydası (görev ya da bağ) */
  count: number;
  total: number;
  /** İzin verilen en yüksek oran (0–1); 0 = hiç olmamalı */
  threshold: number;
  pass: boolean;
  /** Sorunlu satır numaraları */
  rows: number[];
  /** Ölçülemediyse (ör. referans plan yok) */
  skipped?: boolean;
}

export const HIGH_DAYS = 44;

export function planQuality(p: Project, s: Schedule, today: string): QualityCheck[] {
  const tasks = p.tasks;
  const leaves = tasks.flatMap((t, i) => (s.rows[i].isSummary ? [] : [i]));
  // Tamamlanmamış yaprak görevler (DCMA paydası)
  const open = leaves.filter((i) => tasks[i].percent < 100 && !tasks[i].actualFinish);
  const ancestors = ancestorsOf(tasks);
  const withSelf = (id: string) => [id, ...(ancestors.get(id) ?? [])];
  const succOf = new Set<string>();
  for (const t of tasks) for (const pr of t.predecessors) succOf.add(pr.taskId);
  const hasPred = (i: number) => withSelf(tasks[i].id).some((id) => tasks.find((t) => t.id === id)!.predecessors.length > 0);
  const hasSucc = (i: number) => withSelf(tasks[i].id).some((id) => succOf.has(id));
  const links = tasks.flatMap((t, i) => t.predecessors.map((pr) => ({ row: i + 1, ...pr })));
  const rowsOf = (list: number[]) => list.map((i) => i + 1);
  const check = (key: QualityKey, bad: number[], total: number, threshold: number, extra: Partial<QualityCheck> = {}): QualityCheck => ({
    key,
    count: bad.length,
    total,
    threshold,
    pass: extra.skipped ? true : total === 0 || bad.length / total <= threshold + 1e-9,
    rows: [...new Set(bad)].sort((a, b) => a - b),
    ...extra,
  });

  // Mantık: projenin ilk ve son görevi dışında her görevin öncülü ve ardılı olmalı
  const first = leaves.length ? Math.min(...leaves.map((i) => s.rows[i].es)) : 0;
  const last = s.finish;
  const noLogic = open.filter((i) => (!hasPred(i) && s.rows[i].es > first) || (!hasSucc(i) && s.rows[i].ef < last) || (!hasPred(i) && !hasSucc(i)));
  const hard = open.filter((i) => ["MSO", "MFO", "SNLT", "FNLT"].includes(tasks[i].constraint?.type ?? ""));
  const highFloat = open.filter((i) => s.rows[i].slack > HIGH_DAYS);
  const negFloat = open.filter((i) => s.rows[i].slack < 0);
  const long = open.filter((i) => tasks[i].duration > HIGH_DAYS);
  // Geçersiz tarih: gelecekte gerçekleşen tarih ya da başlamamış görevin geçmişte planlanmış başlangıcı
  const invalid = leaves.filter((i) => {
    const t = tasks[i];
    if ((t.actualStart && t.actualStart > today) || (t.actualFinish && t.actualFinish > today)) return true;
    return !t.actualStart && t.percent === 0 && s.rows[i].startDate < today && t.duration > 0;
  });
  const noRes = open.filter((i) => tasks[i].duration > 0 && !tasks[i].assignments?.length && !tasks[i].fixedCost);
  const b = getBaseline(p, 0) ?? p.baselines?.[0];
  const due = b ? leaves.filter((i) => b.tasks[tasks[i].id] && b.tasks[tasks[i].id].finish < today) : [];
  const missed = b ? due.filter((i) => tasks[i].percent < 100 || (tasks[i].actualFinish ?? s.rows[i].finishDate) > b.tasks[tasks[i].id].finish) : [];

  return [
    check("logic", rowsOf(noLogic), open.length, 0.05),
    check("leads", links.filter((l) => l.lag < 0).map((l) => l.row), links.length, 0),
    check("lags", links.filter((l) => l.lag > 0).map((l) => l.row), links.length, 0.05),
    check("relationTypes", links.filter((l) => l.type !== "FS").map((l) => l.row), links.length, 0.1),
    check("hardConstraints", rowsOf(hard), open.length, 0.05),
    check("highFloat", rowsOf(highFloat), open.length, 0.05),
    check("negativeFloat", rowsOf(negFloat), open.length, 0),
    check("highDuration", rowsOf(long), open.length, 0.05),
    check("invalidDates", rowsOf(invalid), leaves.length, 0),
    check("resources", rowsOf(noRes), open.length, 0.1),
    check("missedTasks", rowsOf(missed), due.length, 0.05, b ? {} : { skipped: true }),
  ];
}
