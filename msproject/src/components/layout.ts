// Tablo ve Gantt satırlarının hizalı kalması için ortak ölçüler
/** Satır yüksekliği: Kompakt 30, Rahat 36 (yoğunluk ayarı bu bilgisayarda saklanır) */
export let ROW_H = 30;
export type Density = "compact" | "comfortable";
export function setDensity(d: Density) {
  ROW_H = d === "comfortable" ? 36 : 30;
  if (typeof document !== "undefined") document.documentElement.dataset.density = d;
}
export const HEADER_H = 48;

export type Zoom = "day" | "week" | "month";

/** Ölçeğe göre bir takvim gününün piksel genişliği */
export const PX_PER_DAY: Record<Zoom, number> = { day: 26, week: 9, month: 3 };
