import { describe, it, expect, beforeEach } from "vitest";
import {
  getSavedHandwriting,
  saveCustomHandwriting,
  getSavedCustomHandwriting,
  evaluateMilestones,
  getCurrentVolume,
  advanceToNextVolume,
  getArchivedVolumes,
  STORAGE_KEY_FONT,
  type CustomHandwritingConfig,
  evaluateVolumeFill,
  isVolumeAutoswitchEnabled,
  setVolumeAutoswitchEnabled,
  getVolumeAutoswitchState,
  VOLUME_AUTOSWITCH_KEY,
  TOTAL_BADGES,
} from "./notebookConfig";

describe("notebookConfig.ts - Handwriting, Volumes & Milestones", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should default to kalam font", () => {
    expect(getSavedHandwriting()).toBe("kalam");
  });

  it("should support custom handwriting font", () => {
    localStorage.setItem(STORAGE_KEY_FONT, "custom");
    expect(getSavedHandwriting()).toBe("custom");
  });

  it("should save and retrieve custom handwriting calibration", () => {
    const config: CustomHandwritingConfig = {
      createdAt: 1711280000000,
      previewImage: "data:image/png;base64,iVBORw0KGgoAAA",
      slant: 7,
      weight: 580,
      letterSpacing: 0.5,
      baseFont: "kalam",
      label: "Benim El Yazım",
      sourceType: "draw",
      analysis: {
        strokeDensity: 32,
        detectedSlant: 7,
        inkContrast: 94,
        naturalJitter: 5,
      },
    };

    saveCustomHandwriting(config);
    const retrieved = getSavedCustomHandwriting();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.slant).toBe(7);
    expect(retrieved?.baseFont).toBe("kalam");
    expect(retrieved?.analysis.inkContrast).toBe(94);
  });

  it("should unlock 'Özgün Defter' milestone when custom handwriting is active", () => {
    localStorage.setItem(STORAGE_KEY_FONT, "custom");
    const milestones = evaluateMilestones();
    const customBadge = milestones.find((m) => m.id === "custom_notebook");
    expect(customBadge?.unlocked).toBe(true);
  });

  it("should track volumes and archiving correctly", () => {
    expect(getCurrentVolume()).toBe(1);
    expect(getArchivedVolumes()).toHaveLength(0);

    const newVol = advanceToNextVolume(50, 10);
    expect(newVol).toBe(2);
    expect(getCurrentVolume()).toBe(2);

    const archives = getArchivedVolumes();
    expect(archives).toHaveLength(1);
    expect(archives[0].volume).toBe(1);
    expect(archives[0].wordsLearned).toBe(50);
    expect(archives[0].journalCount).toBe(10);
  });
});

describe("notebookConfig.ts - Volume fill & auto-switch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const seed = (journals: number, learnedWords: number, badges: number) => {
    const entries = Array.from({ length: journals }, (_, i) => ({
      id: "j" + i,
      dateKey: "2026-03-0" + ((i % 9) + 1),
      timeStr: "10:00",
      timestamp: i,
      mood: "calm",
      content: "x",
      wordCount: 5,
    }));
    localStorage.setItem("yourbook_journal_entries_v1", JSON.stringify(entries));
    const cards = Array.from({ length: learnedWords }, (_, i) => ({
      id: "c" + i,
      learnedAt: i % 2 === 0 ? Date.now() : 0,
    }));
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(cards));
    // Rozet sayısını taklit et: ilerleme anahtarlarını doldur
    if (badges >= 1) localStorage.setItem("yourbook_journal_entries_v1_dummy", "1");
    return { journals, learnedWords };
  };

  it("reports total badge capacity as 9", () => {
    expect(TOTAL_BADGES).toBe(9);
  });

  it("returns an empty/low fill for a fresh notebook", () => {
    const fill = evaluateVolumeFill();
    expect(fill.journalCount).toBe(0);
    expect(fill.wordsLearned).toBe(0);
    expect(fill.isFull).toBe(false);
    expect(fill.ratio).toBeGreaterThanOrEqual(0);
    expect(fill.ratio).toBeLessThan(0.5);
  });

  it("counts journal entries and learned words", () => {
    seed(12, 20, 0);
    const fill = evaluateVolumeFill();
    expect(fill.journalCount).toBe(12);
    expect(fill.wordsLearned).toBe(10); // yarısı learnedAt=0 -> sayılmaz
    expect(fill.totalBadges).toBe(TOTAL_BADGES);
  });

  it("reaches a high ratio with lots of content", () => {
    seed(40, 120, 0);
    const fill = evaluateVolumeFill();
    expect(fill.ratio).toBeGreaterThan(0.3);
    expect(fill.reasons).toContain("many_journals");
    expect(fill.reasons).toContain("many_words");
  });

  it("is not full unless badges are complete", () => {
    seed(40, 120, 0);
    const fill = evaluateVolumeFill();
    // Çok içerik olsa da rozetler tamamlanmadıysa isFull false olabilir
    // (ratio >= 0.85 && badges >= 7 koşulu rozet gerektir)
    expect(fill.isFull).toBe(false);
  });

  it("autoswitch preference defaults to off and persists", () => {
    expect(isVolumeAutoswitchEnabled()).toBe(false);
    setVolumeAutoswitchEnabled(true);
    expect(localStorage.getItem(VOLUME_AUTOSWITCH_KEY)).toBe("1");
    expect(isVolumeAutoswitchEnabled()).toBe(true);
    setVolumeAutoswitchEnabled(false);
    expect(isVolumeAutoswitchEnabled()).toBe(false);
  });

  it("reports 'off' when the preference is disabled", () => {
    expect(getVolumeAutoswitchState()).toBe("off");
  });

  it("reports 'idle' when enabled but the volume is not full", () => {
    setVolumeAutoswitchEnabled(true);
    seed(1, 1, 0);
    expect(getVolumeAutoswitchState()).toBe("idle");
  });
});
