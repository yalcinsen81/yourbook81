import { monthName, t, weekStartDay } from "../i18n";
import { addDays, diffDays, formatShort, parseDate } from "./calendar";

// Gantt zaman ölçeği: yakınlaştırma sürekli bir "piksel / gün" değeridir; ölçek (gün → yıl) bu değerden
// kendiliğinden seçilir. Başlık iki satırdır ve yalnızca ekranda görünen aralık için üretilir (sanallaştırma).

export type Scale = "day" | "week" | "month" | "quarter" | "year";

/** En yakın görünüm: günde 40 piksel */
export const MAX_PPD = 40;
/** Projeye sığdırma bu değerin altına inmez (çok uzun projede bile çubuklar görünsün) */
export const FLOOR_PPD = 0.05;
/** Düğme ve klavyeyle bir adım */
export const ZOOM_STEP = 1.25;

/** Ölçek eşikleri (piksel / gün): gün etiketi ~18 piksele, hafta ~21, ay ~25, çeyrek ~23 piksele sığar */
export function scaleFor(ppd: number): Scale {
  if (ppd >= 18) return "day";
  if (ppd >= 3) return "week";
  if (ppd >= 0.8) return "month";
  if (ppd >= 0.25) return "quarter";
  return "year";
}

/** En uzak görünüm: projenin tamamı (ve iki yanında birkaç gün) görünür alana sığar */
export function fitPpd(viewportWidth: number, projectDays: number): number {
  const ppd = Math.max(1, viewportWidth - 40) / Math.max(1, projectDays + 14);
  return Math.min(MAX_PPD, Math.max(FLOOR_PPD, ppd));
}

export function clampPpd(ppd: number, minPpd: number): number {
  return Math.min(MAX_PPD, Math.max(Math.min(minPpd, MAX_PPD), ppd));
}

/**
 * İmlecin altındaki tarih yerinde kalacak şekilde yeni yatay kaydırma: imleç görünümün sol kenarından
 * `cursorX` piksel uzaktadır.
 */
export function anchoredScroll(scrollLeft: number, cursorX: number, oldPpd: number, newPpd: number): number {
  const day = (scrollLeft + cursorX) / oldPpd;
  return Math.max(0, day * newPpd - cursorX);
}

/** Görünen satır aralığı [first, last) ve iki yanda birkaç yedek satır */
export function visibleRange(scrollTop: number, viewport: number, rowH: number, count: number, overscan = 6) {
  const first = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewport) / rowH) + overscan);
  return { first, last: Math.max(first, last) };
}

export interface Band {
  key: string;
  /** Zaman çizelgesi başından gün */
  start: number;
  span: number;
  label: string;
  title?: string;
}

/** Bir sonraki birimin başı */
function nextUnit(iso: string, unit: Scale | "decade"): string {
  const d = parseDate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const ym = (yy: number, mm: number) => `${yy + Math.floor(mm / 12)}-${String((mm % 12) + 1).padStart(2, "0")}-01`;
  switch (unit) {
    case "day":
      return addDays(iso, 1);
    case "week":
      return addDays(iso, 7);
    case "month":
      return ym(y, m + 1);
    case "quarter":
      return ym(y, m - (m % 3) + 3);
    case "year":
      return `${y + 1}-01-01`;
    case "decade":
      return `${y - (y % 10) + 10}-01-01`;
  }
}

/** Tarihi içeren birimin başı */
function unitStart(iso: string, unit: Scale | "decade"): string {
  const d = parseDate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const pad = (n: number) => String(n + 1).padStart(2, "0");
  switch (unit) {
    case "day":
      return iso;
    case "week":
      return addDays(iso, -((d.getUTCDay() - weekStartDay() + 7) % 7));
    case "month":
      return `${y}-${pad(m)}-01`;
    case "quarter":
      return `${y}-${pad(m - (m % 3))}-01`;
    case "year":
      return `${y}-01-01`;
    case "decade":
      return `${y - (y % 10)}-01-01`;
  }
}

/** Üst ve alt başlık satırının birimleri */
export function headerUnits(scale: Scale): [top: Scale | "decade", bottom: Scale] {
  switch (scale) {
    case "day":
    case "week":
      return ["month", scale];
    case "month":
    case "quarter":
      return ["year", scale];
    case "year":
      return ["decade", "year"];
  }
}

function label(iso: string, unit: Scale | "decade", row: "top" | "bottom"): string {
  const d = parseDate(iso);
  const y = d.getUTCFullYear();
  switch (unit) {
    case "day":
      return String(d.getUTCDate());
    case "week":
      return String(d.getUTCDate());
    case "month":
      return row === "top" ? `${monthName(d.getUTCMonth())} ${y}` : monthName(d.getUTCMonth(), true);
    case "quarter":
      return t("quarter.short", { q: String(Math.floor(d.getUTCMonth() / 3) + 1) });
    case "year":
      return String(y);
    case "decade":
      return `${y}–${y + 9}`;
  }
}

/**
 * Bir başlık satırının bantları; yalnızca [fromDay, toDay) aralığına değenler üretilir.
 * `timelineStart` zaman çizelgesinin ilk günüdür.
 */
export function bands(timelineStart: string, unit: Scale | "decade", row: "top" | "bottom", fromDay: number, toDay: number): Band[] {
  const out: Band[] = [];
  let cursor = unitStart(addDays(timelineStart, Math.max(0, Math.floor(fromDay))), unit);
  // Güvenlik sınırı: görünür alanda birkaç binden fazla bant olmaz
  for (let i = 0; i < 5000; i++) {
    const start = diffDays(timelineStart, cursor);
    if (start >= toDay) break;
    const next = nextUnit(cursor, unit);
    const span = diffDays(cursor, next);
    out.push({
      key: cursor,
      start,
      span,
      label: label(cursor, unit, row),
      title: unit === "week" ? t("gantt.week", { date: formatShort(cursor) }) : unit === "day" ? formatShort(cursor) : undefined,
    });
    cursor = next;
  }
  return out;
}
