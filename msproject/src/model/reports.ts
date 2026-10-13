import { formatDateLocal, formatPercent, monthName, t, weekStartDay, type MessageKey } from "../i18n";
import { addDays, parseDate, WorkCalendar } from "./calendar";
import { taskCost } from "./costs";
import { getBaseline } from "./baseline";
import { nonWorkingDates } from "./holidays";
import { subtreeEnd, wbsCodes } from "./outline";
import { formatPredecessors } from "./predecessors";
import { curveSamples, formatAssignments, progressCurves, resourceUsage, type Curves } from "./resources";
import type { Baseline, Project, ProgressWeight, Schedule } from "./types";

// Raporlar (saf): kazanılmış değer, S eğrisi serileri, nakit akışı ve tablo raporları. Tablolar türlü hücrelerle
// üretilir; CSV / Excel / yazdırma aynı tabloyu kullanır (sayılar sayı, tarihler tarih olarak kalır).

export type CellKind = "text" | "number" | "money" | "date" | "percent" | "days";
export type Cell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  kind: CellKind;
}

export interface ReportTable {
  id: ReportKind;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  /** Tablonun altındaki toplam satırı (isteğe bağlı) */
  total?: Record<string, Cell>;
  /** Açıklama satırları (ör. "AC tahmini") */
  notes?: string[];
}

export type ReportKind = "evm" | "scurve" | "critical" | "resources" | "histogram" | "cashflow" | "tasks" | "milestones";
export const REPORT_KINDS: ReportKind[] = ["evm", "scurve", "critical", "resources", "histogram", "cashflow", "tasks", "milestones"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Yaprak görevlerin maliyeti (özette 0) */
function leafCosts(p: Project, s: Schedule): number[] {
  return p.tasks.map((task, i) => (s.rows[i].isSummary ? 0 : taskCost(task, p)));
}

/** Görev bitişi geçmiş ve %100 değil: "gecikmiş" */
export function isLate(p: Project, s: Schedule, index: number, today: string): boolean {
  const r = s.rows[index];
  if (!r || r.isSummary) return false;
  const finish = p.tasks[index].actualFinish ?? r.finishDate;
  return p.tasks[index].percent < 100 && finish < today;
}

export function lateTaskIds(p: Project, s: Schedule, today: string): Set<string> {
  return new Set(p.tasks.flatMap((x, i) => (isLate(p, s, i, today) ? [x.id] : [])));
}

// --- Referans plan maliyet dağılımı ---

/**
 * Referans plandaki maliyetin günlere dağılımı (proje takvimi, iş günlerine eşit; kilometre taşı kendi gününe).
 * Yalnızca yaprak görevler sayılır (özet maliyeti alt görevlerin toplamıdır).
 */
export function baselineDailyCost(p: Project, s: Schedule, b: Baseline): Map<string, number> {
  const cal = new WorkCalendar(p.start, nonWorkingDates(p.holidays), p.workdays);
  const out = new Map<string, number>();
  const add = (date: string, v: number) => out.set(date, (out.get(date) ?? 0) + v);
  p.tasks.forEach((task, i) => {
    if (s.rows[i].isSummary) return;
    const row = b.tasks[task.id];
    if (!row || !row.cost) return;
    const from = cal.toOffset(row.start);
    const to = Math.max(from + 1, cal.toOffset(addDays(row.finish, 1)));
    if (row.duration === 0) {
      add(cal.prevWorkday(row.finish), row.cost);
      return;
    }
    const per = row.cost / (to - from);
    for (let o = from; o < to; o++) add(cal.toDate(o), per);
  });
  return out;
}

/** Güncel planın günlük maliyeti (görevlerin maliyet dağılımına göre) */
export function planDailyCost(curves: Curves): Map<string, number> {
  const out = new Map<string, number>();
  for (let k = 1; k < curves.points.length; k++) {
    const v = curves.points[k].cost - curves.points[k - 1].cost;
    if (Math.abs(v) > 1e-9) out.set(curves.points[k].date, (out.get(curves.points[k].date) ?? 0) + v);
  }
  return out;
}

function sumUntil(daily: Map<string, number>, date: string): number {
  let sum = 0;
  for (const [d, v] of daily) if (d <= date) sum += v;
  return sum;
}

// --- Kazanılmış değer ---

export interface EarnedValue {
  /** Tamamlanmadaki bütçe: referans plan varsa onun toplamı, yoksa güncel plan */
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  /** PV ya da AC 0 ise hesaplanamaz (null) */
  spi: number | null;
  cpi: number | null;
  eac: number;
  etc: number;
  vac: number;
  /** PV'nin kaynağı */
  pvSource: "baseline" | "plan";
  baselineName?: string;
  /** Başlamış ama gerçekleşen maliyeti girilmemiş görevlerin satırları (AC = EV sayıldı) */
  acEstimatedRows: number[];
  today: string;
}

/**
 * Kazanılmış değer göstergeleri (bugünün sonu itibarıyla):
 * PV planlanan değer (referans plan varsa ondan), EV = Σ maliyet × %, AC = Σ gerçekleşen maliyet (girilmemişse EV),
 * SV = EV − PV, CV = EV − AC, SPI = EV / PV, CPI = EV / AC, EAC = BAC / CPI, ETC = EAC − AC, VAC = BAC − EAC.
 */
export function earnedValue(p: Project, s: Schedule, today: string, baselineIndex?: number): EarnedValue {
  const costs = leafCosts(p, s);
  const curves = progressCurves(p, s, today, "cost");
  const b = baselineIndex !== undefined && baselineIndex >= 0 ? getBaseline(p, baselineIndex) : p.baselines?.[0];
  let pv: number;
  let bac: number;
  if (b) {
    const daily = baselineDailyCost(p, s, b);
    pv = sumUntil(daily, today);
    bac = [...daily.values()].reduce((a, v) => a + v, 0);
  } else {
    pv = sumUntil(planDailyCost(curves), today);
    bac = curves.totalCost;
  }
  let ev = 0;
  let ac = 0;
  const acEstimatedRows: number[] = [];
  p.tasks.forEach((task, i) => {
    if (s.rows[i].isSummary) return;
    const earned = (costs[i] * task.percent) / 100;
    ev += earned;
    if (task.actualCost !== undefined) ac += task.actualCost;
    else {
      ac += earned;
      if (task.percent > 0) acEstimatedRows.push(i + 1);
    }
  });
  const spi = pv > 0 ? ev / pv : null;
  const cpi = ac > 0 ? ev / ac : null;
  const eac = cpi ? bac / cpi : bac;
  return {
    bac: round2(bac),
    pv: round2(pv),
    ev: round2(ev),
    ac: round2(ac),
    sv: round2(ev - pv),
    cv: round2(ev - ac),
    spi: spi === null ? null : Math.round(spi * 1000) / 1000,
    cpi: cpi === null ? null : Math.round(cpi * 1000) / 1000,
    eac: round2(eac),
    etc: round2(Math.max(0, eac - ac)),
    vac: round2(bac - eac),
    pvSource: b ? "baseline" : "plan",
    baselineName: b?.name,
    acEstimatedRows,
    today,
  };
}

// --- S eğrisi ---

export interface SCurvePoint {
  date: string;
  /** Planlanan kümülatif ilerleme (%), seçili ağırlıkla */
  planned: number;
  plannedCost: number;
  /** Referans plan (% ve maliyet); referans plan yoksa null */
  baseline: number | null;
  baselineCost: number | null;
  /** Gerçekleşen (kazanılan) ilerleme; bugünden sonrası null */
  actual: number | null;
  actualCost: number | null;
}

/** Görevin ağırlığı: maliyet, iş (adam-gün) ya da süre */
function taskWeights(p: Project, s: Schedule, weight: ProgressWeight): number[] {
  const costs = leafCosts(p, s);
  const byId = new Map(p.resources.map((r) => [r.id, r]));
  return p.tasks.map((task, i) => {
    if (s.rows[i].isSummary) return 0;
    if (weight === "cost") return costs[i];
    if (weight === "duration") return task.duration;
    return (task.assignments ?? []).reduce((sum, a) => {
      const r = byId.get(a.resourceId);
      return sum + (r && r.type !== "material" ? (a.units * task.duration) / 100 : 0);
    }, 0);
  });
}

/**
 * Görevin bir tarihe kadar kazandığı oran (0–1). Girilen yüzde, gerçekleşen başlangıçtan (yoksa planlanan) gerçekleşen
 * bitişe (yoksa %100'de planlanan bitiş, değilse bugün) kadar iş günlerine eşit yayılır.
 */
function earnedFraction(p: Project, s: Schedule, i: number, date: string, today: string, cal: WorkCalendar): number {
  const task = p.tasks[i];
  if (!task.percent) return 0;
  const r = s.rows[i];
  const start = task.actualStart ?? r.startDate;
  const end = task.actualFinish ?? (task.percent >= 100 ? r.finishDate : today);
  if (date < start) return 0;
  const total = cal.workdaysBetween(start, end);
  if (total <= 0 || date >= end) return task.percent / 100;
  return ((task.percent / 100) * cal.workdaysBetween(start, date)) / total;
}

/**
 * S eğrisi serileri: planlanan, referans plan ve gerçekleşen (bugüne kadar), Faz 1'deki cuma örneklemesiyle.
 * Yüzdeler seçili ağırlıkla; referans planda maliyet ağırlığı dışında süre oranı kullanılır.
 */
export function sCurveSeries(p: Project, s: Schedule, curves: Curves, today: string, baselineIndex?: number): SCurvePoint[] {
  const b = baselineIndex !== undefined && baselineIndex >= 0 ? getBaseline(p, baselineIndex) : undefined;
  const samples = curveSamples(curves, s, today);
  const cal = new WorkCalendar(p.start, nonWorkingDates(p.holidays), p.workdays);
  const dates = new Set(samples.map((x) => x.date));
  if (b && b.finish > s.finishDate) {
    let d = addDays(s.finishDate, 7);
    for (; d < b.finish; d = addDays(d, 7)) dates.add(d);
    dates.add(b.finish);
  }
  const byDate = new Map(samples.map((x) => [x.date, x]));
  const weights = taskWeights(p, s, curves.weight);
  const totalW = weights.reduce((a, v) => a + v, 0);
  const costs = leafCosts(p, s);
  const totalCost = costs.reduce((a, v) => a + v, 0);
  // Referans plan: maliyet günlüğü ve (maliyet dışı ağırlıkta) süre günlüğü
  const bCost = b ? baselineDailyCost(p, s, b) : null;
  const bCostTotal = bCost ? [...bCost.values()].reduce((a, v) => a + v, 0) : 0;
  let bDur: Map<string, number> | null = null;
  if (b && curves.weight !== "cost") {
    bDur = new Map();
    p.tasks.forEach((task, i) => {
      const row = b.tasks[task.id];
      if (s.rows[i].isSummary || !row || !row.duration) return;
      const from = cal.toOffset(row.start);
      const to = Math.max(from + 1, cal.toOffset(addDays(row.finish, 1)));
      const w = weights[i] || row.duration;
      for (let o = from; o < to; o++) bDur!.set(cal.toDate(o), (bDur!.get(cal.toDate(o)) ?? 0) + w / (to - from));
    });
  }
  const bDurTotal = bDur ? [...bDur.values()].reduce((a, v) => a + v, 0) : 0;
  const last = curves.points[curves.points.length - 1];
  return [...dates].sort().map((date) => {
    const sample = byDate.get(date);
    const planned = sample ? sample.plannedPercent : date > s.finishDate ? 100 : 0;
    const plannedCost = sample ? sample.plannedCost : date > s.finishDate ? (last?.cost ?? 0) : 0;
    let baseline: number | null = null;
    let baselineCost: number | null = null;
    if (bCost) {
      // Başlangıç noktası gün başıdır (planlanan eğri gibi); diğer noktalar gün sonu
      const until = date === s.calendar.base ? addDays(date, -1) : date;
      baselineCost = sumUntil(bCost, until);
      baseline = bDur ? (bDurTotal ? (sumUntil(bDur, until) / bDurTotal) * 100 : 0) : bCostTotal ? (baselineCost / bCostTotal) * 100 : 0;
    }
    let actual: number | null = null;
    let actualCost: number | null = null;
    // Başlangıç noktası gün başıdır: gerçekleşen de 0
    if (date === s.calendar.base && date <= today) {
      actual = 0;
      actualCost = 0;
    } else if (date <= today) {
      let w = 0;
      let c = 0;
      p.tasks.forEach((_, i) => {
        if (s.rows[i].isSummary) return;
        const f = earnedFraction(p, s, i, date, today, cal);
        w += weights[i] * f;
        c += costs[i] * f;
      });
      actual = totalW ? (w / totalW) * 100 : 0;
      actualCost = c;
      if (!totalCost) actualCost = 0;
    }
    return {
      date,
      planned: round2(planned),
      plannedCost: round2(plannedCost),
      baseline: baseline === null ? null : round2(baseline),
      baselineCost: baselineCost === null ? null : round2(baselineCost),
      actual: actual === null ? null : round2(actual),
      actualCost: actualCost === null ? null : round2(actualCost),
    };
  });
}

// --- Nakit akışı ---

export type CashPeriod = "month" | "week";

export interface CashFlowRow {
  /** Dönemin ilk günü (hafta: hafta başı, ay: ayın 1'i) */
  from: string;
  to: string;
  label: string;
  planned: number;
  cumulative: number;
  baseline: number | null;
  baselineCumulative: number | null;
}

function periodStart(date: string, period: CashPeriod): string {
  if (period === "month") return `${date.slice(0, 8)}01`;
  const dow = parseDate(date).getUTCDay();
  return addDays(date, -((dow - weekStartDay() + 7) % 7));
}

function periodEnd(from: string, period: CashPeriod): string {
  if (period === "week") return addDays(from, 6);
  const d = parseDate(from);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return addDays(m === 11 ? `${y + 1}-01-01` : `${y}-${String(m + 2).padStart(2, "0")}-01`, -1);
}

/** Aylık ya da haftalık planlanan maliyet (ve varsa referans plan), kümülatifiyle */
export function cashFlow(p: Project, s: Schedule, curves: Curves, period: CashPeriod, baselineIndex?: number): CashFlowRow[] {
  const plan = planDailyCost(curves);
  const b = baselineIndex !== undefined && baselineIndex >= 0 ? getBaseline(p, baselineIndex) : undefined;
  const base = b ? baselineDailyCost(p, s, b) : null;
  const buckets = new Map<string, { planned: number; baseline: number }>();
  const add = (date: string, key: "planned" | "baseline", v: number) => {
    const k = periodStart(date, period);
    const cur = buckets.get(k) ?? { planned: 0, baseline: 0 };
    cur[key] += v;
    buckets.set(k, cur);
  };
  for (const [d, v] of plan) add(d, "planned", v);
  if (base) for (const [d, v] of base) add(d, "baseline", v);
  if (!buckets.size) return [];
  // Aradaki boş dönemler de satır olur (grafikte boşluk görünsün)
  const keys = [...buckets.keys()].sort();
  const all: string[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1]; k = periodStart(addDays(periodEnd(k, period), 1), period)) all.push(k);
  let cum = 0;
  let bcum = 0;
  return all.map((from) => {
    const v = buckets.get(from) ?? { planned: 0, baseline: 0 };
    cum += v.planned;
    bcum += v.baseline;
    const d = parseDate(from);
    return {
      from,
      to: periodEnd(from, period),
      label: period === "month" ? `${monthName(d.getUTCMonth(), true)} ${d.getUTCFullYear()}` : from,
      planned: round2(v.planned),
      cumulative: round2(cum),
      baseline: base ? round2(v.baseline) : null,
      baselineCumulative: base ? round2(bcum) : null,
    };
  });
}

// --- Tablo raporları ---

const col = (key: string, label: string, kind: CellKind = "text"): ReportColumn => ({ key, label, kind });

export interface ReportOptions {
  today: string;
  baselineIndex?: number;
  period?: CashPeriod;
}

/** Görev listesi: tüm görevler (özetler girintili adla) */
export function taskListReport(p: Project, s: Schedule, opts: ReportOptions): ReportTable {
  const wbs = wbsCodes(p.tasks);
  const costs = leafCosts(p, s);
  const late = lateTaskIds(p, s, opts.today);
  return {
    id: "tasks",
    title: t("report.tasks"),
    columns: [
      col("row", "#", "number"),
      col("wbs", t("col.wbs")),
      col("name", t("col.name")),
      col("duration", t("col.duration"), "days"),
      col("start", t("col.start"), "date"),
      col("finish", t("col.finish"), "date"),
      col("predecessors", t("col.predecessors")),
      col("resources", t("col.resources")),
      col("percent", t("col.percent"), "percent"),
      col("cost", t("report.col.cost"), "money"),
      col("slack", t("col.slack"), "days"),
      col("status", t("report.col.status")),
    ],
    rows: p.tasks.map((task, i) => {
      const r = s.rows[i];
      const cost = r.isSummary ? costs.slice(i + 1, subtreeEnd(p.tasks, i)).reduce((a, v) => a + v, 0) : costs[i];
      return {
        row: i + 1,
        wbs: wbs[i],
        name: `${"  ".repeat(task.outline)}${task.name}`,
        duration: r.duration,
        start: r.startDate,
        finish: r.finishDate,
        predecessors: formatPredecessors(task.predecessors, p.tasks),
        resources: r.isSummary ? "" : formatAssignments(task.assignments, p.resources),
        percent: r.percent,
        cost: round2(cost),
        slack: r.slack,
        status: statusText(p, s, i, late),
      };
    }),
    total: { name: t("report.total"), cost: round2(costs.reduce((a, v) => a + v, 0)) },
  };
}

function statusText(p: Project, s: Schedule, i: number, late: Set<string>): string {
  const task = p.tasks[i];
  if (s.rows[i].percent >= 100) return t("report.status.done");
  if (late.has(task.id)) return t("report.status.late");
  if (s.rows[i].percent > 0) return t("report.status.inProgress");
  return t("report.status.notStarted");
}

/** Kritik yol: bolluğu 0 (ya da negatif) yaprak görevler, başlangıç sırasıyla */
export function criticalPathReport(p: Project, s: Schedule, opts: ReportOptions): ReportTable {
  const costs = leafCosts(p, s);
  const rows = p.tasks
    .map((task, i) => ({ task, i, r: s.rows[i] }))
    .filter((x) => !x.r.isSummary && x.r.critical)
    .sort((a, b) => a.r.es - b.r.es || a.i - b.i);
  const late = lateTaskIds(p, s, opts.today);
  return {
    id: "critical",
    title: t("report.critical"),
    columns: [
      col("row", "#", "number"),
      col("name", t("col.name")),
      col("duration", t("col.duration"), "days"),
      col("start", t("col.start"), "date"),
      col("finish", t("col.finish"), "date"),
      col("predecessors", t("col.predecessors")),
      col("slack", t("col.slack"), "days"),
      col("percent", t("col.percent"), "percent"),
      col("cost", t("report.col.cost"), "money"),
      col("status", t("report.col.status")),
    ],
    rows: rows.map(({ task, i, r }) => ({
      row: i + 1,
      name: task.name,
      duration: r.duration,
      start: r.startDate,
      finish: r.finishDate,
      predecessors: formatPredecessors(task.predecessors, p.tasks),
      slack: r.slack,
      percent: r.percent,
      cost: round2(costs[i]),
      status: statusText(p, s, i, late),
    })),
    total: { name: t("report.total"), duration: s.finish, cost: round2(rows.reduce((a, x) => a + costs[x.i], 0)) },
    notes: [t("report.criticalNote", { n: rows.length, finish: s.finishDate })],
  };
}

/** Kilometre taşları: tarih, referans plan tarihi ve sapması, son tarih, durum */
export function milestoneReport(p: Project, s: Schedule, opts: ReportOptions): ReportTable {
  const b = opts.baselineIndex !== undefined && opts.baselineIndex >= 0 ? getBaseline(p, opts.baselineIndex) : undefined;
  const cal = new WorkCalendar(p.start, nonWorkingDates(p.holidays), p.workdays);
  const late = lateTaskIds(p, s, opts.today);
  const columns = [
    col("row", "#", "number"),
    col("name", t("col.name")),
    col("date", t("report.col.date"), "date"),
    ...(b ? [col("baseline", t("report.col.baselineDate"), "date"), col("variance", t("col.variance"), "days")] : []),
    col("deadline", t("info.deadline"), "date"),
    col("critical", t("legend.critical")),
    col("status", t("report.col.status")),
  ];
  return {
    id: "milestones",
    title: t("report.milestones"),
    columns,
    rows: p.tasks.flatMap((task, i) => {
      const r = s.rows[i];
      if (!r.isMilestone || r.isSummary) return [];
      const bt = b?.tasks[task.id];
      return [
        {
          row: i + 1,
          name: task.name,
          date: r.finishDate,
          ...(b ? { baseline: bt?.finish ?? null, variance: bt ? cal.toOffset(r.finishDate) - cal.toOffset(bt.finish) : null } : {}),
          deadline: task.deadline ?? null,
          critical: r.critical ? t("common.yes") : "",
          status: task.deadline && r.finishDate > task.deadline && r.percent < 100 ? t("report.status.pastDeadline") : statusText(p, s, i, late),
        },
      ];
    }),
  };
}

/** Kaynak özeti: tür, kapasite, iş, maliyet, en yüksek yük ve aşırı yüklü gün sayısı */
export function resourceReport(p: Project, s: Schedule): ReportTable {
  const usage = resourceUsage(p, s);
  return {
    id: "resources",
    title: t("report.resources"),
    columns: [
      col("name", t("res.col.name")),
      col("type", t("res.col.type")),
      col("capacity", t("res.col.capacity"), "percent"),
      col("rate", t("res.col.rate"), "money"),
      col("work", t("report.col.work"), "number"),
      col("cost", t("report.col.cost"), "money"),
      col("peak", t("report.col.peak"), "percent"),
      col("overDays", t("report.col.overDays"), "number"),
    ],
    rows: usage.map((u) => {
      const material = u.resource.type === "material";
      return {
        name: u.resource.name,
        type: t(`res.type.${u.resource.type ?? "work"}`),
        capacity: material ? null : u.resource.maxUnits,
        rate: u.resource.rate,
        work: material ? null : round2(u.work),
        cost: round2(u.cost),
        peak: material ? null : Math.round(u.peak),
        overDays: material ? null : u.overDays.length,
      };
    }),
    total: { name: t("report.total"), cost: round2(usage.reduce((a, u) => a + u.cost, 0)) },
  };
}

/** Kaynak yük histogramı (tablo): her hafta, kaynak başına en yüksek günlük yük (%) ve kapasite */
export function histogramReport(p: Project, s: Schedule, resourceId?: string): ReportTable {
  const usage = resourceUsage(p, s).filter((u) => u.resource.type !== "material" && (!resourceId || u.resource.id === resourceId));
  const weeks = new Map<string, Record<string, number>>();
  for (const u of usage) {
    u.load.forEach((v, d) => {
      const date = s.calendar.toDate(d);
      const wk = periodStart(date, "week");
      const row = weeks.get(wk) ?? {};
      row[u.resource.id] = Math.max(row[u.resource.id] ?? 0, v);
      weeks.set(wk, row);
    });
  }
  return {
    id: "histogram",
    title: t("report.histogram"),
    columns: [col("week", t("report.col.week"), "date"), ...usage.map((u) => col(u.resource.id, `${u.resource.name} (${formatPercent(u.resource.maxUnits)})`, "percent"))],
    rows: [...weeks.keys()].sort().map((wk) => {
      const row: Record<string, Cell> = { week: wk };
      for (const u of usage) row[u.resource.id] = Math.round(weeks.get(wk)![u.resource.id] ?? 0);
      return row;
    }),
    notes: [t("report.histogramNote")],
  };
}

export function cashFlowReport(p: Project, s: Schedule, curves: Curves, opts: ReportOptions): ReportTable {
  const period = opts.period ?? "month";
  const rows = cashFlow(p, s, curves, period, opts.baselineIndex);
  const hasBaseline = rows.some((r) => r.baseline !== null);
  return {
    id: "cashflow",
    title: `${t("report.cashflow")} · ${t(`report.period.${period}`)}`,
    columns: [
      col("period", t("report.col.period")),
      col("from", t("report.col.from"), "date"),
      col("to", t("report.col.to"), "date"),
      col("planned", t("report.col.planned"), "money"),
      col("cumulative", t("report.col.cumulative"), "money"),
      ...(hasBaseline ? [col("baseline", t("report.col.baselineCost"), "money"), col("baselineCumulative", t("report.col.baselineCumulative"), "money")] : []),
    ],
    rows: rows.map((r) => ({
      period: r.label,
      from: r.from,
      to: r.to,
      planned: r.planned,
      cumulative: r.cumulative,
      ...(hasBaseline ? { baseline: r.baseline, baselineCumulative: r.baselineCumulative } : {}),
    })),
    total: { period: t("report.total"), planned: round2(rows.reduce((a, r) => a + r.planned, 0)) },
  };
}

export function sCurveReport(p: Project, s: Schedule, curves: Curves, opts: ReportOptions): ReportTable {
  const pts = sCurveSeries(p, s, curves, opts.today, opts.baselineIndex);
  const hasBaseline = pts.some((x) => x.baseline !== null);
  return {
    id: "scurve",
    title: `${t("report.scurve")} · ${t(`weight.${curves.weight}`)}`,
    columns: [
      col("date", t("report.col.date"), "date"),
      col("planned", t("report.col.plannedPct"), "percent"),
      ...(hasBaseline ? [col("baseline", t("report.col.baselinePct"), "percent")] : []),
      col("actual", t("report.col.actualPct"), "percent"),
      col("plannedCost", t("report.col.plannedCost"), "money"),
      ...(hasBaseline ? [col("baselineCost", t("report.col.baselineCost"), "money")] : []),
      col("actualCost", t("report.col.earnedCost"), "money"),
    ],
    rows: pts.map((x) => ({ ...x })),
  };
}

export const EVM_KEYS = ["bac", "pv", "ev", "ac", "sv", "cv", "spi", "cpi", "eac", "etc", "vac"] as const;

export function evmReport(p: Project, s: Schedule, opts: ReportOptions): ReportTable {
  const e = earnedValue(p, s, opts.today, opts.baselineIndex);
  const row = (key: (typeof EVM_KEYS)[number]) => ({ metric: key, name: t(`evm.${key}` as MessageKey), value: e[key] });
  const items = EVM_KEYS.map(row);
  return {
    id: "evm",
    title: t("report.evm"),
    columns: [col("metric", t("report.col.metric")), col("name", t("report.col.description")), col("value", t("report.col.value"), "number")],
    rows: items.map(({ metric, name, value }) => ({ metric: metric.toUpperCase(), name, value })),
    notes: [
      t("report.evmAsOf", { date: formatDateLocal(e.today) }),
      e.pvSource === "baseline" ? t("report.pvBaseline", { name: e.baselineName ?? "" }) : t("report.pvPlan"),
      ...(e.acEstimatedRows.length ? [t("report.acEstimated", { rows: e.acEstimatedRows.join(", ") })] : []),
    ],
  };
}

/** Raporu türüne göre üretir */
export function buildReport(kind: ReportKind, p: Project, s: Schedule, opts: ReportOptions): ReportTable {
  const curves = progressCurves(p, s, opts.today);
  switch (kind) {
    case "evm":
      return evmReport(p, s, opts);
    case "scurve":
      return sCurveReport(p, s, curves, opts);
    case "critical":
      return criticalPathReport(p, s, opts);
    case "resources":
      return resourceReport(p, s);
    case "histogram":
      return histogramReport(p, s);
    case "cashflow":
      return cashFlowReport(p, s, curves, opts);
    case "tasks":
      return taskListReport(p, s, opts);
    case "milestones":
      return milestoneReport(p, s, opts);
  }
}
