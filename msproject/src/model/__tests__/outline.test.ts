import { describe, expect, it } from "vitest";
import { indent, move, normalizeOutline, outdent, wbsCodes } from "../outline";
import type { Task } from "../types";

const t = (id: string, outline: number): Task => ({ id, name: id, duration: 1, outline, predecessors: [], percent: 0 });
const ids = (ts: Task[]) => ts.map((x) => `${x.id}${x.outline}`).join(" ");

describe("girinti", () => {
  it("içeri ve dışarı alırken alt ağacı taşır", () => {
    const base = [t("a", 0), t("b", 0), t("c", 1), t("d", 0)];
    expect(ids(indent(base, 1))).toBe("a0 b1 c2 d0");
    expect(ids(indent(base, 0))).toBe("a0 b0 c1 d0");
    expect(ids(outdent(base, 2))).toBe("a0 b0 c0 d0");
  });

  it("kardeşler arasında alt ağaçla taşır", () => {
    const base = [t("a", 0), t("b", 1), t("c", 0), t("d", 1), t("e", 0)];
    expect(ids(move(base, 2, -1))).toBe("c0 d1 a0 b1 e0");
    expect(ids(move(base, 0, 1))).toBe("c0 d1 a0 b1 e0");
    expect(ids(move(base, 1, -1))).toBe(ids(base));
  });

  it("tutarsız girintiyi düzeltir ve WBS üretir", () => {
    const fixed = normalizeOutline([t("a", 1), t("b", 3), t("c", 1)]);
    expect(ids(fixed)).toBe("a0 b1 c1");
    expect(wbsCodes([t("a", 0), t("b", 1), t("c", 1), t("d", 2), t("e", 0)])).toEqual(["1", "1.1", "1.2", "1.2.1", "2"]);
  });
});
