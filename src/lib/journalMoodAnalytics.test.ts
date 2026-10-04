import { describe, it, expect } from "vitest";
import {
  calculateMoodDistribution,
  filterJournalByDateRange,
  getMoodCompassInsight,
  calculateRadarGeometry,
  calculateWritingHabits,
  getMonthCalendarGrid,
  calculateWeeklyMoodTrend,
  buildMoodTrendPath,
  calculateYearHeatmap,
} from "./journalMoodAnalytics";
import { JournalEntry } from "../components/JournalView";

describe("journalMoodAnalytics.ts - Emotional Compass & Calendar Engine", () => {
  const mockEntries: JournalEntry[] = [
    {
      id: "j1",
      dateKey: "2026-03-15",
      timeStr: "09:30",
      timestamp: 1773567000000,
      mood: "peaceful",
      content: "Sabah kahvesi eşliğinde huzur dolu bir defter açılışı.",
      wordCount: 8,
    },
    {
      id: "j2",
      dateKey: "2026-03-14",
      timeStr: "14:15",
      timestamp: 1773497700000,
      mood: "productive",
      content: "Bugün tüm görevleri tamamladım.",
      wordCount: 5,
    },
    {
      id: "j3",
      dateKey: "2026-03-10",
      timeStr: "23:45",
      timestamp: 1773186300000,
      mood: "peaceful",
      content: "Gece lambası altında sakin düşünceler.",
      promptUsed: "Şu an zihninden geçen filtresiz ilk cümle ne?",
      wordCount: 6,
    },
    {
      id: "j4",
      dateKey: "2026-02-20",
      timeStr: "19:00",
      timestamp: 1771610400000,
      mood: "tired",
      content: "Eski bir kayıt.",
      wordCount: 3,
    },
  ];

  it("should calculate mood distribution and dominant mood correctly", () => {
    const stats = calculateMoodDistribution(mockEntries);
    expect(stats.total).toBe(4);
    expect(stats.counts.peaceful).toBe(2);
    expect(stats.counts.productive).toBe(1);
    expect(stats.counts.tired).toBe(1);
    expect(stats.counts.calm).toBe(0);
    expect(stats.dominantMood).toBe("peaceful");
    expect(stats.dominantPercent).toBe(50);
  });

  it("should filter entries by 7d, 30d, and all correctly", () => {
    const ref = new Date("2026-03-15T12:00:00Z");
    const last7 = filterJournalByDateRange(mockEntries, "7d", ref);
    expect(last7.map((e) => e.id)).toEqual(["j1", "j2", "j3"]);

    const last30 = filterJournalByDateRange(mockEntries, "30d", ref);
    expect(last30.length).toBe(4);

    const all = filterJournalByDateRange(mockEntries, "all", ref);
    expect(all.length).toBe(4);
  });

  it("should return poetic mood insights", () => {
    const insight = getMoodCompassInsight("peaceful", 5);
    expect(insight.title).toBe("dingin ve dengeli bir dönem"); expect(insight.message).toContain("huzur");
    expect(insight.tag).toBe("iç sükûnet");

    const empty = getMoodCompassInsight(null, 0);
    expect(empty.title).toBe("defterin henüz sessiz");
  });

  it("should compute radar geometry with 6 vertices and valid points", () => {
    const stats = calculateMoodDistribution(mockEntries);
    const { polygonPoints, points, gridPolygons } = calculateRadarGeometry(stats.counts, 100, { x: 100, y: 100 });

    expect(points).toHaveLength(6);
    expect(gridPolygons).toHaveLength(4);
    expect(polygonPoints.split(" ").length).toBe(6);
    expect(points.find((p) => p.mood === "peaceful")?.count).toBe(2);
  });

  it("should calculate writing habits including word counts and peak slot", () => {
    const habits = calculateWritingHabits(mockEntries);
    expect(habits.totalWords).toBe(22);
    expect(habits.avgWordsPerEntry).toBe(6);
    expect(habits.entriesWithPrompt).toBe(1);
  });

  it("should generate a complete monthly calendar grid with entry links", () => {
    const grid = getMonthCalendarGrid(2026, 2, mockEntries); // March 2026 (0-indexed month 2)
    expect(grid.length % 7).toBe(0);
    const march15 = grid.find((c) => c.dateKey === "2026-03-15");
    expect(march15).toBeDefined();
    expect(march15?.hasEntry).toBe(true);
    expect(march15?.primaryMood).toBe("peaceful");
    expect(march15?.totalWords).toBe(8);
  });
});

describe("journalMoodAnalytics.ts - Weekly Mood Trend (mürekkep eğrisi)", () => {
  // 2026-03-16 bir Pazartesi'dir.
  const monday = new Date(2026, 2, 16);
  const entries: JournalEntry[] = [
    { id: "t1", dateKey: "2026-03-16", timeStr: "09:00", timestamp: 1, mood: "peaceful", content: "a", wordCount: 1 },
    { id: "t2", dateKey: "2026-03-17", timeStr: "09:00", timestamp: 2, mood: "tense", content: "b", wordCount: 1 },
    // 18 Mart: girdi yok (boşluk)
    { id: "t3", dateKey: "2026-03-19", timeStr: "09:00", timestamp: 3, mood: "calm", content: "c", wordCount: 1 },
    { id: "t4", dateKey: "2026-03-19", timeStr: "20:00", timestamp: 4, mood: "hard", content: "d", wordCount: 1 },
  ];

  it("returns exactly 7 days starting on Monday, with weekday keys", () => {
    const pts = calculateWeeklyMoodTrend(entries, monday);
    expect(pts).toHaveLength(7);
    expect(pts[0].dateKey).toBe("2026-03-16");
    expect(pts[6].dateKey).toBe("2026-03-22");
    expect(pts[0].weekdayKey).toBe("time.mon");
    expect(pts[6].weekdayKey).toBe("time.sun");
  });

  it("maps moods to numeric scores and averages multiple entries per day", () => {
    const pts = calculateWeeklyMoodTrend(entries, monday);
    expect(pts[0].score).toBe(2); // peaceful
    expect(pts[1].score).toBe(-1); // tense
    expect(pts[2].score).toBeNull(); // no entry
    // calm (1) + hard (-2) => -0.5
    expect(pts[3].score).toBe(-0.5);
  });

  it("marks today and counts entries per day", () => {
    const pts = calculateWeeklyMoodTrend(entries, monday);
    expect(pts[0].isToday).toBe(true);
    expect(pts[1].isToday).toBe(false);
    expect(pts[3].entryCount).toBe(2);
    expect(pts[2].entryCount).toBe(0);
  });

  it("splits the trend polyline into segments around empty days", () => {
    const pts = calculateWeeklyMoodTrend(entries, monday);
    const { segments } = buildMoodTrendPath(pts, 100, 40, 6);
    // Pzt-Sal | (boşluk) | Per => 2 segment
    expect(segments.length).toBe(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1]).toHaveLength(1);
  });

  it("keeps every coordinate inside the viewport", () => {
    const pts = calculateWeeklyMoodTrend(entries, monday);
    const { segments } = buildMoodTrendPath(pts, 100, 40, 6);
    for (const seg of segments) {
      for (const s of seg) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(40);
      }
    }
  });

  it("returns an empty trend gracefully when there are no entries", () => {
    const pts = calculateWeeklyMoodTrend([], monday);
    expect(pts.every((p) => p.score === null)).toBe(true);
    const { segments } = buildMoodTrendPath(pts, 100, 40, 6);
    expect(segments).toHaveLength(0);
  });
});

describe("journalMoodAnalytics.ts - Year Heatmap (katkı ısı haritası)", () => {
  // 2026 başlangıcı: 1 Ocak 2026 bir Perşembe'dir.
  const today = new Date(2026, 6, 15); // 15 Temmuz 2026

  const entries: JournalEntry[] = [
    { id: "h1", dateKey: "2026-01-01", timeStr: "09:00", timestamp: 1, mood: "calm", content: "a", wordCount: 10 },
    { id: "h2", dateKey: "2026-01-01", timeStr: "21:00", timestamp: 2, mood: "calm", content: "b", wordCount: 5 },
    { id: "h3", dateKey: "2026-03-10", timeStr: "09:00", timestamp: 3, mood: "tired", content: "c", wordCount: 20 },
    { id: "h4", dateKey: "2026-07-15", timeStr: "09:00", timestamp: 4, mood: "peaceful", content: "d", wordCount: 30 },
    // Farklı yıl: haritaya girmemeli
    { id: "h5", dateKey: "2025-12-31", timeStr: "09:00", timestamp: 5, mood: "calm", content: "e", wordCount: 99 },
  ];

  it("builds a 53-week × 7-day grid", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    expect(map.weeks).toBe(53);
    expect(map.days).toHaveLength(53 * 7);
    expect(map.year).toBe(2026);
  });

  it("ignores entries from other years", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const dec31 = map.days.find((d) => d.dateKey === "2025-12-31");
    expect(dec31 === undefined || dec31.entryCount === 0).toBe(true);
    expect(map.totalEntries).toBe(4);
  });

  it("aggregates multiple entries on the same day", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const jan1 = map.days.find((d) => d.dateKey === "2026-01-01");
    expect(jan1?.entryCount).toBe(2);
    expect(jan1?.words).toBe(15);
  });

  it("summarises active days, entries and words", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    expect(map.activeDays).toBe(3); // 1 Ocak, 10 Mart, 15 Temmuz
    expect(map.totalEntries).toBe(4);
    expect(map.totalWords).toBe(65); // 10+5+20+30
    expect(map.maxEntries).toBe(2);
  });

  it("assigns intensity levels 0..4 and keeps empty days at 0", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const jan1 = map.days.find((d) => d.dateKey === "2026-01-01");
    const jan2 = map.days.find((d) => d.dateKey === "2026-01-02");
    expect(jan1?.level).toBeGreaterThanOrEqual(1);
    expect(jan1?.level).toBeLessThanOrEqual(4);
    expect(jan2?.level).toBe(0);
  });

  it("marks today and future days correctly", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    const t15 = map.days.find((d) => d.dateKey === "2026-07-15");
    const dec25 = map.days.find((d) => d.dateKey === "2026-12-25");
    expect(t15?.isToday).toBe(true);
    expect(t15?.isFuture).toBe(false);
    expect(dec25?.isFuture).toBe(true);
  });

  it("produces month markers in chronological order", () => {
    const map = calculateYearHeatmap(entries, 2026, today);
    expect(map.monthMarkers.length).toBe(12);
    expect(map.monthMarkers[0].month).toBe(0);
    const weeks = map.monthMarkers.map((m) => m.weekIndex);
    expect([...weeks].sort((a, b) => a - b)).toEqual(weeks);
  });

  it("returns an all-empty grid when there are no entries", () => {
    const map = calculateYearHeatmap([], 2026, today);
    expect(map.activeDays).toBe(0);
    expect(map.totalEntries).toBe(0);
    expect(map.maxEntries).toBe(0);
    expect(map.days.every((d) => d.level === 0)).toBe(true);
  });
});

describe("heatmap overlay (v98) - two-year comparison", () => {
  const mk = (id: string, dateKey: string) => ({
    id,
    dateKey,
    timeStr: "10:00",
    timestamp: 1,
    mood: "calm" as const,
    content: "x",
    promptUsed: undefined,
    wordCount: 3,
  });

  it("two different years produce independent heatmaps", () => {
    const entries = [
      mk("a", "2026-03-10"),
      mk("b", "2026-03-18"),
      mk("c", "2025-05-01"),
      mk("d", "2025-05-02"),
      mk("e", "2025-05-03"),
    ];
    const m2026 = calculateYearHeatmap(entries, 2026);
    const m2025 = calculateYearHeatmap(entries, 2025);
    expect(m2026.days.filter((d) => d.entryCount > 0).length).toBe(2);
    expect(m2025.days.filter((d) => d.entryCount > 0).length).toBe(3);
  });

  it("overlay grids share the same coordinate system", () => {
    const entries = [mk("a", "2026-03-10"), mk("c", "2025-05-01")];
    for (const y of [2026, 2025]) {
      const m = calculateYearHeatmap(entries, y);
      expect(m.days.length).toBeGreaterThanOrEqual(365);
      for (const d of m.days) {
        expect(d.weekIndex).toBeGreaterThanOrEqual(0);
        expect(d.weekday).toBeGreaterThanOrEqual(0);
        expect(d.weekday).toBeLessThanOrEqual(6);
        expect(d.level).toBeGreaterThanOrEqual(0);
        expect(d.level).toBeLessThanOrEqual(4);
      }
    }
  });

  it("a year with no entries yields an all-empty grid", () => {
    const entries = [mk("a", "2026-03-10")];
    const m = calculateYearHeatmap(entries, 2024);
    expect(m.days.every((d) => d.entryCount === 0)).toBe(true);
  });
});

describe("filterJournalByDateRange - year range (v99 sync)", () => {
  const mk = (id: string, dateKey: string) => ({
    id,
    dateKey,
    timeStr: "10:00",
    timestamp: 1,
    mood: "calm" as const,
    content: "x",
    promptUsed: undefined,
    wordCount: 3,
  });

  const entries = [
    mk("a", "2026-01-05"),
    mk("b", "2026-06-18"),
    mk("c", "2026-12-31"),
    mk("d", "2025-03-10"),
    mk("e", "2025-11-20"),
  ];

  it("returns only entries of the requested year", () => {
    const r2026 = filterJournalByDateRange(entries, "year", new Date(), 2026);
    expect(r2026.map((e) => e.id)).toEqual(["a", "b", "c"]);
    const r2025 = filterJournalByDateRange(entries, "year", new Date(), 2025);
    expect(r2025.map((e) => e.id)).toEqual(["d", "e"]);
  });

  it("falls back to the reference date year when year is omitted", () => {
    const ref = new Date("2025-07-01T00:00:00");
    const r = filterJournalByDateRange(entries, "year", ref);
    expect(r.map((e) => e.id)).toEqual(["d", "e"]);
  });

  it("year range differs from 30d and all", () => {
    const ref = new Date("2026-06-20T00:00:00");
    const rYear = filterJournalByDateRange(entries, "year", ref, 2026);
    const r30d = filterJournalByDateRange(entries, "30d", ref);
    const rAll = filterJournalByDateRange(entries, "all", ref);
    expect(rYear.length).toBe(3);
    expect(r30d.length).toBe(1);
    expect(rAll.length).toBe(5);
  });

  it("returns an empty array for a year with no entries", () => {
    const r = filterJournalByDateRange(entries, "year", new Date(), 2024);
    expect(r).toEqual([]);
  });
});
