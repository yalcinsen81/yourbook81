import { describe, expect, it } from "vitest";
import { ganttImage } from "../ganttSvg";
import { calcProject, inactiveIds, scheduleActive } from "../inactive";
import { groupUnderSummary, moveRowsTo, outlineDepth, summariesToCollapse, ungroupSummary } from "../outline";
import { buildRecurringTasks, recurrenceDates } from "../recurrence";
import { resourceUsage } from "../resources";
import { schedule } from "../schedule";
import { sanitizeProject } from "../storage";
import { timelineItems } from "../timeline";
import type { Project, Task } from "../types";
import { groupRows, taskMatches, weekRange } from "../view";
import { referenceProject } from "./fixtures/reference";

const mk = (id: string, outline = 0, duration = 3, preds: string[] = []): Task => ({
  id,
  name: id,
  outline,
  duration,
  percent: 0,
  predecessors: preds.map((taskId) => ({ taskId, type: "FS", lag: 0 })),
});
const ids = (tasks: Task[]) => tasks.map((x) => `${x.id}:${x.outline}`).join(",");

describe("anahat yardımcıları (B2, B3, B5)", () => {
  const base = [mk("a"), mk("b"), mk("s", 0), mk("c", 1), mk("d", 1), mk("e")];
  it("seçili satırları yeni özet altına alır", () => {
    const out = groupUnderSummary(base, [0, 1], mk("S"));
    expect(ids(out)).toBe("S:0,a:1,b:1,s:0,c:1,d:1,e:0");
  });
  it("özeti çözer: alt görevler bir düzey yukarı çıkar, özetin bağları sayılır", () => {
    const tasks = [mk("x"), { ...mk("s"), predecessors: [{ taskId: "x", type: "FS" as const, lag: 0 }] }, mk("c", 1)];
    const { tasks: out, droppedLinks } = ungroupSummary(tasks, 1);
    expect(ids(out)).toBe("x:0,c:0");
    expect(droppedLinks).toBe(1);
  });
  it("düzeye kadar göster ve derinlik", () => {
    expect(summariesToCollapse(base, 1)).toEqual(["s"]);
    expect(summariesToCollapse(base, 2)).toEqual([]);
    expect(outlineDepth(base)).toBe(2);
  });
  it("çoklu satırı başka özetin altına taşır, düzey sınırlanır", () => {
    expect(ids(moveRowsTo(base, [0, 1], 4, 1))).toBe("s:0,c:1,a:1,b:1,d:1,e:0");
    // Önceki satırın bir altından derine inemez
    expect(ids(moveRowsTo(base, [5], 4, 5))).toBe("a:0,b:0,s:0,c:1,e:2,d:1");
    // Blok kendi içine bırakılamaz
    expect(moveRowsTo(base, [2], 4)).toBe(base);
  });
});

describe("süzgeç ve gruplama (B6)", () => {
  it("hafta aralığı hafta başı ayarına uyar", () => {
    expect(weekRange("2026-10-14", 1)).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(weekRange("2026-10-14", 0)).toEqual({ from: "2026-10-11", to: "2026-10-17" });
  });
  it("Bu hafta süzgeci haftaya değen görevleri seçer", () => {
    const p = referenceProject();
    const s = schedule(p);
    const hits = p.tasks.map((_, i) => i).filter((i) => taskMatches(p, s, i, { query: "", filter: "thisWeek", today: "2026-11-16", weekStart: 1 }));
    expect(hits).toEqual([1]);
  });
  it("kaynağa göre grupla: kaynaksızlar sonda", () => {
    const p = referenceProject();
    const s = schedule(p);
    const rows = groupRows(p, s, p.tasks.map((_, i) => i), "resource", { noResource: "(yok)", noSummary: "(özetsiz)" });
    const groups = rows.filter((r) => r.kind === "group");
    expect(groups).toHaveLength(6);
    expect(groups.at(-1)).toMatchObject({ label: "(yok)", count: 1 });
  });
});

describe("zaman çizelgesi (B10)", () => {
  it("işaretli görevleri kulvarlara yerleştirir ve dışa aktarmaya şerit ekler", () => {
    const p = referenceProject();
    p.tasks[0].timeline = true;
    p.tasks[1].timeline = true;
    p.tasks[5].timeline = true;
    const s = schedule(p);
    const tl = timelineItems(p, s);
    expect(tl.items.map((x) => x.id)).toEqual(["ref-1", "ref-2", "ref-6"]);
    expect(tl.lanes).toBe(1); // ardışık görevler üst üste binmez
    expect(tl.to).toBe("2027-03-01");
    const opts = { from: p.start, to: s.finishDate, scale: "week" as const, size: "A4" as const, orientation: "landscape" as const };
    const plain = ganttImage(p, s, opts);
    const withTl = ganttImage(p, s, { ...opts, timeline: true });
    expect(withTl.height).toBeGreaterThan(plain.height);
  });
  it("aynı anda süren görevler ayrı kulvarda, en çok 3 kulvar", () => {
    const p = referenceProject();
    p.tasks = [mk("a"), mk("b"), mk("c"), mk("d")].map((x) => ({ ...x, timeline: true }));
    const tl = timelineItems(p, schedule(p));
    expect(tl.items.map((x) => x.lane)).toEqual([0, 1, 2, 0]);
    expect(tl.lanes).toBe(3);
  });
});

describe("etkisiz görev (B8)", () => {
  it("etkisiz görev bitişi, maliyeti ve kaynak yükünü etkilemez; satır sırası korunur", () => {
    const p = referenceProject();
    p.tasks.push({ ...mk("x", 0, 40, ["ref-6"]), inactive: true, assignments: [{ resourceId: "res-1", units: 100 }] });
    p.tasks[5] = { ...p.tasks[5], predecessors: [...p.tasks[5].predecessors] };
    const s = scheduleActive(p);
    expect(s.finishDate).toBe("2027-03-01");
    expect(s.rows).toHaveLength(7);
    expect(s.rows[6].row).toBe(7);
    expect(s.rows[6].critical).toBe(false);
    const c = calcProject(p);
    const total = resourceUsage(c, s).reduce((a, u) => a + u.cost, 0);
    expect(total).toBe(635_000);
  });
  it("etkisiz görevin ardılı onu beklemez; etkisiz özetin altı da etkisizdir", () => {
    const p = referenceProject();
    p.tasks = [mk("a", 0, 5), { ...mk("b", 0, 20, ["a"]), inactive: true }, mk("c", 0, 5, ["b"])];
    const s = scheduleActive(p);
    expect(s.byId.get("c")!.startDate).toBe(p.start);
    const q = { ...p, tasks: [{ ...mk("s"), inactive: true }, mk("k", 1), mk("z")] };
    expect([...inactiveIds(q)]).toEqual(["s", "k"]);
  });
  it("etkisiz görev yoksa motor sonucu aynen döner", () => {
    const p = referenceProject();
    expect(calcProject(p)).toBe(p);
    expect(scheduleActive(p).finishDate).toBe(schedule(p).finishDate);
  });
  it("eski dosya açılır; yeni alanlar korunur", () => {
    const p = sanitizeProject({ ...referenceProject(), version: 6, tasks: referenceProject().tasks.map((x, i) => (i === 0 ? { ...x, inactive: true, timeline: true } : x)) })!;
    expect(p.tasks[0].inactive).toBe(true);
    expect(p.tasks[0].timeline).toBe(true);
    expect(p.tasks[1].inactive).toBeUndefined();
    const old = sanitizeProject({ ...referenceProject(), version: 5 })!;
    expect(schedule(old).finishDate).toBe("2027-03-01");
  });
});

describe("yinelenen görev (B14)", () => {
  it("haftalık: başlangıçtan sonraki ilk gün, n haftada bir", () => {
    expect(recurrenceDates({ kind: "weekly", weekday: 3, every: 1 }, "2026-11-02", "2026-11-25")).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
    expect(recurrenceDates({ kind: "weekly", weekday: 1, every: 2 }, "2026-11-02", "2026-11-30")).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
  });
  it("aylık: ayda olmayan gün ayın son gününe kayar", () => {
    expect(recurrenceDates({ kind: "monthly", day: 31, every: 1 }, "2027-01-01", "2027-04-30")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
    expect(recurrenceDates({ kind: "monthly", day: 15, every: 3 }, "2026-11-20", "2027-12-31")).toEqual(["2027-02-15", "2027-05-15", "2027-08-15", "2027-11-15"]);
  });
  it("özet + SNET kısıtlı tekrarlar; motor tatili atlar", () => {
    let n = 0;
    const tasks = buildRecurringTasks("Toplantı", 1, ["2027-01-01", "2027-01-08"], 0, () => `r${++n}`);
    expect(ids(tasks)).toBe("r1:0,r2:1,r3:1");
    expect(tasks[1].constraint).toEqual({ type: "SNET", date: "2027-01-01" });
    const p: Project = { ...referenceProject(), tasks };
    // 1 Ocak yılbaşı tatili: ilk tekrar sonraki iş gününe kayar
    expect(schedule(p).byId.get("r2")!.startDate).toBe("2027-01-04");
  });
});
