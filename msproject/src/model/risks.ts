import { formatNumber, parseNumberLocal } from "../i18n";
import { isValidDate } from "./calendar";
import {
  RISK_RESPONSES,
  RISK_STATUSES,
  type DurationEstimate,
  type Project,
  type Risk,
  type RiskImpact,
  type RiskResponse,
  type RiskStatus,
  type SimulationSettings,
  type SimulationSummary,
} from "./types";

// Risk sicili (saf): puanlama, 5×5 matris, doğrulama ve dosyadan okuma. Benzetim simulation.ts'te.

/** Olasılık puanının benzetimdeki varsayılan gerçekleşme yüzdesi (1 çok düşük … 5 çok yüksek) */
export const RISK_CHANCE = [0, 10, 30, 50, 70, 90] as const;

export const DEFAULT_SIMULATION: SimulationSettings = {
  iterations: 5000,
  distribution: "triangular",
  uncertaintyLow: 10,
  uncertaintyHigh: 25,
  seed: 1,
  includeRisks: true,
};

export const MAX_ITERATIONS = 50_000;

export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Maruziyet = olasılık × etki (1–25) */
export const exposure = (r: Pick<Risk, "probability" | "impact">) => r.probability * r.impact;

/** Maruziyet düzeyi: 1–4 düşük, 5–9 orta, 10–15 yüksek, 16–25 çok yüksek */
export function riskLevel(score: number): RiskLevel {
  if (score >= 16) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

/** Benzetimde kullanılan gerçekleşme olasılığı (0–1) */
export function riskChance(r: Pick<Risk, "probability" | "chance">): number {
  const pct = r.chance ?? RISK_CHANCE[clamp(Math.round(r.probability), 1, 5)];
  return clamp(pct, 0, 100) / 100;
}

/** Benzetime katılan riskler: kapanmamış ve en az bir göreve etkisi olan */
export const activeRisks = (p: Project) => (p.risks ?? []).filter((r) => r.status !== "closed" && r.tasks.some((x) => x.days > 0 || x.cost > 0));

/** 5×5 matris: [olasılık 1–5][etki 1–5] → risk kimlikleri (kapananlar hariç) */
export function riskMatrix(risks: Risk[]): string[][][] {
  const m: string[][][] = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => []));
  for (const r of risks) if (r.status !== "closed") m[r.probability][r.impact].push(r.id);
  return m;
}

/** Görev kimliği → bağlı (kapanmamış) riskler */
export function risksByTask(p: Project): Map<string, Risk[]> {
  const out = new Map<string, Risk[]>();
  for (const r of p.risks ?? []) {
    if (r.status === "closed") continue;
    for (const x of r.tasks) out.set(x.taskId, [...(out.get(x.taskId) ?? []), r]);
  }
  return out;
}

export function newRiskId(p: Project): string {
  const used = new Set((p.risks ?? []).map((r) => r.id));
  let n = (p.risks?.length ?? 0) + 1;
  while (used.has(`R${n}`)) n++;
  return `R${n}`;
}

/** Riski ekler ya da (aynı kimlikle) değiştirir; görevde olmayan bağlar atılır */
export function upsertRisk(p: Project, risk: Risk): Project {
  const clean = toRisk(risk, new Set(p.tasks.map((t) => t.id)));
  if (!clean) return p;
  const list = p.risks ?? [];
  const at = list.findIndex((r) => r.id === clean.id);
  const risks = at < 0 ? [...list, clean] : list.map((r, i) => (i === at ? clean : r));
  return { ...p, risks };
}

export function removeRisk(p: Project, id: string): Project {
  const risks = (p.risks ?? []).filter((r) => r.id !== id);
  const next: Project = { ...p, risks };
  if (!risks.length) delete next.risks;
  return next;
}

/** Görev silinince risk bağları da gider */
export function pruneRiskLinks(p: Project): Project {
  if (!p.risks?.length) return p;
  const ids = new Set(p.tasks.map((t) => t.id));
  if (p.risks.every((r) => r.tasks.every((x) => ids.has(x.taskId)))) return p;
  return { ...p, risks: p.risks.map((r) => ({ ...r, tasks: r.tasks.filter((x) => ids.has(x.taskId)) })) };
}

/** Üç nokta tahmin geçerli mi: 0 ≤ iyimser ≤ en olası ≤ kötümser */
export function validEstimate(e: DurationEstimate | undefined): boolean {
  return !!e && [e.optimistic, e.likely, e.pessimistic].every((v) => Number.isFinite(v) && v >= 0) && e.optimistic <= e.likely && e.likely <= e.pessimistic;
}

/** Tablodaki tahmin hücresi: "8; 10; 15" (iyimser; en olası; kötümser) */
export function formatEstimate(e: DurationEstimate | undefined): string {
  return e ? [e.optimistic, e.likely, e.pessimistic].map((v) => formatNumber(v, Number.isInteger(v) ? 0 : 1)).join("; ") : "";
}

/** "8; 10; 15", "8/10/15" ya da "8 10 15"; boş metin tahmini kaldırır (null). Geçersizse undefined. */
export function parseEstimate(text: string): DurationEstimate | null | undefined {
  const parts = text.trim().split(/\s*[;/]\s*|\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length !== 3) return undefined;
  const [o, m, p] = parts.map((x) => parseNumberLocal(x));
  const e = { optimistic: o ?? NaN, likely: m ?? NaN, pessimistic: p ?? NaN };
  return validEstimate(e) ? e : undefined;
}

// --- Dosyadan okuma (sanitizeProject kullanır) ---

const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export function toEstimate(raw: unknown): DurationEstimate | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const round = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(clamp(v, 0, 10_000) * 100) / 100 : NaN);
  const e = { optimistic: round(o.optimistic), likely: round(o.likely), pessimistic: round(o.pessimistic) };
  return validEstimate(e) ? e : undefined;
}

export function toRisk(raw: unknown, taskIds: Set<string>): Risk | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 40);
  const title = str(o.title, 200);
  if (!id || !title) return undefined;
  const seen = new Set<string>();
  const tasks: RiskImpact[] = (Array.isArray(o.tasks) ? o.tasks : []).flatMap((x) => {
    const t = x as Record<string, unknown> | null;
    if (!t || typeof t.taskId !== "string" || !taskIds.has(t.taskId) || seen.has(t.taskId)) return [];
    seen.add(t.taskId);
    return [{ taskId: t.taskId, days: Math.round(num(t.days, 0, 10_000, 0) * 10) / 10, cost: Math.round(num(t.cost, 0, 1e12, 0) * 100) / 100 }];
  });
  const risk: Risk = {
    id,
    title,
    probability: Math.round(num(o.probability, 1, 5, 3)),
    impact: Math.round(num(o.impact, 1, 5, 3)),
    status: RISK_STATUSES.includes(o.status as RiskStatus) ? (o.status as RiskStatus) : "open",
    tasks,
  };
  const optional = {
    category: str(o.category, 60),
    owner: str(o.owner, 80),
    description: str(o.description, 5000),
    chance: typeof o.chance === "number" && Number.isFinite(o.chance) ? Math.round(clamp(o.chance, 0, 100) * 10) / 10 : undefined,
    response: RISK_RESPONSES.includes(o.response as RiskResponse) ? (o.response as RiskResponse) : undefined,
    mitigation: str(o.mitigation, 5000),
    review: typeof o.review === "string" && isValidDate(o.review) ? o.review : undefined,
  };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined) (risk as unknown as Record<string, unknown>)[k] = v;
  return risk;
}

export function toRisks(raw: unknown, taskIds: Set<string>): Risk[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((x) => {
    const r = toRisk(x, taskIds);
    if (!r || seen.has(r.id)) return [];
    seen.add(r.id);
    return [r];
  }).slice(0, 1000);
}

export function toSimulation(raw: unknown): SimulationSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_SIMULATION;
  return {
    iterations: Math.round(num(o.iterations, 100, MAX_ITERATIONS, d.iterations)),
    distribution: o.distribution === "pert" ? "pert" : "triangular",
    uncertaintyLow: num(o.uncertaintyLow, 0, 95, d.uncertaintyLow),
    uncertaintyHigh: num(o.uncertaintyHigh, 0, 500, d.uncertaintyHigh),
    seed: Math.round(num(o.seed, 0, 2 ** 31 - 1, d.seed)),
    includeRisks: o.includeRisks !== false,
  };
}

/** Kaydedilmiş benzetim özeti: yapısı bozuksa atılır (yeniden çalıştırılır) */
export function toSimSummary(raw: unknown): SimulationSummary | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as SimulationSummary;
  const ok =
    typeof o.fingerprint === "string" &&
    typeof o.at === "string" &&
    typeof o.planFinish === "string" &&
    o.finish && typeof o.finish.p50 === "string" &&
    o.cost && typeof o.cost.p50 === "number" &&
    Array.isArray(o.finishCdf) && Array.isArray(o.costCdf) && Array.isArray(o.tasks) && Array.isArray(o.risks);
  return ok ? o : undefined;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
