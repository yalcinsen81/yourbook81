/**
 * Konuşmadan gelen ham metne noktalama ve büyük harf ekler.
 *
 * Neden gerekli: Web Speech API (Chrome `webkitSpeechRecognition`) noktalama
 * ÜRETMEZ — yalnızca düz kelime dizisi döner. Bu modül o diziyi okunabilir
 * cümlelere çevir.
 *
 * Yaklaşım bilinçli olarak DİL MODELİ KULLANMAZ — sadece güvenli kurallar:
 *   1) Söylenen noktalama sözcüklerini sembole çevir ("nokta" / "period" → ".")
 *   2) Soru cümlesi sezgisi (dil başına soru sözcükleri ve ekleri)
 *   3) Cümle sonlarını büyük harfle başlat (dil başına kurallar)
 *   4) Çok uzun, noktalamasız akışlarda okunabilirlik için cümle böl
 *
 * Bu yüzden asla metni bozmaz: emin olmadığında hiçbir şey yapmaz.
 *
 * DESTEKLEN ARAYÜZ DİLLERİ: tr, en, de, es, fr, it, ar
 * (ar hariç hepsi Latin alfabesi; ar için noktalama çalışır, büyük harf yoktur.)
 */

export type DictationLang = "tr" | "en" | "de" | "es" | "fr" | "it" | "ar";

interface LangRules {
  /** Söylenen noktalama sözcükleri → sembol. */
  spoken: [RegExp, string][];
  /** Cümle bu sözcükle BAŞLIYORSA genellikle sorudur. */
  questionStarters: string[];
  /** Cümle bu ekle BİTİYORSA genellikle sorudur. */
  questionEndings: string[];
  /** Uzun cümleyi bölerken bu sözcüklerden ÖNCE böl. */
  breakBefore: string[];
  /** Bu sözcükten SONRA böl. */
  breakAfter: string[];
  /** Büyük harf dönüşümünde kullanılacak yerel ayar. */
  upperLocale: string;
  /** Bu dilde büyük/küçük harf ayrımı var mı? (Arapça: yok) */
  hasCase: boolean;
  /** Soru işareti (bazı diller farklı işaret kullanır). */
  questionMark: string;
}

const RULES: Record<DictationLang, LangRules> = {
  tr: {
    spoken: [
      [/\b(nokta|noktayı|full stop|period)\b/gi, "."],
      [/\b(virgül|virgul|comma)\b/gi, ","],
      [/\b(soru işareti|soru isareti)\b/gi, "?"],
      [/\b(ünlem|unlem|exclamation)\b/gi, "!"],
      [/\b(yeni satır|yeni satir|satır başı|yeni paragraf)\b/gi, "\n"],
    ],
    questionStarters: [
      "ne", "neden", "niçin", "nicin", "nasıl", "nasil", "nereye", "nerede",
      "nereden", "kim", "kime", "kimi", "hangisi", "hangi", "kaç", "kac", "ne zaman",
    ],
    questionEndings: [
      "mı", "mi", "mu", "mü", "mısın", "misin", "musun", "müsün",
      "mıyız", "miyiz", "muyuz", "müyüz", "mıdır", "midir", "mudur", "müdür",
    ],
    breakBefore: ["ve", "ama", "ancak", "fakat", "çünkü", "cunku", "sonra", "ayrıca", "yani"],
    breakAfter: ["tamam", "peki", "evet", "hayır", "hayir"],
    upperLocale: "tr",
    hasCase: true,
    questionMark: "?",
  },

  en: {
    spoken: [
      [/\b(full stop|period|dot)\b/gi, "."],
      [/\b(comma)\b/gi, ","],
      [/\b(question mark|question)\b/gi, "?"],
      [/\b(exclamation mark|exclamation point|exclamation)\b/gi, "!"],
      [/\b(new line|newline|new paragraph)\b/gi, "\n"],
    ],
    questionStarters: [
      "what", "why", "how", "where", "when", "who", "whom", "whose",
      "which", "is", "are", "was", "were", "do", "does", "did", "can",
      "could", "will", "would", "should", "may", "might",
    ],
    questionEndings: [],
    breakBefore: ["and", "but", "because", "so", "however", "then", "also"],
    breakAfter: ["okay", "ok", "yes", "no", "right"],
    upperLocale: "en",
    hasCase: true,
    questionMark: "?",
  },

  de: {
    spoken: [
      [/\b(punkt|full stop)\b/gi, "."],
      [/\b(komma)\b/gi, ","],
      [/\b(fragezeichen)\b/gi, "?"],
      [/\b(ausrufezeichen|ausrufungszeichen)\b/gi, "!"],
      [/\b(neue zeile|zeilenumbruch|neuer absatz)\b/gi, "\n"],
    ],
    questionStarters: [
      "was", "warum", "wieso", "weshalb", "wie", "wo", "wohin", "woher",
      "wann", "wer", "wen", "wem", "wessen", "welche", "welcher", "welches",
      "ist", "sind", "war", "waren", "kann", "können", "kannst", "wird", "werden",
    ],
    questionEndings: [],
    breakBefore: ["und", "aber", "weil", "denn", "dann", "auch", "jedoch", "deshalb"],
    breakAfter: ["okay", "ok", "gut", "ja", "nein", "richtig"],
    upperLocale: "de",
    hasCase: true,
    questionMark: "?",
  },

  es: {
    spoken: [
      [/\b(punto|punto final)\b/gi, "."],
      [/\b(coma)\b/gi, ","],
      [/\b(signo de interrogación|interrogación|signo de interrogacion)\b/gi, "?"],
      [/\b(signo de exclamación|exclamación|signo de exclamacion)\b/gi, "!"],
      [/\b(nueva línea|nueva linea|nuevo párrafo|nuevo parrafo)\b/gi, "\n"],
    ],
    questionStarters: [
      "qué", "que", "por qué", "porque", "cómo", "como", "dónde", "donde",
      "cuándo", "cuando", "quién", "quien", "quiénes", "cuál", "cual",
      "cuánto", "cuanto", "es", "son", "está", "están", "puede", "puedo",
    ],
    questionEndings: [],
    breakBefore: ["y", "pero", "porque", "entonces", "también", "tambien", "además", "ademas"],
    breakAfter: ["vale", "ok", "sí", "si", "no", "bien"],
    upperLocale: "es",
    hasCase: true,
    questionMark: "?",
  },

  fr: {
    spoken: [
      [/\b(point|point final)\b/gi, "."],
      [/\b(virgule)\b/gi, ","],
      [/\b(point d'interrogation|interrogation)\b/gi, "?"],
      [/\b(point d'exclamation|exclamation)\b/gi, "!"],
      [/\b(nouvelle ligne|nouveau paragraphe|retour à la ligne)\b/gi, "\n"],
    ],
    questionStarters: [
      "quoi", "que", "pourquoi", "comment", "où", "ou", "quand", "qui",
      "quel", "quelle", "quels", "quelles", "combien", "est", "sont",
      "était", "peut", "peux", "est-ce",
    ],
    questionEndings: [],
    breakBefore: ["et", "mais", "parce", "car", "donc", "alors", "aussi", "cependant"],
    breakAfter: ["d'accord", "accord", "ok", "oui", "non", "bien"],
    upperLocale: "fr",
    hasCase: true,
    questionMark: "?",
  },

  it: {
    spoken: [
      [/\b(punto|punto finale)\b/gi, "."],
      [/\b(virgola)\b/gi, ","],
      [/\b(punto interrogativo|punto di domanda)\b/gi, "?"],
      [/\b(punto esclamativo|punto di esclamazione)\b/gi, "!"],
      [/\b(nuova riga|nuovo paragrafo|a capo)\b/gi, "\n"],
    ],
    questionStarters: [
      "cosa", "che", "perché", "perche", "come", "dove", "quando", "chi",
      "quale", "quali", "quanto", "quanta", "è", "e", "sono", "era",
      "può", "puo", "posso",
    ],
    questionEndings: [],
    breakBefore: ["e", "ma", "perché", "perche", "allora", "anche", "quindi", "però", "pero"],
    breakAfter: ["okay", "ok", "va bene", "sì", "si", "no", "giusto"],
    upperLocale: "it",
    hasCase: true,
    questionMark: "?",
  },

  ar: {
    spoken: [
      // NOT: Arapça'da \b kelime sınırı güvenilmez — beyaz boşluk sınırı kullan.
      [/(^|\s)نقطة(?=\s|$)/g, "$1."],
      [/(^|\s)فاصلة(?=\s|$)/g, "$1,"],
      [/(^|\s)(علامة استفهام|استفهام)(?=\s|$)/g, "$1؟"],
      [/(^|\s)(علامة تعجب|تعجب)(?=\s|$)/g, "$1!"],
      [/(^|\s)(سطر جديد|فقرة جديدة)(?=\s|$)/g, "$1\n"],
    ],
    questionStarters: [
      "ما", "ماذا", "لماذا", "كيف", "أين", "اين", "متى", "من", "أي", "اي",
      "كم", "هل",
    ],
    questionEndings: [],
    breakBefore: ["و", "لكن", "لأن", "ثم", "أيضا", "ايضا"],
    breakAfter: ["حسنا", "نعم", "لا"],
    upperLocale: "ar",
    hasCase: false, // Arapça'da büyük/küçük harf ayrımı yok
    questionMark: "؟",
  },
};

/** Cümle sonu işaretleri (her dilde geçerli kümeler). */
const END_PUNCT = /[.!?؟…:;]$/;

function rulesFor(lang: string): LangRules {
  return RULES[(lang as DictationLang) in RULES ? (lang as DictationLang) : "tr"];
}

/** Bir kelime listesini "Cümle başı büyük" hâline getir. */
function capitalizeFirst(s: string, lang: LangRules): string {
  if (!lang.hasCase) return s;
  const t = s.trimStart();
  if (!t) return t;
  const lead = s.slice(0, s.length - t.length);
  return lead + t.charAt(0).toLocaleUpperCase(lang.upperLocale) + t.slice(1);
}

/** Noktalama sonrası ve satır başlarında cümle başlarını büyütür. */
export function capitalizeSentences(text: string, lang = "tr"): string {
  const r = rulesFor(lang);
  if (!r.hasCase) return text;
  let out = capitalizeFirst(text, r);
  out = out.replace(
    /([.!?؟…]\s+)(\p{Ll})/gu,
    (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase(r.upperLocale),
  );
  out = out.replace(
    /(\n\s*)(\p{Ll})/gu,
    (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase(r.upperLocale),
  );
  return out;
}

/** Söylenen noktalama sözcüklerini gerçek sembollere çevir. */
export function applySpokenPunctuation(text: string, lang = "tr"): string {
  const r = rulesFor(lang);
  let out = text;
  for (const [re, sym] of r.spoken) {
    out = out.replace(re, sym);
  }
  // Sembolden önce boşluk olmasın, sonra olsun (sayılar hariç).
  out = out.replace(/[ \t]+([.,!?؟;:…])/g, "$1");
  out = out.replace(/([.,!?؟;:…])(?=[^\s\d])/g, "$1 ");
  out = out.replace(/[ \t]{2,}/g, " ");
  return out.trim();
}

/**
 * Bir parçanın soru cümlesi olup olmadığını sezgisel olarak tahmin eder.
 * Emin değilse false döner (yanlış noktalama koymaktansa hiç koymamak iyidir).
 */
export function looksLikeQuestion(phrase: string, lang = "tr"): boolean {
  const r = rulesFor(lang);
  const words = phrase
    .toLocaleLowerCase(r.upperLocale)
    .replace(/[.,!?؟;:…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return false;

  const first = words[0];
  const last = words[words.length - 1];

  if (r.questionStarters.includes(first)) return true;
  if (r.questionEndings.includes(last)) return true;
  if (r.questionEndings.length && words.some((w) => r.questionEndings.includes(w)))
    return true;

  // Soru sözcüğü cümlenin ORTASINDA da olabilir: "bugün hava nasıl".
  // Yanlış pozitiften kaçınmak için yalnızca tek anlamlı soru sözcükleri
  // (Türkçe 'nasıl/neden/niçin', İngilizce 'what/why/how', vb.) aranır —
  // 'ne/que/che' gibi hem soru hem bağlaç olabilen kısa sözcükler HARİÇ.
  const UNAMBIGUOUS = new Set([
    "nasıl", "nasil", "neden", "niçin", "nicin",
    "how", "why",
    "wie", "warum", "wieso", "weshalb",
    "cómo", "como", "por qué",
    "comment", "pourquoi",
    "perché", "perche",
    "كيف", "لماذا",
  ]);
  for (const w of words.slice(1)) {
    if (UNAMBIGUOUS.has(w)) return true;
  }
  return false;
}

/**
 * Uzun, noktalamasız akışı makul uzunlukta parçalara böler.
 * Yalnızca gerçekten uzun akışlarda devreye girer; kısa metne dokunmaz.
 */
export function splitRunOnSentence(text: string, lang = "tr", maxWords = 34): string {
  const r = rulesFor(lang);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;

  const out: string[] = [];
  let chunk: string[] = [];
  for (const w of words) {
    const bare = w.toLocaleLowerCase(r.upperLocale).replace(/[.,!?؟;:…]/g, "");
    const prevBare = (chunk[chunk.length - 1] || "")
      .toLocaleLowerCase(r.upperLocale)
      .replace(/[.,!?؟;:…]/g, "");

    const shouldBreak =
      chunk.length >= 8 &&
      (r.breakBefore.includes(bare) || r.breakAfter.includes(prevBare));

    if (shouldBreak && chunk.length) {
      out.push(chunk.join(" "));
      chunk = [];
    }
    chunk.push(w);
  }
  if (chunk.length) out.push(chunk.join(" "));
  return out.join("\n");
}

/**
 * Ham tanıma metnini son işleme tabi tutar.
 *
 * @param raw Tanıma servisinden gelen metin (noktalamasız).
 * @param opts.lang Arayüz dili (tr/en/de/es/fr/it/ar). Varsayılan: tr.
 * @param opts.finalComplete Cümle kesinleşti mi? Ara sonuçlar için false —
 *   o durumda cümle sonu işareti eklenmez, çünkü cümle devam ediyor olabilir.
 */
export function punctuate(
  raw: string,
  opts: { lang?: string; finalComplete?: boolean } = {},
): string {
  if (!raw) return "";
  const lang = opts.lang || "tr";
  const r = rulesFor(lang);

  let out = applySpokenPunctuation(raw, lang);

  // Söylenen noktalama zaten son eklediyse dokunma.
  if (opts.finalComplete && !END_PUNCT.test(out)) {
    const tail = out.split(/[.!?؟…\n]/).pop() || out;
    out += looksLikeQuestion(tail, lang) ? r.questionMark : ".";
  }

  if (opts.finalComplete) {
    out = splitRunOnSentence(out, lang);
  }
  return capitalizeSentences(out, lang);
}

/** Belirli bir metni işlerken hangi dillerin desteklendiğini döndür. */
export function supportedPunctuationLangs(): DictationLang[] {
  return Object.keys(RULES) as DictationLang[];
}
