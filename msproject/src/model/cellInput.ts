/**
 * Tablo hücresine yazılan yüzdeyi okur: "45", "%45", "45%" kabul edilir.
 * Tam sayı olmayan, eksi ya da sayı olmayan girişte null; 100'den büyükse 100'e indirilir (clamped).
 */
export function parsePercentCell(text: string): { value: number; clamped: boolean } | null {
  const m = /^\s*%?\s*(\d+)\s*%?\s*$/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 100 ? { value: 100, clamped: true } : { value: n, clamped: false };
}
