import { describe, expect, it } from "vitest";
import { addTask, listTasks, projectSummary } from "../ops";
import { formatMoney } from "../resources";
import { emptyProject } from "../sample";
import { referenceProject } from "./fixtures/reference";

describe("Madde 4: tüm görevlerde aynı alanlar", () => {
  it("kaynaksız görevde cost = 0, resources = '' döner; anahtarlar her satırda aynı", () => {
    const rows = listTasks(referenceProject());
    const keys = Object.keys(rows[0]).sort();
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(keys);
    expect(rows[5]).toMatchObject({ name: "Snag list", cost: 0, resources: "", overallocated: false, constraint: "" });
    expect(rows[0]).toMatchObject({ cost: 85_000, resources: "Hafriyat ve temel ekibi" });
  });

  it("yeni eklenen kaynaksız görev de aynı şemada", () => {
    const p = addTask(emptyProject("2026-11-02"), { name: "Kontrol", duration: 2 }).project;
    const [row] = listTasks(p);
    expect(row).toMatchObject({ cost: 0, resources: "", overallocated: false, constraint: "", info: "" });
  });

  it("özet görevde kaynak boş, maliyet alt görevlerin toplamı", () => {
    let p = referenceProject();
    p = { ...p, tasks: [{ ...p.tasks[0], id: "ozet", name: "Kaba işler", duration: 0, assignments: undefined, predecessors: [] }, ...p.tasks.slice(0, 2).map((t) => ({ ...t, outline: 1 }))] };
    const rows = listTasks(p);
    expect(rows[0]).toMatchObject({ summary: true, resources: "", cost: 335_000 });
  });

  it("özette uyarı listesi ve döngü alanı hep var", () => {
    const s = projectSummary(emptyProject("2026-11-02"));
    expect(s.warnings).toEqual([]);
    expect(s.cycleWarning).toBe("");
  });

  it("boş değer biçimlendirme çökmez", () => {
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(Number.NaN)).toBe("—");
  });
});

describe("Madde 5: maliyeti olmayan görev uyarısı", () => {
  it("maliyet ağırlığında özet ve görev listesi bilgilendirir", () => {
    const p = referenceProject();
    const s = projectSummary(p, "2026-10-13");
    expect(s.progressWeight).toBe("cost");
    expect(s.warnings).toEqual(["1 görevin maliyeti yok, ilerleme ağırlığı 0 (satır 6)."]);
    const rows = listTasks(p);
    expect(rows[5].info).toBe("Maliyeti yok, ilerleme ağırlığı 0");
    expect(rows.filter((r) => r.info)).toHaveLength(1);
  });

  it("süre ağırlığında uyarı yok", () => {
    const p = { ...referenceProject(), progressWeight: "duration" as const };
    expect(projectSummary(p).warnings).toEqual([]);
    expect(listTasks(p).every((r) => r.info === "")).toBe(true);
  });

  it("özet ilerlemesi seçili ağırlıkla: yalnız görev 2 %50 → %19,7", () => {
    const p = referenceProject();
    p.tasks[1] = { ...p.tasks[1], percent: 50 };
    const s = projectSummary(p, "2026-12-01");
    expect(s.progressPercent).toBe(19.7);
    expect(s.earnedValue).toBe(125_000);
  });
});
