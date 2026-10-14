import { describe, expect, it } from "vitest";
import { dateOrder, datePattern, formatDateLocal, invalidDateMessage, msgText, parseDateLocal, setLocale, t } from "../../i18n";
import { formatShort } from "../calendar";
import { parsePercentCell } from "../cellInput";
import { RELIGIOUS_HOLIDAYS, LAST_RELIGIOUS_YEAR } from "../holidayData";
import { turkishHolidays, yearsWithoutReligiousData } from "../holidays";
import { progressWarnings } from "../ops";
import { progressCurves } from "../resources";
import { buildReport, earnedValue, noActualCost } from "../reports";
import { schedule } from "../schedule";
import { writeXlsx } from "../xlsx";
import { referenceProject } from "./fixtures/reference";

describe("1 dil değişimi: metinler hemen yeni dilde", () => {
  it("işlev olarak saklanan bildirim dil değişince yeniden üretilir", () => {
    const msg = () => t("valid.percent");
    expect(msgText(msg)).toBe("Yüzde 0 ile 100 arasında bir sayı olmalı.");
    setLocale({ lang: "en" });
    expect(msgText(msg)).toBe("Percent must be a number between 0 and 100.");
  });

  it("maliyet uyarısı ve rapor notları yeniden hesaplanınca seçili dilde", () => {
    const p = referenceProject();
    p.tasks.forEach((x) => (x.assignments = []));
    const curves = progressCurves(p, schedule(p), "2026-12-01");
    const tr = progressWarnings(curves, "cost").join(" ");
    expect(tr).toContain("Hiçbir görevde maliyet yok");
    setLocale({ lang: "en" });
    const en = progressWarnings(curves, "cost").join(" ");
    expect(en).not.toMatch(/[ğışçöü]/i);
    expect(en).not.toBe(tr);
  });

  it("sekme başlığı anahtarı iki dilde", () => {
    expect(t("app.title")).toBe("Proje Planlayıcı");
    setLocale({ lang: "en" });
    expect(t("app.title")).toBe("Project Planner");
  });
});

describe("3 geçersiz giriş", () => {
  it("tarih: 13/45/2026 ve 2026-02-30 okunamaz; uyarı örnekli", () => {
    expect(parseDateLocal("13/45/2026")).toBeNull();
    expect(parseDateLocal("2026-02-30")).toBeNull();
    expect(invalidDateMessage()).toBe("Tarih okunamadı. Örnek: 13.11.2026 veya 2026-11-13.");
    setLocale({ lang: "en" });
    expect(invalidDateMessage()).toBe("Couldn't read the date. Example: 11/13/2026 or 2026-11-13.");
  });

  it("yüzde: abc, -5, 0.5 geçersiz; 150 → 100 (bildirilir); geçerli olanlar eskisi gibi", () => {
    expect(parsePercentCell("abc")).toBeNull();
    expect(parsePercentCell("-5")).toBeNull();
    expect(parsePercentCell("0.5")).toBeNull();
    expect(parsePercentCell("150")).toEqual({ value: 100, clamped: true });
    expect(parsePercentCell("%45")).toEqual({ value: 45, clamped: false });
    expect(parsePercentCell("45%")).toEqual({ value: 45, clamped: false });
    expect(parsePercentCell("100")).toEqual({ value: 100, clamped: false });
    expect(t("valid.percentClamped")).toContain("100'e ayarlandı");
  });
});

describe("4–5 tarih biçimi", () => {
  it("üç seçenek: dile göre, GG.AA.YYYY, ISO", () => {
    expect(formatDateLocal("2026-11-02")).toBe("02.11.2026");
    setLocale({ lang: "en" });
    expect(formatDateLocal("2026-11-02")).toBe("11/2/2026");
    expect(datePattern()).toBe("MM/DD/YYYY");
    setLocale({ dateStyle: "dmy" });
    expect(dateOrder()).toBe("dmy");
    expect(formatDateLocal("2026-11-02")).toBe("02.11.2026");
    expect(datePattern()).toBe("DD.MM.YYYY");
    setLocale({ dateStyle: "iso" });
    expect(formatDateLocal("2026-11-02")).toBe("2026-11-02");
    expect(t("settings.dateLocaleHint")).toBe("11/2/2026 = month/day/year");
  });

  it("belirsiz 03/04/2026 seçili biçime uyar", () => {
    expect(parseDateLocal("03/04/2026")).toBe("2026-04-03");
    setLocale({ lang: "en" });
    expect(parseDateLocal("03/04/2026")).toBe("2026-03-04");
    setLocale({ dateStyle: "dmy" });
    expect(parseDateLocal("03/04/2026")).toBe("2026-04-03");
    expect(parseDateLocal("03.04.2026")).toBe("2026-04-03");
    expect(parseDateLocal("2026-04-03")).toBe("2026-04-03");
  });

  it("başlangıç ve bitiş aynı biçimde: gün kısaltması + tarih", () => {
    expect(formatShort("2026-11-02")).toBe("Pzt 02.11.2026");
    expect(formatShort("2026-11-13")).toBe("Cum 13.11.2026");
    setLocale({ lang: "en", dateStyle: "iso" });
    expect(formatShort("2026-11-13")).toBe("Fri 2026-11-13");
  });

  it("Excel tarih hücresi seçili biçimde", () => {
    const sheet = { name: "a", header: ["d"], kinds: ["date" as const], rows: [["2026-11-02"]] };
    const code = () => new TextDecoder().decode(writeXlsx([sheet])).match(/numFmtId="165" formatCode="([^"]+)"/)?.[1];
    expect(code()).toBe("dd.mm.yyyy");
    setLocale({ lang: "en" });
    expect(code()).toBe("m/d/yyyy");
    setLocale({ dateStyle: "iso" });
    expect(code()).toBe("yyyy-mm-dd");
  });
});

describe("6 küçük ekranda pencereler (stil kuralları; ölçüm tarayıcı denemesinde)", () => {
  it("pencere ekran içinde, başlık ve düğmeler yapışkan, çocuklar sıkışmaz", async () => {
    // Stil dosyası düz metin olarak okunur (Node türleri projede yok)
    const fsName = "node:fs";
    const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync: (path: string, enc: string) => string };
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.modal \{\s*max-height: calc\(100vh - 2rem\);/);
    expect(css).toMatch(/\.modal > \* \{\s*flex-shrink: 0;/);
    expect(css).toMatch(/\.modal > h2 \{\s*position: sticky;\s*top: 0;/);
    expect(css).toMatch(/\.modal > \.modal-actions \{\s*position: sticky;\s*bottom: 0;/);
  });
});

describe("7 CPI gösterimi (hesap değişmez)", () => {
  const started = () => {
    const p = referenceProject();
    p.tasks[0].percent = 100;
    p.tasks[1].percent = 40;
    return p;
  };

  it("gerçekleşen maliyet yokken CPI/EAC/ETC/VAC gösterilmez; BAC, PV, EV, SPI aynı", () => {
    const p = started();
    const e = earnedValue(p, schedule(p), "2026-12-01");
    expect([e.bac, e.pv, e.ev, e.spi]).toEqual([635_000, 205_000, 185_000, 0.902]);
    // Hesap aynı kalır (AC = EV varsayımı), yalnızca gösterim boş
    expect([e.ac, e.cpi, e.eac]).toEqual([185_000, 1, 635_000]);
    expect(noActualCost(e)).toBe(true);
    const table = buildReport("evm", p, schedule(p), { today: "2026-12-01" });
    const value = (m: string) => table.rows.find((r) => r.metric === m)?.value;
    expect([value("CPI"), value("EAC"), value("ETC"), value("VAC")]).toEqual([null, null, null, null]);
    expect([value("BAC"), value("PV"), value("EV"), value("SPI")]).toEqual([635_000, 205_000, 185_000, 0.902]);
    expect(table.notes?.join(" ")).toContain("Hiçbir görevde gerçekleşen maliyet girilmedi");
  });

  it("kısmen girildiyse eski hesap ve not, kaç görevde varsayıldığıyla", () => {
    const p = started();
    p.tasks[0].actualCost = 90_000;
    const e = earnedValue(p, schedule(p), "2026-12-01");
    expect([e.ac, e.cpi, e.eac, e.vac]).toEqual([190_000, 0.974, 652_162.16, -17_162.16]);
    expect(noActualCost(e)).toBe(false);
    expect(e.acEstimatedRows).toEqual([2]);
    const notes = buildReport("evm", p, schedule(p), { today: "2026-12-01" }).notes!.join(" ");
    expect(notes).toContain("1 başlamış görevde AC = EV sayıldı (satır 2)");
  });
});

describe("8 arifeler ve 2028–2029 bayramları", () => {
  const halfOnly = { official: true, religious: true, halfDays: true };
  it("seçenek işaretliyse Ramazan, Kurban arifeleri ve 28 Ekim yarım gün eklenir (2026–2027)", () => {
    const list = turkishHolidays(2026, 2027, halfOnly);
    const half = list.filter((h) => h.halfDay).map((h) => h.date);
    expect(half).toEqual(["2026-03-19", "2026-05-26", "2026-10-28", "2027-03-08", "2027-05-15", "2027-10-28"]);
    // Bayram günleri seçilmese de arifeler eklenir
    const evesOnly = turkishHolidays(2026, 2026, { official: false, religious: false, halfDays: true });
    expect(evesOnly.map((h) => h.date)).toEqual(["2026-03-19", "2026-05-26", "2026-10-28"]);
    expect(evesOnly.every((h) => h.halfDay)).toBe(true);
  });

  it("süre 'arifeleri yarım gün say' ayarına göre değişir", () => {
    const base = referenceProject();
    base.start = "2026-10-26";
    base.holidays = turkishHolidays(2026, 2027, halfOnly);
    base.tasks = [{ ...base.tasks[0], predecessors: [], duration: 5, assignments: [] }];
    const full = schedule(base);
    const half = schedule({ ...base, halfDayMode: "half" });
    // 26–30 Ekim haftasında 28 Ekim yarım, 29 Ekim tatil
    expect(full.finishDate).toBe("2026-11-02");
    expect(half.finishDate).toBe("2026-11-03");
  });

  it("mevcut veri değişmedi; 2028–2029 eklendi, sonrası yok", () => {
    expect(RELIGIOUS_HOLIDAYS[2026].map((r) => [r.start, r.days])).toEqual([["2026-03-20", 3], ["2026-05-27", 4]]);
    expect(RELIGIOUS_HOLIDAYS[2027].map((r) => [r.start, r.days])).toEqual([["2027-03-09", 3], ["2027-05-16", 4]]);
    expect(RELIGIOUS_HOLIDAYS[2028].map((r) => [r.start, r.days])).toEqual([["2028-02-26", 3], ["2028-05-05", 4]]);
    expect(RELIGIOUS_HOLIDAYS[2029].map((r) => [r.start, r.days])).toEqual([["2029-02-14", 3], ["2029-04-24", 4]]);
    expect(LAST_RELIGIOUS_YEAR).toBe(2029);
    expect(yearsWithoutReligiousData(2026, 2031)).toEqual([2030, 2031]);
    expect(t("calendar.noDataAfter", { year: "2029" })).toBe("2029 sonrası için tatil verisi yok, elle ekleyin.");
  });

  it("23 Nisan 2029 Kurban arifesi tam gün tatille birleşir (tam gün kalır)", () => {
    const d = turkishHolidays(2029, 2029, halfOnly).find((h) => h.date === "2029-04-23")!;
    expect(d.halfDay).toBeUndefined();
  });
});

describe("örnek proje değişmedi", () => {
  it("bitiş 01.03.2027, 85 iş günü, 635.000 ₺", () => {
    const p = referenceProject();
    const s = schedule(p);
    expect(formatDateLocal(s.finishDate)).toBe("01.03.2027");
    expect(earnedValue(p, s, "2026-11-02").bac).toBe(635_000);
    expect(s.rows.reduce((a, r) => a + (r.isSummary ? 0 : r.duration), 0)).toBe(85);
  });
});
