import { isLate } from "./reports";
import type { Project, Schedule } from "./types";

// Görev tablosunun görünümü (saf): arama, süzgeç ve sıralama. Eşleşen görevlerin özetleri de gösterilir
// (MS Project'teki "ilgili özet satırları"); sıralama anahat yapısını korur, kardeşler kendi içinde sıralanır.

export type TaskFilter =
  | "all"
  | "critical"
  | "late"
  | "milestones"
  | "incomplete"
  | "notes"
  | `res:${string}`
  | `tag:${string}`
  | `color:${string}`;

export type SortKey = "none" | "name" | "start" | "finish" | "duration" | "slack" | "cost" | "percent";
export const SORT_KEYS: SortKey[] = ["none", "name", "start", "finish", "duration", "slack", "cost", "percent"];

export interface ViewOptions {
  query: string;
  filter: TaskFilter;
  sort: SortKey;
  desc: boolean;
  today: string;
}

export const DEFAULT_VIEW: Omit<ViewOptions, "today"> = { query: "", filter: "all", sort: "none", desc: false };

export function isViewActive(o: Pick<ViewOptions, "query" | "filter" | "sort">): boolean {
  return !!o.query.trim() || o.filter !== "all" || o.sort !== "none";
}

/** Türkçe büyük/küçük harf ve aksan farkını yok sayan karşılaştırma anahtarı */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Görev kendi başına süzgece ve aramaya uyuyor mu (özetlerin alt görevleri ayrıca değerlendirilir) */
export function taskMatches(p: Project, s: Schedule, i: number, o: Pick<ViewOptions, "query" | "filter" | "today">, wbs?: string): boolean {
  const task = p.tasks[i];
  const r = s.rows[i];
  const f = o.filter;
  if (f === "critical" && !(r.critical && !r.isSummary)) return false;
  if (f === "late" && !isLate(p, s, i, o.today)) return false;
  if (f === "milestones" && !r.isMilestone) return false;
  if (f === "incomplete" && (r.isSummary || task.percent >= 100)) return false;
  if (f === "notes" && !task.notes && !task.links?.length) return false;
  if (f.startsWith("res:") && !(task.assignments ?? []).some((a) => a.resourceId === f.slice(4))) return false;
  if (f.startsWith("tag:")) {
    const tag = fold(f.slice(4));
    if (!(task.tags ?? []).some((x) => fold(x) === tag)) return false;
  }
  if (f.startsWith("color:") && task.color !== f.slice(6)) return false;
  const q = fold(o.query.trim());
  if (!q) return true;
  // Satır numarası ("#12" ya da "12"), ad, not, etiket, kaynak adı, WBS
  const num = /^#?(\d+)$/.exec(q);
  if (num && Number(num[1]) === r.row) return true;
  const names = (task.assignments ?? []).map((a) => p.resources.find((x) => x.id === a.resourceId)?.name ?? "");
  const hay = [task.name, task.notes ?? "", ...(task.tags ?? []), ...names, ...(task.links ?? []).map((l) => l.title ?? l.url), wbs ?? ""];
  return hay.some((h) => fold(h).includes(q));
}

/**
 * Görünür satır sırası (görev dizinleri). `include` görevin kendisinin eşleşip eşleşmediği; eşleşenin üst özetleri de
 * gösterilir. `key` verilirse kardeşler bu anahtara göre (boşlar sonda) sıralanır; anahat bozulmaz.
 */
export function arrange(p: Project, include: boolean[], key?: (i: number) => number | string | null, desc = false): number[] {
  const tasks = p.tasks;
  const keep = include.slice();
  // Eşleşen görevin üst özetleri görünür kalır
  const stack: number[] = [];
  tasks.forEach((task, i) => {
    while (stack.length && tasks[stack[stack.length - 1]].outline >= task.outline) stack.pop();
    if (include[i]) for (const a of stack) keep[a] = true;
    stack.push(i);
  });
  // Ağaç: her düğümün çocukları
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  const path: number[] = [];
  tasks.forEach((task, i) => {
    while (path.length && tasks[path[path.length - 1]].outline >= task.outline) path.pop();
    const parent = path[path.length - 1];
    if (parent === undefined) roots.push(i);
    else children.set(parent, [...(children.get(parent) ?? []), i]);
    path.push(i);
  });
  const cmp = (a: number, b: number) => {
    if (!key) return a - b;
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return a - b;
    if (ka === null) return 1;
    if (kb === null) return -1;
    const c = typeof ka === "string" && typeof kb === "string" ? ka.localeCompare(kb, "tr") : ka < kb ? -1 : 1;
    return desc ? -c : c;
  };
  const out: number[] = [];
  const walk = (list: number[]) => {
    for (const i of [...list].sort(cmp)) {
      if (!keep[i]) continue;
      out.push(i);
      const ch = children.get(i);
      if (ch) walk(ch);
    }
  };
  walk(roots);
  return out;
}

/** Arama + süzgeç + sıralama bir arada */
export function visibleOrder(p: Project, s: Schedule, o: ViewOptions, costs: number[], wbs?: string[]): number[] {
  const include = p.tasks.map((_, i) => taskMatches(p, s, i, o, wbs?.[i]));
  const r = s.rows;
  const keys: Record<Exclude<SortKey, "none">, (i: number) => number | string | null> = {
    name: (i) => fold(p.tasks[i].name),
    start: (i) => r[i].startDate,
    finish: (i) => r[i].finishDate,
    duration: (i) => r[i].duration,
    slack: (i) => r[i].slack,
    cost: (i) => costs[i] ?? 0,
    percent: (i) => r[i].percent,
  };
  return arrange(p, include, o.sort === "none" ? undefined : keys[o.sort], o.desc);
}

/** Projede kullanılan etiketler (görünen yazımıyla, tekrarsız, alfabetik) */
export function projectTags(p: Project): string[] {
  const seen = new Map<string, string>();
  for (const task of p.tasks) for (const tag of task.tags ?? []) if (!seen.has(fold(tag))) seen.set(fold(tag), tag);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "tr"));
}
