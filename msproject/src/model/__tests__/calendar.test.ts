import { describe, expect, it } from "vitest";
import { dateToWorkday, nextWorkday, workdayToDate, isValidDate } from "../calendar";

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
});
