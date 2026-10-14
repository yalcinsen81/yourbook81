import { describe, expect, it } from "vitest";
import { exposure, removeRisk, riskChance, riskLevel, riskMatrix, risksByTask, toRisk, upsertRisk, validEstimate } from "../risks";
import { planQuality } from "../quality";
import { schedule } from "../schedule";
import { costBins, finishBuckets, pert, resultIsCurrent, rng, simulate, simulationFingerprint, triangular } from "../simulation";
import { buildReport } from "../reports";
import { sanitizeProject } from "../storage";
import { PROJECT_VERSION, type Project, type Risk, type SimulationSettings } from "../types";
import { referenceProject } from "./fixtures/reference";

const NO_UNCERTAINTY: SimulationSettings = { iterations: 200, distribution: "triangular", uncertaintyLow: 0, uncertaintyHigh: 0, seed: 7, includeRisks: true };

const risk = (over: Partial<Risk> = {}): Risk => ({ id: "R1", title: "Zemin suyu", probability: 3, impact: 4, status: "open", tasks: [], ...over });

describe("D referans proje (regresyon, Faz 2D)", () => {
  it("sürüm 6; bitiş 2027-03-01, maliyet 635.000; eski dosya risksiz açılır", () => {
    const p = sanitizeProject({ ...referenceProject(), version: 5 })!;
    expect(PROJECT_VERSION).toBeGreaterThanOrEqual(6);
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.risks).toBeUndefined();
    expect(schedule(p).finishDate).toBe("2027-03-01");
  });

  it("belirsizlik ve risk yokken tüm yüzdelikler plana eşit", () => {
    const run = simulate(referenceProject(), NO_UNCERTAINTY)!;
    const s = run.summary;
    expect(s.planFinish).toBe("2027-03-01");
    expect(s.planCost).toBe(635_000);
    expect([s.finish.p10, s.finish.p50, s.finish.p80, s.finish.p95, s.finish.max]).toEqual(Array(5).fill("2027-03-01"));
    expect([s.cost.p50, s.cost.p95]).toEqual([635_000, 635_000]);
    expect(s.onTime).toBe(1);
    expect(s.onBudget).toBe(1);
    // Zincirdeki her görev her yinelemede kritik
    expect(s.tasks.every((x) => x.criticality === 1)).toBe(true);
  });
});

describe("D1 risk sicili", () => {
  it("maruziyet, düzey, olasılık yüzdesi", () => {
    expect(exposure({ probability: 4, impact: 5 })).toBe(20);
    expect([riskLevel(4), riskLevel(5), riskLevel(12), riskLevel(16)]).toEqual(["low", "medium", "high", "critical"]);
    expect(riskChance({ probability: 3 })).toBe(0.5);
    expect(riskChance({ probability: 3, chance: 15 })).toBe(0.15);
  });

  it("matris kapanan riskleri saymaz; görev → risk eşlemesi", () => {
    const p = referenceProject();
    const risks = [risk({ tasks: [{ taskId: "ref-2", days: 5, cost: 0 }] }), risk({ id: "R2", probability: 1, impact: 1, status: "closed", tasks: [{ taskId: "ref-2", days: 1, cost: 0 }] })];
    const m = riskMatrix(risks);
    expect(m[3][4]).toEqual(["R1"]);
    expect(m[1][1]).toEqual([]);
    expect(risksByTask({ ...p, risks }).get("ref-2")!.map((r) => r.id)).toEqual(["R1"]);
  });

  it("dosyadan okuma: bozuk alanlar düzeltilir, olmayan göreve bağ atılır, kopya kimlik atılır", () => {
    const ids = new Set(["a"]);
    const r = toRisk({ id: "R9", title: " Vinç arızası ", probability: 9, impact: 0, status: "x", response: "mitigate", review: "2026-13-01", tasks: [{ taskId: "a", days: -2, cost: 500 }, { taskId: "yok", days: 3 }] }, ids)!;
    expect(r).toEqual({ id: "R9", title: "Vinç arızası", probability: 5, impact: 1, status: "open", response: "mitigate", tasks: [{ taskId: "a", days: 0, cost: 500 }] });
    expect(toRisk({ id: "R1" }, ids)).toBeUndefined();
    const p = sanitizeProject({ ...referenceProject(), risks: [risk(), risk(), { id: "R2", title: "x" }], tasks: referenceProject().tasks.map((t, i) => (i === 1 ? { ...t, estimate: { optimistic: 20, likely: 25, pessimistic: 40 } } : i === 2 ? { ...t, estimate: { optimistic: 12, likely: 10, pessimistic: 9 } } : t)) })!;
    expect(p.risks!.map((x) => x.id)).toEqual(["R1", "R2"]);
    expect(p.tasks[1].estimate).toEqual({ optimistic: 20, likely: 25, pessimistic: 40 });
    expect(p.tasks[2].estimate).toBeUndefined();
    expect(validEstimate({ optimistic: 1, likely: 1, pessimistic: 1 })).toBe(true);
  });

  it("ekle, değiştir, sil", () => {
    let p = upsertRisk(referenceProject(), risk({ tasks: [{ taskId: "ref-1", days: 2, cost: 0 }] }));
    p = upsertRisk(p, risk({ title: "Değişti" }));
    expect(p.risks!.map((r) => r.title)).toEqual(["Değişti"]);
    expect(removeRisk(p, "R1").risks).toBeUndefined();
  });
});

describe("D2 benzetim", () => {
  it("aynı tohum aynı sonuç, farklı tohum farklı", () => {
    const p = referenceProject();
    const s: SimulationSettings = { ...NO_UNCERTAINTY, uncertaintyLow: 10, uncertaintyHigh: 30, iterations: 300 };
    const a = simulate(p, s, { now: new Date(0) })!.summary;
    const b = simulate(p, s, { now: new Date(0) })!.summary;
    const c = simulate(p, { ...s, seed: 8 }, { now: new Date(0) })!.summary;
    expect(a).toEqual(b);
    expect(c.cost.mean).not.toBe(a.cost.mean);
    // Kötümser taraf geniş: plan tutma olasılığı yarının altında, P95 plandan geç
    expect(a.onTime).toBeLessThan(0.5);
    expect(a.finish.p95 > a.planFinish).toBe(true);
    expect(a.finish.p10 <= a.finish.p50 && a.finish.p50 <= a.finish.p80 && a.finish.p80 <= a.finish.p95).toBe(true);
    expect(a.cost.p10).toBeLessThanOrEqual(a.cost.p95);
    // Olasılık eğrisi artan ve 1'de biter
    expect(a.finishCdf.at(-1)!.p).toBe(1);
    expect(a.finishCdf.every((x, i) => i === 0 || x.p >= a.finishCdf[i - 1].p)).toBe(true);
  });

  it("%100 olasılıklı +5 günlük risk kritik görevde bitişi 5 iş günü kaydırır ve maliyeti ekler", () => {
    const p: Project = { ...referenceProject(), risks: [risk({ chance: 100, tasks: [{ taskId: "ref-3", days: 5, cost: 20_000 }] })] };
    const s = simulate(p, NO_UNCERTAINTY)!.summary;
    // 2027-03-01 Pzt + 5 iş günü = 2027-03-08 Pzt
    expect(s.finish.p50).toBe("2027-03-08");
    expect(s.finish.min).toBe("2027-03-08");
    expect(s.onTime).toBe(0);
    // Çatı ekibi günlük 6.000: 5 gün × 6.000 + 20.000
    expect(s.cost.p50).toBe(635_000 + 30_000 + 20_000);
    expect(s.risks).toEqual([{ id: "R1", triggered: 1, delay: 0, cost: 20_000 }]);
    // Risk kapatılınca etkisi yok; dahil edilmezse de yok
    expect(simulate({ ...p, risks: [{ ...p.risks![0], status: "closed" }] }, NO_UNCERTAINTY)!.summary.finish.p50).toBe("2027-03-01");
    expect(simulate(p, { ...NO_UNCERTAINTY, includeRisks: false })!.summary.finish.p50).toBe("2027-03-01");
  });

  it("%50 riskte tetiklenme oranı ve tetiklenince gecikme", () => {
    const p: Project = { ...referenceProject(), risks: [risk({ chance: 50, tasks: [{ taskId: "ref-3", days: 5, cost: 0 }] })] };
    const s = simulate(p, { ...NO_UNCERTAINTY, iterations: 2000 })!.summary;
    expect(s.risks[0].triggered).toBeGreaterThan(0.45);
    expect(s.risks[0].triggered).toBeLessThan(0.55);
    expect(s.risks[0].delay).toBe(5);
    expect(s.onTime).toBeCloseTo(1 - s.risks[0].triggered, 3);
  });

  it("bitmiş görev sabit kalır, başlamışta yalnız kalan oynar", () => {
    const base = referenceProject();
    const p: Project = { ...base, tasks: base.tasks.map((t, i) => (i === 0 ? { ...t, percent: 100 } : i === 1 ? { ...t, percent: 60 } : t)) };
    const run = simulate(p, { ...NO_UNCERTAINTY, uncertaintyHigh: 100, iterations: 300 })!;
    const crit = new Map(run.summary.tasks.map((x) => [x.id, x]));
    // Bitmiş görevin süresi değişmediği için korelasyonu 0
    expect(crit.get("ref-1")?.correlation ?? 0).toBe(0);
    // Kaba yapı en uzun görev ama %60'ı bitti: sürükleyicilik payı Sıva'dan (20 g, hiç başlamamış) az
    expect(crit.get("ref-2")!.correlation).toBeLessThan(crit.get("ref-5")!.correlation);
  });

  it("görev tahmini (O/ML/P) proje genelinin yerine geçer", () => {
    const base = referenceProject();
    const p: Project = { ...base, tasks: base.tasks.map((t, i) => (i === 5 ? { ...t, estimate: { optimistic: 10, likely: 10, pessimistic: 10 } } : t)) };
    // Snag list 5 → 10 gün, kesin
    expect(simulate(p, NO_UNCERTAINTY)!.summary.finish.p50).toBe("2027-03-08");
  });

  it("dağılımların ortalaması formüle uyar", () => {
    const next = rng(42);
    let tri = 0;
    let pt = 0;
    const N = 40_000;
    for (let k = 0; k < N; k++) {
      tri += triangular(2, 5, 14, next());
      pt += pert(2, 5, 14, next);
    }
    expect(tri / N).toBeCloseTo((2 + 5 + 14) / 3, 1);
    expect(pt / N).toBeCloseTo((2 + 4 * 5 + 14) / 6, 1);
    expect(triangular(3, 3, 3, 0.7)).toBe(3);
  });

  it("parmak izi plan ya da ayar değişince değişir; iptal null döner", () => {
    const p = referenceProject();
    const f = simulationFingerprint(p, NO_UNCERTAINTY);
    expect(simulationFingerprint(p, NO_UNCERTAINTY)).toBe(f);
    expect(simulationFingerprint(p, { ...NO_UNCERTAINTY, seed: 2 })).not.toBe(f);
    expect(simulationFingerprint({ ...p, tasks: p.tasks.map((t, i) => (i ? t : { ...t, duration: 11 })) }, NO_UNCERTAINTY)).not.toBe(f);
    const saved: Project = { ...p, simulation: NO_UNCERTAINTY, simResult: simulate(p, NO_UNCERTAINTY)!.summary };
    expect(resultIsCurrent(saved)).toBe(true);
    expect(resultIsCurrent({ ...saved, risks: [risk()] })).toBe(false);
    expect(simulate(p, NO_UNCERTAINTY, { every: 50, onProgress: (done) => done < 100 })).toBeNull();
    // Kayıt ve yeniden okuma
    const back = sanitizeProject(JSON.parse(JSON.stringify(saved)))!;
    expect(back.simResult).toEqual(saved.simResult);
    expect(resultIsCurrent(back)).toBe(true);
  });
});

describe("D3 plan kalite denetimi", () => {
  const by = (p: Project, today: string) => Object.fromEntries(planQuality(p, schedule(p), today).map((c) => [c.key, c]));

  it("referans proje: zincir mantığı tam; maliyetsiz Snag list ve geçmişte kalmış başlangıçlar işaretlenir", () => {
    const q = by(referenceProject(), "2026-11-20");
    expect(q.logic).toMatchObject({ count: 0, total: 6, pass: true });
    expect(q.leads.pass && q.lags.pass && q.relationTypes.pass && q.hardConstraints.pass).toBe(true);
    expect(q.resources).toMatchObject({ rows: [6], pass: false });
    // 20.11'de 1. görev başlamış olmalıydı (%0)
    expect(q.invalidDates.rows).toEqual([1, 2]);
    expect(q.missedTasks.skipped).toBe(true);
  });

  it("öncülsüz/ardılsız görev, öne çekme, sert kısıt, uzun süre, kaçırılan görev", () => {
    const base = referenceProject();
    const p: Project = {
      ...base,
      tasks: [
        ...base.tasks.map((t, i) =>
          i === 2 ? { ...t, predecessors: [{ ...t.predecessors[0], lag: -2 }] } : i === 3 ? { ...t, constraint: { type: "MSO" as const, date: "2027-01-05" } } : i === 4 ? { ...t, duration: 50 } : t,
        ),
        { id: "x", name: "Boşta", duration: 3, outline: 0, percent: 0, predecessors: [] },
      ],
    };
    const withBase = { ...p, baselines: [{ index: 0, name: "İlk", savedAt: "2026-11-01", finish: "2027-03-01", tasks: { "ref-1": { start: "2026-11-02", finish: "2026-11-13", duration: 10, cost: 0 } } }] };
    const q = by(withBase, "2026-11-20");
    expect(q.logic.rows).toEqual([7]);
    expect(q.leads.rows).toEqual([3]);
    expect(q.hardConstraints.rows).toEqual([4]);
    expect(q.highDuration.rows).toEqual([5]);
    expect(q.highFloat.rows).toContain(7);
    expect(q.missedTasks).toMatchObject({ count: 1, total: 1, pass: false });
  });
});

describe("D4 grafik verisi ve raporlar", () => {
  it("bitiş eğrisi haftalara bölünür; olasılıklar toplamı 1", () => {
    const cdf = [
      { date: "2027-03-01", p: 0.2 },
      { date: "2027-03-04", p: 0.5 },
      { date: "2027-03-10", p: 0.9 },
      { date: "2027-04-02", p: 1 },
    ];
    const b = finishBuckets(cdf, 1);
    expect(b[0]).toMatchObject({ from: "2027-03-01", to: "2027-03-07", cumulative: 0.5 });
    expect(b[1]).toMatchObject({ from: "2027-03-08", cumulative: 0.9 });
    expect(b.reduce((a, x) => a + x.p, 0)).toBeCloseTo(1, 9);
    expect(b[b.length - 1].cumulative).toBe(1);
    // Kısa aralıkta günlük
    expect(finishBuckets([{ date: "2027-03-01", p: 0.4 }, { date: "2027-03-03", p: 1 }]).map((x) => x.p)).toEqual([0.4, 0, 0.6]);
  });

  it("maliyet aralıkları eşit genişlikte; tek değerde tek çubuk", () => {
    const cdf = Array.from({ length: 41 }, (_, j) => ({ cost: 1000 + j * 25, p: j / 40 }));
    const bins = costBins(cdf, 10);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toMatchObject({ from: 1000, to: 1100 });
    bins.forEach((b) => expect(b.p).toBeCloseTo(0.1, 6));
    expect(costBins([{ cost: 5, p: 1 }])).toEqual([{ from: 5, to: 5, p: 1, cumulative: 1 }]);
  });

  it("risk sicili, benzetim özeti ve plan kalitesi raporları", () => {
    const base = referenceProject();
    let p: Project = upsertRisk(base, risk({ id: "R1", probability: 2, impact: 2, tasks: [{ taskId: "ref-3", days: 2, cost: 1000 }] }));
    p = upsertRisk(p, risk({ id: "R2", title: "Vinç arızası", probability: 5, impact: 4, response: "mitigate", tasks: [{ taskId: "ref-2", days: 3, cost: 0 }] }));
    const s = schedule(p);
    const opts = { today: "2026-11-20" };
    const reg = buildReport("risks", p, s, opts);
    expect(reg.rows.map((r) => r.id)).toEqual(["R2", "R1"]);
    expect(reg.rows[0]).toMatchObject({ exposure: 20, chance: 90, days: 3 });
    expect(reg.rows[1].tasks).toBe("3. " + p.tasks[2].name);
    expect(buildReport("simulation", p, s, opts).rows).toEqual([]);
    const run = simulate(p, { ...NO_UNCERTAINTY, iterations: 300 })!;
    const withRun = { ...p, simulation: { ...NO_UNCERTAINTY, iterations: 300 }, simResult: run.summary };
    const sim = buildReport("simulation", withRun, s, opts);
    expect(sim.rows[0]).toMatchObject({ finish: "2027-03-01", cost: 635_000 });
    expect(sim.rows).toHaveLength(9);
    expect(sim.notes!.length).toBeGreaterThanOrEqual(2);
    const q = buildReport("quality", p, s, opts);
    expect(q.rows).toHaveLength(11);
  });
});
