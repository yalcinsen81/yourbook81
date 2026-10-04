import { describe, it, expect } from "vitest";
import { buildDeskCounters, deskHeaderCounts, isDue, DAILY_XP_GOAL } from "./counters";
import type { WordCard } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function card(over: Partial<WordCard> = {}): WordCard {
  return { id: "c" + Math.random().toString(36).slice(2, 7), lang: "DE", word: "Wort", translation: "kelime", createdAt: now, learnedAt: null, reviewAt: null, ...over };
}

describe("counters — TEK SAYAC KAYNAGI (madde 4)", () => {
  it("bos deste + bos not: hepsi sifir", () => {
    const c = buildDeskCounters([], [], {});
    expect(c.totalCards).toBe(0);
    expect(c.dueCards).toBe(0);
    expect(c.learnedCards).toBe(0);
    expect(c.archivedCards).toBe(0);
    expect(c.totalNotes).toBe(0);
    expect(c.xp).toBe(0);
    expect(c.goalPercent).toBe(0);
  });

  it("dueCards + archivedCards toplami totalCards'a esit", () => {
    const cards = [
      card(),                                             // yeni -> due
      card({ learnedAt: now, reviewAt: now + 3 * DAY }),  // arsivde
      card({ learnedAt: now - DAY, reviewAt: now - DAY }),// vadesi gecti -> due
    ];
    const c = buildDeskCounters(cards, [], {});
    expect(c.totalCards).toBe(3);
    expect(c.dueCards).toBe(2);
    expect(c.archivedCards).toBe(1);
    expect(c.dueCards + c.archivedCards).toBe(c.totalCards);
  });

  it("'tum notlar' SADECE notlari sayar — kelime kartlari SAYILMAZ", () => {
    const cards = [card(), card(), card()];
    const notes = [{ id: "n1" }, { id: "n2" }];
    const c = buildDeskCounters(cards, notes, {});
    expect(c.totalNotes).toBe(2); // 3 kart + 2 not = 5 DEGIL
    expect(c.totalCards).toBe(3);
  });

  it("XP hedefi: toplam XP ve yuzde AYRI hesaplanir", () => {
    const c = buildDeskCounters([], [], { xp: 1716 });
    expect(c.xp).toBe(1716);                       // "1716 / 2000 XP"
    expect(c.goal).toBe(DAILY_XP_GOAL);
    expect(c.goalPercent).toBe(86);                // "%86"
  });

  it("yuzde 100'u GECMEZ (asiri XP'de kirpilir)", () => {
    const c = buildDeskCounters([], [], { xp: 9999 });
    expect(c.goalPercent).toBe(100);
  });

  it("bugun cevaplanan/ustalasilan engagement'tan gelir", () => {
    const c = buildDeskCounters([], [], { answeredToday: 7, masteredToday: 2, streak: 4 });
    expect(c.answeredToday).toBe(7);
    expect(c.masteredToday).toBe(2);
    expect(c.streak).toBe(4);
  });

  it("bos girdi (undefined/null) cokmez", () => {
    // @ts-expect-error kasitli olarak bozuk girdi
    const c = buildDeskCounters(null, null, {});
    expect(c.totalCards).toBe(0);
    expect(c.totalNotes).toBe(0);
  });
});

describe("isDue — SRS vade kontrolu", () => {
  it("ogrenilmemis kart due", () => {
    expect(isDue(card(), now)).toBe(true);
  });
  it("gelecekteki reviewAt due DEGIL", () => {
    expect(isDue(card({ learnedAt: now, reviewAt: now + DAY }), now)).toBe(false);
  });
  it("learnedAt var ama reviewAt yok -> due (eski kayit korunur)", () => {
    expect(isDue(card({ learnedAt: now, reviewAt: null }), now)).toBe(true);
  });
});

describe("deskHeaderCounts — masa basligi + bos durum (madde 6)", () => {
  it("masada hic kelime yok -> isEmpty true", () => {
    const h = deskHeaderCounts([]);
    expect(h.total).toBe(0);
    expect(h.isEmpty).toBe(true);
    expect(h.allDone).toBe(false);
  });

  it("kelime var, tekrari bekleyen yok -> allDone true", () => {
    const h = deskHeaderCounts([card({ learnedAt: now, reviewAt: now + 5 * DAY })], now);
    expect(h.total).toBe(1);
    expect(h.due).toBe(0);
    expect(h.isEmpty).toBe(false);
    expect(h.allDone).toBe(true);
  });

  it("kelime var ve tekrar bekliyor -> ne isEmpty ne allDone", () => {
    const h = deskHeaderCounts([card()], now);
    expect(h.due).toBe(1);
    expect(h.isEmpty).toBe(false);
    expect(h.allDone).toBe(false);
  });
});