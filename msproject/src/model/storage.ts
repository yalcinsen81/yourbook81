import { isValidDate, normalizeWorkdays } from "./calendar";
import { t } from "../i18n";
import { tagBuiltinHolidays, type Holiday } from "./holidays";
import { normalizeOutline } from "./outline";
import { toEstimate, toRisks, toSimSummary, toSimulation } from "./risks";
import { defaultHolidays } from "./sample";
import {
  BASELINE_SLOTS,
  PROJECT_VERSION,
  type Assignment,
  type Baseline,
  type Blackout,
  type Constraint,
  type ConstraintType,
  type CostAccrual,
  type Leave,
  type LinkType,
  type Predecessor,
  type ProgressWeight,
  type Project,
  type RateType,
  type Resource,
  type ResourceType,
  type Task,
  type TaskColor,
  type TaskLink,
  TASK_COLORS,
} from "./types";

const KEY = "msproject.project.v1";
const LINK_TYPES: LinkType[] = ["FS", "SS", "FF", "SF"];
export const CONSTRAINT_TYPES: ConstraintType[] = ["ASAP", "ALAP", "SNET", "SNLT", "MSO", "MFO", "FNET", "FNLT"];
const ACCRUALS: CostAccrual[] = ["prorated", "start", "end"];
const RES_TYPES: ResourceType[] = ["work", "equipment", "material"];
const RATE_TYPES: RateType[] = ["day", "hour", "use"];
const dateOrUndef = (v: unknown) => (typeof v === "string" && isValidDate(v) ? v : undefined);

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
    const task: Task = {
      id,
      name: typeof t.name === "string" ? t.name : "",
      duration: clampInt(t.duration, 0, 10_000),
      outline: clampInt(t.outline, 0, 50),
      percent: clampInt(t.percent, 0, 100),
      predecessors: Array.isArray(t.predecessors) ? (t.predecessors as unknown[]).flatMap(toPredecessor) : [],
      assignments: Array.isArray(t.assignments) ? (t.assignments as unknown[]).flatMap(toAssignment) : undefined,
    };
    // Sürüm 4 öncesi "şundan önce başlamasın" alanı SNET kısıtı olur
    const constraint = toConstraint(t.constraint) ?? (dateOrUndef(t.startNoEarlierThan) ? { type: "SNET" as const, date: t.startNoEarlierThan as string } : undefined);
    if (constraint && constraint.type !== "ASAP") task.constraint = constraint;
    const optional = {
      deadline: dateOrUndef(t.deadline),
      actualStart: dateOrUndef(t.actualStart),
      actualFinish: dateOrUndef(t.actualStart) ? dateOrUndef(t.actualFinish) : undefined,
      fixedCost: typeof t.fixedCost === "number" && Number.isFinite(t.fixedCost) && t.fixedCost > 0 ? t.fixedCost : undefined,
      costAccrual: ACCRUALS.includes(t.costAccrual as CostAccrual) && t.costAccrual !== "prorated" ? (t.costAccrual as CostAccrual) : undefined,
      blackouts: Array.isArray(t.blackouts) ? (t.blackouts as unknown[]).filter((b): b is string => typeof b === "string") : undefined,
      levelingDelay: typeof t.levelingDelay === "number" && t.levelingDelay > 0 ? clampInt(t.levelingDelay, 0, 10_000) : undefined,
      actualCost: typeof t.actualCost === "number" && Number.isFinite(t.actualCost) && t.actualCost >= 0 ? t.actualCost : undefined,
      notes: typeof t.notes === "string" && t.notes.trim() ? t.notes.slice(0, 20_000) : undefined,
      links: toLinks(t.links),
      tags: toTags(t.tags),
      color: TASK_COLORS.includes(t.color as TaskColor) ? (t.color as TaskColor) : undefined,
      estimate: toEstimate(t.estimate),
      inactive: t.inactive === true ? true : undefined,
      timeline: t.timeline === true ? true : undefined,
    };
    for (const [k, v] of Object.entries(optional)) if (v !== undefined && !(Array.isArray(v) && !v.length)) (task as unknown as Record<string, unknown>)[k] = v;
    tasks.push(task);
  }
  // Var olmayan görevlere işaret eden öncülleri at
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.predecessors = t.predecessors.filter((p) => ids.has(p.taskId) && p.taskId !== t.id);
  // Görevde artık olmayan dönem kimlikleri atılır
  const blackouts = toBlackouts(r.blackouts);
  const blackoutIds = new Set(blackouts.map((b) => b.id));
  for (const t of tasks) {
    if (!t.blackouts) continue;
    t.blackouts = [...new Set(t.blackouts.filter((id) => blackoutIds.has(id)))];
    if (!t.blackouts.length) delete t.blackouts;
  }
  // Kaynaklar; var olmayan kaynağa ve aynı kaynağa iki kez yapılan atamalar atılır
  const resources: Resource[] = [];
  const resIds = new Set<string>();
  for (const item of Array.isArray(r.resources) ? (r.resources as unknown[]) : []) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || resIds.has(o.id)) continue;
    resIds.add(o.id);
    const res: Resource = {
      id: o.id,
      name: typeof o.name === "string" ? o.name : "",
      maxUnits: clampInt(o.maxUnits ?? 100, 1, 100_000),
      rate: Math.max(0, typeof o.rate === "number" && Number.isFinite(o.rate) ? o.rate : 0),
    };
    if (RES_TYPES.includes(o.type as ResourceType) && o.type !== "work") res.type = o.type as ResourceType;
    if (RATE_TYPES.includes(o.rateType as RateType) && o.rateType !== "day") res.rateType = o.rateType as RateType;
    if (typeof o.unitLabel === "string" && o.unitLabel.trim()) res.unitLabel = o.unitLabel.trim().slice(0, 12);
    if (Array.isArray(o.workdays)) res.workdays = normalizeWorkdays(o.workdays);
    const leaves = toRanges(o.leaves);
    if (leaves.length) res.leaves = leaves;
    resources.push(res);
  }
  for (const t of tasks) {
    if (!t.assignments) continue;
    const seenRes = new Set<string>();
    t.assignments = t.assignments.filter((a) => resIds.has(a.resourceId) && !seenRes.has(a.resourceId) && seenRes.add(a.resourceId));
    if (!t.assignments.length) delete t.assignments;
  }
  // Tatil listesi olmayan eski kayıtlara varsayılan Türkiye tatilleri eklenir
  const holidays: Holiday[] = Array.isArray(r.holidays)
    ? (r.holidays as unknown[]).flatMap((h) => {
        const o = h as Record<string, unknown> | null;
        return o && typeof o.date === "string" && isValidDate(o.date)
          ? [
              {
                date: o.date,
                name: typeof o.name === "string" ? o.name : "",
                ...(typeof o.src === "string" && o.src ? { src: o.src } : {}),
                ...(o.halfDay === true ? { halfDay: true } : {}),
              },
            ]
          : [];
      })
    : defaultHolidays(r.start);
  return {
    ...migrate(r),
    name: typeof r.name === "string" ? r.name : t("default.projectFallback"),
    start: r.start,
    tasks: normalizeOutline(tasks),
    holidays: (fileVersion(r) < 3 ? tagBuiltinHolidays(holidays) : holidays).sort((a, b) => a.date.localeCompare(b.date)),
    resources,
    ...(blackouts.length ? { blackouts } : {}),
    ...extras(r),
    ...riskFields(r, ids),
  };
}

/** Sürüm 4 proje alanları (yoksa yazılmaz, varsayılanları kullanılır) */
function extras(r: Record<string, unknown>): Partial<Project> {
  const out: Partial<Project> = {};
  if (r.halfDayMode === "half") out.halfDayMode = "half";
  if (typeof r.overheadPercent === "number" && r.overheadPercent > 0 && r.overheadPercent <= 1000) out.overheadPercent = r.overheadPercent;
  if (typeof r.hoursPerDay === "number" && r.hoursPerDay > 0 && r.hoursPerDay <= 24 && r.hoursPerDay !== 8) out.hoursPerDay = r.hoursPerDay;
  const baselines = toBaselines(r.baselines);
  if (baselines.length) out.baselines = baselines;
  return out;
}

/** Sürüm 6: risk sicili, benzetim ayarları ve son sonuç */
function riskFields(r: Record<string, unknown>, taskIds: Set<string>): Partial<Project> {
  const out: Partial<Project> = {};
  const risks = toRisks(r.risks, taskIds);
  if (risks.length) out.risks = risks;
  const sim = toSimulation(r.simulation);
  if (sim) out.simulation = sim;
  const result = toSimSummary(r.simResult);
  if (result) out.simResult = result;
  return out;
}

/** Ham dosya verisinin biçim sürümü (alan yoksa 1) */
export function fileVersion(raw: unknown): number {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>).version : undefined;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}

/** Dosya bu sürümün yazacağı biçimden eskiyse kaydetmeden önce yedeği alınmalı */
export function needsUpgradeBackup(raw: unknown): boolean {
  return fileVersion(raw) < PROJECT_VERSION;
}

/**
 * Sürüm yükseltme. Sürüm alanı olmayan dosyalar 1. sürümdür: pazartesi–cuma çalışılır, tatil listesi olduğu gibi
 * kalır (kullanıcının tatillerine dokunulmaz). İlerleme ağırlığı yoksa maliyettir. Sürüm 3: para birimi yoksa TRY;
 * hazır tatillere kaynak anahtarı verilir (bkz. tagBuiltinHolidays). Sürüm 4: "şundan önce başlamasın" alanı SNET
 * kısıtına çevrilir; diğer yeni alanlar isteğe bağlıdır, yoksa önceki davranış sürer. Sürüm 5: not, bağlantı,
 * etiket, renk ve gerçekleşen maliyet isteğe bağlı alanlardır; dönüştürülecek eski alan yoktur. Sürüm 6: risk
 * sicili, benzetim ayarları/sonucu ve görevlerde üç nokta tahmin isteğe bağlıdır; dönüştürülecek eski alan yoktur.
 */
function migrate(r: Record<string, unknown>): Pick<Project, "version" | "workdays" | "progressWeight" | "currency"> {
  return {
    version: PROJECT_VERSION,
    workdays: normalizeWorkdays(r.workdays),
    progressWeight: WEIGHTS.includes(r.progressWeight as ProgressWeight) ? (r.progressWeight as ProgressWeight) : "cost",
    currency: normalizeCurrency(r.currency),
  };
}

/** Para birimi kodu: 1–8 harf/simge, büyük harfe çevrilir; geçersizse TRY */
export function normalizeCurrency(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return /^[\p{L}\p{Sc}]{1,8}$/u.test(s) ? s : "TRY";
}

const WEIGHTS: ProgressWeight[] = ["cost", "work", "duration"];

function toPredecessor(raw: unknown): Predecessor[] {
  if (!raw || typeof raw !== "object") return [];
  const p = raw as Record<string, unknown>;
  if (typeof p.taskId !== "string") return [];
  const type = LINK_TYPES.includes(p.type as LinkType) ? (p.type as LinkType) : "FS";
  return [{ taskId: p.taskId, type, lag: clampInt(p.lag, -10_000, 10_000) }];
}

function toAssignment(raw: unknown): Assignment[] {
  if (!raw || typeof raw !== "object") return [];
  const a = raw as Record<string, unknown>;
  if (typeof a.resourceId !== "string") return [];
  // Malzeme miktarı küsuratlı olabilir (iki basamak)
  const n = typeof a.units === "number" && Number.isFinite(a.units) ? a.units : 100;
  return [{ resourceId: a.resourceId, units: Math.min(1_000_000, Math.max(0.01, Math.round(n * 100) / 100)) }];
}

/** Güvenli bağlantı adresi: http(s), mailto, file; başka şema (ör. javascript:) atılır */
export function safeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 2000) return undefined;
  if (/^(https?:|mailto:|file:)/i.test(s)) return s;
  // Şemasız yazılan alan adı (ör. www.ornek.com/plan.pdf)
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return `https://${s}`;
  return undefined;
}

function toLinks(raw: unknown): TaskLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    const url = safeUrl(o?.url);
    if (!o || !url) return [];
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : undefined;
    return [title ? { url, title } : { url }];
  });
  return out.length ? out.slice(0, 50) : undefined;
}

/** Etiketler: kırpılır, tekrarsız, en çok 20 tane, 32 karakter */
export function toTags(raw: unknown): string[] | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    if (typeof x !== "string") continue;
    const tag = x.trim().replace(/\s+/g, " ").slice(0, 32);
    // Türkçe I/İ farkı yinelenen etiket sayılmasın
    const key = tag.toLocaleLowerCase("tr").replace(/ı/g, "i");
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.length ? out.slice(0, 20) : undefined;
}

function toConstraint(raw: unknown): Constraint | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (!CONSTRAINT_TYPES.includes(c.type as ConstraintType)) return undefined;
  const type = c.type as ConstraintType;
  if (type === "ASAP" || type === "ALAP") return { type };
  const date = dateOrUndef(c.date);
  return date ? { type, date } : undefined;
}

/** İzin / dönem aralıkları: geçersizler atılır, ters yazılmışsa düzeltilir */
function toRanges(raw: unknown): Leave[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    const from = dateOrUndef(o?.from);
    const to = dateOrUndef(o?.to);
    if (!o || !from || !to) return [];
    const [a, b] = from <= to ? [from, to] : [to, from];
    return [{ from: a, to: b, ...(typeof o.name === "string" && o.name ? { name: o.name } : {}) }];
  });
}

function toBlackouts(raw: unknown): Blackout[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((x, i) => {
    const o = x as Record<string, unknown> | null;
    const [range] = toRanges([o]);
    if (!o || !range) return [];
    const id = typeof o.id === "string" && o.id && !seen.has(o.id) ? o.id : `b${i + 1}`;
    seen.add(id);
    return [{ id, name: typeof o.name === "string" ? o.name : "", from: range.from, to: range.to }];
  });
}

function toBaselines(raw: unknown): Baseline[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<number, Baseline>();
  for (const x of raw) {
    const o = x as Record<string, unknown> | null;
    if (!o || !Number.isInteger(o.index) || (o.index as number) < 0 || (o.index as number) >= BASELINE_SLOTS) continue;
    if (!o.tasks || typeof o.tasks !== "object") continue;
    const tasks: Baseline["tasks"] = {};
    for (const [id, v] of Object.entries(o.tasks as Record<string, unknown>)) {
      const b = v as Record<string, unknown> | null;
      const start = dateOrUndef(b?.start);
      const finish = dateOrUndef(b?.finish);
      if (!b || !start || !finish) continue;
      tasks[id] = { start, finish, duration: Number(b.duration) || 0, cost: Number(b.cost) || 0 };
    }
    out.set(o.index as number, {
      index: o.index as number,
      name: typeof o.name === "string" ? o.name : "",
      savedAt: dateOrUndef(o.savedAt) ?? "",
      finish: dateOrUndef(o.finish) ?? "",
      tasks,
    });
  }
  return [...out.values()].sort((a, b) => a.index - b.index);
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

/** Tarayıcıdaki kayıt var ama okunamıyor mu (açılışta kurtarma önerilir) */
export function storedProjectCorrupt(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    return !!raw && !sanitizeProject(JSON.parse(raw));
  } catch {
    return true;
  }
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Depolama dolu ya da kapalı: sessizce geç, veri bellekte kalır
  }
}
