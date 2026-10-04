import type { WordCard } from "./types";

/**
 * ⭐ TEK SAYAC KAYNAĞI (Single Source of Truth) — madde 4.
 *
 * SORUN: Sayaclar ekranlar arasinda tutarsizdi:
 *   - Kapak "4 kelime hazir" / "10 kelime masada bekliyor"  (SABIT metinlerdi!)
 *   - Arsivde 11 kart
 *   - Kapak "86 / 2000 XP" (aslinda yuzde) / Istatistik "1716 XP"
 *   - Kapak "3 gunluk sonumlu tekrar" / masa "1 gunluk"
 *   - Menu "tum notlar [11]" (kelime+not toplami) / arsiv "notlar (0)"
 *   - Istatistik "bugun cevaplanan" / "bugun ustalasilan" yanlis sayiyordu
 *
 * COZUM: Tum sayaclar BU dosyadaki saf fonksiyondan turetilir. Kapak, masa
 * basligi, istatistik paneli ve menu ayni nesneyi kullanir; hicbir ekranda
 * elle hesaplanmis/sabit sayi kalmaz.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Gunluk XP hedefi (tek kaynak). */
export const DAILY_XP_GOAL = 2000;

export interface NoteLike {
  id: string;
  content?: string;
  title?: string;
}

export interface EngagementLike {
  xp?: number;
  streak?: number;
  answeredToday?: number;
  masteredToday?: number;
  todayXp?: number;
}

export interface DeskCounters {
  /** TOPLAM kart (masa disi dahil). */
  totalCards: number;
  /** Tekrari BEKLEYEN kart (due). */
  dueCards: number;
  /** Ogrenilmis kart (learnedAt dolu). */
  learnedCards: number;
  /** Arsivdeki (vadesi gelmemis) kart. */
  archivedCards: number;
  /** Toplam NOT sayisi (kelime kartlari SAYILMAZ). */
  totalNotes: number;
  /** Toplam XP. */
  xp: number;
  /** Gunluk hedef (XP). */
  goal: number;
  /** Gunluk hedef yuzdesi (0-100). */
  goalPercent: number;
  /** Gunluk XP (bugun kazanilan). */
  todayXp: number;
  /** Bugun cevaplanan soru/kart sayisi. */
  answeredToday: number;
  /** Bugun ustalasilan kart sayisi. */
  masteredToday: number;
  /** En yakin tekrar kac gun sonra (gun). Kart yoksa null. */
  nextReviewInDays: number | null;
  streak: number;
}

/** Kartin vadesi gelmis mi (tekrar kuyrugunda mi)? */
export function isDue(card: WordCard, now = Date.now()): boolean {
  if (!card.learnedAt) return true;
  if (!card.reviewAt) return true;
  return card.reviewAt <= now;
}

/**
 * TUM sayaclari tek noktadan uretir (SAF — test edilebilir).
 * `cards`: masa disi dahil tum kartlar.
 * `notes`: tum notlar (kelime kartlari degil).
 * `engagement`: XP/streak durumu.
 */
export function buildDeskCounters(
  cards: WordCard[],
  notes: NoteLike[] = [],
  engagement: EngagementLike = {},
  now = Date.now(),
): DeskCounters {
  const safeCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const safeNotes = Array.isArray(notes) ? notes.filter(Boolean) : [];

  let due = 0;
  let learned = 0;
  let archived = 0;
  let soonestReview = Number.POSITIVE_INFINITY;

  for (const c of safeCards) {
    if (c.learnedAt) learned += 1;
    if (isDue(c, now)) due += 1;
    else archived += 1;
    if (c.reviewAt && c.reviewAt > now) {
      soonestReview = Math.min(soonestReview, c.reviewAt);
    }
  }

  const xp = engagement.xp ?? 0;
  const goal = DAILY_XP_GOAL;
  const goalPercent = Math.min(100, Math.round((xp / goal) * 100));

  const nextReviewInDays =
    Number.isFinite(soonestReview) && soonestReview > now
      ? Math.max(1, Math.ceil((soonestReview - now) / DAY_MS))
      : null;

  return {
    totalCards: safeCards.length,
    dueCards: due,
    learnedCards: learned,
    archivedCards: archived,
    totalNotes: safeNotes.length,
    xp,
    goal,
    goalPercent,
    todayXp: engagement.todayXp ?? 0,
    answeredToday: engagement.answeredToday ?? 0,
    masteredToday: engagement.masteredToday ?? 0,
    nextReviewInDays,
    streak: engagement.streak ?? 0,
  };
}

/**
 * Masa basligi sayaci: "N kelime · M tekrarı bekleyen".
 * `deskCards`: yalniz o masanin kartlari. `dueCount`: o masada tekrari bekleyen.
 */
export function deskHeaderCounts(deskCards: WordCard[], now = Date.now()) {
  const list = Array.isArray(deskCards) ? deskCards : [];
  return {
    total: list.length,
    due: list.filter((c) => isDue(c, now)).length,
    /** Masada hic kelime yok mu? (madde 6) */
    isEmpty: list.length === 0,
    /** Kelime var ama tekrari bekleyen yok mu? (madde 6) */
    allDone: list.length > 0 && list.every((c) => !isDue(c, now)),
  };
}