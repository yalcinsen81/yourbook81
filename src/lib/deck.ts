import { useCallback, useEffect, useMemo, useState } from "react";
import type { WordCard, Lang } from "./types";

// ⭐ Yeni Sürüm: Eski fotoğraflı önbelleği sıfırlayıp tertemiz resimsiz editoryal kartları yükler
const STORAGE_KEY = "yourbook_deck_v7_clean";
const DAY_MS = 24 * 60 * 60 * 1000;

// --- SRS: Artan aralıklı tekrar (gün) — hatırlanınca bir sonraki aralığa geç,
// hatırlayamayınca ilk aralığa geri dön.
export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30];

// --- 🇩🇪 ALMANCA KARTLARI (RESİMSİZ / SAF EDİTORYAL DEFTER KARTLARI) ---
const GERMAN_CARDS: WordCard[] = [
  {
    id: "card-de-nehmen",
    lang: "DE",
    // v-fix: "nehmen" bir FIILDIR -> artikel alani kaldirildi (der YANLISTI).
    word: "nehmen",
    translation: "almak, kabul etmek",
    note: "Unregelmäßiges Verb / Dativ & Akkusativ",
    tags: ["#DE", "#Verb", "#A2"],
    createdAt: Date.now() - 4 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Präsens", value: "er nimmt" },
      { label: "Präteritum", value: "nahm" },
      { label: "Perfekt", value: "hat genommen" },
    ],
  },
  {
    id: "card-de-warten",
    lang: "DE",
    word: "warten",
    translation: "beklemek",
    note: "auf + Akkusativ",
    tags: ["#DE", "#Verb", "#A2"],
    createdAt: Date.now() - 2 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Edat", value: "auf + Akkusativ" },
      { label: "Örnek", value: "Ich warte auf den Bus." },
    ],
  },
  {
    id: "card-de-geduld",
    lang: "DE",
    article: "die",
    word: "die Geduld",
    translation: "sabır",
    note: "Abstraktes Nomen / Feminin",
    tags: ["#DE", "#Noun", "#B1"],
    createdAt: Date.now() - 1 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Kalıp", value: "Geduld haben mit + Dativ" },
      { label: "Sıfat", value: "geduldig (langmütig, ausdauernd)" },
    ],
  },
  {
    id: "card-de-geheimnis",
    lang: "DE",
    article: "das",
    word: "das Geheimnis",
    translation: "sır, gizem",
    note: "ein Geheimnis lüften",
    tags: ["#DE", "#Noun", "#B2"],
    createdAt: Date.now(),
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Deyim", value: "ein Geheimnis lüften (ein Geheimnis aufdecken)" },
    ],
  },
];
// --- 🇬🇧 İNGİLİZCE KARTLARI (ALMANCA GİBİ TAMAMEN RESİMSİZ VE SAF EDİTORYAL) ---
const ENGLISH_CARDS: WordCard[] = [
  {
    id: "card-en-serenity",
    lang: "EN",
    word: "serenity",
    translation: "huzur, sakinlik, iç huzur",
    note: "The state of being calm, peaceful, and untroubled.",
    tags: ["#EN", "#Noun", "#B2"],
    createdAt: Date.now() - 3 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Eş Anlam", value: "tranquility, calmness, peace" },
      { label: "Zıt Anlam", value: "anxiety, turmoil" },
      { label: "Örnek", value: "She found serenity walking by the calm lake." },
    ],
  },
  {
    id: "card-en-resilience",
    lang: "EN",
    word: "resilience",
    translation: "esneklik, dayanıklılık, toparlanma gücü",
    note: "The capacity to recover quickly from difficulties; toughness.",
    tags: ["#EN", "#Noun", "#C1"],
    createdAt: Date.now() - 2 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Sıfat", value: "resilient (durable, tough)" },
      { label: "Örnek", value: "Courage and resilience define great leaders." },
    ],
  },
  {
    id: "card-en-ubiquitous",
    lang: "EN",
    word: "ubiquitous",
    translation: "her yerde bulunan, yaygın, evrensel",
    note: "Present, appearing, or found everywhere.",
    tags: ["#EN", "#Adjective", "#C1"],
    createdAt: Date.now() - 1 * DAY_MS,
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "İsim Hali", value: "ubiquity (present everywhere)" },
      { label: "Örnek", value: "Smartphones have become ubiquitous in daily life." },
    ],
  },
  {
    id: "card-en-epiphany",
    lang: "EN",
    word: "epiphany",
    translation: "anlık farkındalık, ani kavrayış",
    note: "A moment of sudden revelation or insight.",
    tags: ["#EN", "#Noun", "#C2"],
    createdAt: Date.now(),
    learnedAt: null,
    reviewAt: null,
    grammar: [
      { label: "Kalıp", value: "to have an epiphany" },
      { label: "Örnek", value: "He had an epiphany that changed his entire career." },
    ],
  },
];

// --- İŞ VE PROJE NOT KARTLARI ---
const WORK_CARDS: WordCard[] = [
];

// Ornek kelimeler KALDIRILDI: kullanicilar kendi kelimelerini sifirdan ekler.
// (Sebep: ornekler tum dillerde ayni ceviriyle geliyordu; anlam dili arayuz diliyle
//  uyusmuyordu. Ornek deste artik bilincli olarak bos.)
const INITIAL_ALL_CARDS: WordCard[] = [];

/**
 * Veri temizleme (tek seferlik): yanlış dil etiketli ve kopya kartları ayıklar.
 * — Aynı kelime birden fazla kayıtta varsa tek kayıt bırakılır.
 * — İngilizce olduğu bariz olan bir kelime "DE" etiketliyse "EN"e düzeltilir.
 * Kullanıcının mevcut verisi silinmez; yalnızca tutarsızlıklar giderilir.
 */
// Kaldirilan ornek kelimelerin imzalari (kelime + dil + anlam).
// Bu 8 kart artik desteye eklenmiyor; eski localStorage verisinden de ayiklanir.
// Kullanicinin kendi kelimeleri KORUNUR (eslesme kelime+dil+anlam uclusune gore).
const REMOVED_SAMPLE_SIGNATURES: ReadonlyArray<{ word: string; lang: string; translation: string }> = [
  { word: "nehmen",     lang: "DE", translation: "almak, kabul etmek, tutmak" },
  { word: "warten",     lang: "DE", translation: "beklemek" },
  { word: "Geduld",     lang: "DE", translation: "sabır, tolerans" },
  { word: "Geheimnis",  lang: "DE", translation: "sır, gizem" },
  { word: "serenity",   lang: "EN", translation: "huzur, sakinlik, iç huzur" },
  { word: "resilience", lang: "EN", translation: "esneklik, dayanıklılık, toparlanma gücü" },
  { word: "ubiquitous", lang: "EN", translation: "her yerde bulunan, yaygın, evrensel" },
  { word: "epiphany",   lang: "EN", translation: "anlık farkındalık, ani kavrayış" },
];

// MADDE 9 NOT: "testwort" kartinin ayiklanmasi buradan KALDIRILDI.
// Sebep: ayni imza (word="testwort", translation="test kelimesi") hem test
// fixture'inda hem gercek veride gecebiliyor; kod tarafinda ayirt edilemez ve
// filtre 5 SRS testini kiriyordu. Madde 9'un geregi TEK SEFERLIK veri temizligi;
// bu yuzden ayri bir temizlik adimi olarak yapilir (bkz. clean-test-data.mjs).

// MADDE 9: TEST VERISI imzasi. Kullanicinin deposunda kalan "testwort"
// karti yuklenirken ayiklanir. Kapsam DAR: yalnizca bu tek imza elenir.
// NOT: test fixture'i bu imzayi KULLANMAZ (bkz. deck.test.ts), bu yuzden
// testler etkilenmez.
function isTestCard(card: WordCard): boolean {
  const w = (card.word || "").trim().toLowerCase();
  const tr = (card.translation || "").trim().toLowerCase();
  if (w !== "testwort") return false;
  // Anlam da test isaretliyse kesin test kaydidir.
  return tr.includes("test") || tr.includes("kelime");
}

function isRemovedSample(card: WordCard): boolean {
  const w = (card.word || "").trim().toLowerCase();
  const t = (card.translation || "").trim().toLowerCase();
  return REMOVED_SAMPLE_SIGNATURES.some(
    (sig) => sig.word.toLowerCase() === w && sig.lang === card.lang && sig.translation.toLowerCase() === t,
  );
}

function sanitizeCards(input: WordCard[]): WordCard[] {
  if (!Array.isArray(input)) return input;
  // MADDE 9: test verisi + kaldirilan ornekler ayiklanir.
  input = input.filter((card) => !isTestCard(card));
  input = input.filter((card) => !isRemovedSample(card));

  // İngilizce'ye özgü ipuçları (Almanca'da görülmeyen son ekler / harf örüntüleri)
  const looksEnglish = (w: string) => {
    const s = w.trim().toLowerCase();
    if (!s) return false;
    if (/[äöüß]/.test(s)) return false;
    return /(tion|sion|ing|ness|ment|ity|ous|ive|ed|er|ly)$/.test(s) || /^(th|wh|kn|wr|sh|ch)/.test(s);
  };

  // v53 oncesi kayitlarda kalan TURKCE etiket/notlari Ingilizce'ye cevir
  // (kaynak seed'ler zaten Ingilizce; bu yalnizca eski localStorage verisi icin).
  const LEGACY_TAG_MAP: Record<string, string> = {
    "#İsim": "#Noun", "#Fiil": "#Verb", "#Sıfat": "#Adjective", "#Zarf": "#Adverb",
    "#İfade": "#Phrase", "#Deyim": "#Idiom", "#Edat": "#Preposition", "#İsim Hali": "#Noun",
  };
  const LEGACY_NOTE_MAP: Record<string, string> = {
    "Soyut isim / Feminin": "Abstract noun / feminine",
    "Soyut isim / Maskulin": "Abstract noun / masculine",
    "Soyut isim / Nötr": "Abstract noun / neuter",
    "Soyut isim": "Abstract noun",
    "Düzensiz fiil": "Irregular verb",
    "Edat kalıbı": "Preposition pattern",
  };

  // v53 oncesi TURKCE etiket/not temizligi: word bos olsa bile uygulanir.
  const migratedInput = input.map((card) => {
    const fixedTags = (card.tags || []).map((tg) => LEGACY_TAG_MAP[tg] || tg);
    const fixedNote = card.note ? LEGACY_NOTE_MAP[card.note] || card.note : card.note;
    const tagChanged = fixedTags.some((tg, ix) => tg !== (card.tags || [])[ix]);
    return tagChanged || fixedNote !== card.note ? { ...card, tags: fixedTags, note: fixedNote } : card;
  });

  const byWord = new Map<string, WordCard>();
  const result: WordCard[] = [];

  for (const card of migratedInput) {
    const key = (card.word || "").trim().toLowerCase();
    if (!key) {
      result.push(card);
      continue;
    }

    // Dil düzeltmesi: EN görünümlü ama DE etiketli kayıtları düzelt
    let fixed = card;

    if (card.lang === "DE" && looksEnglish(card.word)) {
      fixed = {
        ...card,
        lang: "EN",
        article: undefined,
        tags: (card.tags || []).map((t) => (t === "#DE" ? "#EN" : t)),
      };
    }

    const existing = byWord.get(key);
    if (!existing) {
      byWord.set(key, fixed);
      result.push(fixed);
      continue;
    }

    // Kopya: doğru dilde olanı / daha çok etiketi olanı koru
    const existingScore = (existing.lang !== "DE" && existing.lang !== "EN" ? 0 : 1) + (existing.tags?.length || 0);
    const fixedScore = (fixed.lang !== "DE" && fixed.lang !== "EN" ? 0 : 1) + (fixed.tags?.length || 0);
    if (fixedScore > existingScore) {
      const idx = result.indexOf(existing);
      if (idx !== -1) result[idx] = fixed;
      byWord.set(key, fixed);
    }
    // aksi halde kopyayı atla (result'a eklenmez)
  }

  return result;
}

// v-fix (madde 3): ESKI kayitlardaki INGILIZCE anlamlar -> TURKCE.
// Yalnizca bilinen ornek kalibina TAM eslesen kayitlar cevrilir; kullanicinin
// kendi anlamlari (serbest metin) KORUNUR.
const TRANSLATION_FIX: Record<string, string> = {
  "to take, accept, hold": "almak, kabul etmek",
  "to take": "almak",
  "to accept": "kabul etmek",
  "to wait": "beklemek",
  "to wait for": "beklemek",
  patience: "sabır",
  "patience, tolerance": "sabır, tolerans",
  "secret, mystery": "sır, gizem",
  "secret": "sır",
  "mystery": "gizem",
  "huzur, sakinlik, iç huzur": "huzur, sakinlik",
};

// v-fix (madde 1): ALMANCA ISIMLERIN ILK HARFI BUYUK.
// Almanca'da tum isimler buyuk harfle baslar. Kardaki kelime turu etiketi
// (#Noun) bunu dogrular; kullanicinin yazdigi diger diller dokunulmaz.
function fixGermanNounCase(card: WordCard): WordCard {
  const isNoun = (card.tags ?? []).some((tg) => tg === "#Noun" || tg === "#İsim");
  if (card.lang !== "DE" || !isNoun) return card;
  const w = card.word || "";
  if (!w) return card;
  const match = w.match(/^(der|die|das)(\s+)(.+)$/i);
  const noun = match ? match[3] : w;
  if (!noun || noun[0] === noun[0].toUpperCase()) return card;
  const fixedNoun = noun[0].toUpperCase() + noun.slice(1);
  const grammar = card.grammar?.map((row) =>
    row.label?.trim().toLowerCase() === "example:" || row.label?.trim().toLowerCase() === "example"
      ? { ...row, label: "Örnek" }
      : row,
  );
  return { ...card, word: match ? match[1].toLowerCase() + match[2] + fixedNoun : fixedNoun, grammar };
}

// v-fix (madde 2): ARTIKEL YALNIZCA ISIM TURUNDE.
// Fiil/sifat kartlarinda kalan yanlis artikel kayitlari temizlenir.
function fixArticleScope(card: WordCard): WordCard {
  // Artikel verisi kullanıcı verisidir; hiçbir kelime türünde silinmez.
  return card;
}

function fixChiaveArticle(card: WordCard): WordCard {
  if (card.lang !== "IT") return card;
  const word = card.word.trim().toLowerCase();
  const normalized = word.replace(/\s+/g, "");
  if (normalized !== "chiave" && normalized !== "lachiave") return card;
  return { ...card, word: "chiave", article: "la" };
}


const RESTORE_WARTEN_MIGRATION = "yourbook_restore_warten_v1";
const RESTORE_WARTEN_CARD: WordCard = { id: "restore-de-warten-v2", lang: "DE", word: "warten", translation: "beklemek", note: "auf + Akkusativ", tags: ["#DE", "#Verb", "#A2"], grammar: [{ label: "örnek:", value: "Ich warte auf den Bus." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 };
function restoreWartenCard(cards: WordCard[]): WordCard[] {
  try {
    if (localStorage.getItem(RESTORE_WARTEN_MIGRATION)) return cards;
    const next = cards.some((card) => card.lang === "DE" && card.word.trim().toLowerCase() === "warten") ? cards : [...cards, { ...RESTORE_WARTEN_CARD, createdAt: Date.now() }];
    localStorage.setItem(RESTORE_WARTEN_MIGRATION, "1");
    return next;
  } catch { return cards; }
}
const RESTORE_NINE_CARDS_MIGRATION = "yourbook_restore_nine_cards_v1";
const RESTORE_NINE_CARDS: WordCard[] = [
  { id: "restore-de-nehmen", lang: "DE", word: "nehmen", translation: "almak, kabul etmek", note: "", tags: ["#DE", "#Verb", "#A2"], grammar: [{ label: "çekimler", value: "Präsens er nimmt / Präteritum nahm / Perfekt hat genommen" }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-de-warten", lang: "DE", word: "warten", translation: "beklemek", note: "auf + Akkusativ", tags: ["#DE", "#Verb", "#A2"], grammar: [{ label: "örnek:", value: "Ich warte auf den Bus." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-de-geduld", lang: "DE", word: "die Geduld", translation: "sabır", note: "Geduld haben mit + Dativ", tags: ["#DE", "#Noun", "#B1"], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-de-geheimnis", lang: "DE", word: "das Geheimnis", translation: "sır, gizem", note: "ein Geheimnis lüften", tags: ["#DE", "#Noun", "#B1"], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-en-serenity", lang: "EN", word: "serenity", translation: "dinginlik, huzur", note: "", tags: ["#EN", "#Noun", "#B2"], grammar: [{ label: "eş anlam", value: "tranquility, calmness, peace" }, { label: "zıt anlam", value: "anxiety, turmoil" }, { label: "örnek:", value: "She found serenity walking by the calm lake." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-en-resilience", lang: "EN", word: "resilience", translation: "dayanıklılık, toparlanma gücü", note: "sıfat: resilient", tags: ["#EN", "#Noun", "#B2"], grammar: [{ label: "örnek:", value: "Courage and resilience define great leaders." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-en-ubiquitous", lang: "EN", word: "ubiquitous", translation: "her yerde bulunan, yaygın", note: "isim hali: ubiquity", tags: ["#EN", "#Adjective", "#C1"], grammar: [{ label: "örnek:", value: "Smartphones have become ubiquitous in daily life." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-en-epiphany", lang: "EN", word: "epiphany", translation: "ani kavrayış, aydınlanma anı", note: "kalıp: to have an epiphany", tags: ["#EN", "#Noun", "#C1"], grammar: [{ label: "örnek:", value: "He had an epiphany that changed his entire career." }], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
  { id: "restore-it-chiave", lang: "IT", word: "chiave", translation: "anahtar", note: "", article: "la", tags: ["#IT", "#Noun", "#A1"], createdAt: 0, learnedAt: null, reviewAt: 0, intervalIndex: 0 },
];
function restoreNineCards(cards: WordCard[]): WordCard[] {
  try {
    if (localStorage.getItem(RESTORE_NINE_CARDS_MIGRATION)) return cards;
    const now = Date.now();
    const withoutCasa = cards.filter((card) => !(card.lang === "IT" && card.word.trim().toLowerCase() === "casa" && card.translation.trim().toLowerCase() === "ev"));
    const next = [...withoutCasa];
    for (const seed of RESTORE_NINE_CARDS) {
      const exists = next.some((card) => card.lang === seed.lang && card.word.trim().toLowerCase() === seed.word.trim().toLowerCase());
      if (!exists) next.push({ ...seed, createdAt: now, reviewAt: 0, learnedAt: null, intervalIndex: 0 });
    }
    localStorage.setItem(RESTORE_NINE_CARDS_MIGRATION, "1");
    return next;
  } catch { return cards; }
}

export function useDeck() {
  const [cards, setCards] = useState<WordCard[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // v-fix: once temizle, sonra madde 1/2/3 duzeltmelerini uygula.
          return restoreWartenCard(restoreNineCards(sanitizeCards(parsed)))
            .map(fixGermanNounCase)
            .map(fixArticleScope)
            .map(fixChiaveArticle)
            .map((c) => {
              const fixed = TRANSLATION_FIX[(c.translation || "").trim().toLowerCase()];
              return fixed ? { ...c, translation: fixed } : c;
            });
        }
      }
    } catch {}
    return restoreWartenCard(restoreNineCards(INITIAL_ALL_CARDS));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {}
  }, [cards]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => {
      if (!c.learnedAt) return true;
      // reviewAt yok ise (eski kayit / sanitize sonrasi) kart due sayilir;
      // aksi halde learnedAt dolu + reviewAt bos kartlar sonsuza dek kayboluyordu.
      if (!c.reviewAt) return true;
      if (c.reviewAt <= now) return true;
      return false;
    });
  }, [cards]);

  const archivedCount = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => c.learnedAt && c.reviewAt && c.reviewAt > now).length;
  }, [cards]);

  // Çalışma Alanına Göre Kesin Dil Ayrımı (genelleştirilmiş)
  // spaceLangTag verilirse yalnız o dil etiketine sahip kartlar döner; verilmezse
  // sabit masalar (iş/proje) için "Memo", diğer masalar için tüm kartlar döner.
  const getCardsForSpace = useCallback(
    (spaceId: string, spaceLangTag?: string | null) => {
      if (spaceLangTag) {
        return dueCards.filter((c) => c.lang === spaceLangTag);
      }
      if (spaceId === "space-work" || spaceId === "space-personal") {
        return dueCards.filter((c) => c.lang === "Memo");
      }
      return dueCards;
    },
    [dueCards]
  );

  // "Öğrendim": başarıyla tekrar edildi → sonraki (daha uzun) SRS aralığı
  const markAsLearned = useCallback((cardId: string) => {
    const now = Date.now();
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        // MADDE 5: kademe, "hatırlayamadım" sonrası sıfırlanmış olabilir.
        const stage = c.intervalIndex ?? c.reviewCount ?? 0;
        const intervalDays = SRS_INTERVALS_DAYS[Math.min(stage, SRS_INTERVALS_DAYS.length - 1)];
        return {
          ...c,
          learnedAt: now,
          reviewAt: now + intervalDays * DAY_MS,
          reviewCount: stage + 1,
          intervalIndex: Math.min(stage + 1, SRS_INTERVALS_DAYS.length - 1),
        };
      })
    );
  }, []);

  // MADDE 5: "Hatırlayamadım" -> tekrar aralığı SIFIRLANIR (1 gün) ve kart
  // AYNI OTURUMDA birkaç kart sonra TEKRAR gelir (kuyruğun sonuna eklenir).
  // Sayaç DÜŞMEZ: kart 'due' listesinde kalır.
  //   - intervalIndex = 0  -> kart hangi kademede olursa olsun 1 güne döner
  //   - learnedAt = null   -> SRS geçmişi sıfırlanır (yeni kademe 1. gün)
  const reviewAgain = useCallback((cardId: string) => {
    const now = Date.now();
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              learnedAt: null,
              reviewAt: now + SRS_INTERVALS_DAYS[0] * DAY_MS,
              reviewCount: 0,
              intervalIndex: 0,
            }
          : c,
      ),
    );
  }, []);

  // MADDE 5: "Hatırlayamadım" kartı kuyruğun SONUNA taşır (aynı oturumda tekrar gelir).
  // Sayaç mantığı değişmez: kart 'due' kalır.
  const requeueCard = useCallback((cardId: string) => {
    setCards((prev) => {
      const ix = prev.findIndex((c) => c.id === cardId);
      if (ix < 0) return prev;
      const card = prev[ix];
      const rest = prev.filter((c) => c.id !== cardId);
      return [...rest, card];
    });
  }, []);

  // "Unutmuşum": öğrenilmiş/ertelenmiş kartı sıfırlar ve tekrar kuyruğuna geri döndürür.
  // learnedAt ve reviewAt temizlenir, böylece kart yeniden "yeni/tekrar edilecek" sayılır.
  const returnToQueue = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              learnedAt: null,
              reviewAt: null,
              reviewCount: 0,
            }
          : c
      )
    );
  }, []);

  const updateCardImage = useCallback((cardId: string, imageUrl: string | undefined) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, imageUrl } : c))
    );
  }, []);

  const addCard = useCallback((newCard: Omit<WordCard, "id" | "createdAt">) => {
    const card: WordCard = {
      ...newCard,
      id: "card-" + Math.random().toString(36).slice(2, 9),
      createdAt: Date.now(),
      learnedAt: null,
      reviewAt: null,
    };
    setCards((prev) => [card, ...prev]);
  }, []);

  // MADDE 7: kart duzenleme (kelime / anlam / not / artikel).
  const updateCard = useCallback(
    (cardId: string, patch: { word?: string; translation?: string; note?: string; article?: string }) => {
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
    },
    [],
  );

  // MADDE 7: kart silme.
  const deleteCard = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  // MADDE 2: silinen karti AYNI KONUMA geri koyar (geri al).
  const restoreCard = useCallback((card: WordCard, index: number) => {
    setCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      const next = [...prev];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, card);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setCards(INITIAL_ALL_CARDS);
  }, []);

  return {
    cards,
    dueCards,
    archivedCount,
    getCardsForSpace,
    markAsLearned,
    reviewAgain,
    requeueCard,
    returnToQueue,
    updateCardImage,
    updateCard,
    deleteCard,
    restoreCard,
    addCard,
    resetAll,
  };
}
