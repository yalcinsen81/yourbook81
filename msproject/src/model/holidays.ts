import { getLang, tIn, type Lang } from "../i18n";
import { FIXED_HOLIDAYS, RELIGIOUS_HOLIDAYS, type HolidayName } from "./holidayData";

// Türkiye resmî tatilleri. Veri yıl bazlı olarak holidayData.ts'tedir; hangi grupların ekleneceğini kullanıcı
// seçer (MS Project'teki gibi takvimi proje başında kendisi kurar).

export interface Holiday {
  date: string;
  name: string;
  /** Yarım gün (arife): iş günü sayılır, takvimde işaretlenir. */
  halfDay?: boolean;
  /**
   * Hazır tatilin kaynağı ("fixed:01-01", "rel:2027-03-09:0", "rel:2027-03-09:eve"; birleşmişse "|" ile).
   * Varsa ad seçili dilde bu anahtardan üretilir; kullanıcının girdiği tatilde yoktur ve adı yazıldığı gibi kalır.
   */
  src?: string;
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

const label = (n: HolidayName, lang: Lang) => (lang === "en" ? n.en : n.tr);

/** Tek bir kaynak anahtarının adı; bilinmiyorsa null */
function srcName(src: string, lang: Lang): string | null {
  const fixed = /^fixed:(\d{2}-\d{2})$/.exec(src);
  if (fixed) {
    const f = FIXED_HOLIDAYS.find((x) => x.mmdd === fixed[1]);
    return f ? label(f, lang) : null;
  }
  const rel = /^rel:(\d{4}-\d{2}-\d{2}):(eve|\d+)$/.exec(src);
  if (!rel) return null;
  const r = RELIGIOUS_HOLIDAYS[Number(rel[1].slice(0, 4))]?.find((x) => x.start === rel[1]);
  if (!r) return null;
  if (rel[2] === "eve") return label(r.eve, lang);
  return tIn(lang, "holiday.dayN", { name: label(r, lang), n: String(Number(rel[2]) + 1) });
}

/** Tatilin görünen adı: hazır tatil seçili dilde, kullanıcının girdiği ad yazıldığı gibi */
export function holidayLabel(h: Holiday, lang: Lang = getLang()): string {
  if (!h.src) return h.name;
  const names = h.src.split("|").map((x) => srcName(x, lang));
  return names.every((x) => x !== null) ? names.join(" / ") : h.name;
}

/** Dini bayram verisi bulunmayan yıllar (kullanıcı bu yılların bayramlarını elle girmeli) */
export function yearsWithoutReligiousData(fromYear: number, toYear: number): number[] {
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) if (!RELIGIOUS_HOLIDAYS[y]) years.push(y);
  return years;
}

export function turkishHolidays(
  fromYear: number,
  toYear: number,
  options: HolidayOptions = DEFAULT_HOLIDAY_OPTIONS,
  lang: Lang = getLang(),
): Holiday[] {
  const list: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const f of FIXED_HOLIDAYS) {
      // Arife (28 Ekim) yalnızca "arifeler" seçeneğine bağlıdır
      if (f.halfDay ? !options.halfDays : !options.official) continue;
      list.push({ date: `${y}-${f.mmdd}`, name: label(f, lang), src: `fixed:${f.mmdd}`, ...(f.halfDay ? { halfDay: true } : {}) });
    }
    if (!options.religious && !options.halfDays) continue;
    for (const r of RELIGIOUS_HOLIDAYS[y] ?? []) {
      const d0 = new Date(`${r.start}T00:00:00Z`).getTime();
      const day = (i: number) => new Date(d0 + i * 86_400_000).toISOString().slice(0, 10);
      // Bayram arifeleri yarım gün olarak eklenir (bayram günleri seçilmese de)
      if (options.halfDays) list.push({ date: day(-1), name: label(r.eve, lang), src: `rel:${r.start}:eve`, halfDay: true });
      if (!options.religious) continue;
      for (let i = 0; i < r.days; i++) {
        const src = `rel:${r.start}:${i}`;
        list.push({ date: day(i), name: srcName(src, lang)!, src });
      }
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
    const src = prev.src && h.src ? `${prev.src}|${h.src}` : undefined;
    added.set(h.date, { date: h.date, name: `${prev.name} / ${h.name}`, ...(src ? { src } : {}), ...(halfDay ? { halfDay: true } : {}) });
  }
  return [...existing, ...added.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Zamanlamada çalışılmayan günler: yarım günler (arife) iş günü sayılır. */
export function nonWorkingDates(holidays: Holiday[]): string[] {
  return holidays.filter((h) => !h.halfDay).map((h) => h.date);
}

/**
 * Sürüm 3 öncesi dosyalar: hazır listeden eklenmiş tatillere kaynak anahtarı verilir (tarih ve Türkçe ya da
 * İngilizce ad birebir tutmalı). Kullanıcının adını değiştirdiği ya da kendi eklediği tatile dokunulmaz.
 */
export function tagBuiltinHolidays(holidays: Holiday[]): Holiday[] {
  if (!holidays.length) return holidays;
  const years = holidays.map((h) => Number(h.date.slice(0, 4)));
  const all = { official: true, religious: true, halfDays: true };
  const from = Math.min(...years);
  const to = Math.max(...years);
  const byDate = new Map<string, Holiday[]>();
  for (const lang of ["tr", "en"] as const) {
    for (const b of turkishHolidays(from, to, all, lang)) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
    // Arife olmadan üretilen listede birleşik adlar farklı olabilir (ör. 19 Mayıs + Kurban 4. gün)
    for (const b of turkishHolidays(from, to, { ...all, halfDays: false }, lang)) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
  }
  return holidays.map((h) => {
    if (h.src) return h;
    const match = byDate.get(h.date)?.find((b) => b.name === h.name);
    return match?.src ? { ...h, src: match.src } : h;
  });
}
