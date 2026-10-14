import { beforeAll, describe, expect, it } from "vitest";
import { setLocale } from "../../i18n";
import { schedule } from "../schedule";
import type { Project, Task } from "../types";
import { allWarnings, taskWarnings } from "../validation";
import { arrange, DEFAULT_VIEW, fold, isViewActive, projectTags, taskMatches, visibleOrder, type ViewOptions } from "../view";
import { referenceProject } from "./fixtures/reference";

beforeAll(() => setLocale({ lang: "tr" }));

/**
 * Referans projenin özetli hali:
 * 1 Kaba işler (özet) → 2 Hafriyat ve temel, 3 Kaba yapı; 4 İnce işler (özet) → 5 Çatı, 6 Tesisat, 7 Sıva; 8 Snag list
 */
function nested(): Project {
  const ref = referenceProject();
  const leaf = (i: number, extra: Partial<Task> = {}): Task => ({ ...ref.tasks[i], outline: 1, ...extra });
  const tasks: Task[] = [
    { id: "s1", name: "Kaba işler", duration: 1, outline: 0, percent: 0, predecessors: [] },
    leaf(0, { percent: 100, tags: ["Dış İş"], color: "green", notes: "Zemin etüdü tamam" }),
    leaf(1, { percent: 50, tags: ["dış iş", "Beton"] }),
    { id: "s2", name: "İnce işler", duration: 1, outline: 0, percent: 0, predecessors: [] },
    leaf(2, { tags: ["Dış iş"] }),
    leaf(3, { links: [{ url: "https://ornek.com/tesisat.pdf", title: "Tesisat projesi" }] }),
    leaf(4),
    { ...ref.tasks[5], outline: 0 },
  ];
  return { ...ref, tasks };
}

const view = (o: Partial<ViewOptions> = {}): ViewOptions => ({ ...DEFAULT_VIEW, today: "2026-12-21", ...o });
const names = (p: Project, order: number[]) => order.map((i) => p.tasks[i].name);

describe("C3 görünüm: arama, süzgeç, sıralama", () => {
  it("yeniden düzenleme referans tarihlerini bozmaz", () => {
    const p = nested();
    const s = schedule(p);
    expect(s.finishDate).toBe("2027-03-01");
    expect(s.rows[0].isSummary && s.rows[3].isSummary).toBe(true);
  });

  it("varsayılan görünüm tüm satırları özgün sırada verir", () => {
    const p = nested();
    expect(visibleOrder(p, schedule(p), view(), [])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(isViewActive(DEFAULT_VIEW)).toBe(false);
    expect(isViewActive({ ...DEFAULT_VIEW, query: "  " })).toBe(false);
    expect(isViewActive({ ...DEFAULT_VIEW, sort: "name" })).toBe(true);
  });

  it("arama Türkçe harf ve büyük/küçük farkını yok sayar, eşleşenin özetini de gösterir", () => {
    expect(fold("İÇ IŞIK Çatı")).toBe("ic isik cati");
    const p = nested();
    const s = schedule(p);
    expect(names(p, visibleOrder(p, s, view({ query: "CATI" }), []))).toEqual(["İnce işler", "Çatı imalatı"]);
    // Not, bağlantı başlığı ve kaynak adı da aranır
    expect(names(p, visibleOrder(p, s, view({ query: "etüdü" }), []))).toEqual(["Kaba işler", "Hafriyat ve temel"]);
    expect(names(p, visibleOrder(p, s, view({ query: "tesisat projesi" }), []))).toEqual(["İnce işler", "Tesisat ve elektrik"]);
    expect(names(p, visibleOrder(p, s, view({ query: "kaba yapı ekibi" }), []))).toEqual(["Kaba işler", "Kaba yapı"]);
    // Satır numarası
    expect(names(p, visibleOrder(p, s, view({ query: "#8" }), []))).toEqual(["Snag list"]);
    expect(visibleOrder(p, s, view({ query: "yok böyle bir şey" }), [])).toEqual([]);
  });

  it("süzgeçler: gecikmiş, kritik, kilometre taşı, tamamlanmamış, notlu, kaynak, etiket, renk", () => {
    const p = nested();
    const s = schedule(p);
    const only = (filter: ViewOptions["filter"], today = "2026-12-21") =>
      p.tasks.flatMap((x, i) => (taskMatches(p, s, i, view({ filter, today })) ? [x.name] : []));
    // Kaba yapı 2026-12-18'de bitmeliydi, %50
    expect(only("late")).toEqual(["Kaba yapı"]);
    expect(only("late", "2026-12-18")).toEqual([]);
    expect(only("critical")).toHaveLength(6);
    expect(only("milestones")).toEqual([]);
    expect(only("incomplete")).not.toContain("Hafriyat ve temel");
    expect(only("incomplete")).not.toContain("Kaba işler");
    expect(only("notes")).toEqual(["Hafriyat ve temel", "Tesisat ve elektrik"]);
    expect(only("res:res-3")).toEqual(["Çatı imalatı"]);
    // Etiket süzgeci yazım farkını (Dış İş / dış iş / Dış iş) yok sayar
    expect(only("tag:DIŞ İŞ")).toEqual(["Hafriyat ve temel", "Kaba yapı", "Çatı imalatı"]);
    expect(only("color:green")).toEqual(["Hafriyat ve temel"]);
    // Süzgeç + arama birlikte
    expect(names(p, visibleOrder(p, s, view({ filter: "tag:beton", query: "kaba" }), []))).toEqual(["Kaba işler", "Kaba yapı"]);
  });

  it("sıralama anahattı korur: kardeşler kendi içinde sıralanır, özetin altı ayrılmaz", () => {
    const p = nested();
    const s = schedule(p);
    const order = visibleOrder(p, s, view({ sort: "duration", desc: true }), []);
    // Kökler: Kaba işler (35 g), İnce işler (45 g), Snag (5 g) → azalan
    expect(names(p, order)).toEqual(["İnce işler", "Sıva, boya, son kat", "Tesisat ve elektrik", "Çatı imalatı", "Kaba işler", "Kaba yapı", "Hafriyat ve temel", "Snag list"]);
    const byName = names(p, visibleOrder(p, s, view({ sort: "name" }), []));
    expect(byName).toEqual(["İnce işler", "Çatı imalatı", "Sıva, boya, son kat", "Tesisat ve elektrik", "Kaba işler", "Hafriyat ve temel", "Kaba yapı", "Snag list"]);
  });

  it("boş anahtarlar sona gider; eşitlerde özgün sıra korunur", () => {
    const p = nested();
    const keys: (number | null)[] = [null, 3, null, 1, 2, 2, 1, 5];
    expect(arrange(p, p.tasks.map(() => true), (i) => keys[i])).toEqual([3, 6, 4, 5, 7, 0, 1, 2]);
  });

  it("projectTags tekrarsız ve alfabetik", () => {
    expect(projectTags(nested())).toEqual(["Beton", "Dış İş"]);
  });
});

describe("C3 doğrulama uyarıları", () => {
  it("gecikme ve tarih aralığı uyarıları", () => {
    const base = nested();
    const p: Project = {
      ...base,
      tasks: base.tasks.map((x, i) =>
        i === 4
          ? { ...x, deadline: "2026-12-01", constraint: { type: "SNET", date: "2026-10-01" } }
          : i === 5
            ? { ...x, actualStart: "2027-01-05", actualCost: 1000 }
            : i === 6
              ? { ...x, actualCost: 500 }
              : x,
      ),
    };
    const s = schedule(p);
    const kinds = (i: number) => taskWarnings(p, s, i, "2026-12-21").map((w) => w.kind);
    expect(kinds(2)).toEqual(["late"]);
    expect(taskWarnings(p, s, 2, "2026-12-21")[0].text).toContain("18.12.2026");
    expect(kinds(4)).toEqual(["deadlineBeforeStart", "constraintBeforeProject"]);
    expect(kinds(5)).toEqual(["actualInFuture"]);
    expect(kinds(6)).toEqual(["actualCostNoProgress"]);
    expect(kinds(1)).toEqual([]);
    // Özet gecikmiş sayılmaz
    expect(kinds(0)).toEqual([]);
    const all = allWarnings(p, s, "2026-12-21");
    expect([...all.keys()]).toEqual([p.tasks[2].id, p.tasks[4].id, p.tasks[5].id, p.tasks[6].id]);
  });
});
