import tr from "./locales/tr";

export type TranslationDict = typeof tr;
export type TranslationKey = keyof TranslationDict;

export interface UiLanguageDef {
  code: string;
  label: string;
  flag: string;
  /** Metin yönü — "ltr" veya "rtl" (Arapça). */
  dir: "ltr" | "rtl";
}
/**
 * Desteklenen ARAYÜZ (UI) dilleri — kaynak dil Türkçe.
 * Aşama 1: tr + en. Aşama 2: de, es, pt. Aşama 3: Arapça (ar) — RTL. Aşama 4: ru, fr.
 * Aşama 5: fr + it ARAYÜZ diline alındı. (pt/ru/nl çevirileri DICTS'te hazır bekliyor.)
 */
// ARAYUZ dilleri: bu 7 tanesi (tr/en/de/es/fr/it/ar). pt/ru/nl çevirileri DICTS'te
// hazır, ancak ARAYUZ dil listesinde DEĞİL — istenirse tek satırla eklenir.
export const UI_LANGUAGES: UiLanguageDef[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "es", label: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "it", label: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
];

// Yalnızca kaynak dil (tr) pakete dahildir; diğer diller ilk kullanımda yüklenir.
const DICTS: Record<string, Partial<TranslationDict>> = { tr };

const LOADERS: Record<string, () => Promise<{ default: Partial<TranslationDict> }>> = {
  en: () => import("./locales/en"),
  de: () => import("./locales/de"),
  es: () => import("./locales/es"),
  pt: () => import("./locales/pt"),
  ar: () => import("./locales/ar"),
  ru: () => import("./locales/ru"),
  fr: () => import("./locales/fr"),
  nl: () => import("./locales/nl"),
  it: () => import("./locales/it"),
};

/** Sözlüğü elle kaydeder (testler ve önceden yüklenmiş sözlükler için). */
export function registerDictionary(code: string, dict: Partial<TranslationDict>) {
  DICTS[code] = dict;
}

export function isDictionaryLoaded(code: string): boolean {
  return Boolean(DICTS[code]);
}

/** Verilen dilin sözlüğünü (gerekirse) yükler. Bilinmeyen dil için sessizce tr'ye düşer. */
export async function loadDictionary(code: string): Promise<void> {
  if (DICTS[code] || !LOADERS[code]) return;
  try {
    const mod = await LOADERS[code]();
    DICTS[code] = mod.default;
  } catch {
    /* ağ hatası: translate() tr kaynağına düşer */
  }
}

export const STORAGE_KEY_UI_LANGUAGE = "yourbook_ui_language_v1";
export const UI_LANGUAGE_EVENT = "yourbook-ui-language-changed";

export function getSavedUiLanguage(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UI_LANGUAGE);
    if (raw && UI_LANGUAGES.some((l) => l.code === raw)) return raw;
  } catch {
    /* ignore */
  }
  return "tr";
}

export function setSavedUiLanguage(code: string) {
  try {
    if (UI_LANGUAGES.some((l) => l.code === code)) {
      localStorage.setItem(STORAGE_KEY_UI_LANGUAGE, code);
      window.dispatchEvent(new CustomEvent(UI_LANGUAGE_EVENT, { detail: code }));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Çeviri fonksiyonu. Anahtar bulunamazsa Türkçe kaynağa, o da yoksa anahtarın
 * kendisine düşer — böylece eksik çeviri uygulamayı asla bozmaz.
 */
/** UI dili -> BCP-47 locale eslemesi (tarih/saat bicimlendirme icin). */
export const LOCALE_MAP: Record<string, string> = {
  tr: "tr-TR", en: "en-GB", de: "de-DE", es: "es-ES",
  pt: "pt-PT", ar: "ar-SA", ru: "ru-RU", fr: "fr-FR",
  nl: "nl-NL", it: "it-IT",
};
export function langToLocale(lang: string): string {
  return LOCALE_MAP[lang] || "tr-TR";
}

export function translate(langCode: string, key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[langCode] || DICTS.tr;
  const source = DICTS.tr;
  let value = (dict as Record<string, string>)[key] ?? (source as Record<string, string>)[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{${k}}`).join(String(v));
    }
  }
  return value;
}

export { tr };
