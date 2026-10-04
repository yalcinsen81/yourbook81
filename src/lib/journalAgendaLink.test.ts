import { describe, it, expect } from "vitest";

/**
 * Ajanda ↔ Günlük çapraz bağlantısının çekirdek mantığı.
 * Bu iki fonksiyon bileşenlerde satır içi yazılı olduğu için burada birebir
 * aynı kurallarla test edilir (tarih eşleşmesi + sıralama + süzme).
 */

interface RawAgendaEvent {
  id?: string;
  dateKey?: string;
  timeStr?: string;
  title?: string;
  hasAlarm?: boolean;
}

interface DayAgendaEvent {
  id: string;
  timeStr: string;
  title: string;
  hasAlarm: boolean;
}

/** JournalView içindeki dayAgendaEvents mantığının aynası. */
function selectDayAgendaEvents(all: RawAgendaEvent[], dateKey: string): DayAgendaEvent[] {
  return all
    .filter((e) => e.dateKey === dateKey && e.title)
    .map((e) => ({
      id: e.id || `${e.dateKey}-${e.timeStr}-${e.title}`,
      timeStr: e.timeStr || "",
      title: e.title || "",
      hasAlarm: !!e.hasAlarm,
    }))
    .sort((a, b) => a.timeStr.localeCompare(b.timeStr));
}

/** CalendarAgendaView içindeki "bu gün günlüğü var mı?" mantığının aynası. */
function hasJournalForDay(journalDateKeys: string[], dateKey: string): boolean {
  return journalDateKeys.includes(dateKey);
}

/** Yerel Date -> YYYY-MM-DD (CalendarAgendaView.toDateKey ile aynı). */
function toDateKey(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

describe("agenda ↔ journal cross-link", () => {
  const events: RawAgendaEvent[] = [
    { id: "a1", dateKey: "2026-03-10", timeStr: "14:00", title: "İhale teslimi", hasAlarm: true },
    { id: "a2", dateKey: "2026-03-10", timeStr: "09:30", title: "Sabah toplantısı" },
    { id: "a3", dateKey: "2026-03-11", timeStr: "10:00", title: "Başka gün" },
    { id: "a4", dateKey: "2026-03-10", timeStr: "18:00" }, // başlıksız -> süzülür
  ];

  it("selects only the requested day", () => {
    const day = selectDayAgendaEvents(events, "2026-03-10");
    expect(day).toHaveLength(2);
    expect(day.every((e) => ["İhale teslimi", "Sabah toplantısı"].includes(e.title))).toBe(true);
  });

  it("sorts by time ascending", () => {
    const day = selectDayAgendaEvents(events, "2026-03-10");
    expect(day.map((e) => e.timeStr)).toEqual(["09:30", "14:00"]);
  });

  it("drops entries without a title", () => {
    const day = selectDayAgendaEvents(events, "2026-03-10");
    expect(day.some((e) => e.title === "")).toBe(false);
  });

  it("keeps the alarm flag", () => {
    const day = selectDayAgendaEvents(events, "2026-03-10");
    expect(day.find((e) => e.title === "İhale teslimi")?.hasAlarm).toBe(true);
    expect(day.find((e) => e.title === "Sabah toplantısı")?.hasAlarm).toBe(false);
  });

  it("synthesises an id when missing", () => {
    const withNoId = selectDayAgendaEvents(
      [{ dateKey: "2026-03-10", timeStr: "08:00", title: "X" }],
      "2026-03-10"
    );
    expect(withNoId[0].id).toBe("2026-03-10-08:00-X");
  });

  it("returns an empty list for a day with no entries", () => {
    expect(selectDayAgendaEvents(events, "2026-03-12")).toEqual([]);
  });

  it("detects whether a day already has a journal entry", () => {
    const journalKeys = ["2026-03-10", "2026-03-12"];
    expect(hasJournalForDay(journalKeys, "2026-03-10")).toBe(true);
    expect(hasJournalForDay(journalKeys, "2026-03-11")).toBe(false);
  });

  it("build the same date key on both sides of the link", () => {
    // Ajanda ve günlük aynı yerel tarihi aynı anahtara çevirmeli,
    // yoksa çapraz bağlantı günü bulamaz.
    const d = new Date(2026, 2, 5); // 5 Mart 2026
    expect(toDateKey(d)).toBe("2026-03-05");
    const d2 = new Date(2026, 11, 31);
    expect(toDateKey(d2)).toBe("2026-12-31");
  });

  it("link round-trip: agenda day -> journal date key matches stored entries", () => {
    const agendaDay = selectDayAgendaEvents(events, "2026-03-10");
    expect(agendaDay.length).toBeGreaterThan(0);
    const journalKeys = ["2026-03-10"];
    // Ajandadan gelen gün, günlükte de kayıtlı olmalı
    expect(hasJournalForDay(journalKeys, toDateKey(new Date(2026, 2, 10)))).toBe(true);
  });
});
