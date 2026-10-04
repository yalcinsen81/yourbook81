import { describe, it, expect } from "vitest";
import {
  maturityOf,
  calculateMaturity,
  calculateDeskStats,
  calculateQuality,
  calculateStreakReport,
  calculateAllStats,
  DAILY_XP_GOAL,
  XP_PER_LEVEL,
} from "./stats";
import type { WordCard } from "./types";

function mk(id: string, over: Partial<WordCard> = {}): WordCard {
  return {
    id,
    lang: "DE",
    word: "Wort" + id,
    translation: "kelime" + id,
    createdAt: 0,
    reviewCount: 0,
    ...over,
  };
}

describe("stats - maturityOf", () => {
  it("classifies unlearned cards as 'new'", () => {
    expect(maturityOf(mk("a"))).toBe("new");
    expect(maturityOf(mk("b", { learnedAt: null }))).toBe("new");
  });

  it("classifies learned cards by review count", () => {
    expect(maturityOf(mk("a", { learnedAt: 1, reviewCount: 0 }))).toBe("learning");
    expect(maturityOf(mk("b", { learnedAt: 1, reviewCount: 1 }))).toBe("learning");
    expect(maturityOf(mk("c", { learnedAt: 1, reviewCount: 2 }))).toBe("reviewing");
    expect(maturityOf(mk("d", { learnedAt: 1, reviewCount: 4 }))).toBe("reviewing");
    expect(maturityOf(mk("e", { learnedAt: 1, reviewCount: 5 }))).toBe("mastered");
    expect(maturityOf(mk("f", { learnedAt: 1, reviewCount: 12 }))).toBe("mastered");
  });

  it("treats a learned card with no reviewCount as 'learning' (v63 SRS fix)", () => {
    expect(maturityOf(mk("x", { learnedAt: 1000, reviewCount: undefined }))).toBe("learning");
  });
});

describe("stats - calculateMaturity", () => {
  const cards = [
    mk("n1"),
    mk("n2"),
    mk("l1", { learnedAt: 1, reviewCount: 1 }),
    mk("r1", { learnedAt: 1, reviewCount: 3 }),
    mk("m1", { learnedAt: 1, reviewCount: 6 }),
    mk("m2", { learnedAt: 1, reviewCount: 9 }),
  ];

  it("counts each maturity bucket", () => {
    const r = calculateMaturity(cards);
    const byKey = Object.fromEntries(r.buckets.map((b) => [b.key, b.count]));
    expect(byKey.new).toBe(2);
    expect(byKey.learning).toBe(1);
    expect(byKey.reviewing).toBe(1);
    expect(byKey.mastered).toBe(2);
    expect(r.total).toBe(6);
  });

  it("buckets always cover all four maturities and sum to total", () => {
    const r = calculateMaturity(cards);
    expect(r.buckets.map((b) => b.key)).toEqual(["new", "learning", "reviewing", "mastered"]);
    expect(r.buckets.reduce((s, b) => s + b.count, 0)).toBe(r.total);
  });

  it("computes percentages that sum to ~100", () => {
    const r = calculateMaturity(cards);
    const sum = r.buckets.reduce((s, b) => s + b.percent, 0);
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
  });

  it("reports learnedCount and avgReviews", () => {
    const r = calculateMaturity(cards);
    expect(r.learnedCount).toBe(4);
    // (0+0+1+3+6+9) / 6 = 3.17 -> 3.2
    expect(r.avgReviews).toBe(3.2);
  });

  it("handles an empty deck without NaN", () => {
    const r = calculateMaturity([]);
    expect(r.total).toBe(0);
    expect(r.avgReviews).toBe(0);
    expect(r.buckets.every((b) => b.percent === 0)).toBe(true);
  });
});

describe("stats - calculateDeskStats", () => {
  const cards = [
    mk("a", { lang: "DE" }),
    mk("b", { lang: "DE", learnedAt: 1, reviewCount: 6 }),
    mk("c", { lang: "EN" }),
    mk("d", { lang: "EN" }),
    mk("e", { lang: "EN", learnedAt: 1, reviewCount: 7 }),
    mk("f", { lang: "AR", learnedAt: 1, reviewCount: 5 }),
  ];

  it("groups cards by desk language", () => {
    const r = calculateDeskStats(cards);
    const byLang = Object.fromEntries(r.map((d) => [d.lang, d]));
    expect(byLang.DE.total).toBe(2);
    expect(byLang.EN.total).toBe(3);
    expect(byLang.AR.total).toBe(1);
  });

  it("counts mastered cards per desk", () => {
    const r = calculateDeskStats(cards);
    const byLang = Object.fromEntries(r.map((d) => [d.lang, d]));
    expect(byLang.DE.mastered).toBe(1);
    expect(byLang.DE.masteredPercent).toBe(50);
    expect(byLang.EN.mastered).toBe(1);
    expect(byLang.EN.masteredPercent).toBe(33);
    expect(byLang.AR.masteredPercent).toBe(100);
  });

  it("sorts desks by total desc, then lang asc", () => {
    const r = calculateDeskStats(cards);
    expect(r.map((d) => d.lang)).toEqual(["EN", "DE", "AR"]);
  });

  it("normalizes lowercase lang and handles missing lang", () => {
    const r = calculateDeskStats([mk("a", { lang: "de" }), mk("b", { lang: "" as string })]);
    const langs = r.map((d) => d.lang);
    expect(langs).toContain("DE");
    expect(langs).toContain("?");
  });

  it("returns an empty array for an empty deck", () => {
    expect(calculateDeskStats([])).toEqual([]);
  });
});

describe("stats - calculateQuality", () => {
  it("counts filled fields", () => {
    const cards = [
      mk("a", { translation: "ev", article: "das", grammar: [{ label: "Präsens", value: "x" }], tags: ["#DE"] }),
      mk("b", { translation: "su" }),
      mk("c", { translation: "  " }), // bosluk -> sayilmaz
    ];
    const r = calculateQuality(cards);
    expect(r.total).toBe(3);
    expect(r.withTranslation).toBe(2);
    expect(r.withArticle).toBe(1);
    expect(r.withGrammar).toBe(1);
    expect(r.withTags).toBe(1);
  });

  it("computes a 0-100 quality score", () => {
    const perfect = [mk("a", { article: "das", grammar: [{ label: "L", value: "v" }], tags: ["#DE"] })];
    expect(calculateQuality(perfect).qualityScore).toBe(100);

    const empty = [mk("a", { translation: "" })];
    expect(calculateQuality(empty).qualityScore).toBe(0);
  });

  it("handles an empty deck", () => {
    const r = calculateQuality([]);
    expect(r.total).toBe(0);
    expect(r.qualityScore).toBe(0);
  });
});

describe("stats - calculateStreakReport", () => {
  it("computes goal percent capped at 100", () => {
    expect(calculateStreakReport({ xp: 0, streak: 0, answeredToday: 0, masteredToday: 0 }).goalPercent).toBe(0);
    expect(calculateStreakReport({ xp: 500, streak: 3, answeredToday: 1, masteredToday: 0 }).goalPercent).toBe(25);
    expect(calculateStreakReport({ xp: 5000, streak: 9, answeredToday: 5, masteredToday: 1 }).goalPercent).toBe(100);
  });

  it("derives level and level progress from xp", () => {
    const r = calculateStreakReport({ xp: 450, streak: 2, answeredToday: 0, masteredToday: 0 });
    expect(r.level).toBe(Math.floor(450 / XP_PER_LEVEL)); // 2
    expect(r.xpIntoLevel).toBe(450 - 2 * XP_PER_LEVEL); // 50
    expect(r.xpForNextLevel).toBe(XP_PER_LEVEL);
  });

  it("passes through streak and today counters", () => {
    const r = calculateStreakReport({ xp: 100, streak: 7, answeredToday: 4, masteredToday: 2, bonusXpToday: 30 });
    expect(r.streak).toBe(7);
    expect(r.answeredToday).toBe(4);
    expect(r.masteredToday).toBe(2);
    expect(r.bonusXpToday).toBe(30);
  });

  it("uses DAILY_XP_GOAL as the default goal", () => {
    const r = calculateStreakReport({ xp: DAILY_XP_GOAL, streak: 1, answeredToday: 0, masteredToday: 0 });
    expect(r.goalPercent).toBe(100);
  });
});

describe("stats - calculateAllStats", () => {
  it("returns all four reports at once", () => {
    const cards = [mk("a", { lang: "DE" }), mk("b", { lang: "EN", learnedAt: 1, reviewCount: 6 })];
    const all = calculateAllStats(cards, { xp: 300, streak: 2, answeredToday: 1, masteredToday: 0 });
    expect(all.maturity.total).toBe(2);
    expect(all.desks.length).toBe(2);
    expect(all.quality.total).toBe(2);
    expect(all.streak.xp).toBe(300);
  });
});
