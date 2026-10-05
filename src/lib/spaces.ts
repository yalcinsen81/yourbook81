import { useState } from "react";
import type { Lang, LanguageDef } from "./types";
import { getLanguageByCode, spaceIdForLanguage } from "./languages";

export interface CraftSpace {
  id: string;
  name: string;
  nameKey?: string;
  descriptionKey?: string;
  badgeKey?: string;
  icon: string;
  targetLang: Lang | null;
  description: string;
  coverClass: string;
  accentColor: string;
  badge: string;
  /** Hedef dil kodu ("de" | "en" | "es" ...). Genelleştirilmiş dil masaları için. */
  languageCode?: string;
}

export const CRAFT_SPACES: CraftSpace[] = [
  {
    id: "space-de",
    name: "Almanca Masası",
    nameKey: "desk.de",
    icon: "🇩🇪",
    targetLang: "DE",
    languageCode: "de",
    description: "Artikel, düzensiz fiil çekimleri ve 3 günlük aralıklı tekrar",
    descriptionKey: "desk.de.desc",
    coverClass: "craft-cover-slate",
    accentColor: "#3B6978",
    badge: "Almanca A1-B2",
    badgeKey: "desk.de_badge",
  },
  {
    id: "space-en",
    name: "İngilizce Masası",
    nameKey: "desk.en",
    icon: "🇬🇧",
    targetLang: "EN",
    languageCode: "en",
    description: "Akademik kelime dağarcığı, zengin eş anlamlılar ve telaffuz pratiği",
    descriptionKey: "desk.en.desc",
    coverClass: "craft-cover-aurora",
    accentColor: "#007AFF",
    badge: "İngilizce B2-C2",
    badgeKey: "desk.en_badge",
  },
  {
    id: "space-work",
    name: "Work & Projects",
    nameKey: "desk.work",
    icon: "briefcase",
    targetLang: "Memo",
    description: "Proposals, meeting notes and project ideas in one place",
    descriptionKey: "desk.work.desc",
    coverClass: "craft-cover-sunset",
    accentColor: "#FF9500",
    badge: "Work Notes",
    badgeKey: "desk.work_badge",
  },
  {
    id: "space-personal",
    name: "Personal & Daily",
    nameKey: "desk.personal",
    icon: "personal",
    targetLang: null,
    description: "The day's thoughts, inspiring quotes and personal growth goals",
    descriptionKey: "desk.personal.desc",
    coverClass: "craft-cover-forest",
    accentColor: "#34C759",
    badge: "Personal",
    badgeKey: "desk.personal_badge",
  },
];

const STORAGE_KEY_ACTIVE_SPACE = "craft_active_space_taste_v1";
const STORAGE_KEY_CUSTOM_SPACES = "craft_custom_spaces_v1";

function loadCustomSpaces(): CraftSpace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_SPACES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // v69 MIGRATION: eski kayitlarda nameKey/badgeKey/descriptionKey yok -> dil kaydindan doldur.
    // Aksi halde sabit Turkce ad gosterilir (or. 'Ispanyolca Masasi' her arayuz dilinde).
    const migrated = parsed
      .filter((s): s is CraftSpace => s && typeof s.id === "string" && typeof s.name === "string")
      .map((s) => {
        if (!s.languageCode) return s;
        const def = getLanguageByCode(s.languageCode);
        if (!def) return s;
        return {
          ...s,
          name: s.name || def.deskName,
          nameKey: s.nameKey || def.deskNameKey,
          badge: s.badge || def.badge,
          badgeKey: s.badgeKey || def.badgeKey,
          description: s.description || def.description,
          descriptionKey: s.descriptionKey || def.descriptionKey,
          icon: s.icon || def.flag,
        };
      });
    return migrated;
  } catch {
    return [];
  }
}

function saveCustomSpaces(spaces: CraftSpace[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_SPACES, JSON.stringify(spaces));
  } catch {}
}

export function createCustomSpace(
  name: string,
  icon: string,
  accentColor: string,
  description = ""
): CraftSpace {
  return {
    id: `space-custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    icon,
    targetLang: null,
    description,
    coverClass: "craft-cover-slate",
    accentColor,
    badge: name,
  };
}

/**
 * Bir hedef dil için GENEL masa üretir.
 * Aynı kalıp tüm dillerde geçerlidir; yeni dil eklemek için languages.ts'e kayıt yetir.
 */
export function createLanguageSpace(language: LanguageDef): CraftSpace {
  return {
    id: spaceIdForLanguage(language.code),
    name: language.deskName,
    nameKey: language.deskNameKey,
    icon: language.flag,
    targetLang: language.langTag as Lang,
    languageCode: language.code,
    description: language.description,
    descriptionKey: language.descriptionKey,
    coverClass: language.coverClass,
    accentColor: language.accentColor,
    badge: language.badge,
    badgeKey: language.badgeKey,
  };
}

export function useSpaces() {
  const [customSpaces, setCustomSpaces] = useState<CraftSpace[]>(loadCustomSpaces);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_SPACE) || "space-de";
    } catch {
      return "space-de";
    }
  });

  const spaces = [...CRAFT_SPACES, ...customSpaces];
  // v-fix: DIL MASALARI icin TEK DOGRULUK KAYNAGI.
  // "6" gibi SABIT sayi YAZILMAZ; yeni dil eklenince otomatik artar.
  const langDesks = spaces.filter((s) => !!(s as CraftSpace & { languageCode?: string }).languageCode);
  const activeSpace =
    spaces.find((s) => s.id === activeSpaceId) || CRAFT_SPACES[0];

  const switchSpace = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SPACE, spaceId);
    } catch {}
  };

  const addSpace = (name: string, icon: string, accentColor: string, description = "") => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const space = createCustomSpace(trimmed, icon, accentColor, description);
    const next = [...customSpaces, space];
    setCustomSpaces(next);
    saveCustomSpaces(next);
    switchSpace(space.id);
    return space;
  };

  /** Verilen dil kodunda bir masa zaten var mı? (mükerrer masa engeli) */
  const languageSpaceExists = (code: string) =>
    spaces.some((s) => s.languageCode === code);

  /**
   * Bir hedef dil için masa açar. Zaten varsa mevcut masaya geçer ve onu döndür
   * (aynı dilden ikinci masa açılmaz).
   */
  const addLanguageSpace = (code: string) => {
    const existing = spaces.find((s) => s.languageCode === code);
    if (existing) {
      switchSpace(existing.id);
      return existing;
    }
    const def = getLanguageByCode(code);
    if (!def) return null;
    const space = createLanguageSpace(def);
    const next = [...customSpaces, space];
    setCustomSpaces(next);
    saveCustomSpaces(next);
    switchSpace(space.id);
    return space;
  };

  /**
   * Birden çok dil için masa açar (örn. karşılama akışı). Var olanları atlar, aktif masayı değiştirmez.
   * Tek durum güncellemesi yapar: art arda addLanguageSpace çağrıları bayat durum yüzünden birbirini ezerdi.
   */
  const addLanguageSpaces = (codes: string[]) => {
    const fresh = [...new Set(codes)]
      .filter((c) => !spaces.some((s) => s.languageCode === c))
      .map((c) => getLanguageByCode(c))
      .filter((d): d is LanguageDef => Boolean(d))
      .map(createLanguageSpace);
    if (fresh.length === 0) return;
    const next = [...customSpaces, ...fresh];
    setCustomSpaces(next);
    saveCustomSpaces(next);
  };

  const removeSpace = (spaceId: string) => {
    if (CRAFT_SPACES.some((s) => s.id === spaceId)) return;
    const next = customSpaces.filter((s) => s.id !== spaceId);
    setCustomSpaces(next);
    saveCustomSpaces(next);
    if (activeSpaceId === spaceId) switchSpace(CRAFT_SPACES[0].id);
  };

  return {
    /** SADECE dil masalari (tek dogruluk kaynagi). */
    langDesks,
    /** Dil masasi SAYISI - arayuzde sabit sayi yazmak yerine bunu kullan. */
    langDeskCount: langDesks.length,
    spaces,
    defaultSpaces: CRAFT_SPACES,
    activeSpace,
    activeSpaceId,
    switchSpace,
    addSpace,
    addLanguageSpace,
    addLanguageSpaces,
    languageSpaceExists,
    removeSpace,
  };
}
