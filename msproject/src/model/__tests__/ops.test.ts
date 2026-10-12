import { describe, expect, it } from "vitest";
import { addTask, deleteTask, linkTasks, listTasks, OpError, projectSummary, shiftTask, unlinkTasks, updateTask } from "../ops";
import { emptyProject } from "../sample";
import type { Project } from "../types";

const base = (): Project => ({ ...emptyProject("2026-10-12"), holidays: [] });

describe("proje işlemleri (MCP)", () => {
  it("görev ekler, alt görev yapar, öncül verir", () => {
    let p = base();
    p = addTask(p, { name: "Kaba yapı" }).project;
    p = addTask(p, { name: "Temel", duration: 5, parentRow: 1 }).project;
    p = addTask(p, { name: "Perde", duration: 3, parentRow: 1, predecessors: "2" }).project;
    const r = addTask(p, { name: "Teslim", duration: 0, predecessors: "1" });
    p = r.project;
    expect(r.row).toBe(4);
    const rows = listTasks(p);
    expect(rows.map((x) => [x.name, x.level, x.summary])).toEqual([
      ["Kaba yapı", 0, true],
      ["Temel", 1, false],
      ["Perde", 1, false],
      ["Teslim", 0, false],
    ]);
    expect(rows[2].start).toBe("2026-10-19");
    expect(rows[3].milestone).toBe(true);
    expect(rows[3].start).toBe("2026-10-22");
    expect(projectSummary(p).durationWorkdays).toBe(8);
  });

  it("after_row alt görevlerin sonrasına aynı düzeyde ekler", () => {
    let p = base();
    p = addTask(p, { name: "A" }).project;
    p = addTask(p, { name: "A1", parentRow: 1 }).project;
    p = addTask(p, { name: "B", afterRow: 1 }).project;
    expect(listTasks(p).map((x) => `${x.name}:${x.level}`)).toEqual(["A:0", "A1:1", "B:0"]);
  });

  it("günceller, bağlar, bağı kaldırır, girintiler ve siler", () => {
    let p = base();
    for (const n of ["A", "B", "C"]) p = addTask(p, { name: n, duration: 2 }).project;
    p = linkTasks(p, 1, 2, "FS", 1);
    expect(listTasks(p)[1].predecessors).toBe("1FS+1g");
    p = linkTasks(p, 1, 2, "SS");
    expect(listTasks(p)[1].predecessors).toBe("1SS");
    p = unlinkTasks(p, 1, 2);
    expect(listTasks(p)[1].predecessors).toBe("");
    p = updateTask(p, 3, { name: "C2", percent: 150, startNoEarlierThan: "2026-10-20" });
    expect(listTasks(p)[2]).toMatchObject({ name: "C2", percent: 100, start: "2026-10-20" });
    p = updateTask(p, 3, { startNoEarlierThan: "" });
    expect(listTasks(p)[2].start).toBe("2026-10-12");
    p = shiftTask(p, 2, "in");
    expect(listTasks(p)[0].summary).toBe(true);
    const d = deleteTask(p, 1);
    expect(d.deleted).toBe(2);
    expect(listTasks(d.project).map((x) => x.name)).toEqual(["C2"]);
  });

  it("anlaşılır hatalar fırlatır", () => {
    let p = base();
    p = addTask(p, { name: "A" }).project;
    p = addTask(p, { name: "B", predecessors: "1" }).project;
    expect(() => updateTask(p, 9, { name: "x" })).toThrow(OpError);
    expect(() => linkTasks(p, 2, 1)).toThrow(/döngü/);
    expect(() => updateTask(p, 1, { predecessors: "abc" })).toThrow(/Anlaşılamayan/);
    expect(() => addTask(p, { name: "C", startNoEarlierThan: "2026-13-01" })).toThrow(/Geçersiz tarih/);
    expect(() => shiftTask(p, 1, "out")).toThrow(OpError);
  });
});
