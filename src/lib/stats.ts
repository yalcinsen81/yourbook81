import type { WordCard } from "./types";

/**
 * Ogrenme istatistikleri — SAF turetim fonksiyonlari (test edilebilir).
 *
 * Kaynak veriler:
 *  - WordCard[] (deck): SRS durumu (learnedAt/reviewAt/reviewCount), gramer dolulugu
 *  - EngagementState: xp, streak, answeredToday, masteredToday, bonusXpToday
 *
 * Hicbir ek localStorage semasi EKLENMEZ; var olan veriden turetir.
 */

/** SRS olgunluk kademesi. */
export type Maturity = "new" | "learning" | "reviewing" | "mastered";

export interface MaturityBucket {
  key: Maturity;
  count: number;
  /** Toplam karta orani (0-100). */
  percent: number;
}

export interface MaturityReport {
  total: number;
  buckets: MaturityBucket[];
  /** Ogrenilmemis kart sayisi. */
  newCount: number;
  /** Ogrenilmis (learnedAt dolu) kart sayisi. */
  learnedCount: number;
  /** Ortalama tekrar sayisi. */
  avgReviews: number;
}

export interface DeskStat {
  /** Masa kodu (DE, EN, ES, FR, IT, AR) */
  lang: string;
  total: number;
  mastered: number;
  /** Ogrenilme orani (0-100). */
  masteredPercent: number;
}

export interface QualityReport {
  total: number;
  /** Cevirisi olan kart sayisi. */
  withTranslation: number;
  /** Artikeli olan kart sayisi (dilbilgisi eksiksizligi). */
  withArticle: number;
  /** En az bir gramer satiri olan kart sayisi. */
  withGrammar: number;
  /** En az bir etiketi olan kart sayisi. */
  withTags: number;
  /** 0-100 arasi "kart kalitesi" puani (4 alanin doluluk ortalamasi). */
  qualityScore: number;
}

export interface StreakReport {
  xp: number;
  streak: number;
  answeredToday: number;
  masteredToday: number;
  bonusXpToday: number;
  /** Gunluk hedefe (2000 XP) ulasma orani (0-100). */
  goalPercent: number;
  /** 0-100 arasi seviye ici ilerleme (kaba tahmin: 200 XP = 1 seviye). */
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/**
 * SRS olgunluk kademesi:
 *  - new       : hic ogrenilmemis (learnedAt yok)
 *  - learning  : ogrenilmis, tekrar sayisi < 2
 *  - reviewing : tekrar sayisi 2-4
 *  - mastered  : tekrar sayisi >= 5
 */
export function maturityOf(card: WordCard): Maturity {
  if (!card.learnedAt) return "new";
  const n = card.reviewCount ?? 0;
  if (n >= 5) return "mastered";
  if (n >= 2) return "reviewing";
  return "learning";
}

const MATURITY_ORDER: Maturity[] = ["new", "learning", "reviewing", "mastered"];

/** Kart havuzundan olgunluk dagilimini uretir. */
export function calculateMaturity(cards: WordCard[]): MaturityReport {
  const counts: Record<Maturity, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  let reviewSum = 0;
  let learnedCount = 0;

  for (const c of cards) {
    counts[maturityOf(c)] += 1;
    reviewSum += c.reviewCount ?? 0;
    if (c.learnedAt) learnedCount += 1;
  }

  const total = cards.length;
  const buckets: MaturityBucket[] = MATURITY_ORDER.map((key) => ({
    key,
    count: counts[key],
    percent: total === 0 ? 0 : Math.round((counts[key] / total) * 100),
  }));

  return {
    total,
    buckets,
    newCount: counts.new,
    learnedCount,
    avgReviews: total === 0 ? 0 : Math.round((reviewSum / total) * 10) / 10,
  };
}

/** Masa (dil) bazli dagilim. `cards` tum kartlar olmali. */
export function calculateDeskStats(cards: WordCard[]): DeskStat[] {
  const byLang = new Map<string, { total: number; mastered: number }>();

  for (const c of cards) {
    const lang = (c.lang || "?").toUpperCase();
    if (!byLang.has(lang)) byLang.set(lang, { total: 0, mastered: 0 });
    const e = byLang.get(lang)!;
    e.total += 1;
    if (maturityOf(c) === "mastered") e.mastered += 1;
  }

  return Array.from(byLang.entries())
    .map(([lang, v]) => ({
      lang,
      total: v.total,
      mastered: v.mastered,
      masteredPercent: v.total === 0 ? 0 : Math.round((v.mastered / v.total) * 100),
    }))
    .sort((a, b) => b.total - a.total || a.lang.localeCompare(b.lang));
}

/** Kart kalitesi (alan dolulugu). */
export function calculateQuality(cards: WordCard[]): QualityReport {
  const total = cards.length;
  let withTranslation = 0;
  let withArticle = 0;
  let withGrammar = 0;
  let withTags = 0;

  for (const c of cards) {
    if (c.translation && c.translation.trim()) withTranslation += 1;
    if (c.article && c.article.trim()) withArticle += 1;
    if ((c.grammar ?? []).some((g) => g.value && g.value.trim())) withGrammar += 1;
    if ((c.tags ?? []).length > 0) withTags += 1;
  }

  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const qualityScore =
    total === 0
      ? 0
      : Math.round((pct(withTranslation) + pct(withArticle) + pct(withGrammar) + pct(withTags)) / 4);

  return { total, withTranslation, withArticle, withGrammar, withTags, qualityScore };
}

/** Gunluk hedef (XP). */
export const DAILY_XP_GOAL = 2000;
/** Kaba seviye esigi (XP). */
export const XP_PER_LEVEL = 200;

export interface EngagementSnapshot {
  xp: number;
  streak: number;
  answeredToday: number;
  masteredToday: number;
  bonusXpToday?: number;
}

/** Engagement state'inden streak/seviye raporu. */
export function calculateStreakReport(s: EngagementSnapshot, goal = DAILY_XP_GOAL): StreakReport {
  const xp = s.xp ?? 0;
  const goalPercent = goal === 0 ? 0 : Math.min(100, Math.round((xp / goal) * 100));
  const level = Math.floor(xp / XP_PER_LEVEL);
  const xpIntoLevel = xp - level * XP_PER_LEVEL;
  return {
    xp,
    streak: s.streak ?? 0,
    answeredToday: s.answeredToday ?? 0,
    masteredToday: s.masteredToday ?? 0,
    bonusXpToday: s.bonusXpToday ?? 0,
    goalPercent,
    level,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
  };
}

/** Tum istatistikleri tek cagride uretir (UI icin kolaylik). */
export function calculateAllStats(cards: WordCard[], engagement: EngagementSnapshot) {
  return {
    maturity: calculateMaturity(cards),
    desks: calculateDeskStats(cards),
    quality: calculateQuality(cards),
    streak: calculateStreakReport(engagement),
  };
}
