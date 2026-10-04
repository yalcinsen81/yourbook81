import { describe, it, expect, beforeEach } from "vitest";
import { createBackup, restoreBackup } from "./backup";

describe("backup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("bilinen anahtarları yedekler", () => {
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([{ id: "c1" }]));
    localStorage.setItem("lexi_engagement_v1", JSON.stringify({ xp: 120 }));

    const backup = createBackup();
    expect(backup.app).toBe("lexi-cards");
    expect(backup.version).toBe(1);
    expect(backup.data["yourbook_deck_v7_clean"]).toEqual([{ id: "c1" }]);
    expect(backup.data["lexi_engagement_v1"]).toEqual({ xp: 120 });
  });

  it("boş anahtarları yedeğe eklemez", () => {
    localStorage.setItem("yourbook_notes_v1", JSON.stringify([]));
    const backup = createBackup();
    expect(backup.data["yourbook_notes_v1"]).toEqual([]);
    expect(backup.data["craft_active_space_taste_v1"]).toBeUndefined();
  });

  it("restoreBackup verileri geri yükler", () => {
    const backup = createBackup();
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([{ id: "c1", word: "nehmen" }]));
    const fresh = createBackup();

    localStorage.clear();
    const result = restoreBackup(fresh);
    expect(result.restoredKeys).toContain("yourbook_deck_v7_clean");
    expect(JSON.parse(localStorage.getItem("yourbook_deck_v7_clean")!)).toEqual([
      { id: "c1", word: "nehmen" },
    ]);
    void backup;
  });

  it("yanlış uygulamadan gelen yedeği reddeder", () => {
    const result = restoreBackup({ app: "baska-uygulama" as any, version: 1, exportedAt: "", data: {} });
    expect(result.restoredKeys).toHaveLength(0);
  });
});
