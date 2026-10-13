// Süre girişi: "5", "5g", "5d", "5 gün", "5 days" (iş günü), "2w", "2hf", "2 hafta" (hafta = çalışma haftasındaki gün sayısı),
// "4h", "4sa", "4 saat" (8 saatlik güne göre yukarı yuvarlanır). Ondalık için nokta ya da virgül kabul edilir.

export interface ParsedDuration {
  /** İş günü */
  days: number;
  /** Saat girildiyse yazılan saat (gün sayısı yukarı yuvarlandı) */
  hours?: number;
}

export const HOURS_PER_DAY = 8;

const UNITS: [RegExp, "d" | "w" | "h"][] = [
  [/^(g|d|gün|gun|gn|days?|iş günü|is gunu|wd)$/, "d"],
  [/^(w|wk|wks|weeks?|hf|hafta)$/, "w"],
  [/^(h|hr|hrs|hours?|sa|saat|st)$/, "h"],
];

/** Metni iş gününe çevirir; anlaşılamazsa ya da negatifse null. */
export function parseDuration(text: string, workdaysPerWeek = 5): ParsedDuration | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*([\p{L} ]*)$/u.exec(text.trim().toLocaleLowerCase("tr"));
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const unitText = m[2].trim();
  const unit = unitText ? UNITS.find(([re]) => re.test(unitText))?.[1] : "d";
  if (!unit || !Number.isFinite(value) || value < 0) return null;
  // Kayan nokta hatası (ör. 0,1 × 3) yuvarlamayı bozmasın
  const up = (x: number) => Math.ceil(x - 1e-9);
  if (unit === "d") return { days: up(value) };
  if (unit === "w") return { days: up(value * Math.max(1, workdaysPerWeek)) };
  return { days: up(value / HOURS_PER_DAY), hours: value };
}
