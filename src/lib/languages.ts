import type { LanguageDef } from "./types";

/**
 * Desteklenen hedef diller kayıt defteri.
 * Aşama 1: de, en (mevcut — dokunulmadı)
 * Aşama 2: es (İspanyolca)
 * Aşama 3+: fr, pt, ar aynı kalıpla eklenir.
 */
export const LANGUAGES: LanguageDef[] = [
  {
    code: "de",
    langTag: "DE",
    name: "Almanca",
  nameKey: "lang.de.short",
    deskName: "Almanca Masası",
  deskNameKey: "desk.de",
    flag: "🇩🇪",
    accentColor: "#3B6978",
    coverClass: "craft-cover-slate",
    description: "Artikel, düzensiz fiil çekimleri ve 3 günlük aralıklı tekrar",
  descriptionKey: "desk.de.desc",
    badge: "Almanca A1-B2",
  badgeKey: "desk.de_badge",
    fields: [
      {
        key: "artikel",
        label: "Artikel",
    labelKey: "field.artikel",
        type: "select",
        options: ["der", "die", "das", ""],
      },
      {
        key: "plural",
        label: "Çoğul",
    labelKey: "field.plural",
        type: "text",
        placeholder: "z. B. die Häuser",
      },
    ],
  },
  {
    code: "en",
    langTag: "EN",
    name: "İngilizce",
  nameKey: "lang.en.short",
    deskName: "İngilizce Masası",
  deskNameKey: "desk.en",
    flag: "🇬🇧",
    accentColor: "#007AFF",
    coverClass: "craft-cover-aurora",
    description: "Akademik kelime dağarcığı, zengin eş anlamlılar ve telaffuz pratiği",
  descriptionKey: "desk.en.desc",
    badge: "İngilizce B2-C2",
  badgeKey: "desk.en_badge",
    fields: [
      {
        key: "pos",
        label: "Tür",
    labelKey: "field.pos",
        type: "select",
        options: ["noun", "verb", "adjective", "adverb", ""],
      },
      {
        key: "tenses",
        label: "Zaman / Çekim",
    labelKey: "field.tenses",
        type: "text",
        placeholder: "e.g. go / went / gone",
      },
    ],
  },
  {
    code: "es",
    langTag: "ES",
    name: "İspanyolca",
  nameKey: "lang.es.short",
    deskName: "İspanyolca Masası",
  deskNameKey: "desk.es",
    flag: "🇪🇸",
    accentColor: "#E4572E",
    coverClass: "craft-cover-sunset",
    description: "Cinsiyet, fiil çekimleri ve günlük konuşma kalıpları",
  descriptionKey: "desk.es.desc",
    badge: "İspanyolca A1-B1",
  badgeKey: "desk.es_badge",
    fields: [
      {
        key: "gender",
        label: "Cinsiyet (el/la)",
    labelKey: "field.gender",
        type: "select",
        options: ["el", "la", ""],
      },
      {
        key: "conjugation",
        label: "Çekim",
    labelKey: "field.conjugation",
        type: "text",
        placeholder: "p. ej. hablar / hablo / hablé",
      },
    ],
  },
  {
    code: "fr",
    langTag: "FR",
    name: "Fransızca",
  nameKey: "lang.fr.short",
    deskName: "Fransızca Masası",
  deskNameKey: "desk.fr",
    flag: "🇫🇷",
    accentColor: "#2E5EAA",
    coverClass: "craft-cover-aurora",
    description: "Cinsiyet, fiil çekimleri ve günlük konuşma kalıpları",
  descriptionKey: "desk.fr.desc",
    badge: "Fransızca A1-B1",
  badgeKey: "desk.fr_badge",
    fields: [
      {
        key: "gender",
        label: "Cinsiyet (le/la)",
    labelKey: "field.gender_fr",
        type: "select",
        options: ["le", "la", ""],
      },
      {
        key: "conjugation",
        label: "Çekim",
    labelKey: "field.conjugation",
        type: "text",
        placeholder: "p. ex. parler / parle / parlé",
      },
    ],
  },
  {
    code: "it",
    langTag: "IT",
    name: "İtalyanca",
  nameKey: "lang.it.short",
    deskName: "İtalyanca Masası",
  deskNameKey: "desk.it",
    flag: "🇮🇹",
    accentColor: "#2A9D8F",
    coverClass: "craft-cover-forest",
    description: "Cinsiyet, fiil çekimleri ve günlük konuşma kalıpları",
  descriptionKey: "desk.it.desc",
    badge: "İtalyanca A1-B1",
  badgeKey: "desk.it_badge",
    fields: [
      {
        key: "gender",
        label: "Cinsiyet (il/la)",
    labelKey: "field.gender_it",
        type: "select",
        options: ["il", "la", ""],
      },
      {
        key: "conjugation",
        label: "Çekim",
    labelKey: "field.conjugation",
        type: "text",
        placeholder: "es. parlare / parlo / parlato",
      },
    ],
  },
  {
    code: "ar",
    langTag: "AR",
    name: "Arapça",
  nameKey: "lang.ar.short",
    deskName: "Arapça Masası",
  deskNameKey: "desk.ar",
    flag: "🇸🇦",
    accentColor: "#1F7A5A",
    coverClass: "craft-cover-sunset",
    description: "Cinsiyet (müzekker/müennes), çoğul ve kök kalıpları",
  descriptionKey: "desk.ar.desc",
    badge: "Arapça A1-B1",
  badgeKey: "desk.ar_badge",
    fields: [
      {
        key: "gender",
        label: "Cinsiyet (müzekker/müennes)",
    labelKey: "field.gender_ar",
        type: "select",
        options: ["müzekker", "müennes", ""],
      },
      {
        key: "plural",
        label: "Çoğul",
    labelKey: "field.plural",
        type: "text",
        placeholder: "örn. كِتَاب / كُتُب",
      },
    ],
  },
];

/** Kayıtlı tüm dil kodları (masa açılabilir diller). */
export const SUPPORTED_LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function getLanguageByCode(code: string | null | undefined): LanguageDef | null {
  if (!code) return null;
  return LANGUAGES.find((l) => l.code === code) || null;
}

export function getLanguageByTag(tag: string | null | undefined): LanguageDef | null {
  if (!tag) return null;
  return LANGUAGES.find((l) => l.langTag === tag) || null;
}

/**
 * Bir dil koduna karşılık gelen masa id'si (sabit ön ek + kod).
 * Örn. "de" -> "space-de", "es" -> "space-es"
 */
export function spaceIdForLanguage(code: string): string {
  return `space-${code}`;
}

/** Masa id'sinden hedef dil kodunu çıkar (örn. "space-es" -> "es"). */
export function languageCodeFromSpaceId(spaceId: string): string | null {
  const m = /^space-([a-z]{2,3})$/.exec(spaceId);
  return m ? m[1] : null;
}
