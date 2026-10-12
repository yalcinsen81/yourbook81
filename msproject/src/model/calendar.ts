// Standart takvim: Pazartesi–Cuma iş günü, hafta sonu tatil. Tüm tarihler UTC olarak YYYY-MM-DD.

const DAY_MS = 86_400_000;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return formatDate(parseDate(iso)) === iso;
}

export function addDays(iso: string, days: number): string {
  return formatDate(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

/** Takvim günü farkı (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

export function isWorkday(iso: string): boolean {
  const dow = parseDate(iso).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Tarih hafta sonuna denk geliyorsa sonraki pazartesiye kaydırır. */
export function nextWorkday(iso: string): string {
  let d = iso;
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
}

/** İş günü ofsetini tarihe çevirir. `base` bir iş günü olmalıdır; negatif ofset geriye sayar. */
export function workdayToDate(base: string, offset: number): string {
  const dow = (parseDate(base).getUTCDay() + 6) % 7; // 0 = pazartesi
  // Pazartesiden itibaren sayılan mutlak iş günü indeksi
  const abs = dow + offset;
  const weeks = Math.floor(abs / 5);
  const rem = abs - weeks * 5;
  const monday = addDays(base, -dow);
  return addDays(monday, weeks * 7 + rem);
}

/** Tarihin `base`'e göre iş günü ofseti. Hafta sonu tarihi sonraki iş gününe yuvarlanır. */
export function dateToWorkday(base: string, iso: string): number {
  const target = nextWorkday(iso);
  const baseDow = (parseDate(base).getUTCDay() + 6) % 7;
  const monday = addDays(base, -baseDow);
  const days = diffDays(monday, target);
  const weeks = Math.floor(days / 7);
  const rem = days - weeks * 7; // 0..4 (hafta sonu yuvarlandı)
  return weeks * 5 + rem - baseDow;
}

const TR_DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Tablo için kısa Türkçe gösterim: "Pzt 12.10.26" */
export function formatShort(iso: string): string {
  const d = parseDate(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${TR_DAYS[d.getUTCDay()]} ${dd}.${mm}.${yy}`;
}

export function monthLabel(iso: string): string {
  const d = parseDate(iso);
  return `${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dayOfWeekLetter(iso: string): string {
  return ["P", "P", "S", "Ç", "P", "C", "C"][parseDate(iso).getUTCDay()];
}
