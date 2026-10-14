import { describe, expect, it } from "vitest";
import { curveAtDate, curveSamples, progressCurves } from "../resources";
import { schedule } from "../schedule";
import type { Project } from "../types";
import { REFERENCE_DATES, referenceProject } from "./fixtures/reference";

const round2 = (n: number) => Math.round(n * 100) / 100;

function withPercents(p: Project, percents: Record<number, number>): Project {
  return { ...p, tasks: p.tasks.map((t, i) => (percents[i + 1] !== undefined ? { ...t, percent: percents[i + 1] } : t)) };
}

describe("referans proje (regresyon)", () => {
  it("tarihler, bitiş ve toplam maliyet değişmez", () => {
    const p = referenceProject();
    const s = schedule(p);
    expect(s.rows.map((r) => [r.startDate, r.finishDate])).toEqual(REFERENCE_DATES);
    expect(s.finishDate).toBe("2027-03-01");
    expect(progressCurves(p, s, "2026-10-13").totalCost).toBe(635_000);
  });
});

describe("Madde 1: tek ağırlıkla ilerleme", () => {
  it("maliyet ağırlığı varsayılandır; planlanan % = planlanan maliyet / toplam maliyet", () => {
    const p = referenceProject();
    const s = schedule(p);
    const c = progressCurves(p, s, "2026-10-13");
    expect(c.weight).toBe("cost");
    const at = (d: string) => round2(curveAtDate(c, s.calendar, d).planned);
    expect(at("2026-11-13")).toBe(13.39);
    expect(at("2026-12-18")).toBe(52.76);
    expect(at("2027-01-25")).toBe(77.32);
    expect(at("2027-02-22")).toBe(100);
    // İki eksen aynı ağırlıkta: her noktada yüzde = maliyet / toplam
    for (const pt of c.points) expect(pt.planned).toBeCloseTo((pt.cost / c.totalCost) * 100, 9);
  });

  it("hepsi %100 ise gerçekleşen %100 ve kazanılan değer 635.000", () => {
    const p = withPercents(referenceProject(), { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 });
    const c = progressCurves(p, schedule(p), "2027-03-02");
    expect(c.earnedPercent).toBe(100);
    expect(c.earnedCost).toBe(635_000);
  });

  it("yalnızca görev 2 %50 ise kazanılan değer 125.000, gerçekleşen aynı ağırlıkta", () => {
    const p = withPercents(referenceProject(), { 2: 50 });
    const c = progressCurves(p, schedule(p), "2026-12-01");
    expect(c.earnedCost).toBe(125_000);
    expect(c.earnedPercent).toBeCloseTo((125_000 / 635_000) * 100, 9);
  });

  it("süre ve iş ağırlıkları seçilebilir", () => {
    const p = referenceProject();
    const s = schedule(p);
    const dur = progressCurves(p, s, "2026-10-13", "duration");
    expect(round2(curveAtDate(dur, s.calendar, "2026-11-13").planned)).toBe(11.76); // 10 / 85 iş günü
    const work = progressCurves({ ...p, progressWeight: "work" }, s, "2026-10-13");
    expect(work.weight).toBe("work");
    // İş: kaynaklı görevler 80 adam-gün; Snag list'in işi yok
    expect(round2(curveAtDate(work, s.calendar, "2026-11-13").planned)).toBe(12.5);
  });

  it("maliyet hiç yoksa süreye düşer ve bunu bildirir", () => {
    const p = { ...referenceProject(), resources: [] };
    const c = progressCurves(p, schedule(p), "2026-10-13");
    expect(c.weight).toBe("duration");
    expect(c.weightFallback).toBe(true);
  });

  it("maliyeti olmayan görevler listelenir", () => {
    const p = referenceProject();
    expect(progressCurves(p, schedule(p), "2026-10-13").zeroCostRows).toEqual([6]);
  });
});

describe("Madde 2: eğri örnekleri takvim haftasına sabit", () => {
  it("başlangıç, her cuma, bitiş; artan ve tekrarsız; %0 ile başlar %100 ile biter", () => {
    const p = referenceProject();
    const s = schedule(p);
    const samples = curveSamples(progressCurves(p, s, "2026-10-13"), s, "2026-10-13");
    const dates = samples.map((x) => x.date);
    expect(dates[0]).toBe("2026-11-02");
    expect(dates.slice(1, 3)).toEqual(["2026-11-06", "2026-11-13"]);
    expect(dates.slice(-2)).toEqual(["2027-02-26", "2027-03-01"]);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
    expect(samples[0].plannedPercent).toBe(0);
    expect(samples[samples.length - 1].plannedPercent).toBe(100);
    // Tatil olan 1 Ocak cuması da nokta; değeri 31 Aralık ile aynı
    const i = dates.indexOf("2026-12-25");
    expect(dates[i + 1]).toBe("2027-01-01");
    expect(samples[i + 1].plannedPercent).toBe(curveAtDate(progressCurves(p, s, "2026-10-13"), s.calendar, "2026-12-31").planned);
    // Ortadaki noktaların hepsi cuma
    for (const d of dates.slice(1, -1)) expect(new Date(`${d}T00:00:00Z`).getUTCDay()).toBe(5);
  });

  it("bugün aralıktaysa eklenir", () => {
    const p = referenceProject();
    const s = schedule(p);
    const dates = curveSamples(progressCurves(p, s, "2026-12-02"), s, "2026-12-02").map((x) => x.date);
    expect(dates).toContain("2026-12-02");
    expect([...dates].sort()).toEqual(dates);
  });
});
