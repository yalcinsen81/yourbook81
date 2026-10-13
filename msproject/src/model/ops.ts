import { pruneRiskLinks, risksByTask } from "./risks";
import { getLang, t } from "../i18n";
import { addDays, formatDate, isValidDate, normalizeWorkdays } from "./calendar";
import { CONSTRAINT_TYPES } from "./storage";
import { indent, normalizeOutline, outdent, subtreeEnd, wbsCodes, ancestorsOf } from "./outline";
import { formatPredecessors, parsePredecessors } from "./predecessors";
import { cycleWith, schedule } from "./schedule";
import { newId } from "./storage";
import {
  assignFromText,
  formatAssignments,
  newResourceId,
  plannedAt,
  progressCurves,
  projectWeight,
  removeResource,
  resourceUsage,
  taskCost,
  type Curves,
} from "./resources";
import type {
  ConstraintType,
  CostAccrual,
  DurationEstimate,
  Leave,
  LinkType,
  ProgressWeight,
  Project,
  RateType,
  Resource,
  ResourceType,
  Schedule,
  ScheduleIssue,
  Task,
} from "./types";

// Projeyi değiştiren saf işlemler. Satır numaraları 1'den başlar (tablodaki # sütunu, öncüllerdeki numaralar).
// MCP sunucusu (Claude bağlantısı) bunları kullanır; hatalar seçili dildeki mesajla fırlatılır.

export class OpError extends Error {}

function taskAt(p: Project, row: number): Task {
  const task = p.tasks[row - 1];
  if (!Number.isInteger(row) || !task) throw new OpError(t("err.noRow", { row: String(row), count: p.tasks.length }));
  return task;
}

function setPredecessors(p: Project, task: Task, text: string): Task {
  const { predecessors, errors } = parsePredecessors(text, p.tasks, task.id);
  if (errors.length) throw new OpError(t("err.predecessor", { parts: errors.join(", ") }));
  const base: Project = { ...p, tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, predecessors: [] } : t)) };
  for (const pr of predecessors) checkCycle(base, task.id, pr.taskId);
  return { ...task, predecessors };
}

/** Bağ döngü oluşturuyorsa nedenini söyleyen metin (ör. "… döngü oluşur (3 → 5 → 3)"), yoksa null */
export function cycleError(project: Project, taskId: string, predId: string, link?: { from: number; to: number }): string | null {
  const path = cycleWith(project, taskId, predId);
  if (!path) return null;
  const anc = ancestorsOf(project.tasks);
  if ((anc.get(taskId) ?? []).includes(predId) || (anc.get(predId) ?? []).includes(taskId)) {
    return t("err.summaryLink", { a: String(path[0]), b: String(path[1]) });
  }
  if (link) return t("err.cycleLink", { from: String(link.from), to: String(link.to), path: path.join(" → ") });
  const row = project.tasks.findIndex((x) => x.id === predId) + 1;
  return t("err.cycleRow", { row: String(row), path: path.join(" → ") });
}

function checkCycle(project: Project, taskId: string, predId: string): void {
  const msg = cycleError(project, taskId, predId);
  if (msg) throw new OpError(msg);
}

function checkDate(d: string | undefined): void {
  if (d && !isValidDate(d)) throw new OpError(t("err.date", { date: d, pattern: getLang() === "tr" ? "YYYY-AA-GG" : "YYYY-MM-DD" }));
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
  /** Eski ad: SNET kısıtı */
  startNoEarlierThan?: string;
  constraintType?: string;
  constraintDate?: string;
  deadline?: string;
  /** "Ali[50%]; Vinç"; listede olmayan adlar yeni kaynak olur */
  resources?: string;
  fixedCost?: number;
  costAccrual?: CostAccrual;
}

function setResources(p: Project, taskId: string, text: string): Project {
  const { project, errors } = assignFromText(p, taskId, text);
  if (errors.length) throw new OpError(t("err.resource", { parts: errors.join(", ") }));
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
  let task: Task = applyFields(
    {
      id: newId(),
      name: input.name,
      duration: clampDuration(input.duration ?? 1),
      outline,
      percent: clampPercent(input.percent ?? 0),
      predecessors: [],
    },
    input,
  );
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
  /** Yüzde girilince gerçekleşen başlangıç/bitiş ve kalan süre MS Project'teki gibi güncellenir */
  percent?: number;
  /** Eski ad: SNET kısıtı. Boş metin kısıtı kaldırır. */
  startNoEarlierThan?: string;
  /** ASAP, ALAP, SNET, SNLT, MSO, MFO, FNET, FNLT */
  constraintType?: string;
  constraintDate?: string;
  /** Boş metin son tarihi kaldırır */
  deadline?: string;
  /** Boş metin kaldırır (yüzde 0 olur) */
  actualStart?: string;
  /** Görevi %100 yapar, süreyi gerçekleşen tarihlere göre ayarlar; boş metin kaldırır */
  actualFinish?: string;
  /** Kalan süre (iş günü): süre = gerçekleşen + kalan, yüzde yeniden hesaplanır */
  remainingDuration?: number;
  /** Atamaları tamamen değiştirir; boş metin hepsini kaldırır */
  resources?: string;
  fixedCost?: number;
  costAccrual?: CostAccrual;
  /** Göreve uygulanacak çalışılamayan dönemlerin adları (listeyi tamamen değiştirir) */
  blackouts?: string[];
}

/** Kısıt, son tarih ve maliyet alanlarını uygular (doğrulayarak) */
function applyFields(task: Task, f: TaskInput | TaskPatch): Task {
  const next = { ...task };
  if (f.startNoEarlierThan !== undefined) {
    checkDate(f.startNoEarlierThan);
    if (f.startNoEarlierThan) next.constraint = { type: "SNET", date: f.startNoEarlierThan };
    else delete next.constraint;
  }
  if (f.constraintType !== undefined || f.constraintDate !== undefined) {
    const type = (f.constraintType ?? next.constraint?.type ?? "ASAP").toUpperCase() as ConstraintType;
    if (!CONSTRAINT_TYPES.includes(type)) throw new OpError(t("err.constraintType", { type, list: CONSTRAINT_TYPES.join(", ") }));
    next.constraint = constraintOf(type, f.constraintDate ?? next.constraint?.date);
    if (!next.constraint) delete next.constraint;
  }
  if (f.deadline !== undefined) {
    checkDate(f.deadline);
    if (f.deadline) next.deadline = f.deadline;
    else delete next.deadline;
  }
  if (f.fixedCost !== undefined) {
    if (!Number.isFinite(f.fixedCost) || f.fixedCost < 0) throw new OpError(t("err.fixedCost"));
    if (f.fixedCost > 0) next.fixedCost = f.fixedCost;
    else delete next.fixedCost;
  }
  if (f.costAccrual !== undefined) {
    if (f.costAccrual === "prorated") delete next.costAccrual;
    else next.costAccrual = f.costAccrual;
  }
  return next;
}

/** Kısıt nesnesi; ASAP için undefined. Tarih isteyen türde tarih yoksa hata. */
export function constraintOf(type: ConstraintType, date?: string): Task["constraint"] {
  if (type === "ASAP") return undefined;
  if (type === "ALAP") return { type };
  if (!date) throw new OpError(t("err.constraintDate"));
  checkDate(date);
  return { type, date };
}

/**
 * Yüzde girişi (MS Project gibi): %0 gerçekleşen tarihleri siler; >0 ve gerçekleşen başlangıç yoksa planlanan
 * başlangıç yazılır; %100 ve gerçekleşen bitiş yoksa planlanan bitiş yazılır; <100 gerçekleşen bitişi siler.
 */
export function withPercent(task: Task, percent: number, s: Schedule): Task {
  const next: Task = { ...task, percent: clampPercent(percent) };
  const r = s.byId.get(task.id);
  if (next.percent === 0) {
    delete next.actualStart;
    delete next.actualFinish;
    return next;
  }
  if (!next.actualStart && r) next.actualStart = r.startDate;
  if (next.percent === 100) {
    if (!next.actualFinish && r) next.actualFinish = r.finishDate;
  } else delete next.actualFinish;
  return next;
}

/** Gerçekleşen başlangıç: boşsa kaldırılır (yüzde 0 olur) */
export function withActualStart(task: Task, date: string): Task {
  checkDate(date);
  const next = { ...task };
  if (!date) {
    delete next.actualStart;
    delete next.actualFinish;
    next.percent = 0;
    return next;
  }
  next.actualStart = date;
  if (next.actualFinish && next.actualFinish < date) delete next.actualFinish;
  return next;
}

/** Gerçekleşen bitiş: görev %100 olur, süre gerçekleşen başlangıç–bitiş arası iş günü olur */
export function withActualFinish(task: Task, date: string, s: Schedule): Task {
  checkDate(date);
  const next = { ...task };
  if (!date) {
    delete next.actualFinish;
    if (next.percent === 100) next.percent = 99;
    return next;
  }
  if (!next.actualStart) throw new OpError(t("err.actualFinishNoStart"));
  if (date < next.actualStart) throw new OpError(t("err.actualFinishBeforeStart"));
  next.actualFinish = date;
  next.percent = 100;
  if (next.duration > 0) {
    const cal = s.calendar;
    const days = s.capacity(task.id, cal.toOffset(next.actualStart), cal.toOffset(addDays(date, 1)));
    next.duration = Math.max(1, Math.round(days));
  }
  return next;
}

/** Kalan süre: gerçekleşen kısım (süre × %) korunur, süre = gerçekleşen + kalan */
export function withRemaining(task: Task, remaining: number, s: Schedule): Task {
  if (!Number.isFinite(remaining) || remaining < 0) throw new OpError(t("err.remaining"));
  const actual = (task.duration * task.percent) / 100;
  const duration = Math.max(0, Math.round(actual + remaining));
  const percent = duration > 0 ? Math.round((actual / duration) * 100) : task.percent;
  return withPercent({ ...task, duration }, remaining === 0 && duration > 0 ? 100 : Math.min(99, percent), s);
}

export function updateTask(p: Project, row: number, patch: TaskPatch): Project {
  let task = applyFields({ ...taskAt(p, row) }, patch);
  if (patch.name !== undefined) task.name = patch.name;
  if (patch.duration !== undefined) task.duration = clampDuration(patch.duration);
  if (patch.blackouts !== undefined) {
    const ids = patch.blackouts.map((name) => {
      const b = (p.blackouts ?? []).find((x) => x.name.toLocaleLowerCase("tr") === name.trim().toLocaleLowerCase("tr"));
      if (!b) throw new OpError(t("err.noBlackout", { name }));
      return b.id;
    });
    if (ids.length) task.blackouts = [...new Set(ids)];
    else delete task.blackouts;
  }
  if (patch.predecessors !== undefined) task = setPredecessors(p, task, patch.predecessors);
  let next = { ...p, tasks: p.tasks.map((t, i) => (i === row - 1 ? task : t)) };
  if (patch.resources !== undefined) next = setResources(next, task.id, patch.resources);
  // İlerleme alanları güncel zamanlamaya göre yorumlanır
  const progress = patch.percent !== undefined || patch.actualStart !== undefined || patch.actualFinish !== undefined || patch.remainingDuration !== undefined;
  if (!progress) return next;
  let cur = next.tasks[row - 1];
  if (patch.actualStart !== undefined) cur = withActualStart(cur, patch.actualStart);
  if (patch.percent !== undefined) cur = withPercent(cur, patch.percent, schedule({ ...next, tasks: next.tasks.map((x, i) => (i === row - 1 ? cur : x)) }));
  if (patch.actualFinish !== undefined) cur = withActualFinish(cur, patch.actualFinish, schedule(next));
  if (patch.remainingDuration !== undefined) cur = withRemaining(cur, patch.remainingDuration, schedule(next));
  return { ...next, tasks: next.tasks.map((x, i) => (i === row - 1 ? cur : x)) };
}

/** Görevi siler; özetse alt görevleri de silinir. */
export function deleteTask(p: Project, row: number): { project: Project; deleted: number } {
  taskAt(p, row);
  const end = subtreeEnd(p.tasks, row - 1);
  const doomed = new Set(p.tasks.slice(row - 1, end).map((t) => t.id));
  const tasks = p.tasks
    .filter((t) => !doomed.has(t.id))
    .map((t) => ({ ...t, predecessors: t.predecessors.filter((pr) => !doomed.has(pr.taskId)) }));
  return { project: pruneRiskLinks({ ...p, tasks: normalizeOutline(tasks) }), deleted: doomed.size };
}

export function shiftTask(p: Project, row: number, direction: "in" | "out"): Project {
  taskAt(p, row);
  let tasks = direction === "in" ? indent(p.tasks, row - 1) : outdent(p.tasks, row - 1);
  if (tasks === p.tasks) {
    throw new OpError(t(direction === "in" ? "err.cannotIndent" : "err.cannotOutdent"));
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
  if (from.id === to.id) throw new OpError(t("err.selfLink"));
  const without: Project = {
    ...p,
    tasks: p.tasks.map((t) => (t.id === to.id ? { ...t, predecessors: t.predecessors.filter((x) => x.taskId !== from.id) } : t)),
  };
  const msg = cycleError(without, to.id, from.id, { from: fromRow, to: toRow });
  if (msg) throw new OpError(msg);
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
  if (!to.predecessors.some((x) => x.taskId === from.id)) throw new OpError(t("err.noLink", { from: String(fromRow), to: String(toRow) }));
  return {
    ...p,
    tasks: p.tasks.map((t) => (t.id === to.id ? { ...t, predecessors: t.predecessors.filter((x) => x.taskId !== from.id) } : t)),
  };
}

/** Görev çıktısı: her satırda aynı alanlar bulunur (boş değerler "" / 0 / false). */
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
  /** "Şu tarihten önce başlamasın: YYYY-AA-GG" (seçili dilde) ya da "" */
  constraint: string;
  /** ASAP, ALAP, SNET … */
  constraintType: ConstraintType;
  constraintDate: string;
  deadline: string;
  actualStart: string;
  actualFinish: string;
  /** Kalan süre (iş günü) = süre × (1 − %) */
  remainingDuration: number;
  fixedCost: number;
  /** Zamanlama uyarıları (kısıt çatışması, son tarih aşımı) */
  issues: string[];
  /** "Ali[50%]; Vinç" ya da ""; özet görevlerde "" */
  resources: string;
  /** Görev maliyeti; özet görevde alt görevlerin toplamı */
  cost: number;
  overallocated: boolean;
  /** Bilgi notu (ör. maliyet ağırlığında maliyeti olmayan görev) ya da "" */
  info: string;
  /** Üç nokta süre tahmini (iyimser, en olası, kötümser) */
  estimate?: DurationEstimate;
  /** Bağlı kapanmamış risklerin kimlikleri */
  risks?: string[];
}

export function listTasks(p: Project): TaskRow[] {
  const s = schedule(p);
  const wbs = wbsCodes(p.tasks);
  const over = new Set(resourceUsage(p, s).flatMap((u) => u.overTasks));
  const curves = progressCurves(p, s, formatDate(new Date()));
  const zeroCost = new Set(curves.weight === "cost" ? curves.zeroCostRows : []);
  const leafCost = p.tasks.map((task, i) => (s.rows[i].isSummary ? 0 : Math.round(taskCost(task, p))));
  const issuesOf = new Map<string, string[]>();
  for (const is of s.issues) issuesOf.set(is.taskId, [...(issuesOf.get(is.taskId) ?? []), issueText(p, s, is)]);
  const byTask = risksByTask(p);
  return p.tasks.map((task, i) => {
    const r = s.rows[i];
    const linked = byTask.get(task.id);
    const cost = r.isSummary ? leafCost.slice(i + 1, subtreeEnd(p.tasks, i)).reduce((a, b) => a + b, 0) : leafCost[i];
    return {
      row: i + 1,
      wbs: wbs[i],
      name: task.name,
      level: task.outline,
      summary: r.isSummary,
      milestone: r.isMilestone,
      duration: r.isSummary ? r.duration : task.duration,
      start: r.startDate,
      finish: r.finishDate,
      predecessors: formatPredecessors(task.predecessors, p.tasks),
      percent: r.percent,
      slack: r.slack,
      critical: r.critical,
      constraint: task.constraint ? `${t(`constraint.${task.constraint.type}`)}${task.constraint.date ? `: ${task.constraint.date}` : ""}` : "",
      constraintType: task.constraint?.type ?? "ASAP",
      constraintDate: task.constraint?.date ?? "",
      deadline: task.deadline ?? "",
      actualStart: task.actualStart ?? "",
      actualFinish: task.actualFinish ?? "",
      remainingDuration: r.isSummary ? 0 : round1((task.duration * (100 - task.percent)) / 100),
      fixedCost: task.fixedCost ?? 0,
      issues: issuesOf.get(task.id) ?? [],
      resources: r.isSummary ? "" : formatAssignments(task.assignments, p.resources),
      cost,
      overallocated: over.has(task.id),
      info: zeroCost.has(i + 1) ? t("warn.taskNoCost") : "",
      ...(task.estimate ? { estimate: task.estimate } : {}),
      ...(linked ? { risks: linked.map((x) => x.id) } : {}),
    };
  });
}

export function projectSummary(p: Project, today = formatDate(new Date())) {
  const s = schedule(p);
  const leaves = p.tasks.filter((_, i) => !s.rows[i].isSummary);
  const usage = resourceUsage(p, s);
  const curves = progressCurves(p, s, today);
  const plannedToday = curves.todayDay < 0 ? 0 : plannedAt(curves, Math.min(curves.todayDay, s.finish - 1));
  return {
    name: p.name,
    start: s.calendar.base,
    finish: s.finishDate,
    durationWorkdays: s.finish,
    workdays: normalizeWorkdays(p.workdays),
    tasks: leaves.length,
    criticalTasks: leaves.filter((t) => s.byId.get(t.id)!.critical).length,
    /** İlerleme ağırlığı: cost (maliyet), work (iş, adam-gün) ya da duration (süre) */
    progressWeight: curves.weight,
    progressPercent: round1(curves.earnedPercent),
    plannedPercentToday: round1(plannedToday),
    varianceToday: round1(curves.earnedPercent - plannedToday),
    earnedValue: Math.round(curves.earnedCost),
    holidays: p.holidays.length,
    resources: p.resources.length,
    totalCost: Math.round(p.tasks.reduce((sum, task, i) => sum + (s.rows[i].isSummary ? 0 : taskCost(task, p)), 0)),
    overheadPercent: p.overheadPercent ?? 0,
    issues: s.issues.map((is) => issueText(p, s, is)),
    overallocatedResources: usage.filter((u) => u.overDays.length).map((u) => u.resource.name),
    cycleWarning: s.cycle.length ? t("warn.cycle", { rows: s.cycle.map((id) => p.tasks.findIndex((task) => task.id === id) + 1).join(", ") }) : "",
    /** Bilgilendirme (hata değil): ör. maliyeti olmayan görevler */
    warnings: progressWarnings(curves, projectWeight(p)),
  };
}

/** Zamanlama uyarısının seçili dildeki metni */
export function issueText(p: Project, s: Schedule, is: ScheduleIssue): string {
  const i = p.tasks.findIndex((x) => x.id === is.taskId);
  const task = p.tasks[i];
  const r = s.rows[i];
  const row = String(i + 1);
  const c = task?.constraint;
  switch (is.kind) {
    case "constraintLink":
      return t("issue.constraintLink", { row, constraint: c ? t(`constraint.${c.type}`) : "", date: c?.date ?? "" });
    case "startLate":
      return t("issue.startLate", { row, start: r.startDate, date: c?.date ?? "" });
    case "finishLate":
      return t("issue.finishLate", { row, finish: r.finishDate, date: c?.date ?? "" });
    case "deadline":
      return t("issue.deadline", { row, finish: r.finishDate, date: task?.deadline ?? "" });
    case "noWorkingTime":
      return t("issue.noWorkingTime", { row });
  }
}

/** İlerleme ağırlığıyla ilgili bilgi notları (arayüz ve MCP aynı metni kullanır) */
export function progressWarnings(curves: Curves, requested: ProgressWeight): string[] {
  const out: string[] = [];
  if (curves.weightFallback) out.push(t("warn.weightFallback", { weight: t(`weight.${requested}`) }));
  else if (curves.weight === "cost" && curves.zeroCostRows.length)
    out.push(t("warn.zeroCostTasks", { n: curves.zeroCostRows.length, rows: curves.zeroCostRows.join(", ") }));
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function clampDuration(n: number): number {
  if (!Number.isFinite(n) || n < 0) throw new OpError(t("err.duration"));
  return Math.min(10_000, Math.round(n));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) throw new OpError(t("err.percent"));
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
  /** %100 birimde ücret (gün/saat/kullanım başına) ya da malzemede birim fiyat */
  rate?: number;
  type?: ResourceType;
  rateType?: RateType;
  unitLabel?: string;
  /** Kaynağın kendi çalışma günleri (0 = pazar); boş dizi proje takvimine döndürür */
  workdays?: number[];
  /** İzinler (listeyi tamamen değiştirir) */
  leaves?: Leave[];
}

/** Kaynağı adına göre bulur ve günceller; yoksa ekler. */
export function setResource(p: Project, input: ResourceInput): { project: Project; created: boolean } {
  const name = input.name.trim();
  if (!name || /[;,[\]]/.test(name)) throw new OpError(t("err.resourceName"));
  if (input.maxUnits !== undefined && !(input.maxUnits >= 1)) throw new OpError(t("err.capacity"));
  if (input.rate !== undefined && !(input.rate >= 0)) throw new OpError(t("err.rate"));
  const existing = findResource(p, name);
  if (input.newName !== undefined) {
    const nn = input.newName.trim();
    if (!nn || /[;,[\]]/.test(nn)) throw new OpError(t("err.resourceName"));
    const clash = findResource(p, nn);
    if (clash && clash !== existing) throw new OpError(t("err.resourceExists", { name: nn }));
  }
  for (const l of input.leaves ?? []) {
    checkDate(l.from);
    checkDate(l.to);
  }
  const fields: Partial<Resource> = {
    ...(input.newName !== undefined ? { name: input.newName.trim() } : {}),
    ...(input.maxUnits !== undefined ? { maxUnits: Math.round(input.maxUnits) } : {}),
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
    ...(input.type !== undefined ? { type: input.type === "work" ? undefined : input.type } : {}),
    ...(input.rateType !== undefined ? { rateType: input.rateType === "day" ? undefined : input.rateType } : {}),
    ...(input.unitLabel !== undefined ? { unitLabel: input.unitLabel.trim() || undefined } : {}),
    ...(input.workdays !== undefined ? { workdays: input.workdays.length ? normalizeWorkdays(input.workdays) : undefined } : {}),
    ...(input.leaves !== undefined
      ? { leaves: input.leaves.length ? input.leaves.map((l) => (l.from <= l.to ? l : { ...l, from: l.to, to: l.from })) : undefined }
      : {}),
  };
  if (existing) {
    return { project: { ...p, resources: p.resources.map((r) => (r === existing ? { ...r, ...fields } : r)) }, created: false };
  }
  const created: Resource = { id: newResourceId(), name, maxUnits: 100, rate: 0, ...fields };
  return { project: { ...p, resources: [...p.resources, created] }, created: true };
}

export function deleteResource(p: Project, name: string): { project: Project; unassigned: number } {
  const r = findResource(p, name);
  if (!r) throw new OpError(t("err.noResource", { name, list: p.resources.map((x) => x.name).join(", ") || t("common.none") }));
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
    const r = u.resource;
    return {
      name: r.name,
      type: r.type ?? "work",
      rateType: r.type === "material" ? "unit" : (r.rateType ?? "day"),
      ...(r.unitLabel ? { unitLabel: r.unitLabel } : {}),
      maxUnitsPercent: r.maxUnits,
      rate: r.rate,
      workdays: r.workdays ?? "project",
      leaves: r.leaves ?? [],
      /** İş (adam-gün); malzemede toplam miktar */
      workPersonDays: Math.round(u.work * 10) / 10,
      cost: Math.round(u.cost),
      peakPercent: u.peak,
      overallocated: ranges,
      overallocatedTaskRows: u.overTasks.map((id) => p.tasks.findIndex((t) => t.id === id) + 1),
    };
  });
}
