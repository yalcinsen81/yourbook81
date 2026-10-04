import { describe, it, expect, beforeEach } from "vitest";
import {
  SYNC_KEYS,
  exportCurrentData,
  importDataToStorage,
  getLastSyncedTime,
} from "./syncEngine";

describe("syncEngine.ts - Comprehensive 20-Key Sync Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should contain all essential storage keys including journal, custom handwriting, volume, agenda and sound", () => {
    expect(SYNC_KEYS).toContain("yourbook_journal_entries_v1");
    expect(SYNC_KEYS).toContain("yourbook_custom_handwriting_v1");
    expect(SYNC_KEYS).toContain("yourbook_notebook_volume_v1");
    expect(SYNC_KEYS).toContain("yourbook_sound_profile_v1");
    expect(SYNC_KEYS).toContain("superr_agenda_events_v4");
  });

  it("should export existing local data into a synchronized payload", () => {
    localStorage.setItem("yourbook_notebook_volume_v1", "3");
    localStorage.setItem("yourbook_sound_profile_v1", "pencil");
    localStorage.setItem("yourbook_journal_entries_v1", JSON.stringify([{ id: "j1", content: "test" }]));

    const exported = exportCurrentData();
    expect(exported.yourbook_notebook_volume_v1).toBe(3);
    expect(exported.yourbook_sound_profile_v1).toBe("pencil");
    expect(exported.yourbook_journal_entries_v1).toEqual([{ id: "j1", content: "test" }]);
  });

  it("should import data payload into localStorage and report changes", () => {
    const payload = {
      yourbook_sound_profile_v1: "typewriter",
      yourbook_paper_texture_v1: "kraft",
      superr_theme_v1: "theme-cream",
    };

    const hasChanged = importDataToStorage(payload);
    expect(hasChanged).toBe(true);

    expect(localStorage.getItem("yourbook_sound_profile_v1")).toBe("typewriter");
    expect(localStorage.getItem("yourbook_paper_texture_v1")).toBe("kraft");
    expect(localStorage.getItem("superr_theme_v1")).toBe("theme-cream");

    // Re-importing identical payload should not report changed
    const reImportChanged = importDataToStorage(payload);
    expect(reImportChanged).toBe(false);
  });
});

describe("syncEngine.ts - v26 keys & merge safety", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("includes v26 keys (ui language, volume autoswitch, craft spaces)", () => {
    expect(SYNC_KEYS).toContain("yourbook_ui_language_v1");
    expect(SYNC_KEYS).toContain("yourbook_volume_autoswitch_v1");
    expect(SYNC_KEYS).toContain("craft_custom_spaces_v1");
    expect(SYNC_KEYS).toContain("craft_active_space_taste_v1");
  });

  it("syncs the UI language preference both ways", () => {
    localStorage.setItem("yourbook_ui_language_v1", "de");
    const exported = exportCurrentData();
    expect(exported.yourbook_ui_language_v1).toBe("de");

    localStorage.clear();
    importDataToStorage({ yourbook_ui_language_v1: "ar" });
    expect(localStorage.getItem("yourbook_ui_language_v1")).toBe("ar");
  });

  it("syncs custom language desks", () => {
    const spaces = [{ id: "es-1", languageCode: "es" }];
    localStorage.setItem("craft_custom_spaces_v1", JSON.stringify(spaces));
    const exported = exportCurrentData();
    expect(exported.craft_custom_spaces_v1).toEqual(spaces);
  });

  it("does not wipe unrelated local keys when importing a partial payload", () => {
    localStorage.setItem("yourbook_journal_entries_v1", JSON.stringify([{ id: "keep-me" }]));
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([{ id: "card-1" }]));
    importDataToStorage({ yourbook_sound_profile_v1: "fountain" });
    // Diğer anahtarlar korunmalı
    expect(localStorage.getItem("yourbook_journal_entries_v1")).toContain("keep-me");
    expect(localStorage.getItem("yourbook_deck_v7_clean")).toContain("card-1");
  });

  it("returns null last-synced time before any sync has happened", () => {
    expect(getLastSyncedTime()).toBeNull();
  });
});

import { mergeSyncData, mergeValue } from "./syncEngine";

describe("syncEngine.ts - üç yönlü birleştirme (veri kaybı önleme)", () => {
  const n = (id: string, text: string, updatedAt = 0) => ({ id, text, updatedAt });

  it("yalnız yerel değiştiyse yerel korunur (çevrimdışı düzenleme kaybolmaz)", () => {
    const base = { notes: [n("a", "eski")] };
    const local = { notes: [n("a", "yerel düzenleme")] };
    expect(mergeSyncData(base, local, base).notes).toEqual([n("a", "yerel düzenleme")]);
  });

  it("yalnız bulut değiştiyse bulut uygulanır", () => {
    const base = { theme: "cream" };
    expect(mergeSyncData(base, base, { theme: "dark" }).theme).toBe("dark");
  });

  it("iki taraf farklı öğe eklediyse ikisi de korunur", () => {
    const base = { notes: [n("a", "x")] };
    const local = { notes: [n("a", "x"), n("b", "yerel")] };
    const cloud = { notes: [n("a", "x"), n("c", "bulut")] };
    const ids = (mergeSyncData(base, local, cloud).notes as any[]).map((x) => x.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("bir tarafın silmesi, diğer taraf dokunmadıysa uygulanır", () => {
    const base = { notes: [n("a", "x"), n("b", "y")] };
    const local = { notes: [n("a", "x")] }; // b yerelde silindi
    const merged = mergeSyncData(base, local, base).notes as any[];
    expect(merged.map((x) => x.id)).toEqual(["a"]);
  });

  it("silinen öğe diğer tarafta düzenlendiyse geri gelir", () => {
    const base = { notes: [n("a", "x")] };
    const local = { notes: [] as any[] };
    const cloud = { notes: [n("a", "bulutta düzenlendi")] };
    expect((mergeSyncData(base, local, cloud).notes as any[])[0].text).toBe("bulutta düzenlendi");
  });

  it("aynı öğeyi iki taraf düzenlediyse daha yeni updatedAt kazanır", () => {
    const base = { notes: [n("a", "x", 1)] };
    const local = { notes: [n("a", "yerel", 5)] };
    const cloud = { notes: [n("a", "bulut", 9)] };
    expect((mergeSyncData(base, local, cloud).notes as any[])[0].text).toBe("bulut");
  });

  it("id'siz değerlerde çakışmada yerel kazanır; bulutta olmayan yerel anahtar korunur", () => {
    expect(mergeValue("a", "yerel", "bulut")).toBe("yerel");
    expect(mergeSyncData({}, { only: 1 }, { other: 2 })).toEqual({ only: 1, other: 2 });
  });
});
