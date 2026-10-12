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

/**
 * Tatil günlerini de bilen iş takvimi. Ofsetler `base`'den (ilk iş günü) sayılır.
 * İş günleri ihtiyaç oldukça ileri/geri doğru önbelleğe eklenir.
 */
export class WorkCalendar {
  readonly base: string;
  private readonly off: Set<string>;
  private readonly forward: string[];
  private readonly backward: string[] = [""]; // backward[k] = base'den k iş günü önce (k >= 1)
  private readonly index = new Map<string, number>();

  constructor(start: string, holidays: Iterable<string> = []) {
    this.off = new Set(holidays);
    this.base = this.nextWorkday(start);
    this.forward = [this.base];
    this.index.set(this.base, 0);
  }

  isWorkday(iso: string): boolean {
    return isWorkday(iso) && !this.off.has(iso);
  }

  isHoliday(iso: string): boolean {
    return this.off.has(iso);
  }

  nextWorkday(iso: string): string {
    let d = iso;
    // 400 günden uzun tatil zinciri olamaz; sonsuz döngüye karşı sınır
    for (let i = 0; i < 400 && !this.isWorkday(d); i++) d = addDays(d, 1);
    return d;
  }

  prevWorkday(iso: string): string {
    let d = iso;
    for (let i = 0; i < 400 && !this.isWorkday(d); i++) d = addDays(d, -1);
    return d;
  }

  toDate(offset: number): string {
    if (offset >= 0) {
      while (this.forward.length <= offset) {
        const next = this.nextWorkday(addDays(this.forward[this.forward.length - 1], 1));
        this.index.set(next, this.forward.length);
        this.forward.push(next);
      }
      return this.forward[offset];
    }
    const k = -offset;
    while (this.backward.length <= k) {
      const last = this.backward.length === 1 ? this.base : this.backward[this.backward.length - 1];
      const prev = this.prevWorkday(addDays(last, -1));
      this.index.set(prev, -this.backward.length);
      this.backward.push(prev);
    }
    return this.backward[k];
  }

  /** Tarihin ofseti; iş günü değilse sonraki iş gününe yuvarlanır. */
  toOffset(iso: string): number {
    const target = this.nextWorkday(iso);
    const known = this.index.get(target);
    if (known !== undefined) return known;
    if (target > this.base) {
      while (this.forward[this.forward.length - 1] < target) this.toDate(this.forward.length);
    } else {
      while ((this.backward.length === 1 ? this.base : this.backward[this.backward.length - 1]) > target) {
        this.toDate(-this.backward.length);
      }
    }
    return this.index.get(target)!;
  }

  /** `from`–`to` arasındaki (ikisi dahil) iş günü sayısı; `to` önceyse 0. */
  workdaysBetween(from: string, to: string): number {
    if (to < from) return 0;
    return this.toOffset(addDays(to, 1)) - this.toOffset(from);
  }
}
