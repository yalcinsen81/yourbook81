// Tablo ve Gantt satırlarının hizalı kalması için ortak ölçüler
export const ROW_H = 30;
export const HEADER_H = 48;

export type Zoom = "day" | "week" | "month";

/** Ölçeğe göre bir takvim gününün piksel genişliği */
export const PX_PER_DAY: Record<Zoom, number> = { day: 26, week: 9, month: 3 };
