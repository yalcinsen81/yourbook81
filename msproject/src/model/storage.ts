import { isValidDate } from "./calendar";
import { normalizeOutline } from "./outline";
import type { LinkType, Predecessor, Project, Task } from "./types";

const KEY = "msproject.project.v1";
const LINK_TYPES: LinkType[] = ["FS", "SS", "FF", "SF"];

export function newId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Dışarıdan gelen (dosya, localStorage) veriyi doğrular; bozuk alanları düzeltir, olmazsa null döner. */
export function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.tasks) || typeof r.start !== "string" || !isValidDate(r.start)) return null;
  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (const item of r.tasks) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const id = typeof t.id === "string" && t.id && !seen.has(t.id) ? t.id : newId();
    seen.add(id);
    tasks.push({
      id,
      name: typeof t.name === "string" ? t.name : "",
      duration: clampInt(t.duration, 0, 10_000),
      outline: clampInt(t.outline, 0, 50),
      percent: clampInt(t.percent, 0, 100),
      startNoEarlierThan:
        typeof t.startNoEarlierThan === "string" && isValidDate(t.startNoEarlierThan) ? t.startNoEarlierThan : undefined,
      predecessors: Array.isArray(t.predecessors) ? (t.predecessors as unknown[]).flatMap(toPredecessor) : [],
    });
  }
  // Var olmayan görevlere işaret eden öncülleri at
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.predecessors = t.predecessors.filter((p) => ids.has(p.taskId) && p.taskId !== t.id);
  return { name: typeof r.name === "string" ? r.name : "Proje", start: r.start, tasks: normalizeOutline(tasks) };
}

function toPredecessor(raw: unknown): Predecessor[] {
  if (!raw || typeof raw !== "object") return [];
  const p = raw as Record<string, unknown>;
  if (typeof p.taskId !== "string") return [];
  const type = LINK_TYPES.includes(p.type as LinkType) ? (p.type as LinkType) : "FS";
  return [{ taskId: p.taskId, type, lag: clampInt(p.lag, -10_000, 10_000) }];
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(max, Math.max(min, n));
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Depolama dolu ya da kapalı: sessizce geç, veri bellekte kalır
  }
}
