import { describe, expect, it, vi } from "vitest";
import {
  datePattern,
  detectLang,
  formatDateLocal,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  formatPercent,
  parseDateLocal,
  parseNumberLocal,
  setCurrency,
  setLocale,
  t,
  tIn,
  weekStartDay,
  type MessageKey,
} from "..";
import { en } from "../en";
import { tr } from "../tr";

const placeholders = (v: unknown) =>
  [...new Set([...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(",");

describe("sözlükler", () => {
  it("tr ve en aynı anahtarlara ve yer tutuculara sahip", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
    for (const k of Object.keys(tr) as MessageKey[]) expect(placeholders(en[k]), k).toBe(placeholders(tr[k]));
  });

  it("FS/SS/FF/SF kısaltmaları iki dilde aynı, açıklamaları çevrilir", () => {
    expect(tIn("tr", "grid.predHint")).toContain("4FS+2g");
    expect(tIn("en", "grid.predHint")).toContain("4FS+2d");
    expect(tIn("tr", "link.FS")).toBe("Bitiş-Başlangıç");
    expect(tIn("en", "link.FS")).toBe("Finish-to-Start");
  });

  it("eksik anahtar: tr → en → anahtar adı, bir kez uyarır", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(t("yok.boyle.anahtar" as MessageKey)).toBe("yok.boyle.anahtar");
    t("yok.boyle.anahtar" as MessageKey);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("dil ve biçimler", () => {
  it("işletim sistemi dili: tr → Türkçe, diğerleri İngilizce", () => {
    expect(detectLang("tr-TR")).toBe("tr");
    expect(detectLang("tr")).toBe("tr");
    expect(detectLang("en-GB")).toBe("en");
    expect(detectLang("de-DE")).toBe("en");
  });

  it("çoğul", () => {
    setLocale({ lang: "en" });
    expect(t("unit.tasks", { n: 1 })).toBe("1 task");
    expect(t("unit.tasks", { n: 3 })).toBe("3 tasks");
    expect(t("unit.workdays", { n: 0 })).toBe("0 workdays");
    setLocale({ lang: "tr" });
    expect(t("unit.tasks", { n: 1 })).toBe("1 görev");
    expect(t("unit.tasks", { n: 3 })).toBe("3 görev");
  });

  it("tarih: TR 13.11.2026, EN 11/13/2026, ISO", () => {
    expect(formatDateLocal("2026-11-13")).toBe("13.11.2026");
    expect(datePattern()).toBe("GG.AA.YYYY");
    setLocale({ lang: "en" });
    expect(formatDateLocal("2026-11-13")).toBe("11/13/2026");
    expect(datePattern()).toBe("MM/DD/YYYY");
    setLocale({ dateStyle: "iso" });
    expect(formatDateLocal("2026-11-13")).toBe("2026-11-13");
    expect(formatDateLocal("bozuk")).toBe("—");
  });

  it("tarih okuma: seçili biçim, ISO ve 2 haneli yıl; geçersiz gün reddedilir", () => {
    expect(parseDateLocal("13.11.2026")).toBe("2026-11-13");
    expect(parseDateLocal("13/11/26")).toBe("2026-11-13");
    expect(parseDateLocal("2026-11-13")).toBe("2026-11-13");
    expect(parseDateLocal("31.02.2027")).toBeNull();
    setLocale({ lang: "en" });
    expect(parseDateLocal("11/13/2026")).toBe("2026-11-13");
    expect(parseDateLocal("13/11/2026")).toBeNull();
  });

  it("hafta başı: TR pazartesi, EN pazar", () => {
    expect(weekStartDay()).toBe(1);
    setLocale({ lang: "en" });
    expect(weekStartDay()).toBe(0);
  });

  it("sayı, yüzde ve para (dönüştürme yok, yalnızca sembol)", () => {
    expect(formatNumber(635000.5)).toBe("635.000,5");
    expect(formatMoney(635000)).toBe("635.000 ₺");
    expect(formatMoney(635000.5)).toBe("635.000,50 ₺");
    expect(formatPercent(45)).toBe("%45");
    expect(formatMoneyShort(250000)).toBe("250 bin ₺");
    setCurrency("EUR");
    expect(formatMoney(635000)).toBe("635.000 €");
    setLocale({ lang: "en" });
    expect(formatMoney(635000)).toBe("€635,000");
    setCurrency("TRY");
    expect(formatMoney(635000.5)).toBe("₺635,000.50");
    expect(formatPercent(45)).toBe("45%");
    setCurrency("AED");
    expect(formatMoney(1200)).toBe("AED 1,200");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("sayı okuma: dilin ayırıcıları, para simgesi atılır", () => {
    expect(parseNumberLocal("12.500 ₺")).toBe(12500);
    expect(parseNumberLocal("12.500,75")).toBe(12500.75);
    expect(parseNumberLocal("%150")).toBe(150);
    setLocale({ lang: "en" });
    expect(parseNumberLocal("$12,500.75")).toBe(12500.75);
    expect(parseNumberLocal("abc")).toBeNull();
  });
});
