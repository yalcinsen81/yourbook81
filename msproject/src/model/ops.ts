import { isValidDate } from "./calendar";
import { indent, normalizeOutline, outdent, subtreeEnd, wbsCodes, ancestorsOf } from "./outline";
import { formatPredecessors, parsePredecessors } from "./predecessors";
import { schedule, wouldCreateCycle } from "./schedule";
import { newId } from "./storage";
import { assignFromText, formatAssignments, newResourceId, removeResource, resourceUsage, taskCost } from "./resources";
import type { LinkType, Project, Resource, Task } from "./types";

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
  /** "Ali[50%]; Vinç"; listede olmayan adlar yeni kaynak olur */
  resources?: string;
}

function setResources(p: Project, taskId: string, text: string): Project {
  const { project, errors } = assignFromText(p, taskId, text);
  if (errors.length) throw new OpError(`Anlaşılamayan kaynak: ${errors.join(", ")}. Örnek: "Ali", "Ali[50%]; Vinç".`);
  return project;
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
  if (input.resources) project = setResources(project, task.id, input.resources);
  return { project, row: at + 1 };
}

export interface TaskPatch {
  name?: string;
  duration?: number;
  predecessors?: string;
  percent?: number;
  /** Boş metin kısıtı kaldırır */
  startNoEarlierThan?: string;
  /** Atamaları tamamen değiştirir; boş metin hepsini kaldırır */
  resources?: string;
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
  const next = { ...p, tasks: p.tasks.map((t, i) => (i === row - 1 ? task : t)) };
  return patch.resources !== undefined ? setResources(next, task.id, patch.resources) : next;
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
  resources?: string;
  cost?: number;
  overallocated?: boolean;
}

export function listTasks(p: Project): TaskRow[] {
  const s = schedule(p);
  const wbs = wbsCodes(p.tasks);
  const over = new Set(resourceUsage(p, s).flatMap((u) => u.overTasks));
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
      ...(!r.isSummary && t.assignments?.length
        ? {
            resources: formatAssignments(t.assignments, p.resources),
            cost: Math.round(taskCost(t, p.resources)),
            ...(over.has(t.id) ? { overallocated: true } : {}),
          }
        : {}),
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
    resources: p.resources.length,
    totalCost: Math.round(resourceUsage(p, s).reduce((sum, u) => sum + u.cost, 0)),
    overallocatedResources: resourceUsage(p, s).filter((u) => u.overDays.length).map((u) => u.resource.name),
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

function findResource(p: Project, name: string): Resource | undefined {
  const k = name.trim().toLocaleLowerCase("tr");
  return p.resources.find((r) => r.name.toLocaleLowerCase("tr") === k);
}

export interface ResourceInput {
  name: string;
  newName?: string;
  /** Kapasite %: 100 = bir kişi, 300 = üç kişilik ekip */
  maxUnits?: number;
  /** %100 birimde günlük ücret */
  rate?: number;
}

/** Kaynağı adına göre bulur ve günceller; yoksa ekler. */
export function setResource(p: Project, input: ResourceInput): { project: Project; created: boolean } {
  const name = input.name.trim();
  if (!name || /[;,[\]]/.test(name)) throw new OpError("Kaynak adı boş olamaz ve ; , [ ] içeremez.");
  if (input.maxUnits !== undefined && !(input.maxUnits >= 1)) throw new OpError("Kapasite en az %1 olmalı.");
  if (input.rate !== undefined && !(input.rate >= 0)) throw new OpError("Ücret 0 ya da pozitif olmalı.");
  const existing = findResource(p, name);
  if (input.newName !== undefined) {
    const nn = input.newName.trim();
    if (!nn || /[;,[\]]/.test(nn)) throw new OpError("Yeni ad boş olamaz ve ; , [ ] içeremez.");
    const clash = findResource(p, nn);
    if (clash && clash !== existing) throw new OpError(`"${nn}" adında bir kaynak zaten var.`);
  }
  const fields = {
    ...(input.newName !== undefined ? { name: input.newName.trim() } : {}),
    ...(input.maxUnits !== undefined ? { maxUnits: Math.round(input.maxUnits) } : {}),
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
  };
  if (existing) {
    return { project: { ...p, resources: p.resources.map((r) => (r === existing ? { ...r, ...fields } : r)) }, created: false };
  }
  const created: Resource = { id: newResourceId(), name, maxUnits: 100, rate: 0, ...fields };
  return { project: { ...p, resources: [...p.resources, created] }, created: true };
}

export function deleteResource(p: Project, name: string): { project: Project; unassigned: number } {
  const r = findResource(p, name);
  if (!r) throw new OpError(`"${name}" adında kaynak yok. Kaynaklar: ${p.resources.map((x) => x.name).join(", ") || "(yok)"}.`);
  const unassigned = p.tasks.filter((t) => t.assignments?.some((a) => a.resourceId === r.id)).length;
  return { project: removeResource(p, r.id), unassigned };
}

/** Kaynak listesi: iş, maliyet, en yüksek yük ve aşırı yüklü tarih aralıkları */
export function listResources(p: Project) {
  const s = schedule(p);
  return resourceUsage(p, s).map((u) => {
    const ranges: string[] = [];
    let from = -1;
    u.overDays.forEach((d, i) => {
      if (from < 0) from = d;
      if (u.overDays[i + 1] !== d + 1) {
        const a = s.calendar.toDate(from);
        const b = s.calendar.toDate(d);
        ranges.push(a === b ? a : `${a} – ${b}`);
        from = -1;
      }
    });
    return {
      name: u.resource.name,
      maxUnitsPercent: u.resource.maxUnits,
      dailyRate: u.resource.rate,
      workPersonDays: Math.round(u.work * 10) / 10,
      cost: Math.round(u.cost),
      peakPercent: u.peak,
      overallocated: ranges,
      overallocatedTaskRows: u.overTasks.map((id) => p.tasks.findIndex((t) => t.id === id) + 1),
    };
  });
}
