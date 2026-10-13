import { describe, expect, it } from "vitest";
import { setLocale } from "../../i18n";
import { isDriving } from "../../components/Gantt";
import { formatShort } from "../calendar";
import { parseDuration } from "../duration";
import { holidayLabel, tagBuiltinHolidays, turkishHolidays } from "../holidays";
import { formatPredecessors, parsePredecessors } from "../predecessors";
import { sampleProject } from "../sample";
import { schedule } from "../schedule";
import { needsUpgradeBackup, sanitizeProject } from "../storage";
import { anchoredScroll, bands, clampPpd, fitPpd, MAX_PPD, scaleFor, visibleRange } from "../timescale";
import { PROJECT_VERSION } from "../types";
import { REFERENCE_DATES, referenceProject } from "./fixtures/reference";

describe("süre girişi (A1)", () => {
  it("5, 5g, 5d, 5 gün, 5 days → 5 iş günü", () => {
    for (const s of ["5", "5g", "5d", "5 gün", "5 days", "5G"]) expect(parseDuration(s)?.days, s).toBe(5);
  });
  it("hafta: çalışma haftasının gün sayısıyla", () => {
    expect(parseDuration("2w")?.days).toBe(10);
    expect(parseDuration("2 hafta", 6)?.days).toBe(12);
    expect(parseDuration("1,5w")?.days).toBe(8);
  });
  it("saat: 8 saatlik güne yukarı yuvarlanır", () => {
    expect(parseDuration("2h")).toEqual({ days: 1, hours: 2 });
    expect(parseDuration("16h")).toEqual({ days: 2, hours: 16 });
    expect(parseDuration("17 saat")).toEqual({ days: 3, hours: 17 });
  });
  it("geçersiz", () => {
    for (const s of ["", "-3", "beş", "5x", "5 yıl"]) expect(parseDuration(s), s).toBeNull();
  });
});

describe("öncül gecikme birimi dile göre", () => {
  const tasks = referenceProject().tasks;
  it("g ve d ikisi de okunur, yazım seçili dilde", () => {
    const preds = parsePredecessors("1FS+2d;2SS-1g", tasks, "ref-6").predecessors;
    expect(preds.map((p) => p.lag)).toEqual([2, -1]);
    expect(formatPredecessors(preds, tasks)).toBe("1FS+2g;2SS-1g");
    setLocale({ lang: "en" });
    expect(formatPredecessors(preds, tasks)).toBe("1FS+2d;2SS-1d");
  });
});

describe("tablo tarihi dile göre", () => {
  it("TR Pzt 02.11.2026, EN Mon 11/2/2026, ISO", () => {
    expect(formatShort("2026-11-02")).toBe("Pzt 02.11.2026");
    setLocale({ lang: "en" });
    expect(formatShort("2026-11-02")).toBe("Mon 11/2/2026");
    setLocale({ dateStyle: "iso" });
    expect(formatShort("2026-11-02")).toBe("Mon 2026-11-02");
  });
});

describe("tatil adları iki dilde, kullanıcı adı olduğu gibi", () => {
  const all = { official: true, religious: true, halfDays: true };
  it("hazır tatil seçili dilde gösterilir", () => {
    const h = turkishHolidays(2027, 2027, all).find((x) => x.date === "2027-01-01")!;
    expect(h.src).toBe("fixed:01-01");
    expect(holidayLabel(h, "tr")).toBe("Yılbaşı");
    expect(holidayLabel(h, "en")).toBe("New Year's Day");
    const kurban = turkishHolidays(2027, 2027, all).find((x) => x.date === "2027-05-19")!;
    expect(holidayLabel(kurban, "en")).toBe("Commemoration of Atatürk, Youth and Sports Day / Eid al-Adha day 4");
    expect(holidayLabel(turkishHolidays(2027, 2027, all).find((x) => x.date === "2027-03-08")!, "en")).toBe("Eid al-Fitr eve");
  });
  it("kullanıcının girdiği ad çevrilmez", () => {
    expect(holidayLabel({ date: "2027-02-10", name: "Şantiye bakımı" }, "en")).toBe("Şantiye bakımı");
  });
  it("eski dosya: hazır tatillere kaynak anahtarı verilir, değiştirilmiş ada dokunulmaz", () => {
    const tagged = tagBuiltinHolidays([
      { date: "2027-01-01", name: "Yılbaşı" },
      { date: "2027-03-09", name: "Ramazan Bayramı 1. gün" },
      { date: "2027-05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı / Kurban Bayramı 4. gün" },
      { date: "2027-10-29", name: "Bizim tatil" },
    ]);
    expect(tagged.map((h) => h.src)).toEqual(["fixed:01-01", "rel:2027-03-09:0", "fixed:05-19|rel:2027-05-16:3", undefined]);
  });
});

describe("dosya sürümü 3 ve yedek", () => {
  it("v2 dosya açılır: para birimi TRY, tatil adları korunur, yedek gerekir", () => {
    const v2 = { ...JSON.parse(JSON.stringify(referenceProject())), version: 2 };
    for (const h of v2.holidays) delete h.src;
    expect(needsUpgradeBackup(v2)).toBe(true);
    const p = sanitizeProject(v2)!;
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.currency).toBe("TRY");
    expect(p.holidays.map((h) => h.name)).toEqual(v2.holidays.map((h: { name: string }) => h.name));
    expect(p.holidays.find((h) => h.date === "2027-01-01")?.src).toBe("fixed:01-01");
    expect(needsUpgradeBackup(p)).toBe(false);
  });
  it("para birimi korunur, bozuksa TRY", () => {
    expect(sanitizeProject({ ...referenceProject(), currency: "eur" })!.currency).toBe("EUR");
    expect(sanitizeProject({ ...referenceProject(), currency: "!!" })!.currency).toBe("TRY");
  });
  it("örnek proje seçili dilde oluşturulur", () => {
    expect(sampleProject("2026-11-02").tasks[2].name).toBe("Ruhsat ve izinler");
    setLocale({ lang: "en" });
    const p = sampleProject("2026-11-02");
    expect(p.tasks[2].name).toBe("Permits and approvals");
    expect(p.resources[0].name).toBe("Site manager");
    expect(p.name).toBe("Sample: House Construction");
  });
});

describe("referans regresyon: dil değişince plan değişmez", () => {
  it("bitiş 2027-03-01, tarihler aynı (TR ve EN)", () => {
    for (const lang of ["tr", "en"] as const) {
      setLocale({ lang });
      const s = schedule(sanitizeProject(JSON.parse(JSON.stringify(referenceProject())))!);
      expect(s.finishDate).toBe("2027-03-01");
      expect(s.rows.map((r) => [r.startDate, r.finishDate])).toEqual(REFERENCE_DATES);
    }
  });
});

describe("Gantt (A2/A3)", () => {
  it("ölçek eşikleri", () => {
    expect(scaleFor(40)).toBe("day");
    expect(scaleFor(18)).toBe("day");
    expect(scaleFor(9)).toBe("week");
    expect(scaleFor(2)).toBe("month");
    expect(scaleFor(0.5)).toBe("quarter");
    expect(scaleFor(0.1)).toBe("year");
  });
  it("sınırlar: en yakın 40 px/gün, en uzak proje sığar", () => {
    expect(clampPpd(100, 2)).toBe(MAX_PPD);
    const min = fitPpd(1000, 120);
    expect(min * (120 + 14)).toBeLessThanOrEqual(1000);
    expect(clampPpd(0.01, min)).toBe(min);
  });
  it("imleç altındaki tarih yerinde kalır", () => {
    // 26 px/gün, kaydırma 2600 (gün 100), imleç 300 px → gün 111,5; 52 px/gün'de aynı gün aynı yerde
    const left = anchoredScroll(2600, 300, 26, 52);
    expect((left + 300) / 52).toBeCloseTo((2600 + 300) / 26);
  });
  it("sanallaştırma: 1000 satırda yalnızca görünenler", () => {
    const r = visibleRange(15_000, 600, 30, 1000);
    expect(r.first).toBe(494);
    expect(r.last).toBe(526);
    expect(visibleRange(0, 600, 30, 3)).toEqual({ first: 0, last: 3 });
  });
  it("iki satırlı başlık: gün → ay/gün, çeyrek → yıl/çeyrek", () => {
    const days = bands("2026-11-02", "day", "bottom", 0, 3);
    expect(days.map((b) => b.label)).toEqual(["2", "3", "4"]);
    const months = bands("2026-11-02", "month", "top", 0, 40);
    expect(months.map((b) => b.label)).toEqual(["Kasım 2026", "Aralık 2026"]);
    expect(months[0].start).toBe(-1); // 1 Kasım, başlangıçtan bir gün önce
    const q = bands("2026-11-02", "quarter", "bottom", 0, 200);
    expect(q.map((b) => b.label)).toEqual(["Ç4", "Ç1", "Ç2"]);
    setLocale({ lang: "en" });
    expect(bands("2026-11-02", "quarter", "bottom", 0, 61).map((b) => b.label)).toEqual(["Q4", "Q1"]);
    // Hafta başı: EN pazar
    expect(bands("2026-11-02", "week", "bottom", 0, 7)[0].key).toBe("2026-11-01");
  });
  it("referans projede 6 görev kritik ve 5 FS bağının hepsi kritik ok", () => {
    const p = referenceProject();
    const s = schedule(p);
    expect(s.rows.every((r) => r.critical)).toBe(true);
    for (const task of p.tasks)
      for (const pr of task.predecessors)
        expect(isDriving(pr.type, pr.lag, s.byId.get(pr.taskId)!, s.byId.get(task.id)!)).toBe(true);
  });
  it("bolluklu bağ kritik değil; SS/FF/SF doğru uçtan", () => {
    expect(isDriving("FS", 0, { es: 0, ef: 5 }, { es: 7, ef: 9 })).toBe(false);
    expect(isDriving("SS", 2, { es: 0, ef: 5 }, { es: 2, ef: 9 })).toBe(true);
    expect(isDriving("FF", 0, { es: 0, ef: 5 }, { es: 2, ef: 5 })).toBe(true);
    expect(isDriving("SF", 0, { es: 4, ef: 5 }, { es: 1, ef: 4 })).toBe(true);
  });
});
