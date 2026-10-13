import { getLang, t } from "../i18n";
import { FIXED_HOLIDAYS, RELIGIOUS_HOLIDAYS, type HolidayName } from "./holidayData";

// Türkiye resmî tatilleri. Veri yıl bazlı olarak holidayData.ts'tedir; hangi grupların ekleneceğini kullanıcı
// seçer (MS Project'teki gibi takvimi proje başında kendisi kurar).

export interface Holiday {
  date: string;
  name: string;
  /** Yarım gün (arife): iş günü sayılır, takvimde işaretlenir. */
  halfDay?: boolean;
}

export interface HolidayOptions {
  /** Sabit resmî tatiller (Yılbaşı, 23 Nisan, …) */
  official: boolean;
  /** Ramazan ve Kurban bayramları (yalnızca verisi olan yıllar) */
  religious: boolean;
  /** Arifeler (yarım gün olarak işaretlenir) */
  halfDays: boolean;
}

export const DEFAULT_HOLIDAY_OPTIONS: HolidayOptions = { official: true, religious: true, halfDays: false };

const label = (n: HolidayName) => (getLang() === "en" ? n.en : n.tr);

/** Dini bayram verisi bulunmayan yıllar (kullanıcı bu yılların bayramlarını elle girmeli) */
export function yearsWithoutReligiousData(fromYear: number, toYear: number): number[] {
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) if (!RELIGIOUS_HOLIDAYS[y]) years.push(y);
  return years;
}

export function turkishHolidays(fromYear: number, toYear: number, options: HolidayOptions = DEFAULT_HOLIDAY_OPTIONS): Holiday[] {
  const list: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const f of FIXED_HOLIDAYS) {
      if (f.halfDay ? !(options.official && options.halfDays) : !options.official) continue;
      list.push({ date: `${y}-${f.mmdd}`, name: label(f), ...(f.halfDay ? { halfDay: true } : {}) });
    }
    if (!options.religious) continue;
    for (const r of RELIGIOUS_HOLIDAYS[y] ?? []) {
      const d0 = new Date(`${r.start}T00:00:00Z`).getTime();
      const day = (i: number) => new Date(d0 + i * 86_400_000).toISOString().slice(0, 10);
      if (options.halfDays) list.push({ date: day(-1), name: label(r.eve), halfDay: true });
      for (let i = 0; i < r.days; i++) list.push({ date: day(i), name: `${label(r)} ${i + 1}. ${t("common.day")}` });
    }
  }
  return mergeHolidays([], list);
}

/**
 * Tatil listelerini birleştirir. `existing` (kullanıcının listesi) hiç ezilmez: aynı güne denk gelen yeni kayıt
 * eklenmez. Yeni kayıtlar kendi aralarında aynı güne denk gelirse adları birleşir (ör. 19 Mayıs 2027 Kurban
 * Bayramı'na denk gelir); tam gün tatil yarım günü örter.
 */
export function mergeHolidays(existing: Holiday[], incoming: Holiday[]): Holiday[] {
  const known = new Set(existing.map((h) => h.date));
  const added = new Map<string, Holiday>();
  for (const h of incoming) {
    if (known.has(h.date)) continue;
    const prev = added.get(h.date);
    if (!prev) {
      added.set(h.date, { ...h });
      continue;
    }
    const halfDay = !!prev.halfDay && !!h.halfDay;
    added.set(h.date, { date: h.date, name: `${prev.name} / ${h.name}`, ...(halfDay ? { halfDay: true } : {}) });
  }
  return [...existing, ...added.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Zamanlamada çalışılmayan günler: yarım günler (arife) iş günü sayılır. */
export function nonWorkingDates(holidays: Holiday[]): string[] {
  return holidays.filter((h) => !h.halfDay).map((h) => h.date);
}
