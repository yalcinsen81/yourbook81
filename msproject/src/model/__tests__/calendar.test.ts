import { describe, expect, it } from "vitest";
import { dateToWorkday, nextWorkday, workdayToDate, isValidDate, WorkCalendar } from "../calendar";
import { turkishHolidays } from "../holidays";

// 2026-10-12 pazartesi
describe("takvim", () => {
  it("iş günü ofsetini tarihe çevirir, hafta sonunu atlar", () => {
    expect(workdayToDate("2026-10-12", 0)).toBe("2026-10-12");
    expect(workdayToDate("2026-10-12", 4)).toBe("2026-10-16");
    expect(workdayToDate("2026-10-12", 5)).toBe("2026-10-19");
    expect(workdayToDate("2026-10-14", 3)).toBe("2026-10-19");
    expect(workdayToDate("2026-10-12", -1)).toBe("2026-10-09");
  });

  it("tarihi ofsete çevirir ve geri çevirir", () => {
    for (const base of ["2026-10-12", "2026-10-14", "2026-10-16"]) {
      for (let n = -12; n < 40; n++) {
        expect(dateToWorkday(base, workdayToDate(base, n))).toBe(n);
      }
    }
  });

  it("hafta sonu tarihini pazartesiye yuvarlar", () => {
    expect(nextWorkday("2026-10-17")).toBe("2026-10-19");
    expect(dateToWorkday("2026-10-12", "2026-10-18")).toBe(5);
  });

  it("geçersiz tarihi reddeder", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("12.10.2026")).toBe(false);
  });

  it("tatilli takvim: ofset ve tarih birbirinin tersidir", () => {
    const cal = new WorkCalendar("2026-10-12", ["2026-10-29", "2026-10-30", "2026-10-09"]);
    expect(cal.toDate(12)).toBe("2026-10-28");
    expect(cal.toDate(13)).toBe("2026-11-02");
    expect(cal.toOffset("2026-10-29")).toBe(13);
    expect(cal.toDate(-1)).toBe("2026-10-08");
    for (let n = -15; n < 60; n++) expect(cal.toOffset(cal.toDate(n))).toBe(n);
    expect(cal.workdaysBetween("2026-10-26", "2026-11-02")).toBe(4);
  });

  it("tatil günü başlarsa ilk iş günü taban olur", () => {
    const cal = new WorkCalendar("2027-01-01", turkishHolidays(2027, 2027).map((h) => h.date));
    expect(cal.base).toBe("2027-01-04");
  });

  it("Türkiye tatil listesi bayramları gün gün içerir", () => {
    const list = turkishHolidays(2026, 2026);
    expect(list.filter((h) => h.name.startsWith("Kurban")).map((h) => h.date)).toEqual([
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
    ]);
    expect(list.some((h) => h.date === "2026-10-29")).toBe(true);
  });
});
