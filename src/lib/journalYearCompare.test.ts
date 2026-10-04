import { describe, it, expect } from "vitest";
import { calculateYearComparison } from "./journalMoodAnalytics";
import type { JournalEntry } from "../components/JournalView";

const mk = (id: string, dateKey: string, wordCount = 5): JournalEntry => ({
  id,
  dateKey,
  timeStr: "10:00",
  timestamp: 1,
  mood: "calm",
  content: "x",
  wordCount,
});

// 2025: 3 girdi / 2 aktif gün / 30 kelime
// 2026: 4 girdi / 3 aktif gün / 100 kelime
const entries: JournalEntry[] = [
  mk("a", "2025-03-10", 10),
  mk("b", "2025-03-10", 10),
  mk("c", "2025-07-01", 10),
  mk("d", "2026-01-05", 25),
  mk("e", "2026-01-05", 25),
  mk("f", "2026-02-14", 25),
  mk("g", "2026-06-30", 25),
];

describe("journalMoodAnalytics - calculateYearComparison", () => {
  it("discovers the years present in the data, newest first", () => {
    const rows = calculateYearComparison(entries);
    expect(rows.map((r) => r.year)).toEqual([2026, 2025]);
  });

  it("totals entries and words per year", () => {
    const [y2026, y2025] = calculateYearComparison(entries);
    expect(y2026.totalEntries).toBe(4);
    expect(y2026.totalWords).toBe(100);
    expect(y2025.totalEntries).toBe(3);
    expect(y2025.totalWords).toBe(30);
  });

  it("counts active days (unique dates, not entries)", () => {
    const [y2026, y2025] = calculateYearComparison(entries);
    expect(y2026.activeDays).toBe(3); // 01-05, 02-14, 06-30
    expect(y2025.activeDays).toBe(2); // 03-10, 07-01
  });

  it("computes the busiest single day", () => {
    const [y2026, y2025] = calculateYearComparison(entries);
    expect(y2026.maxEntries).toBe(2); // 2026-01-05
    expect(y2025.maxEntries).toBe(2); // 2025-03-10
  });

  it("computes average words per active day", () => {
    const [y2026, y2025] = calculateYearComparison(entries);
    expect(y2026.avgWordsPerActiveDay).toBe(33.3); // 100 / 3
    expect(y2025.avgWordsPerActiveDay).toBe(15); // 30 / 2
  });

  it("builds a 12-slot monthly histogram", () => {
    const [y2026] = calculateYearComparison(entries);
    expect(y2026.monthly).toHaveLength(12);
    expect(y2026.monthly[0]).toBe(2); // Ocak
    expect(y2026.monthly[1]).toBe(1); // Şubat
    expect(y2026.monthly[5]).toBe(1); // Haziran
    expect(y2026.monthly[2]).toBe(0); // Mart boş
  });

  it("reports the first and last entry dates", () => {
    const [y2026, y2025] = calculateYearComparison(entries);
    expect(y2026.firstDate).toBe("2026-01-05");
    expect(y2026.lastDate).toBe("2026-06-30");
    expect(y2025.firstDate).toBe("2025-03-10");
    expect(y2025.lastDate).toBe("2025-07-01");
  });

  it("honours an explicit year list and ignores unknown years", () => {
    const rows = calculateYearComparison(entries, [2024, 2026]);
    expect(rows.map((r) => r.year)).toEqual([2026, 2024]);
    expect(rows[1].totalEntries).toBe(0); // 2024 veri yok
    expect(rows[1].firstDate).toBeNull();
    expect(rows[1].avgWordsPerActiveDay).toBe(0);
  });

  it("falls back to the current year when there is no data", () => {
    const rows = calculateYearComparison([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(new Date().getFullYear());
    expect(rows[0].totalEntries).toBe(0);
    expect(rows[0].monthly).toHaveLength(12);
  });
});
