import type { WordCard } from "./types";

/**
 * Sinav/Quiz modu — soru uretimi (SAF fonksiyonlar, test edilebilir).
 *
 * WordHuntGame'den farklari:
 *  - Daha genis soru tipleri (ceviri + artikel + cekim/gramer alani)
 *  - Yapilandirilmis RAPOR (dogru/yanlis listesi, yuzde, en zayif kartlar)
 *  - SRS geri besleme: yanlis cevaplanan kartlar tekrar havuzuna duser
 *  - Distractor secimi DETERMINISTIK tohumlanabilir (test icin)
 */

export type QuizQuestionType = "wordToTrans" | "transToWord" | "article";

export interface QuizQuestion {
  /** Sorulan kart */
  target: WordCard;
  /** Sorulan kartin gorunen adi (UI'da soru baglami icin) */
  targetWord?: string;
  type: QuizQuestionType;
  /** Buyuk puntoyla gosterilen soru (kelime veya anlam) */
  prompt: string;
  /** Sorun alt etiketi icin i18n anahtari */
  promptSubKey: string;
  /** Dogru cevap metni */
  correctAnswer: string;
  /** Karistirilmis secenekler (dogru cevap dahil) */
  options: string[];
}

export interface QuizAnswerRecord {
  question: QuizQuestion;
  /** Kullanicinin sectigi secenek (null = bos birakti) */
  picked: string | null;
  isCorrect: boolean;
  /** Cevap suresi (ms) */
  elapsedMs: number;
}

export interface QuizReport {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** 0-100 arasi basari yuzdesi */
  percent: number;
  answers: QuizAnswerRecord[];
  /** Yanlis cevaplanan kartlar (SRS'e geri beslenecek) */
  wrongCards: WordCard[];
  /** En cok zorlanilan kartlar (yanlis sayisina gore) */
  weakest: WordCard[];
  totalMs: number;
}

export interface BuildQuizOptions {
  /** Kac soru uretilecek (havuzdan fazlaysa havuz kadar) */
  count?: number;
  /** Kullanilabilecek soru tipleri (varsayilan: hepsi uygun olanlar) */
  types?: QuizQuestionType[];
  /** Distractor icin ek havuz (masa disi kelimeler) */
  fallbackPool?: WordCard[];
  /** Deterministik karistirma icin tohum (test) */
  seed?: number;
  /** Icerik / tanim metinleri (i18n'den gecirilir) */
  subKeys?: {
    wordToTrans?: string;
    transToWord?: string;
    article?: string;
    grammar?: string;
  };
}

/** Mulberry32 — kucuk, deterministik PRNG (test edilebilirlik icin). */
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates — rng kullanarak karistirma (girdiyi degistirmez). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Kartin tam yazimi (artikel varsa one eklenir). */
export function fullWord(card: WordCard): string {
  return card.article ? `${card.article} ${card.word}` : card.word;
}

/** Kart icin kullanilabilir soru tiplerini belirler. */
export function availableTypes(card: WordCard): QuizQuestionType[] {
  const types: QuizQuestionType[] = [];
  if (card.translation && card.translation.trim()) types.push("wordToTrans", "transToWord");
  if (card.article && card.article.trim()) types.push("article");
  // v-fix: grammar tipi kaldirildi (soru metni hangi alani sordugunu
  // belirtmiyordu + distractor'lar farkli turlerden geliyordu).
  return types;
}

/** Bir kart icin soru uretir; uygun tip yoksa null doner. */
export function buildQuestion(
  target: WordCard,
  others: WordCard[],
  rng: () => number,
  types: QuizQuestionType[],
  subKeys: NonNullable<BuildQuizOptions["subKeys"]>,
): QuizQuestion | null {
  const usable = types.filter((tp) => availableTypes(target).indexOf(tp) >= 0);
  if (!usable.length) return null;

  const type = usable[Math.floor(rng() * usable.length)];

  if (type === "article") {
    const correct = (target.article || "").trim();
    const pool = Array.from(
      new Set(
        others
          .map((c) => (c.article || "").trim())
          .filter((a) => !!a && a !== correct),
      ),
    );
    const options = shuffle([correct].concat(pool.slice(0, 3)), rng);
    if (options.length < 2) return null;
    return {
      target,
      type,
      prompt: fullWord(target),
      promptSubKey: subKeys.article || "quiz.ask_article",
      targetWord: fullWord(target),
      correctAnswer: correct,
      options,
    };
  }

  // v-fix: grammar soru tipi KALDIRILDI. Net ve dogru calisan tipler:
  //   wordToTrans / transToWord / article

  const wordToTrans = type === "wordToTrans";
  const prompt = wordToTrans ? fullWord(target) : target.translation;
  const correctAnswer = wordToTrans ? target.translation : fullWord(target);

  const distractorPool = others.filter((c) => c.id !== target.id);
  const answers: string[] = [];
  for (const c of shuffle(distractorPool, rng)) {
    if (answers.length >= 3) break;
    const a = wordToTrans ? c.translation : fullWord(c);
    if (a && a !== correctAnswer && answers.indexOf(a) < 0) answers.push(a);
  }
  if (!answers.length) return null;

  return {
    target,
    type,
    prompt,
    promptSubKey: wordToTrans
      ? (subKeys.wordToTrans || "quiz.ask_meaning")
      : (subKeys.transToWord || "quiz.ask_word"),
    targetWord: fullWord(target),
    correctAnswer,
    options: shuffle([correctAnswer].concat(answers), rng),
  };
}

/**
 * Havuzdan bir sinav uretir.
 * Soru kurulamayan kartlar (celdirici yok / tip uygun degil) atlanir.
 */
export function buildQuiz(pool: WordCard[], opts: BuildQuizOptions = {}): QuizQuestion[] {
  const rng = makeRng(opts.seed);
  const count = opts.count ?? 10;
  const types = opts.types ?? (["wordToTrans", "transToWord", "article"] as QuizQuestionType[]);
  const subKeys = opts.subKeys ?? {};

  const seen = new Map<string, WordCard>();
  pool.forEach((c) => seen.set(c.id, c));
  (opts.fallbackPool ?? []).forEach((c) => seen.set(c.id, c));
  const combined = Array.from(seen.values());

  const targets = shuffle(pool, rng).slice(0, Math.min(count, pool.length));

  const questions: QuizQuestion[] = [];
  for (const target of targets) {
    const q = buildQuestion(target, combined, rng, types, subKeys);
    if (q) questions.push(q);
  }
  return questions;
}

/** Cevaplari degerlendirip yapilandirilmis rapor uretir. */
export function evaluateQuiz(answers: QuizAnswerRecord[]): QuizReport {
  const correct = answers.filter((a) => a.isCorrect).length;
  const skipped = answers.filter((a) => a.picked === null).length;
  const total = answers.length;
  const wrong = total - correct;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const totalMs = answers.reduce((s, a) => s + a.elapsedMs, 0);

  const wrongCards = answers.filter((a) => !a.isCorrect).map((a) => a.question.target);

  const counts = new Map<string, { card: WordCard; n: number }>();
  wrongCards.forEach((c) => {
    const cur = counts.get(c.id);
    if (cur) cur.n += 1;
    else counts.set(c.id, { card: c, n: 1 });
  });
  const weakest = Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .map((x) => x.card);

  return { total, correct, wrong, skipped, percent, answers, wrongCards, weakest, totalMs };
}
