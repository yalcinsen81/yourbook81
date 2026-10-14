import { addDays, normalizeWorkdays, parseDate } from "./calendar";
import { taskCost } from "./costs";
import { activeRisks, DEFAULT_SIMULATION, riskChance } from "./risks";
import { schedule } from "./schedule";
import type { Distribution, Project, Schedule, SimulationSettings, SimulationSummary, Task } from "./types";

// Monte Carlo benzetimi (saf). Her yinelemede yaprak görevlerin kalan süreleri seçilen dağılımdan çekilir, kapanmamış
// riskler olasılıklarıyla tetiklenir (bağlı görevlere gün ve tutar ekler) ve plan mevcut zamanlama motoruyla yeniden
// hesaplanır. Böylece takvim, kısıtlar, kaynak takvimleri ve gerçekleşenler aynen geçerlidir. Bitmiş görevler sabittir,
// başlamış görevlerde yalnız kalan kısım oynar. Kaynak seviyelemesi yinelemelerde yeniden yapılmaz (kayıtlı
// seviyeleme gecikmeleri kalır). Süreler motorun çözünürlüğünde, tam iş gününe yuvarlanır.

/** Tohumlu sözde rastgele sayı üreteci (mulberry32): [0, 1) */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Üçgen dağılım (ters dağılım işleviyle): a ≤ m ≤ b */
export function triangular(a: number, m: number, b: number, u: number): number {
  if (b <= a) return a;
  const f = (m - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
}

/** Gama(k, 1) örneği (Marsaglia–Tsang); k < 1 için güçlendirme */
function gamma(k: number, next: () => number): number {
  if (k < 1) return gamma(k + 1, next) * Math.pow(next() || 1e-12, 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      // Box–Muller ile standart normal
      x = Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = next();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u || 1e-12) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** PERT (beta) dağılımı: ortalama (a + 4m + b) / 6 */
export function pert(a: number, m: number, b: number, next: () => number): number {
  if (b <= a) return a;
  const alpha = 1 + (4 * (m - a)) / (b - a);
  const beta = 1 + (4 * (b - m)) / (b - a);
  const x = gamma(alpha, next);
  const y = gamma(beta, next);
  return a + ((b - a) * x) / (x + y);
}

export function sample(dist: Distribution, a: number, m: number, b: number, next: () => number): number {
  return dist === "pert" ? pert(a, m, b, next) : triangular(a, m, b, next());
}

/** Görevin (kalan) süre aralığı: tahmin varsa o, yoksa süre ± proje geneli belirsizlik */
export function durationRange(task: Task, s: Pick<SimulationSettings, "uncertaintyLow" | "uncertaintyHigh">): [number, number, number] {
  const e = task.estimate;
  if (e) return [e.optimistic, e.likely, e.pessimistic];
  const d = task.duration;
  return [d * (1 - s.uncertaintyLow / 100), d, d * (1 + s.uncertaintyHigh / 100)];
}

/** Girdi parmak izi: plan, riskler ya da ayarlar değişince değişir (kayıtlı sonucun güncelliği) */
export function simulationFingerprint(p: Project, settings: SimulationSettings): string {
  const input = JSON.stringify([
    p.start,
    normalizeWorkdays(p.workdays),
    p.holidays.map((h) => `${h.date}${h.halfDay ? "½" : ""}`).sort(),
    p.halfDayMode === "half",
    p.blackouts,
    p.overheadPercent,
    p.hoursPerDay,
    p.resources,
    p.tasks.map((t) => [t.id, t.duration, t.outline, t.predecessors, t.constraint, t.percent, t.actualStart, t.actualFinish, t.assignments, t.fixedCost, t.blackouts, t.levelingDelay, t.estimate]),
    (p.risks ?? []).map((r) => [r.id, r.status, r.probability, r.chance, r.tasks]),
    settings,
  ]);
  // FNV-1a, iki farklı başlangıçla (64 bit)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export const settingsOf = (p: Project): SimulationSettings => p.simulation ?? DEFAULT_SIMULATION;

/** Kayıtlı sonuç güncel mi */
export function resultIsCurrent(p: Project): boolean {
  return !!p.simResult && p.simResult.fingerprint === simulationFingerprint(p, settingsOf(p));
}

export interface SimulationRun {
  summary: SimulationSummary;
  /** Her yinelemenin bitiş ofseti (hariç) ve maliyeti; histogram için */
  finishes: Float64Array;
  costs: Float64Array;
  /** Ofset → tarih (bitiş günü) */
  dateOf: (finishOffset: number) => string;
}

export interface SimulationOptions {
  /** Yineleme sayısını ayarlardan bağımsız sınırlar (test, önizleme) */
  iterations?: number;
  /** Her `every` yinelemede bir çağrılır; false dönerse benzetim durur (iptal) */
  onProgress?: (done: number, total: number) => boolean | void;
  every?: number;
  /** Sonucun zaman damgası (test için) */
  now?: Date;
}

const quantile = (sorted: ArrayLike<number>, q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];

/** Benzetimi çalıştırır. İptal edilirse null döner. */
export function simulate(p: Project, settings: SimulationSettings = settingsOf(p), opts: SimulationOptions = {}): SimulationRun | null {
  const base = schedule(p);
  const total = Math.max(1, Math.round(opts.iterations ?? settings.iterations));
  const next = rng(settings.seed);
  const leaves = p.tasks.flatMap((t, i) => (base.rows[i].isSummary ? [] : [i]));
  // Maliyet süreyle doğrusaldır: c(d) = sabit + gün başı × d
  const cost0 = p.tasks.map((t) => taskCost(t, p, 0));
  const perDay = p.tasks.map((t, i) => taskCost(t, p, 1) - cost0[i]);
  const planCost = leaves.reduce((a, i) => a + cost0[i] + perDay[i] * p.tasks[i].duration, 0);
  // Görev başına çekiliş: bitmiş görev sabit; başlamışta yalnız kalan oynar; kilometre taşı sabit
  const plans = leaves.map((i) => {
    const t = p.tasks[i];
    const done = t.percent >= 100 || !!t.actualFinish;
    const fixed = done || t.duration <= 0 ? t.duration : (t.duration * t.percent) / 100;
    const range = durationRange(t, settings).map((v) => (v * (100 - (done ? 100 : t.percent))) / 100) as [number, number, number];
    return { i, fixed, range, variable: !done && t.duration > 0 };
  });
  const risks = settings.includeRisks ? activeRisks(p) : [];
  const leafSet = new Set(leaves.map((i) => p.tasks[i].id));
  const indexOf = new Map(p.tasks.map((t, i) => [t.id, i]));
  const riskLinks = risks.map((r) => ({
    chance: riskChance(r),
    // Bitmiş göreve risk etkisi yazılmaz
    links: r.tasks.flatMap((x) => {
      const i = indexOf.get(x.taskId);
      const t = i === undefined ? undefined : p.tasks[i];
      return i !== undefined && t && leafSet.has(t.id) && t.percent < 100 && !t.actualFinish ? [{ i, days: x.days, cost: x.cost }] : [];
    }),
  }));

  const finishes = new Float64Array(total);
  const costs = new Float64Array(total);
  const critical = new Float64Array(p.tasks.length);
  // Pearson korelasyonu için toplamlar (görev süresi ↔ proje bitişi)
  const sx = new Float64Array(p.tasks.length);
  const sxx = new Float64Array(p.tasks.length);
  const sxy = new Float64Array(p.tasks.length);
  const trig = new Float64Array(risks.length);
  const trigF = new Float64Array(risks.length);
  let sy = 0;
  let syy = 0;
  const dur = new Float64Array(p.tasks.length);
  const fired = new Uint8Array(risks.length);
  const dates = new Map<number, string>();
  const every = Math.max(1, opts.every ?? 250);
  let n = 0;
  for (; n < total; n++) {
    if (opts.onProgress && n % every === 0 && n > 0 && opts.onProgress(n, total) === false) return null;
    for (const pl of plans) {
      const d = pl.variable ? pl.fixed + sample(settings.distribution, pl.range[0], pl.range[1], pl.range[2], next) : pl.fixed;
      dur[pl.i] = d;
    }
    let extraCost = 0;
    riskLinks.forEach((r, k) => {
      fired[k] = next() < r.chance ? 1 : 0;
      if (!fired[k]) return;
      trig[k]++;
      for (const l of r.links) {
        dur[l.i] += l.days;
        extraCost += l.cost;
      }
    });
    const tasks = p.tasks.map((t, i) => {
      if (base.rows[i].isSummary) return t;
      // Motor tam iş günüyle çalışır; süreli görev en az 1 gün kalır
      const d = t.duration > 0 || dur[i] > 0 ? Math.max(1, Math.round(dur[i])) : 0;
      dur[i] = d;
      return d === t.duration ? t : { ...t, duration: d };
    });
    const s: Schedule = schedule({ ...p, tasks });
    const f = s.finish;
    if (!dates.has(f)) dates.set(f, s.finishDate);
    let c = extraCost;
    for (const i of leaves) {
      c += cost0[i] + perDay[i] * dur[i];
      if (s.rows[i].critical) critical[i]++;
      sx[i] += dur[i];
      sxx[i] += dur[i] * dur[i];
      sxy[i] += dur[i] * f;
    }
    finishes[n] = f;
    costs[n] = c;
    sy += f;
    syy += f * f;
    riskLinks.forEach((_, k) => fired[k] && (trigF[k] += f));
  }
  opts.onProgress?.(total, total);

  const dateOf = (f: number) => dates.get(f) ?? (f > 0 ? base.calendar.toDate(f - 1) : base.calendar.base);
  const fs = Float64Array.from(finishes).sort();
  const cs = Float64Array.from(costs).sort();
  const meanF = sy / n;
  const meanC = cs.reduce((a, b) => a + b, 0) / n;
  const pick = (q: number) => dateOf(quantile(fs, q));
  const cq = (q: number) => Math.round(quantile(cs, q));
  // Olasılık eğrisi: her farklı bitiş günü (çok fazlaysa en çok 80 nokta)
  const uniq: { date: string; p: number }[] = [];
  for (let k = 0; k < n; k++) if (k === n - 1 || fs[k + 1] !== fs[k]) uniq.push({ date: dateOf(fs[k]), p: (k + 1) / n });
  const finishCdf = uniq.length <= 80 ? uniq : Array.from({ length: 80 }, (_, j) => uniq[Math.round((j * (uniq.length - 1)) / 79)]);
  const costCdf = Array.from({ length: 41 }, (_, j) => ({ cost: Math.round(quantile(cs, j / 40 || 1 / n)), p: j / 40 })).map((x, j) => (j === 0 ? { cost: Math.round(cs[0]), p: 1 / n } : x));
  const varY = syy / n - meanF * meanF;
  const tasks = leaves
    .filter((i) => plans.some((pl) => pl.i === i && pl.variable) || critical[i] > 0)
    .map((i) => {
      const mx = sx[i] / n;
      const cov = sxy[i] / n - mx * meanF;
      const varX = sxx[i] / n - mx * mx;
      const corr = varX > 1e-12 && varY > 1e-12 ? cov / Math.sqrt(varX * varY) : 0;
      return { id: p.tasks[i].id, criticality: round3(critical[i] / n), correlation: round3(corr) };
    });
  const riskStats = risks.map((r, k) => {
    const hit = trig[k];
    // Tetiklendiğinde ve tetiklenmediğinde ortalama bitiş farkı (iş günü)
    const delay = hit > 0 && hit < n ? trigF[k] / hit - (sy - trigF[k]) / (n - hit) : 0;
    return { id: r.id, triggered: round3(hit / n), delay: Math.round(delay * 10) / 10, cost: riskLinks[k].links.reduce((a, l) => a + l.cost, 0) };
  });
  const summary: SimulationSummary = {
    fingerprint: simulationFingerprint(p, settings),
    at: (opts.now ?? new Date()).toISOString(),
    iterations: n,
    seed: settings.seed,
    distribution: settings.distribution,
    planFinish: base.finishDate,
    planCost: Math.round(planCost),
    onTime: round3(countAtMost(fs, base.finish) / n),
    onBudget: round3(countAtMost(cs, planCost + 0.005) / n),
    finish: { p10: pick(0.1), p50: pick(0.5), p80: pick(0.8), p90: pick(0.9), p95: pick(0.95), mean: dateOf(Math.round(meanF)), min: dateOf(fs[0]), max: dateOf(fs[n - 1]) },
    cost: { p10: cq(0.1), p50: cq(0.5), p80: cq(0.8), p90: cq(0.9), p95: cq(0.95), mean: Math.round(meanC), min: Math.round(cs[0]), max: Math.round(cs[n - 1]) },
    finishCdf,
    costCdf,
    tasks,
    risks: riskStats,
  };
  return { summary, finishes, costs, dateOf };
}

function countAtMost(sorted: Float64Array, v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

// --- Grafik verisi (saf): kaydedilmiş özetten histogram üretir ---

export interface Bucket {
  /** Dönemin ilk günü (tarih) ya da maliyet aralığının alt sınırı */
  from: string | number;
  to: string | number;
  /** O dönemde/aralıkta bitme olasılığı ve birikimli olasılık (0–1) */
  p: number;
  cumulative: number;
}

/** Bitiş olasılık eğrisini haftalara (kısa aralıkta günlere) böler; weekStart 0 = pazar, 1 = pazartesi */
export function finishBuckets(cdf: { date: string; p: number }[], weekStart = 1): Bucket[] {
  if (!cdf.length) return [];
  const first = cdf[0].date;
  const last = cdf[cdf.length - 1].date;
  const span = Math.round((parseDate(last).getTime() - parseDate(first).getTime()) / 86_400_000);
  const step = span <= 21 ? 1 : 7;
  const startOf = (iso: string) => (step === 1 ? iso : addDays(iso, -((parseDate(iso).getUTCDay() - weekStart + 7) % 7)));
  const out: Bucket[] = [];
  let k = 0;
  let cum = 0;
  for (let d = startOf(first); d <= last; d = addDays(d, step)) {
    const to = addDays(d, step - 1);
    while (k < cdf.length && cdf[k].date <= to) cum = cdf[k++].p;
    out.push({ from: d, to, p: cum - (out.length ? out[out.length - 1].cumulative : 0), cumulative: cum });
  }
  return out;
}

/** Maliyet dağılımını eşit genişlikte aralıklara böler (olasılık eğrisinden doğrusal ara değer) */
export function costBins(cdf: { cost: number; p: number }[], bins = 12): Bucket[] {
  if (!cdf.length) return [];
  const lo = cdf[0].cost;
  const hi = cdf[cdf.length - 1].cost;
  if (hi <= lo) return [{ from: lo, to: hi, p: 1, cumulative: 1 }];
  const F = (c: number) => {
    if (c <= lo) return 0;
    if (c >= hi) return 1;
    const j = cdf.findIndex((x) => x.cost >= c);
    const a = cdf[j - 1];
    const b = cdf[j];
    return b.cost === a.cost ? b.p : a.p + ((c - a.cost) / (b.cost - a.cost)) * (b.p - a.p);
  };
  const w = (hi - lo) / bins;
  return Array.from({ length: bins }, (_, i) => {
    const from = lo + i * w;
    const to = i === bins - 1 ? hi : from + w;
    return { from: Math.round(from), to: Math.round(to), p: F(to) - (i ? F(from) : 0), cumulative: F(to) };
  });
}
