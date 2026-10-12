import { isValidDate } from "./calendar";
import { indent, normalizeOutline, outdent, subtreeEnd, wbsCodes, ancestorsOf } from "./outline";
import { formatPredecessors, parsePredecessors } from "./predecessors";
import { schedule, wouldCreateCycle } from "./schedule";
import { newId } from "./storage";
import type { LinkType, Project, Task } from "./types";

// Projeyi değiştiren saf işlemler. Satır numaraları 1'den başlar (tablodaki # sütunu, öncüllerdeki numaralar).
// MCP sunucusu (Claude bağlantısı) bunları kullanır; hatalar kullanıcıya gösterilecek Türkçe mesajla fırlatılır.

export class OpError extends Error {}

function taskAt(p: Project, row: number): Task {
  const t = p.tasks[row - 1];
  if (!Number.isInteger(row) || !t) throw new OpError(`${row}. satır yok. Görev sayısı: ${p.tasks.length}.`);
  return t;
}

function setPredecessors(p: Project, task: Task, text: string): Task {
  const { predecessors, errors } = parsePredecessors(text, p.tasks, task.id);
  if (errors.length) throw new OpError(`Anlaşılamayan öncül: ${errors.join(", ")}. Örnek: "2", "3SS", "4FS+2".`);
  const base: Project = { ...p, tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, predecessors: [] } : t)) };
  for (const pr of predecessors) {
    if (wouldCreateCycle(base, task.id, pr.taskId)) {
      const row = p.tasks.findIndex((t) => t.id === pr.taskId) + 1;
      throw new OpError(`${row}. satır öncül olamaz: döngü ya da özet–alt görev bağı oluşur.`);
    }
  }
  return { ...task, predecessors };
}

function checkDate(d: string | undefined): void {
  if (d && !isValidDate(d)) throw new OpError(`Geçersiz tarih: ${d}. Biçim YYYY-AA-GG olmalı.`);
}

export interface TaskInput {
  name: string;
  duration?: number;
  /** Bu satırın (alt görevleriyle birlikte) hemen altına, aynı düzeyde eklenir */
  afterRow?: number;
  /** Bu özetin/görevin son alt görevi olarak eklenir */
  parentRow?: number;
  predecessors?: string;
  percent?: number;
  startNoEarlierThan?: string;
}

export function addTask(p: Project, input: TaskInput): { project: Project; row: number } {
  checkDate(input.startNoEarlierThan);
  let at = p.tasks.length;
  let outline = 0;
  if (input.parentRow !== undefined) {
    const parent = taskAt(p, input.parentRow);
    at = subtreeEnd(p.tasks, input.parentRow - 1);
    outline = parent.outline + 1;
  } else if (input.afterRow !== undefined) {
    const after = taskAt(p, input.afterRow);
    at = subtreeEnd(p.tasks, input.afterRow - 1);
    outline = after.outline;
  }
  let task: Task = {
    id: newId(),
    name: input.name,
    duration: clampDuration(input.duration ?? 1),
    outline,
    percent: clampPercent(input.percent ?? 0),
    predecessors: [],
    startNoEarlierThan: input.startNoEarlierThan || undefined,
  };
  let project: Project = { ...p, tasks: normalizeOutline([...p.tasks.slice(0, at), task, ...p.tasks.slice(at)]) };
  if (input.predecessors) {
    task = setPredecessors(project, project.tasks[at], input.predecessors);
    project = { ...project, tasks: project.tasks.map((t, i) => (i === at ? task : t)) };
  }
  return { project, row: at + 1 };
}

export interface TaskPatch {
  name?: string;
  duration?: number;
  predecessors?: string;
  percent?: number;
  /** Boş metin kısıtı kaldırır */
  startNoEarlierThan?: string;
}

export function updateTask(p: Project, row: number, patch: TaskPatch): Project {
  let task = { ...taskAt(p, row) };
  if (patch.name !== undefined) task.name = patch.name;
  if (patch.duration !== undefined) task.duration = clampDuration(patch.duration);
  if (patch.percent !== undefined) task.percent = clampPercent(patch.percent);
  if (patch.startNoEarlierThan !== undefined) {
    checkDate(patch.startNoEarlierThan);
    task.startNoEarlierThan = patch.startNoEarlierThan || undefined;
  }
  if (patch.predecessors !== undefined) task = setPredecessors(p, task, patch.predecessors);
  return { ...p, tasks: p.tasks.map((t, i) => (i === row - 1 ? task : t)) };
}

/** Görevi siler; özetse alt görevleri de silinir. */
export function deleteTask(p: Project, row: number): { project: Project; deleted: number } {
  taskAt(p, row);
  const end = subtreeEnd(p.tasks, row - 1);
  const doomed = new Set(p.tasks.slice(row - 1, end).map((t) => t.id));
  const tasks = p.tasks
    .filter((t) => !doomed.has(t.id))
    .map((t) => ({ ...t, predecessors: t.predecessors.filter((pr) => !doomed.has(pr.taskId)) }));
  return { project: { ...p, tasks: normalizeOutline(tasks) }, deleted: doomed.size };
}

export function shiftTask(p: Project, row: number, direction: "in" | "out"): Project {
  taskAt(p, row);
  let tasks = direction === "in" ? indent(p.tasks, row - 1) : outdent(p.tasks, row - 1);
  if (tasks === p.tasks) {
    throw new OpError(direction === "in" ? "Bu görev daha fazla içeri alınamaz." : "Bu görev zaten en üst düzeyde.");
  }
  // Görev kendi özetine bağlı kaldıysa bağ kopar
  const anc = ancestorsOf(tasks);
  tasks = tasks.map((t) => {
    const mine = new Set(anc.get(t.id));
    const kept = t.predecessors.filter((pr) => !mine.has(pr.taskId) && !(anc.get(pr.taskId) ?? []).includes(t.id));
    return kept.length === t.predecessors.length ? t : { ...t, predecessors: kept };
  });
  return { ...p, tasks };
}

export function linkTasks(p: Project, fromRow: number, toRow: number, type: LinkType = "FS", lag = 0): Project {
  const from = taskAt(p, fromRow);
  const to = taskAt(p, toRow);
  if (from.id === to.id) throw new OpError("Görev kendisine bağlanamaz.");
  const without: Project = {
    ...p,
    tasks: p.tasks.map((t) => (t.id === to.id ? { ...t, predecessors: t.predecessors.filter((x) => x.taskId !== from.id) } : t)),
  };
  if (wouldCreateCycle(without, to.id, from.id)) {
    throw new OpError(`${fromRow} → ${toRow} bağı döngü ya da özet–alt görev bağı oluşturur.`);
  }
  return {
    ...without,
    tasks: without.tasks.map((t) =>
      t.id === to.id ? { ...t, predecessors: [...t.predecessors, { taskId: from.id, type, lag: Math.round(lag) }] } : t,
    ),
  };
}

export function unlinkTasks(p: Project, fromRow: number, toRow: number): Project {
  const from = taskAt(p, fromRow);
  const to = taskAt(p, toRow);
  if (!to.predecessors.some((x) => x.taskId === from.id)) throw new OpError(`${fromRow} ile ${toRow} arasında bağ yok.`);
  return {
    ...p,
    tasks: p.tasks.map((t) => (t.id === to.id ? { ...t, predecessors: t.predecessors.filter((x) => x.taskId !== from.id) } : t)),
  };
}

export interface TaskRow {
  row: number;
  wbs: string;
  name: string;
  level: number;
  summary: boolean;
  milestone: boolean;
  duration: number;
  start: string;
  finish: string;
  predecessors: string;
  percent: number;
  slack: number;
  critical: boolean;
  constraint?: string;
}

export function listTasks(p: Project): TaskRow[] {
  const s = schedule(p);
  const wbs = wbsCodes(p.tasks);
  return p.tasks.map((t, i) => {
    const r = s.rows[i];
    return {
      row: i + 1,
      wbs: wbs[i],
      name: t.name,
      level: t.outline,
      summary: r.isSummary,
      milestone: r.isMilestone,
      duration: r.isSummary ? r.duration : t.duration,
      start: r.startDate,
      finish: r.finishDate,
      predecessors: formatPredecessors(t.predecessors, p.tasks),
      percent: t.percent,
      slack: r.slack,
      critical: r.critical,
      ...(t.startNoEarlierThan ? { constraint: `şundan önce başlamasın: ${t.startNoEarlierThan}` } : {}),
    };
  });
}

export function projectSummary(p: Project) {
  const s = schedule(p);
  const leaves = p.tasks.filter((_, i) => !s.rows[i].isSummary);
  let total = 0;
  let done = 0;
  for (const t of leaves) {
    total += t.duration;
    done += (t.duration * t.percent) / 100;
  }
  return {
    name: p.name,
    start: s.calendar.base,
    finish: s.finishDate,
    durationWorkdays: s.finish,
    tasks: leaves.length,
    criticalTasks: leaves.filter((t) => s.byId.get(t.id)!.critical).length,
    progressPercent: total ? Math.round((done / total) * 100) : 0,
    holidays: p.holidays.length,
    cycleWarning: s.cycle.length ? `Döngüsel bağ var: ${s.cycle.map((id) => p.tasks.findIndex((t) => t.id === id) + 1).join(", ")}. satırlar` : undefined,
  };
}

function clampDuration(n: number): number {
  if (!Number.isFinite(n) || n < 0) throw new OpError("Süre 0 ya da pozitif bir iş günü sayısı olmalı.");
  return Math.min(10_000, Math.round(n));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) throw new OpError("Yüzde 0–100 arasında olmalı.");
  return Math.min(100, Math.max(0, Math.round(n)));
}
