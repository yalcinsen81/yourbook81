import { describe, it, expect } from "vitest";
import { buildQuiz, buildQuestion, evaluateQuiz, availableTypes, fullWord } from "./quiz";
import { WordCard } from "./types";

function mk(id: string, word: string, translation: string, extra: Partial<WordCard> = {}): WordCard {
  return {
    id,
    lang: "de",
    word,
    translation,
    reviewCount: 0,
    createdAt: 0,
    ...extra,
  };
}

const POOL: WordCard[] = [
  mk("c1", "Geduld", "sabır", { article: "die" }),
  mk("c2", "Haus", "ev", { article: "das" }),
  mk("c3", "Baum", "ağaç", { article: "der" }),
  mk("c4", "lüften", "havalandırmak"),
  mk("c5", "Geheimnis", "sır", { article: "das" }),
  mk("c6", "Wasser", "su", { article: "das" }),
];

describe("quiz - fullWord / availableTypes", () => {
  it("fullWord prepends the article when present", () => {
    expect(fullWord(mk("x", "Haus", "ev", { article: "das" }))).toBe("das Haus");
    expect(fullWord(mk("y", "lüften", "havalandırmak"))).toBe("lüften");
  });

  it("availableTypes includes translation types when translation exists", () => {
    const t = availableTypes(mk("x", "Haus", "ev", { article: "das" }));
    expect(t).toContain("wordToTrans");
    expect(t).toContain("transToWord");
    expect(t).toContain("article");
  });

});

describe("quiz - buildQuiz", () => {
  it("is deterministic for the same seed", () => {
    const a = buildQuiz(POOL, { count: 4, seed: 42 });
    const b = buildQuiz(POOL, { count: 4, seed: 42 });
    expect(a.map((q) => q.target.id)).toEqual(b.map((q) => q.target.id));
    expect(a.map((q) => q.type)).toEqual(b.map((q) => q.type));
    expect(a.map((q) => q.options.join("|"))).toEqual(b.map((q) => q.options.join("|")));
  });

  it("respects the requested count (capped by pool size)", () => {
    expect(buildQuiz(POOL, { count: 3, seed: 1 }).length).toBeLessThanOrEqual(3);
    expect(buildQuiz(POOL, { count: 999, seed: 1 }).length).toBeLessThanOrEqual(POOL.length);
  });

  it("every question has the correct answer among its options", () => {
    const qs = buildQuiz(POOL, { count: 10, seed: 7 });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.options).toContain(q.correctAnswer);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      // secenekler tekil olmali
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("restricts to the requested question types", () => {
    const qs = buildQuiz(POOL, { count: 10, seed: 3, types: ["wordToTrans"] });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.type).toBe("wordToTrans");
  });

  it("article questions only offer plausible article distractors", () => {
    const qs = buildQuiz(POOL, { count: 10, seed: 5, types: ["article"] });
    const q = qs[0];
    expect(q).toBeTruthy();
    // tum secenekler pool'daki artikellerden olmali
    const articles = new Set(POOL.map((c) => c.article).filter(Boolean));
    for (const o of q.options) expect(articles.has(o)).toBe(true);
  });

  it("skips cards that cannot form a question (no distractors)", () => {
    // Tek kartlik havuz -> celdirici yok -> soru uretilemez
    const single = [mk("solo", "Haus", "ev", { article: "das" })];
    const qs = buildQuiz(single, { count: 5, seed: 1, types: ["wordToTrans"] });
    expect(qs.length).toBe(0);
  });

  it("can use fallbackPool for distractors", () => {
    const single = [mk("solo", "Haus", "ev")];
    const qs = buildQuiz(single, { count: 1, seed: 1, types: ["wordToTrans"], fallbackPool: POOL });
    expect(qs.length).toBe(1);
    expect(qs[0].options.length).toBeGreaterThanOrEqual(2);
    expect(qs[0].options).toContain("ev");
  });

  it("buildQuestion returns null when no type is usable", () => {
    const noTrans = { ...mk("x", "Haus", ""), translation: "" } as WordCard;
    const q = buildQuestion(noTrans, POOL, () => 0, ["wordToTrans"], {});
    expect(q).toBeNull();
  });


});

describe("quiz - evaluateQuiz", () => {
  const qs = buildQuiz(POOL, { count: 4, seed: 11 });

  const answers = [
    { question: qs[0], picked: qs[0].correctAnswer, isCorrect: true, elapsedMs: 1200 },
    { question: qs[1], picked: "yanlis", isCorrect: false, elapsedMs: 3000 },
    { question: qs[2], picked: null, isCorrect: false, elapsedMs: 5000 },
    { question: qs[3], picked: qs[3].correctAnswer, isCorrect: true, elapsedMs: 900 },
  ];

  it("counts correct / wrong / skipped and percent", () => {
    const r = evaluateQuiz(answers);
    expect(r.total).toBe(4);
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.percent).toBe(50);
    expect(r.totalMs).toBe(10100);
  });

  it("collects wrong cards for SRS feedback", () => {
    const r = evaluateQuiz(answers);
    expect(r.wrongCards.map((c) => c.id).sort()).toEqual([qs[1].target.id, qs[2].target.id].sort());
  });

  it("ranks weakest cards by number of wrong answers", () => {
    const q = qs[0];
    const r = evaluateQuiz([
      { question: q, picked: "x", isCorrect: false, elapsedMs: 1 },
      { question: q, picked: "y", isCorrect: false, elapsedMs: 1 },
      { question: qs[1], picked: "z", isCorrect: false, elapsedMs: 1 },
    ]);
    expect(r.weakest[0].id).toBe(q.target.id); // 2 kez yanlis -> en zayif
    expect(r.weakest.length).toBe(2); // tekrarlar birlestirildi
  });

  it("handles an empty answer list without dividing by zero", () => {
    const r = evaluateQuiz([]);
    expect(r.percent).toBe(0);
    expect(r.total).toBe(0);
    expect(r.wrongCards).toEqual([]);
  });
});
