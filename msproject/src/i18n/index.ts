import { en } from "./en";
import { tr, type MessageKey, type Plural } from "./tr";

// Arayüz metinleri ve bölgesel biçimler. Kullanıcıya görünen her metin anahtarla (tr + en) yazılır.
// Dil ve tarih biçimi uygulama ayarıdır (proje dosyasına girmez); değişince abone olan arayüz anında yeniden çizilir.
// Saf modüller ve MCP sunucusu da aynı t() işlevini kullanır.

export type Lang = "tr" | "en";
/** Tarih gösterimi: dile göre (TR 13.11.2026, EN 11/13/2026) ya da ISO (2026-11-13) */
export type DateStyle = "locale" | "iso";
export type { MessageKey };

type Entry = string | Plural;
const DICTS: Record<Lang, Partial<Record<MessageKey, Entry>>> = { tr, en };

let lang: Lang = detectLang();
let dateStyle: DateStyle = "locale";
const listeners = new Set<() => void>();
const warned = new Set<string>();

/** İşletim sistemi / tarayıcı dili Türkçe ise tr, değilse en */
export function detectLang(locale?: string): Lang {
  const l =
    locale ??
    (typeof navigator !== "undefined" && navigator.language ? navigator.language : Intl.DateTimeFormat().resolvedOptions().locale);
  return /^tr\b/i.test(l ?? "") ? "tr" : "en";
}

export function getLang(): Lang {
  return lang;
}

export function getDateStyle(): DateStyle {
  return dateStyle;
}

/** Dil ya da tarih biçimini değiştirir ve aboneleri (arayüzü) uyarır. */
export function setLocale(next: { lang?: Lang; dateStyle?: DateStyle }): void {
  const l = next.lang ?? lang;
  const d = next.dateStyle ?? dateStyle;
  if (l === lang && d === dateStyle) return;
  lang = l;
  dateStyle = d;
  version++;
  for (const fn of listeners) fn();
}

export function setLang(l: Lang): void {
  setLocale({ lang: l });
}

let version = 0;
/** Abonelik (React useSyncExternalStore için) */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function localeVersion(): number {
  return version;
}

/** BCP 47 yerel ayar kodu (Intl için) */
export function localeTag(l: Lang = lang): string {
  return l === "tr" ? "tr-TR" : "en-US";
}

function lookup(key: MessageKey, l: Lang = lang): Entry {
  const own = DICTS[l][key];
  if (own !== undefined) return own;
  // Eksik çeviri: Türkçe → İngilizce → anahtar adı
  if (!warned.has(`${l}:${key}`)) {
    warned.add(`${l}:${key}`);
    console.warn(`[i18n] "${key}" anahtarı ${l} dilinde yok`);
  }
  return DICTS.tr[key] ?? DICTS.en[key] ?? key;
}

/**
 * Çeviri. "{n} görev" gibi yer tutucular params ile doldurulur. Çoğul girişlerde ({ one, other }) params.n'e
 * göre Intl.PluralRules ile biçim seçilir.
 */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return tIn(lang, key, params);
}

/** Belirli bir dilde çeviri (ör. Türkçe adla eşleştirme için) */
export function tIn(l: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  const entry = lookup(key, l);
  let text: string;
  if (typeof entry === "string") text = entry;
  else {
    const n = Number(params.n ?? 0);
    const rule = new Intl.PluralRules(localeTag(l)).select(n);
    text = rule === "one" ? entry.one : entry.other;
  }
  return text.replace(/\{(\w+)\}/g, (m, name: string) => {
    if (!(name in params)) return m;
    const v = params[name];
    return typeof v === "number" ? formatNumber(v, 2, l) : v;
  });
}

/** Sayı: TR 635.000,5 / EN 635,000.5 */
export function formatNumber(n: number, maxDigits = 2, l: Lang = lang): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(localeTag(l), { maximumFractionDigits: maxDigits }).format(n);
}

const SYMBOLS: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };

/** Proje para birimi (dilden bağımsız). Arayüz projeyi değiştirince günceller. */
let currency = "TRY";
export function setCurrency(code: string | undefined): void {
  currency = (code ?? "").trim() || "TRY";
}
export function getCurrency(): string {
  return currency;
}

export function currencySymbol(code = currency): string {
  return SYMBOLS[code.toUpperCase()] ?? code;
}

/**
 * Para: tutar dönüştürülmez, yalnızca sembol ve sayı biçimi değişir.
 * TR "635.000,50 ₺", EN "₺635,000.50"; özel kod: TR "635.000 AED", EN "AED 635,000".
 */
export function formatMoney(n: number | null | undefined, code = currency): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  const digits = Number.isInteger(rounded) ? 0 : 2;
  const num = new Intl.NumberFormat(localeTag(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rounded);
  const sym = currencySymbol(code);
  if (lang === "tr") return `${num} ${sym}`;
  return sym.length === 1 ? `${n < 0 ? "-" : ""}${sym}${num.replace(/^-/, "")}` : `${sym} ${num}`;
}

/** Haftanın ilk günü (0 = pazar): TR pazartesi, EN pazar */
export function weekStartDay(): number {
  return lang === "tr" ? 1 : 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Tarih: TR 13.11.2026, EN 11/13/2026, ISO 2026-11-13. Geçersiz değerde "—". */
export function formatDateLocal(iso: string | null | undefined): string {
  const m = typeof iso === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return "—";
  if (dateStyle === "iso") return iso!;
  return lang === "tr" ? `${m[3]}.${m[2]}.${m[1]}` : `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

/** Tarih biçiminin kalıbı (yer tutucu ve ipucu için) */
export function datePattern(): string {
  if (dateStyle === "iso") return "YYYY-MM-DD";
  return lang === "tr" ? "GG.AA.YYYY" : "MM/DD/YYYY";
}

/**
 * Kullanıcının yazdığı tarihi ISO'ya çevirir. Seçili biçim, ISO ve diğer dilin biçimi kabul edilir;
 * yıl 2 haneli yazılırsa 2000'li yıllar varsayılır. Geçersizse null.
 */
export function parseDateLocal(text: string): string | null {
  const s = text.trim();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) {
    // Eğik çizgi: İngilizcede ay/gün, Türkçede gün/ay
    const [a, b] = [Number(m[1]), Number(m[2])];
    [mo, d] = lang === "en" ? [a, b] : [b, a];
    y = Number(m[3]);
  } else return null;
  if (y < 100) y += 2000;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Ay adı (0 = ocak) */
export function monthName(month: number, short = false): string {
  return t(`month.${short ? "short" : "long"}.${month}` as MessageKey);
}

/** Gün adı (0 = pazar) */
export function dayName(dow: number, short = true): string {
  return t(`day.${short ? "short" : "long"}.${dow}` as MessageKey);
}

/** Yüzde: TR "%45", EN "45%" */
export function formatPercent(n: number, maxDigits = 0): string {
  return t("common.percent", { v: formatNumber(n, maxDigits) });
}

/** Kısa para (grafik ekseni): TR "250 bin ₺", EN "₺250K" */
export function formatMoneyShort(v: number, code = currency): string {
  const sym = currencySymbol(code);
  const num =
    Math.abs(v) >= 1_000_000
      ? t("charts.million", { n: formatNumber(v / 1_000_000, 2) })
      : Math.abs(v) >= 1000
        ? t("charts.thousand", { n: formatNumber(Math.round(v / 1000), 0) })
        : formatNumber(Math.round(v), 0);
  if (lang === "tr") return `${num} ${sym}`;
  return sym.length === 1 ? `${sym}${num}` : `${sym} ${num}`;
}

/**
 * Kullanıcının yazdığı sayıyı okur: para birimi simgesi, kodu ve % atılır. TR'de nokta binlik, virgül ondalık;
 * EN'de virgül binlik, nokta ondalık. Okunamazsa null.
 */
export function parseNumberLocal(text: string): number | null {
  let s = text.replace(/[\p{Sc}%\s]/gu, "").replace(/[A-Za-z]+/g, "");
  if (!s) return null;
  const [group, dec] = lang === "tr" ? [".", ","] : [",", "."];
  // Tek ayırıcı ve ardından 3'ten farklı hane: diğer dilin ondalığı da kabul edilir (ör. TR'de 12.5)
  if (!s.includes(dec) && s.split(group).length === 2 && s.split(group)[1].length !== 3) s = s.replace(group, dec);
  s = s.split(group).join("").replace(dec, ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
