import { JournalEntry } from "../components/JournalView";
import { translate } from "../i18n";

export type MoodRange = "7d" | "30d" | "year" | "all";

export interface MoodCountItem {
  id: string;
  count: number;
  percent: number;
}

export interface MoodStats {
  total: number;
  counts: Record<string, number>;
  percents: Record<string, number>;
  dominantMood: string | null;
  dominantPercent: number;
}

export interface WritingHabits {
  totalWords: number;
  avgWordsPerEntry: number;
  peakHourSlot: string;
  entriesWithPrompt: number;
}

export interface CalendarDayCell {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntry: boolean;
  entryCount: number;
  primaryMood: string | null;
  totalWords: number;
}

export const MOOD_ORDER = [
  "peaceful",
  "productive",
  "calm",
  "tired",
  "tense",
  "hard",
] as const;

export function filterJournalByDateRange(
  entries: JournalEntry[],
  range: MoodRange,
  referenceDate = new Date(),
  year?: number
): JournalEntry[] {
  if (range === "all") return entries;

  if (range === "year") {
    const y = year ?? referenceDate.getFullYear();
    const prefix = String(y) + "-";
    return entries.filter((e) => (e.dateKey || "").startsWith(prefix));
  }

  const days = range === "7d" ? 7 : 30;
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const todayKey = referenceDate.toISOString().slice(0, 10);
  return entries.filter((e) => e.dateKey >= cutoffKey && e.dateKey <= todayKey);
}

export function calculateMoodDistribution(entries: JournalEntry[]): MoodStats {
  const counts: Record<string, number> = {
    peaceful: 0,
    productive: 0,
    calm: 0,
    tired: 0,
    tense: 0,
    hard: 0,
  };

  for (const entry of entries) {
    if (counts[entry.mood] !== undefined) {
      counts[entry.mood]++;
    } else {
      counts[entry.mood] = 1;
    }
  }

  const total = entries.length;
  const percents: Record<string, number> = {};
  let dominantMood: string | null = null;
  let maxCount = 0;

  for (const key of MOOD_ORDER) {
    const c = counts[key] || 0;
    percents[key] = total > 0 ? Math.round((c / total) * 100) : 0;
    if (c > maxCount) {
      maxCount = c;
      dominantMood = key;
    }
  }

  const dominantPercent = total > 0 && dominantMood ? percents[dominantMood] : 0;

  return {
    total,
    counts,
    percents,
    dominantMood,
    dominantPercent,
  };
}

export function getMoodCompassInsight(
  dominantMood: string | null,
  total: number,
  lang: string = "tr"
): { title: string; message: string; tag: string } {
  const insight = (key: string) => ({
    title: translate(lang, `insight.${key}.title`),
    message: translate(lang, `insight.${key}.msg`),
    tag: translate(lang, `insight.${key}.tag`),
  });
  if (total === 0 || !dominantMood) return insight("empty");
  switch (dominantMood) {
    case "peaceful": return insight("peaceful");
    case "productive": return insight("productive");
    case "calm": return insight("calm");
    case "tired": return insight("tired");
    case "tense": return insight("tense");
    case "hard": return insight("hard");
    default: return insight("mixed");
  }
}

export interface RadarPoint {
  x: number;
  y: number;
  mood: string;
  count: number;
  percent: number;
  angleDeg: number;
}

export function calculateRadarGeometry(
  counts: Record<string, number>,
  radius = 90,
  center = { x: 120, y: 120 }
): {
  polygonPoints: string;
  points: RadarPoint[];
  gridPolygons: string[];
} {
  const moods = MOOD_ORDER;
  const numAxes = moods.length;
  const values = moods.map((m) => counts[m] || 0);
  const maxVal = Math.max(...values, 1);

  // Concentric polygon background grids (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    return moods
      .map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
        const r = radius * lvl;
        const px = center.x + r * Math.cos(angle);
        const py = center.y + r * Math.sin(angle);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  });

  // Calculate user value polygon points
  const points: RadarPoint[] = moods.map((m, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
    const val = counts[m] || 0;
    // Min 12% radius so it is visible even with 0 counts
    const ratio = Math.max(val / maxVal, 0.12);
    const r = radius * ratio;
    const px = center.x + r * Math.cos(angle);
    const py = center.y + r * Math.sin(angle);
    const angleDeg = Math.round((angle * 180) / Math.PI);

    return {
      x: Math.round(px * 10) / 10,
      y: Math.round(py * 10) / 10,
      mood: m,
      count: val,
      percent: Math.round((val / maxVal) * 100),
      angleDeg,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return { polygonPoints, points, gridPolygons };
}

export function calculateWritingHabits(entries: JournalEntry[], lang: string = "tr"): WritingHabits {
  if (entries.length === 0) {
    return {
      totalWords: 0,
      avgWordsPerEntry: 0,
      peakHourSlot: translate(lang, "habit.nodata"),
      entriesWithPrompt: 0,
    };
  }

  const totalWords = entries.reduce((acc, e) => acc + (e.wordCount || 0), 0);
  const avgWordsPerEntry = Math.round(totalWords / entries.length);
  const entriesWithPrompt = entries.filter((e) => Boolean(e.promptUsed)).length;

  const slots = {
    sabah: 0, // 06:00 - 11:59
    öğle: 0, // 12:00 - 16:59
    akşam: 0, // 17:00 - 21:59
    gece: 0, // 22:00 - 05:59
  };

  for (const e of entries) {
    const hour = parseInt(e.timeStr?.slice(0, 2) || "12", 10);
    if (hour >= 6 && hour < 12) slots.sabah++;
    else if (hour >= 12 && hour < 17) slots.öğle++;
    else if (hour >= 17 && hour < 22) slots.akşam++;
    else slots.gece++;
  }

  let peakSlot = translate(lang, "habit.slot.morning");
  let maxSlotCount = slots.sabah;

  if (slots.öğle > maxSlotCount) {
    maxSlotCount = slots.öğle;
    peakSlot = translate(lang, "habit.slot.noon");
  }
  if (slots.akşam > maxSlotCount) {
    maxSlotCount = slots.akşam;
    peakSlot = translate(lang, "habit.slot.evening");
  }
  if (slots.gece > maxSlotCount) {
    maxSlotCount = slots.gece;
    peakSlot = translate(lang, "habit.slot.night");
  }

  return {
    totalWords,
    avgWordsPerEntry,
    peakHourSlot: peakSlot,
    entriesWithPrompt,
  };
}

export function getMonthCalendarGrid(
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  entries: JournalEntry[]
): CalendarDayCell[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Day of week for 1st day (0 = Sunday, 1 = Monday, ... 6 = Saturday)
  // Shift so Monday is index 0
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  // Map entries by dateKey
  const byDate = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.dateKey) || [];
    list.push(entry);
    byDate.set(entry.dateKey, list);
  }

  const cells: CalendarDayCell[] = [];

  // Previous month trailing days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const monthStr = String(prevMonthIdx + 1).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const key = `${prevYear}-${monthStr}-${dayStr}`;
    const dayEntries = byDate.get(key) || [];
    const totalWords = dayEntries.reduce((acc, cur) => acc + (cur.wordCount || 0), 0);

    cells.push({
      dateKey: key,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: key === todayKey,
      hasEntry: dayEntries.length > 0,
      entryCount: dayEntries.length,
      primaryMood: dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].mood : null,
      totalWords,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const monthStr = String(month + 1).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const key = `${year}-${monthStr}-${dayStr}`;
    const dayEntries = byDate.get(key) || [];
    const totalWords = dayEntries.reduce((acc, cur) => acc + (cur.wordCount || 0), 0);

    cells.push({
      dateKey: key,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: key === todayKey,
      hasEntry: dayEntries.length > 0,
      entryCount: dayEntries.length,
      primaryMood: dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].mood : null,
      totalWords,
    });
  }

  // Next month leading days to complete the 35 or 42 grid
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const monthStr = String(nextMonthIdx + 1).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const key = `${nextYear}-${monthStr}-${dayStr}`;
    const dayEntries = byDate.get(key) || [];
    const totalWords = dayEntries.reduce((acc, cur) => acc + (cur.wordCount || 0), 0);

    cells.push({
      dateKey: key,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: key === todayKey,
      hasEntry: dayEntries.length > 0,
      entryCount: dayEntries.length,
      primaryMood: dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].mood : null,
      totalWords,
    });
  }

  return cells;
}
/** Duygu kimliğini -2..+2 aralığında sayısal bir tona çevir (trend eğrisi için). */
export const MOOD_SCORE: Record<string, number> = {
  peaceful: 2,
  productive: 1.5,
  calm: 1,
  tired: -0.5,
  tense: -1,
  hard: -2,
};

export interface MoodTrendPoint {
  /** ISO tarih anahtarı (YYYY-MM-DD). */
  dateKey: string;
  /** Yerel gün indeksi (0 = Pazartesi ... 6 = Pazar). */
  weekday: number;
  /** Gün kısaltma anahtarı (time.mon ... time.sun) — render sırasında t() ile çevrilir. */
  weekdayKey: string;
  /** O gün ortalama duygu tonu (-2..+2). Girdi yoksa null. */
  score: number | null;
  /** O gün yazılan girdi sayısı. */
  entryCount: number;
  isToday: boolean;
}

const WEEKDAY_KEYS = ["time.mon", "time.tue", "time.wed", "time.thu", "time.fri", "time.sat", "time.sun"];

/** Verilen Date'i yerel saat diliminde YYYY-MM-DD anahtarına çevir. */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function entryDateKey(entry: JournalEntry): string {
  return (entry as { dateKey?: string }).dateKey || "";
}

/**
 * Bugünden geriye doğru 7 günlük (Pazartesi başlangıçlı) duygu trendi üretir.
 * Girdisi olmayan günlerde score = null döner; eğri bu noktalarda boşluk bırakır.
 */
export function calculateWeeklyMoodTrend(entries: JournalEntry[], today = new Date()): MoodTrendPoint[] {
  // Bu haftanın pazartesisini bul
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = (start.getDay() + 6) % 7; // 0 = Pazartesi
  start.setDate(start.getDate() - dow);

  const byDay = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const k = entryDateKey(e);
    if (!k) continue;
    const arr = byDay.get(k);
    if (arr) arr.push(e);
    else byDay.set(k, [e]);
  }

  const todayKey = toDateKey(today);
  const out: MoodTrendPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = toDateKey(d);
    const dayEntries = byDay.get(key) || [];
    let score: number | null = null;
    if (dayEntries.length) {
      let sum = 0;
      let n = 0;
      for (const e of dayEntries) {
        const mood = (e as { mood?: string | null }).mood;
        if (mood && mood in MOOD_SCORE) {
          sum += MOOD_SCORE[mood];
          n++;
        }
      }
      if (n > 0) score = Math.round((sum / n) * 100) / 100;
    }
    out.push({
      dateKey: key,
      weekday: i,
      weekdayKey: WEEKDAY_KEYS[i],
      score,
      entryCount: dayEntries.length,
      isToday: key === todayKey,
    });
  }
  return out;
}

/**
 * Trend noktalarını 0..1 aralığında normalize edip SVG polyline koordinatlarına çevir.
 * Boş günler segmenti böler (her bitişik dolu gün grubu ayrı bir polyline olur).
 */
export function buildMoodTrendPath(
  points: MoodTrendPoint[],
  width: number,
  height: number,
  padding = 10
): { segments: { x: number; y: number; point: MoodTrendPoint }[][]; min: number; max: number } {
  const scores = points.filter((p) => p.score !== null).map((p) => p.score as number);
  const min = scores.length ? Math.min(...scores, -0.001) : -2;
  const max = scores.length ? Math.max(...scores, 0.001) : 2;
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const segments: { x: number; y: number; point: MoodTrendPoint }[][] = [];
  let current: { x: number; y: number; point: MoodTrendPoint }[] = [];
  points.forEach((p, i) => {
    if (p.score === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    const x = padding + (innerW * i) / Math.max(1, points.length - 1);
    const y = padding + innerH * (1 - ((p.score as number) - min) / span);
    current.push({ x, y, point: p });
  });
  if (current.length) segments.push(current);
  return { segments, min, max };
}
export interface HeatmapDay {
  /** ISO tarih anahtarı (YYYY-MM-DD). */
  dateKey: string;
  /** Yerel hafta indeksi (0 = ilk sütun). */
  weekIndex: number;
  /** Yerel gün indeksi (0 = Pazartesi ... 6 = Pazar) = satır. */
  weekday: number;
  /** O gün yazılan girdi sayısı (0 = boş). */
  entryCount: number;
  /** O gün yazılan toplam kelime. */
  words: number;
  /** Yoğunluk seviyesi 0..4 (0 = boş, 4 = en yoğun). */
  level: 0 | 1 | 2 | 3 | 4;
  /** Gelecekte mi (henüz yaşanmamış gün)? */
  isFuture: boolean;
  isToday: boolean;
}

export interface YearHeatmap {
  days: HeatmapDay[];
  weeks: number;
  totalEntries: number;
  totalWords: number;
  activeDays: number;
  /** En yoğun gün girdi sayısı (seviye eşikleri için). */
  maxEntries: number;
  /** Ay başlangıç işaretleri: hafta indeksi -> ay numarası (0-11). */
  monthMarkers: { weekIndex: number; month: number }[];
  /** Yıl. */
  year: number;
}

/**
 * Bir yılın (Pazartesi başlangıçlı) katkı ısı haritasını üretir.
 * GitHub katkı grafiği gibi: 53 sütun (hafta) × 7 satır (gün).
 * Yoğunluk, o gün girdi sayısına göre 4 kovaya bölünür (quartile).
 */
export function calculateYearHeatmap(entries: JournalEntry[], year: number, today = new Date()): YearHeatmap {
  const byDay = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const k = (e as { dateKey?: string }).dateKey || "";
    if (!k || k.slice(0, 4) !== String(year)) continue;
    const arr = byDay.get(k);
    if (arr) arr.push(e);
    else byDay.set(k, [e]);
  }

  // Yılın ilk günü içeren haftanın pazartesisine çek
  const jan1 = new Date(year, 0, 1);
  const startOffset = (jan1.getDay() + 6) % 7; // 0 = Pazartesi
  const gridStart = new Date(year, 0, 1 - startOffset);

  const todayKey = toDateKey(today);
  const days: HeatmapDay[] = [];
  const monthMarkers: { weekIndex: number; month: number }[] = [];
  const seenMonths = new Set<number>();

  let maxEntries = 0;
  let totalEntries = 0;
  let totalWords = 0;
  let activeDays = 0;

  // 53 hafta × 7 gün = 371 hücre (yıl + kenar günleri)
  const WEEKS = 53;
  for (let w = 0; w < WEEKS; w++) {
    for (let wd = 0; wd < 7; wd++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + wd);
      const inYear = d.getFullYear() === year;
      if (!inYear) {
        // Yıl dışı hücreleri yine ekle (grid dikdörtgen kalsın) ama boş/future işaretle
        days.push({
          dateKey: toDateKey(d),
          weekIndex: w,
          weekday: wd,
          entryCount: 0,
          words: 0,
          level: 0,
          isFuture: true,
          isToday: false,
        });
        continue;
      }
      const key = toDateKey(d);
      const list = byDay.get(key) || [];
      const entryCount = list.length;
      const words = list.reduce((a, e) => a + ((e as { wordCount?: number }).wordCount || 0), 0);
      if (entryCount > maxEntries) maxEntries = entryCount;
      if (entryCount > 0) {
        activeDays++;
        totalEntries += entryCount;
        totalWords += words;
      }
      // Ay işareti: yalnızca yıl içindeki ilk görülen ay
      if (d.getDate() === 1 && !seenMonths.has(d.getMonth())) {
        seenMonths.add(d.getMonth());
        monthMarkers.push({ weekIndex: w, month: d.getMonth() });
      }
      days.push({
        dateKey: key,
        weekIndex: w,
        weekday: wd,
        entryCount,
        words,
        level: 0, // sonradan hesaplanır
        isFuture: key > todayKey,
        isToday: key === todayKey,
      });
    }
  }

  // Yoğunluk seviyeleri: 1..maxEntries arasını 4 kovaya böl
  const bucket = maxEntries > 0 ? maxEntries / 4 : 1;
  for (const day of days) {
    if (day.entryCount <= 0) day.level = 0;
    else day.level = Math.min(4, Math.max(1, Math.ceil(day.entryCount / bucket))) as 1 | 2 | 3 | 4;
  }

  return {
    days,
    weeks: WEEKS,
    totalEntries,
    totalWords,
    activeDays,
    maxEntries,
    monthMarkers,
    year,
  };
}
export interface YearSummary {
  year: number;
  totalEntries: number;
  totalWords: number;
  activeDays: number;
  /** O yılın en yoğun günündeki girdi sayısı. */
  maxEntries: number;
  /** Aktif gün başına ortalama kelime. */
  avgWordsPerActiveDay: number;
  /** Yılın ilk ve son girdi tarihi (varsa). */
  firstDate: string | null;
  lastDate: string | null;
  /** Aylara göre girdi dağılımı (12 eleman). */
  monthly: number[];
}

/**
 * Birden çok yılı özetleyip karşılaştırma için hazırlar.
 * Verilen yıllar (varsayılan: girdilerin bulunduğu tüm yıllar) yeniden eskiye sıralanır.
 */
export function calculateYearComparison(entries: JournalEntry[], years?: number[]): YearSummary[] {
  // Yıl listesi verilmediyse girdilerden çıkar
  let list = years;
  if (!list || !list.length) {
    const set = new Set<number>();
    for (const e of entries) {
      const k = (e as { dateKey?: string }).dateKey || "";
      const y = parseInt(k.slice(0, 4), 10);
      if (!Number.isNaN(y)) set.add(y);
    }
    list = Array.from(set);
  }
  if (!list.length) list = [new Date().getFullYear()];

  return list
    .slice()
    .sort((a, b) => b - a)
    .map((year) => {
      const monthly = new Array(12).fill(0);
      let totalEntries = 0;
      let totalWords = 0;
      let maxEntries = 0;
      const activeKeys = new Set<string>();
      let firstDate: string | null = null;
      let lastDate: string | null = null;
      const perDay = new Map<string, number>();

      for (const e of entries) {
        const k = (e as { dateKey?: string }).dateKey || "";
        if (!k || k.slice(0, 4) !== String(year)) continue;
        totalEntries++;
        totalWords += (e as { wordCount?: number }).wordCount || 0;
        activeKeys.add(k);
        perDay.set(k, (perDay.get(k) || 0) + 1);
        const m = parseInt(k.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) monthly[m]++;
        if (!firstDate || k < firstDate) firstDate = k;
        if (!lastDate || k > lastDate) lastDate = k;
      }
      for (const n of perDay.values()) if (n > maxEntries) maxEntries = n;

      const activeDays = activeKeys.size;
      return {
        year,
        totalEntries,
        totalWords,
        activeDays,
        maxEntries,
        avgWordsPerActiveDay: activeDays > 0 ? Math.round((totalWords / activeDays) * 10) / 10 : 0,
        firstDate,
        lastDate,
        monthly,
      };
    });
}
