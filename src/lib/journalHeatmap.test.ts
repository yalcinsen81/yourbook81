import { describe, it, expect } from "vitest";
import { calculateYearHeatmap, HeatmapDay } from "./journalMoodAnalytics";
import type { JournalEntry } from "../components/JournalView";

/** Isı haritası klavye gezinmesinin çekirdek mantığı (JournalHeatmap onKeyDown aynası). */
function nextDayIndex(days: HeatmapDay[], currentIndex: number, delta: number): number | null {
  const next = days[currentIndex + delta];
  if (!next || next.isFuture) return null;
  return currentIndex + delta;
}

const entries: JournalEntry[] = [
  { id: "a", dateKey: "2026-03-10", timeStr: "10:00", timestamp: 1, mood: "calm", content: "x", wordCount: 3 },
  { id: "b", dateKey: "2026-03-11", timeStr: "10:00", timestamp: 2, mood: "calm", content: "y", wordCount: 3 },
];

const today = new Date(2026, 6, 15); // 15 Temmuz 2026

describe("journalHeatmap - day selection & keyboard navigation", () => {
  it("allows selecting a past/current day", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const idx = map.days.findIndex((d) => d.dateKey === "2026-03-10");
    expect(idx).toBeGreaterThanOrEqual(0);
    // Seçim engellenmez (gelecek değil)
    expect(map.days[idx].isFuture).toBe(false);
  });

  it("blocks navigation into future days", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const todayIdx = map.days.findIndex((d) => d.dateKey === "2026-07-15");
    expect(todayIdx).toBeGreaterThanOrEqual(0);
    // Bugünden +1 gün ileri gidilemez
    expect(nextDayIndex(map.days, todayIdx, 1)).toBeNull();
  });

  it("moves right by one day and down by one week", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const idx = map.days.findIndex((d) => d.dateKey === "2026-03-10");
    const rightIdx = nextDayIndex(map.days, idx, 1);
    const downIdx = nextDayIndex(map.days, idx, 7);
    expect(rightIdx).toBe(idx + 1);
    expect(downIdx).toBe(idx + 7);
    // Sağdaki bir gün sonrası olmalı
    expect(map.days[idx + 1].dateKey > map.days[idx].dateKey).toBe(true);
  });

  it("moves left by one day and up by one week", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const idx = map.days.findIndex((d) => d.dateKey === "2026-03-10");
    expect(nextDayIndex(map.days, idx, -1)).toBe(idx - 1);
    expect(nextDayIndex(map.days, idx, -7)).toBe(idx - 7);
  });

  it("every day has a unique date key (needed for focus selectors)", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const keys = map.days.map((d) => d.dateKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("days with entries stay selectable and keep their level", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const d = map.days.find((x) => x.dateKey === "2026-03-10");
    expect(d?.entryCount).toBe(1);
    expect(d?.level).toBeGreaterThanOrEqual(1);
    expect(d?.isFuture).toBe(false);
  });
});
