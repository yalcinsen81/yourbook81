import { describe, expect, it } from "vitest";
import { baselineVariance, clearBaseline, saveBaseline } from "../baseline";
import { accrualShares, taskCostBreakdown } from "../costs";
import { initHistory, push, redo, undo } from "../history";
import { clearLeveling, levelByDelay, overallocations, proposeLeveling } from "../leveling";
import { cycleError, listTasks, projectSummary, updateTask, withActualFinish, withPercent, withRemaining } from "../ops";
import { cloneRows, insertRows, moveBlockTo } from "../outline";
import { progressCurves, resourceUsage } from "../resources";
import { schedule } from "../schedule";
import { fileVersion, needsUpgradeBackup, sanitizeProject } from "../storage";
import type { LinkType, Project, Resource, Task } from "../types";
import { REFERENCE_DATES, referenceProject } from "./fixtures/reference";

const t = (id: string, duration: number, preds: string[] = [], extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  duration,
  outline: 0,
  percent: 0,
  predecessors: preds.map((p) => {
    const [taskId, type = "FS", lag = "0"] = p.split(":");
    return { taskId, type: type as LinkType, lag: Number(lag) };
  }),
  ...extra,
});
// 2026-10-12 pazartesi
const project = (tasks: Task[], extra: Partial<Project> = {}): Project => ({
  name: "p",
  start: "2026-10-12",
  tasks,
  holidays: [],
  resources: [],
  ...extra,
});
const res = (id: string, extra: Partial<Resource> = {}): Resource => ({ id, name: id, maxUnits: 100, rate: 0, ...extra });
const dates = (p: Project, id: string) => {
  const r = schedule(p).byId.get(id)!;
  return [r.startDate, r.finishDate];
};

describe("referans proje (regresyon, Faz 2B)", () => {
  it("bitiş 2027-03-01, tarihler ve toplam 635.000 değişmez; tüm görevler kritik", () => {
    const p = referenceProject();
    const s = schedule(p);
    expect(s.rows.map((r) => [r.startDate, r.finishDate])).toEqual(REFERENCE_DATES);
    expect(s.finishDate).toBe("2027-03-01");
    expect(s.rows.every((r) => r.critical)).toBe(true);
    expect(s.issues).toEqual([]);
    expect(projectSummary(p, "2026-10-13").totalCost).toBe(635_000);
    expect(progressCurves(p, s, "2026-10-13").totalCost).toBe(635_000);
  });

  it("sürüm 3 dosyası olarak kaydedilip açılınca aynı sonucu verir", () => {
    const raw = JSON.parse(JSON.stringify({ ...referenceProject(), version: 3 }));
    expect(needsUpgradeBackup(raw)).toBe(true);
    const p = sanitizeProject(raw)!;
    expect(p.version).toBe(4);
    expect(schedule(p).finishDate).toBe("2027-03-01");
    expect(projectSummary(p, "2026-10-13").totalCost).toBe(635_000);
  });

  it("yeni maliyet kalemleri toplamı doğru artırır", () => {
    const p = referenceProject();
    p.tasks[5].fixedCost = 10_000; // Snag list
    expect(projectSummary(p, "2026-10-13").totalCost).toBe(645_000);
    expect(projectSummary({ ...p, overheadPercent: 10 }, "2026-10-13").totalCost).toBe(709_500);
    expect(schedule(p).finishDate).toBe("2027-03-01");
  });
});

describe("B1 çalışma takvimi", () => {
  it("cumartesi çalışılan hafta", () => {
    expect(dates(project([t("a", 6)], { workdays: [1, 2, 3, 4, 5, 6] }), "a")).toEqual(["2026-10-12", "2026-10-17"]);
  });

  it("hafta sonuna denk gelen tatil iş günü sayısını bozmaz", () => {
    const p = project([t("a", 6)], { holidays: [{ date: "2026-10-17", name: "Cumartesi tatili" }] });
    expect(dates(p, "a")).toEqual(["2026-10-12", "2026-10-19"]);
  });

  it("arife yalnızca işaretse iş günü, yarım gün seçeneğinde yarım kapasite", () => {
    const holidays = [
      { date: "2026-10-28", name: "Arife", halfDay: true },
      { date: "2026-10-29", name: "Cumhuriyet Bayramı" },
    ];
    const base = project([t("a", 3)], { start: "2026-10-26", holidays });
    expect(dates(base, "a")).toEqual(["2026-10-26", "2026-10-28"]);
    const half = { ...base, halfDayMode: "half" as const };
    // 26 (1) + 27 (1) + 28 (0,5) + 30 (1): 3 güne ancak cuma ulaşılır
    expect(dates(half, "a")).toEqual(["2026-10-26", "2026-10-30"]);
    expect(schedule(half).capacity("a", 0, 4)).toBe(3.5);
  });

  it("kaynak takvimi: cumartesi çalışan ekip, ardılı proje takvimiyle pazartesi başlar", () => {
    const p = project([t("a", 6, [], { assignments: [{ resourceId: "R", units: 100 }] }), t("b", 1, ["a"]), t("c", 6)], {
      resources: [res("R", { workdays: [1, 2, 3, 4, 5, 6] })],
    });
    expect(dates(p, "a")).toEqual(["2026-10-12", "2026-10-17"]);
    expect(dates(p, "b")).toEqual(["2026-10-19", "2026-10-19"]);
    expect(dates(p, "c")).toEqual(["2026-10-12", "2026-10-19"]);
    // Cumartesi kaynak yükünde görünür
    const s = schedule(p);
    const sat = s.calendar.toOffset("2026-10-17");
    expect(resourceUsage(p, s)[0].load[sat]).toBe(100);
  });

  it("kaynak izni görevi uzatır; iki kaynakta ortak çalışma günleri kullanılır", () => {
    const leave = project([t("a", 3, [], { assignments: [{ resourceId: "R", units: 100 }] })], {
      resources: [res("R", { leaves: [{ from: "2026-10-14", to: "2026-10-15" }] })],
    });
    expect(dates(leave, "a")).toEqual(["2026-10-12", "2026-10-16"]);
    const both = project(
      [t("a", 6, [], { assignments: [{ resourceId: "R1", units: 100 }, { resourceId: "R2", units: 100 }] })],
      { resources: [res("R1", { workdays: [1, 2, 3, 4, 5, 6] }), res("R2")] },
    );
    expect(dates(both, "a")).toEqual(["2026-10-12", "2026-10-19"]);
  });

  it("çalışılamayan dönem yalnızca seçildiği göreve uygulanır", () => {
    const p = project([t("dis", 2, [], { blackouts: ["kis"] }), t("ic", 2)], {
      blackouts: [{ id: "kis", name: "Kış", from: "2026-10-13", to: "2026-10-14" }],
    });
    expect(dates(p, "dis")).toEqual(["2026-10-12", "2026-10-15"]);
    expect(dates(p, "ic")).toEqual(["2026-10-12", "2026-10-13"]);
  });

  it("ortak çalışma günü yoksa uyarır ve proje takvimini kullanır", () => {
    const p = project([t("a", 2, [], { assignments: [{ resourceId: "R1", units: 100 }, { resourceId: "R2", units: 100 }] })], {
      resources: [res("R1", { workdays: [1] }), res("R2", { workdays: [2] })],
    });
    const s = schedule(p);
    expect(s.issues).toEqual([{ taskId: "a", kind: "noWorkingTime" }]);
    expect(s.byId.get("a")!.finishDate).toBe("2026-10-13");
  });
});

describe("B2 kısıtlar ve son tarih", () => {
  it("MSO tarihe sabitler, öncülle çatışırsa uyarır", () => {
    const ok = project([t("a", 1), t("b", 2, ["a"], { constraint: { type: "MSO", date: "2026-10-14" } })]);
    expect(dates(ok, "b")).toEqual(["2026-10-14", "2026-10-15"]);
    expect(schedule(ok).issues).toEqual([]);
    const bad = project([t("a", 5), t("b", 2, ["a"], { constraint: { type: "MSO", date: "2026-10-14" } })]);
    expect(dates(bad, "b")).toEqual(["2026-10-14", "2026-10-15"]);
    expect(schedule(bad).issues).toEqual([{ taskId: "b", kind: "constraintLink" }]);
  });

  it("MFO, FNET, SNET", () => {
    expect(dates(project([t("a", 2, [], { constraint: { type: "MFO", date: "2026-10-16" } })]), "a")).toEqual(["2026-10-15", "2026-10-16"]);
    expect(dates(project([t("a", 2, [], { constraint: { type: "FNET", date: "2026-10-20" } })]), "a")).toEqual(["2026-10-19", "2026-10-20"]);
    expect(dates(project([t("a", 2, [], { constraint: { type: "SNET", date: "2026-10-17" } })]), "a")).toEqual(["2026-10-19", "2026-10-20"]);
  });

  it("SNLT ve FNLT aşılırsa uyarı ve negatif bolluk", () => {
    const p = project([t("a", 3), t("b", 1, ["a"], { constraint: { type: "SNLT", date: "2026-10-13" } })]);
    const s = schedule(p);
    expect(s.byId.get("b")!.startDate).toBe("2026-10-15");
    expect(s.issues).toEqual([{ taskId: "b", kind: "startLate" }]);
    expect(s.byId.get("b")!.slack).toBe(-2);
    expect(s.byId.get("b")!.critical).toBe(true);
    const f = schedule(project([t("a", 5, [], { constraint: { type: "FNLT", date: "2026-10-14" } })]));
    expect(f.issues).toEqual([{ taskId: "a", kind: "finishLate" }]);
  });

  it("son tarih aşılırsa uyarır ve bolluğu ona göre hesaplar", () => {
    const s = schedule(project([t("a", 5, [], { deadline: "2026-10-14" }), t("b", 10)]));
    expect(s.issues).toEqual([{ taskId: "a", kind: "deadline" }]);
    expect(s.byId.get("a")!.slack).toBe(-2);
    const ok = schedule(project([t("a", 5, [], { deadline: "2026-10-20" }), t("b", 10)]));
    expect(ok.issues).toEqual([]);
    expect(ok.byId.get("a")!.slack).toBe(2);
  });

  it("ALAP ardılını geciktirmeden olabildiğince geç başlar", () => {
    const p = project([
      t("b", 5),
      t("c", 1, [], { constraint: { type: "ALAP" } }),
      t("d", 1, ["b", "c"]),
      t("e", 2, [], { constraint: { type: "ALAP" } }),
    ]);
    expect(dates(p, "c")).toEqual(["2026-10-16", "2026-10-16"]);
    expect(dates(p, "d")).toEqual(["2026-10-19", "2026-10-19"]);
    expect(dates(p, "e")).toEqual(["2026-10-16", "2026-10-19"]);
    expect(schedule(p).finishDate).toBe("2026-10-19");
  });

  it("döngüde zinciri verir; hata mesajı satırları söyler", () => {
    const s = schedule(project([t("a", 1, ["c"]), t("b", 1, ["a"]), t("c", 1, ["b"])]));
    expect(s.cyclePath).toHaveLength(4);
    expect(s.cyclePath[0]).toBe(s.cyclePath[3]);
    expect(new Set(s.cyclePath)).toEqual(new Set(["a", "b", "c"]));
    const p = project([t("a", 1), t("b", 1, ["a"]), t("c", 1, ["b"])]);
    expect(cycleError(p, "a", "c")).toBe("3. satır öncül olamaz: döngü oluşur (1 → 2 → 3 → 1).");
  });

  it("özet ile alt görevi arasındaki bağ ayrı mesajla engellenir", () => {
    const p = project([t("s", 0), { ...t("x", 1), outline: 1 }]);
    expect(cycleError(p, "x", "s")).toMatch(/özet görevi/);
  });
});

describe("B2 gerçekleşen tarihler ve ilerleme", () => {
  const p = project([t("a", 4), t("b", 4, ["a"])]);
  const s = schedule(p);

  it("yüzde girilince gerçekleşen başlangıç yazılır, %100'de bitiş; %0 siler", () => {
    const half = withPercent(p.tasks[1], 50, s);
    expect(half).toMatchObject({ percent: 50, actualStart: "2026-10-16" });
    expect(half.actualFinish).toBeUndefined();
    expect(withPercent(half, 100, s)).toMatchObject({ actualFinish: "2026-10-21" });
    const zero = withPercent(half, 0, s);
    expect(zero.actualStart).toBeUndefined();
  });

  it("gerçekleşen başlangıç görevi sabitler (öncül gecikse de)", () => {
    const q = updateTask(p, 2, { actualStart: "2026-10-15", percent: 25 });
    const later = updateTask(q, 1, { duration: 8 });
    expect(dates(later, "b")[0]).toBe("2026-10-15");
  });

  it("gerçekleşen bitiş süreyi günceller; kalan süre yüzdeyi günceller", () => {
    const started = { ...p.tasks[0], actualStart: "2026-10-12", percent: 50 };
    const done = withActualFinish(started, "2026-10-19", s);
    expect(done).toMatchObject({ percent: 100, duration: 6 });
    // %50 × 4 gün = 2 gün gerçekleşen; kalan 6 → süre 8, %25
    const r = withRemaining({ ...p.tasks[0], percent: 50, actualStart: "2026-10-12" }, 6, s);
    expect(r).toMatchObject({ duration: 8, percent: 25 });
    expect(listTasks({ ...p, tasks: [r, p.tasks[1]] })[0].remainingDuration).toBe(6);
  });

  it("özet görevin yüzdesi alt görevlerden süre ağırlıklı", () => {
    const q = project([t("s", 0), { ...t("x", 2), outline: 1, percent: 100 }, { ...t("y", 6), outline: 1, percent: 0 }]);
    expect(schedule(q).byId.get("s")!.percent).toBe(25);
  });
});

describe("B2 hiyerarşi, kopyala-yapıştır, sürükle-bırak", () => {
  let n = 0;
  const id = () => `n${++n}`;
  const tasks = [
    t("A", 0),
    { ...t("A1", 2), outline: 1 },
    { ...t("A2", 3, ["A1"]), outline: 1 },
    t("B", 1, ["A2"]),
  ];

  it("kopya alt ağacıyla gelir; iç bağlar yeni kimliğe, dış bağlar korunur", () => {
    const copy = cloneRows(tasks, [0], id);
    expect(copy.map((x) => x.name)).toEqual(["A", "A1", "A2"]);
    expect(copy[2].predecessors[0].taskId).toBe(copy[1].id);
    const b = cloneRows(tasks, [3], id);
    expect(b[0].predecessors[0].taskId).toBe("A2");
    const pasted = insertRows(tasks, 4, copy, 0);
    expect(pasted.map((x) => [x.name, x.outline])).toEqual([["A", 0], ["A1", 1], ["A2", 1], ["B", 0], ["A", 0], ["A1", 1], ["A2", 1]]);
    expect(schedule(project(pasted)).cycle).toEqual([]);
  });

  it("sürükle-bırak hedefin girintisini alır; kendi alt ağacına bırakılamaz", () => {
    const moved = moveBlockTo(tasks, 3, 1);
    expect(moved.map((x) => [x.id, x.outline])).toEqual([["A", 0], ["B", 1], ["A1", 1], ["A2", 1]]);
    // B artık A'nın alt görevi; A2'ye (aynı özetin altında) bağı sürer
    expect(moved[1].predecessors).toHaveLength(1);
    expect(moveBlockTo(tasks, 0, 2)).toBe(tasks);
    const toEnd = moveBlockTo(tasks, 0, 4);
    expect(toEnd.map((x) => x.id)).toEqual(["B", "A", "A1", "A2"]);
  });
});

describe("B2 geri al / yinele", () => {
  it("en az 50 adım geri alınır ve yinelenir", () => {
    let h = initHistory(0);
    for (let i = 1; i <= 60; i++) h = push(h, i);
    for (let i = 0; i < 50; i++) h = undo(h);
    expect(h.present).toBe(10);
    for (let i = 0; i < 50; i++) h = redo(h);
    expect(h.present).toBe(60);
    // Yeni değişiklik yinele listesini temizler
    h = push(undo(h), 99);
    expect(redo(h).present).toBe(99);
  });

  it("100 adımdan eskisi düşer", () => {
    let h = initHistory(0);
    for (let i = 1; i <= 150; i++) h = push(h, i);
    expect(h.past).toHaveLength(100);
    expect(h.past[0]).toBe(50);
  });
});

describe("B2 referans plan", () => {
  it("kaydedilir, sapma iş günü olarak hesaplanır, silinir", () => {
    const p = referenceProject();
    const s = schedule(p);
    const withBase = saveBaseline(p, s, 0, "2026-10-13");
    expect(withBase.baselines![0]).toMatchObject({ index: 0, name: "Referans plan 1", finish: "2027-03-01" });
    expect(withBase.baselines![0].tasks["ref-2"]).toMatchObject({ start: "2026-11-16", finish: "2026-12-18", duration: 25, cost: 250_000 });
    // İkinci görev 3 gün uzarsa ardılları 3 iş günü kayar
    const later = { ...withBase, tasks: withBase.tasks.map((x) => (x.id === "ref-2" ? { ...x, duration: 28 } : x)) };
    const v = baselineVariance(later, schedule(later), 0);
    expect(v.get("ref-1")).toMatchObject({ start: 0, finish: 0 });
    expect(v.get("ref-2")).toMatchObject({ start: 0, finish: 3, duration: 3, cost: 30_000 });
    expect(v.get("ref-6")).toMatchObject({ start: 3, finish: 3 });
    // 3 referans plan aynı anda
    let q = saveBaseline(withBase, s, 1, "2026-10-14");
    q = saveBaseline(q, s, 2, "2026-10-15", "Revize");
    expect(q.baselines!.map((b) => b.name)).toEqual(["Referans plan 1", "Referans plan 2", "Revize"]);
    expect(clearBaseline(q, 1).baselines!.map((b) => b.index)).toEqual([0, 2]);
    // Dosyaya yazılıp okununca korunur
    expect(sanitizeProject(JSON.parse(JSON.stringify(q)))!.baselines).toEqual(q.baselines);
  });
});

describe("B2 kaynak seviyeleme", () => {
  const p = project([t("x", 5, [], { assignments: [{ resourceId: "R", units: 100 }] }), t("y", 3, [], { assignments: [{ resourceId: "R", units: 100 }] })], {
    resources: [res("R", { rate: 1000 })],
  });

  it("aşırı yükü bulur ve üç öneri sunar", () => {
    expect(overallocations(p)).toMatchObject([{ name: "R", days: 3, peak: 200 }]);
    const [delay, units, capacity] = proposeLeveling(p);
    expect(delay.kind).toBe("delay");
    expect(delay.remainingOver).toBe(0);
    expect(delay.changes).toMatchObject([{ row: 2, before: 0, after: 5, startBefore: "2026-10-12", startAfter: "2026-10-19" }]);
    expect(delay.finishAfter).toBe("2026-10-21");
    expect(units.remainingOver).toBe(0);
    expect(units.changes.map((c) => [c.row, c.before, c.after])).toEqual([[1, 100, 50], [2, 100, 50]]);
    expect(dates(units.project, "x")).toEqual(["2026-10-12", "2026-10-23"]);
    expect(units.costAfter).toBe(units.costBefore);
    expect(capacity.changes).toMatchObject([{ name: "R", before: 100, after: 200 }]);
    expect(capacity.finishAfter).toBe(capacity.finishBefore);
    // Öneri projeyi değiştirmez; gecikmeler temizlenebilir
    expect(p.tasks[1].levelingDelay).toBeUndefined();
    expect(clearLeveling(delay.project).tasks[1].levelingDelay).toBeUndefined();
  });

  it("başlamış görevi oynatmaz; aşırı yük yoksa öneri yok", () => {
    const started = { ...p, tasks: p.tasks.map((x) => ({ ...x, percent: 10, actualStart: "2026-10-12" })) };
    expect(levelByDelay(started)).toBe(started);
    expect(proposeLeveling(project([t("a", 1)]))).toEqual([]);
  });

  it("1000 görevli projede sınırlı sürede biter", () => {
    const tasks = Array.from({ length: 1000 }, (_, i) => t(`k${i}`, 2, i % 10 ? [`k${i - 1}`] : [], { assignments: [{ resourceId: "R", units: 100 }] }));
    const big = project(tasks, { resources: [res("R")] });
    const t0 = performance.now();
    levelByDelay(big, 50);
    expect(performance.now() - t0).toBeLessThan(20_000);
  });
});

describe("B3 maliyet modeli", () => {
  const resources: Resource[] = [
    res("isci", { rate: 1000 }),
    res("vinc", { type: "equipment", rate: 100, rateType: "hour" }),
    res("nakliye", { rate: 1500, rateType: "use" }),
    res("beton", { type: "material", rate: 2000, unitLabel: "m³" }),
  ];
  const task = t("a", 5, [], {
    fixedCost: 1000,
    assignments: [
      { resourceId: "isci", units: 200 },
      { resourceId: "vinc", units: 100 },
      { resourceId: "nakliye", units: 100 },
      { resourceId: "beton", units: 12.5 },
    ],
  });

  it("kalemler: işgücü, ekipman (saatlik), kullanım başına, malzeme, sabit, genel gider", () => {
    const c = taskCostBreakdown(task, { resources, overheadPercent: 10 });
    expect(c).toEqual({ labor: 10_000 + 1500, equipment: 4000, material: 25_000, fixed: 1000, overhead: 4150, total: 45_650 });
  });

  it("malzeme kapasite tüketmez ve aşırı yük oluşturmaz", () => {
    const p = project([task], { resources });
    const u = resourceUsage(p, schedule(p));
    expect(u[3]).toMatchObject({ work: 12.5, cost: 25_000, overDays: [] });
    expect(listTasks(p)[0].resources).toContain("beton[12.5 m³]");
  });

  it("maliyet dağılımı: eşit, başta, sonda", () => {
    expect(accrualShares([1, 1, 0, 1, 1])).toEqual([0.25, 0.25, 0, 0.25, 0.25]);
    expect(accrualShares([0, 1, 1], "start")).toEqual([0, 1, 0]);
    expect(accrualShares([1, 1, 0], "end")).toEqual([0, 1, 0]);
    const p = project([t("a", 4, [], { fixedCost: 4000, costAccrual: "end" })]);
    const c = progressCurves(p, schedule(p), "2026-10-12");
    expect(c.points.map((x) => x.cost)).toEqual([0, 0, 0, 0, 4000]);
    const start = progressCurves({ ...p, tasks: [{ ...p.tasks[0], costAccrual: "start" }] }, schedule(p), "2026-10-12");
    expect(start.points.map((x) => x.cost)).toEqual([0, 4000, 4000, 4000, 4000]);
  });

  it("kilometre taşının sabit maliyeti toplamda yer alır", () => {
    const p = project([t("a", 2, [], { fixedCost: 100 }), t("m", 0, ["a"], { fixedCost: 50 })]);
    expect(progressCurves(p, schedule(p), "2026-10-12").totalCost).toBe(150);
  });
});

describe("dosya sürümü 4", () => {
  it("eski startNoEarlierThan SNET kısıtına çevrilir; yeni alanlar doğrulanır", () => {
    const raw = {
      name: "x",
      start: "2026-10-12",
      tasks: [
        { id: "a", name: "a", duration: 2, outline: 0, percent: 0, predecessors: [], startNoEarlierThan: "2026-10-14" },
        { id: "b", name: "b", duration: 2, outline: 0, percent: 0, predecessors: [], constraint: { type: "MSO" }, blackouts: ["yok", "kis"] },
      ],
      blackouts: [{ id: "kis", name: "Kış", from: "2026-12-31", to: "2026-12-01" }],
      resources: [{ id: "r", name: "Beton", maxUnits: 100, rate: 5, type: "material", workdays: [6, 1] }],
    };
    expect(fileVersion(raw)).toBe(1);
    const p = sanitizeProject(raw)!;
    expect(p.tasks[0].constraint).toEqual({ type: "SNET", date: "2026-10-14" });
    expect("startNoEarlierThan" in p.tasks[0]).toBe(false);
    // Tarihsiz MSO geçersiz: kısıt atılır
    expect(p.tasks[1].constraint).toBeUndefined();
    expect(p.tasks[1].blackouts).toEqual(["kis"]);
    expect(p.blackouts).toEqual([{ id: "kis", name: "Kış", from: "2026-12-01", to: "2026-12-31" }]);
    expect(p.resources[0]).toMatchObject({ type: "material", workdays: [1, 6] });
  });
});
