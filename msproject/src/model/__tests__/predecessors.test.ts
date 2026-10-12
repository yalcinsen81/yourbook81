import { describe, expect, it } from "vitest";
import { formatPredecessors, parsePredecessors } from "../predecessors";
import type { Task } from "../types";

const t = (id: string): Task => ({ id, name: id, duration: 1, outline: 0, predecessors: [], percent: 0 });
const tasks = [t("a"), t("b"), t("c"), t("d")];

describe("öncül metni", () => {
  it("satır numarası, tip ve gecikmeyi okur", () => {
    const r = parsePredecessors("1; 2SS+3g, 3FF-1", tasks, "d");
    expect(r.errors).toEqual([]);
    expect(r.predecessors).toEqual([
      { taskId: "a", type: "FS", lag: 0 },
      { taskId: "b", type: "SS", lag: 3 },
      { taskId: "c", type: "FF", lag: -1 },
    ]);
  });

  it("Türkçe kısaltmaları kabul eder", () => {
    const r = parsePredecessors("1bb+2gün;2BşBş", tasks, "d");
    expect(r.predecessors).toEqual([
      { taskId: "a", type: "FS", lag: 2 },
      { taskId: "b", type: "SS", lag: 0 },
    ]);
  });

  it("geçersiz, olmayan ve kendini gösteren satırları hata sayar", () => {
    const r = parsePredecessors("9, 4, xx, 1QQ", tasks, "d");
    expect(r.predecessors).toEqual([]);
    expect(r.errors).toEqual(["9", "4", "xx", "1QQ"]);
  });

  it("geri yazar", () => {
    const preds = parsePredecessors("1;2SS+3g;3FF-1g", tasks, "d").predecessors;
    expect(formatPredecessors(preds, tasks)).toBe("1;2SS+3g;3FF-1g");
  });
});
