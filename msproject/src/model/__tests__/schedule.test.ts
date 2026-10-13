import { describe, expect, it } from "vitest";
import { schedule, wouldCreateCycle } from "../schedule";
import type { LinkType, Project, Task } from "../types";

const t = (id: string, duration: number, preds: string[] = [], outline = 0, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  duration,
  outline,
  percent: 0,
  predecessors: preds.map((p) => {
    const [taskId, type = "FS", lag = "0"] = p.split(":");
    return { taskId, type: type as LinkType, lag: Number(lag) };
  }),
  ...extra,
});
const project = (tasks: Task[], holidays: string[] = []): Project => ({
  name: "p",
  start: "2026-10-12",
  tasks,
  holidays: holidays.map((date) => ({ date, name: "" })),
  resources: [],
});

describe("zamanlama", () => {
  it("FS zincirini hafta sonunu atlayarak dizer", () => {
    const s = schedule(project([t("a", 3), t("b", 4, ["a"])]));
    expect(s.byId.get("a")!.startDate).toBe("2026-10-12");
    expect(s.byId.get("a")!.finishDate).toBe("2026-10-14");
    expect(s.byId.get("b")!.startDate).toBe("2026-10-15");
    expect(s.byId.get("b")!.finishDate).toBe("2026-10-20");
    expect(s.finishDate).toBe("2026-10-20");
  });

  it("SS, FF, SF ve gecikmeyi uygular", () => {
    const s = schedule(
      project([t("a", 5), t("b", 2, ["a:SS:2"]), t("c", 2, ["a:FF"]), t("d", 1, ["a:SF"]), t("e", 1, ["a:FS:-2"])]),
    );
    expect(s.byId.get("b")!.es).toBe(2);
    expect(s.byId.get("c")!.es).toBe(3);
    expect(s.byId.get("c")!.ef).toBe(5);
    expect(s.byId.get("d")!.ef).toBe(1);
    expect(s.byId.get("e")!.es).toBe(3);
  });

  it("kritik yolu ve bolluğu bulur", () => {
    // a(3) -> c(2); b(1) -> c ; d(1) bağımsız
    const s = schedule(project([t("a", 3), t("b", 1), t("c", 2, ["a", "b"]), t("d", 1)]));
    expect(s.finish).toBe(5);
    expect(s.byId.get("a")!.critical).toBe(true);
    expect(s.byId.get("c")!.critical).toBe(true);
    expect(s.byId.get("b")!.slack).toBe(2);
    expect(s.byId.get("d")!.slack).toBe(4);
    expect(s.byId.get("b")!.critical).toBe(false);
  });

  it("kilometre taşı sıfır süreli ve ardılı aynı gün başlar", () => {
    const s = schedule(project([t("a", 2), t("m", 0, ["a"]), t("b", 1, ["m"])]));
    const m = s.byId.get("m")!;
    expect(m.isMilestone).toBe(true);
    // MS Project gibi: öncülün bittiği günün sonunda (13 Ekim)
    expect(m.startDate).toBe("2026-10-13");
    expect(m.finishDate).toBe("2026-10-13");
    expect(s.byId.get("b")!.startDate).toBe("2026-10-14");
  });

  it("özet görev alt görevlerini kapsar, öncülü alt görevlere geçer", () => {
    const s = schedule(
      project([t("x", 2), t("S", 0, ["x"]), t("s1", 2, [], 1), t("s2", 3, ["s1"], 1), t("y", 1, ["S"])]),
    );
    const S = s.byId.get("S")!;
    expect(S.isSummary).toBe(true);
    expect(S.es).toBe(2);
    expect(S.ef).toBe(7);
    expect(S.duration).toBe(5);
    expect(s.byId.get("y")!.es).toBe(7);
  });

  it("başlangıç kısıtını uygular", () => {
    const s = schedule(project([t("a", 1, [], 0, { constraint: { type: "SNET", date: "2026-10-17" } })]));
    expect(s.byId.get("a")!.startDate).toBe("2026-10-19");
  });

  it("döngüyü bildirir ve çökmez", () => {
    const s = schedule(project([t("a", 1, ["b"]), t("b", 1, ["a"]), t("c", 1)]));
    expect(s.cycle.sort()).toEqual(["a", "b"]);
    expect(s.rows).toHaveLength(3);
  });

  it("döngü ve özet-alt görev bağını önceden yakalar", () => {
    const p = project([t("a", 1), t("b", 1, ["a"]), t("S", 0), t("s1", 1, [], 1)]);
    expect(wouldCreateCycle(p, "a", "b")).toBe(true);
    expect(wouldCreateCycle(p, "s1", "S")).toBe(true);
    expect(wouldCreateCycle(p, "s1", "b")).toBe(false);
  });

  it("tatil günlerini atlar", () => {
    // 29 Ekim 2026 perşembe tatil
    const s = schedule(project([t("a", 5), t("b", 1, ["a"])], ["2026-10-29"]));
    expect(s.byId.get("a")!.finishDate).toBe("2026-10-16");
    const s2 = schedule(project([t("a", 14)], ["2026-10-29"]));
    expect(s2.byId.get("a")!.finishDate).toBe("2026-10-30");
  });
});
