import { describe, expect, it } from "vitest";
import {
  assignFromText,
  formatAssignments,
  overallocatedTasks,
  parseAssignments,
  progressCurves,
  removeResource,
  resourceUsage,
  taskCost,
} from "../resources";
import { sampleProject } from "../sample";
import { schedule } from "../schedule";
import type { Project, Resource, Task } from "../types";

const ali: Resource = { id: "ali", name: "Ali", maxUnits: 100, rate: 1000 };
const vinc: Resource = { id: "vinc", name: "Vinç", maxUnits: 100, rate: 5000 };

const task = (id: string, duration: number, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  duration,
  outline: 0,
  percent: 0,
  predecessors: [],
  ...extra,
});

const project = (tasks: Task[], resources: Resource[] = [ali, vinc]): Project => ({
  name: "p",
  start: "2026-10-12", // pazartesi
  tasks,
  holidays: [],
  resources,
});

describe("atama yazımı", () => {
  it("birim ve büyük/küçük harf", () => {
    const r = parseAssignments("ali[50%]; VİNÇ", [ali, vinc]);
    expect(r.errors).toEqual([]);
    expect(r.created).toEqual([]);
    expect(r.assignments).toEqual([
      { resourceId: "ali", units: 50 },
      { resourceId: "vinc", units: 100 },
    ]);
  });

  it("bilinmeyen ad yeni kaynak olur, hatalı birim reddedilir", () => {
    const r = parseAssignments("Kalıp ekibi[200]", [ali]);
    expect(r.created).toHaveLength(1);
    expect(r.created[0]).toMatchObject({ name: "Kalıp ekibi", maxUnits: 100, rate: 0 });
    expect(r.assignments[0].units).toBe(200);
    expect(parseAssignments("Ali[0%]", [ali]).errors).toEqual(["Ali[0%]"]);
  });

  it("biçimleme %100'ü yazmaz", () => {
    expect(
      formatAssignments(
        [
          { resourceId: "ali", units: 50 },
          { resourceId: "vinc", units: 100 },
        ],
        [ali, vinc],
      ),
    ).toBe("Ali[50%]; Vinç");
  });

  it("assignFromText yeni kaynağı listeye ekler; kaynak silinince atama kalkar", () => {
    const p = project([task("a", 2)]);
    const { project: p2 } = assignFromText(p, "a", "Ali; Usta");
    expect(p2.resources.map((r) => r.name)).toEqual(["Ali", "Vinç", "Usta"]);
    const p3 = removeResource(p2, "ali");
    expect(p3.tasks[0].assignments!.map((a) => a.resourceId)).toEqual([p2.resources[2].id]);
  });
});

describe("kaynak yükü", () => {
  it("çakışan görevler kapasiteyi aşar", () => {
    const p = project([
      task("a", 3, { assignments: [{ resourceId: "ali", units: 100 }] }),
      task("b", 2, { assignments: [{ resourceId: "ali", units: 50 }], predecessors: [{ taskId: "a", type: "SS", lag: 2 }] }),
      task("c", 1, { assignments: [{ resourceId: "vinc", units: 100 }], predecessors: [{ taskId: "b", type: "FS", lag: 0 }] }),
    ]);
    const s = schedule(p);
    const [uAli, uVinc] = resourceUsage(p, s);
    expect(uAli.load).toEqual([100, 100, 150, 50, 0]);
    expect(uAli.overDays).toEqual([2]);
    expect(uAli.peak).toBe(150);
    expect(uAli.work).toBe(4);
    expect(uAli.cost).toBe(4000);
    expect(uVinc.overDays).toEqual([]);
    expect(uVinc.cost).toBe(5000);
    expect([...overallocatedTasks([uAli, uVinc])].sort()).toEqual(["a", "b"]);
  });

  it("özet görevin ataması sayılmaz, görev maliyeti", () => {
    const p = project([
      task("s", 0, { assignments: [{ resourceId: "ali", units: 100 }] }),
      task("x", 4, { outline: 1, assignments: [{ resourceId: "vinc", units: 50 }] }),
    ]);
    const [uAli, uVinc] = resourceUsage(p, schedule(p));
    expect(uAli.work).toBe(0);
    expect(uVinc.work).toBe(2);
    expect(taskCost(p.tasks[1], p.resources)).toBe(10_000);
  });
});

describe("eğriler", () => {
  it("S eğrisi %100'de, maliyet toplamda biter; kazanılan değer yüzdeden", () => {
    const p = project([
      task("a", 2, { percent: 50, assignments: [{ resourceId: "ali", units: 100 }] }),
      task("b", 2, { predecessors: [{ taskId: "a", type: "FS", lag: 0 }], assignments: [{ resourceId: "vinc", units: 100 }] }),
    ]);
    const c = progressCurves(p, schedule(p), "2026-10-13");
    expect(c.points.map((x) => x.planned)).toEqual([0, 25, 50, 75, 100]);
    expect(c.points.map((x) => x.cost)).toEqual([0, 1000, 2000, 7000, 12000]);
    expect(c.totalCost).toBe(12_000);
    expect(c.earnedPercent).toBe(25);
    expect(c.earnedCost).toBe(1000);
    expect(c.todayDay).toBe(1);
  });

  it("örnek projede tesisat ekibi aşırı yüklü", () => {
    const p = sampleProject("2026-10-12");
    const u = resourceUsage(p, schedule(p));
    const tesisat = u.find((x) => x.resource.name === "Tesisat ekibi")!;
    expect(tesisat.overDays.length).toBe(15);
    expect(u.filter((x) => x.overDays.length).map((x) => x.resource.name)).toEqual(["Tesisat ekibi"]);
  });
});
