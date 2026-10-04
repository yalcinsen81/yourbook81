import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeck, SRS_INTERVALS_DAYS } from "./deck";

const DAY_MS = 24 * 60 * 60 * 1000;

function intervalDays(card: { learnedAt?: number | null; reviewAt?: number | null }) {
  return Math.round(((card.reviewAt ?? 0) - (card.learnedAt ?? 0)) / DAY_MS);
}

describe("useDeck SRS", () => {
  // Deste artik ornek kelime icermiyor; SRS testleri kendi kartini kurar.
  function seedOneCard() {
    const now = Date.now();
    const card = {
      id: "test-card-1",
      // NOT: fixture "testwort" KULLANMAZ. Uygulama deposundaki test kartini
      // ayiklayan filtre (madde 9) bu imzayi eler ve SRS testlerini kirardi.
      word: "Geduld",
      translation: "sabir",
      lang: "DE",
      tags: [],
      createdAt: now,
      learnedAt: null,
      reviewAt: now - 1000,
      reviewCount: 0,
    };
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([card]));
  }

  beforeEach(() => {
    localStorage.removeItem("yourbook_deck_v7_clean");
    seedOneCard();
  });

  it("markAsLearned ilk aralığı (1 gün) atar ve reviewCount'ı artırır", () => {
    const { result } = renderHook(() => useDeck());
    const card = result.current.dueCards[0];
    act(() => result.current.markAsLearned(card.id));

    const learned = result.current.cards.find((c) => c.id === card.id)!;
    expect(learned.reviewCount).toBe(1);
    expect(intervalDays(learned)).toBe(SRS_INTERVALS_DAYS[0]);
  });

  it("ardışık tekrarlar kartı kuyruktan çıkarır ve reviewCount büyütür", () => {
    const { result } = renderHook(() => useDeck());
    const card = result.current.dueCards[0];

    for (let i = 0; i < SRS_INTERVALS_DAYS.length; i++) {
      act(() => result.current.markAsLearned(card.id));
      // reviewAt gelecekte olduğundan due listesinden düşmeli
      expect(result.current.dueCards.find((x) => x.id === card.id)).toBeUndefined();
      // tekrar test için reviewAt'i hemen geçmişe alıp kuyruğa geri koy
      act(() => {
        const updated = result.current.cards.map((c) =>
          c.id === card.id ? { ...c, reviewAt: Date.now() - 1000 } : c
        );
        localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(updated));
      });
      result.current.cards.length; // re-render tetikle
    }

    const c = result.current.cards.find((x) => x.id === card.id)!;
    expect(c.reviewCount).toBe(SRS_INTERVALS_DAYS.length);
  });

  // MADDE 5: "Hatırlayamadım" -> aralık sıfırlanır, SAYAÇ DÜŞMEZ (kart kuyrukta KALIR).
  it("reviewAgain aralığı ve kademeyi sıfırlar, kart kuyrukta KALIR", () => {
    const { result } = renderHook(() => useDeck());
    const card = result.current.dueCards[0];
    act(() => {
      result.current.markAsLearned(card.id);
      result.current.markAsLearned(card.id);
    });
    // İki başarılı tekrardan sonra kart kuyruktan çıkmış olmalı.
    expect(result.current.dueCards.find((c) => c.id === card.id)).toBeUndefined();

    act(() => result.current.reviewAgain(card.id));
    const c = result.current.cards.find((x) => x.id === card.id)!;
    expect(c.reviewCount).toBe(0);
    expect(c.intervalIndex).toBe(0);
    // Aralık 1 güne döner ve learnedAt temizlenir.
    expect(c.learnedAt ?? null).toBeNull();
    expect(Math.round(((c.reviewAt ?? 0) - Date.now()) / DAY_MS)).toBe(SRS_INTERVALS_DAYS[0]);
    // ⭐ SAYAÇ DÜŞMEZ: kart hâlâ tekrar kuyruğunda görünür.
    expect(result.current.dueCards.some((x) => x.id === card.id)).toBe(true);
  });

  // MADDE 5: "Hatırlayamadım" kartı kuyruğun SONUNA taşımalı (aynı oturumda tekrar gelir).
  it("requeueCard kartı kuyruğun sonuna taşır", () => {
    const { result } = renderHook(() => useDeck());
    const first = result.current.cards[0];
    act(() => result.current.requeueCard(first.id));
    const cards = result.current.cards;
    expect(cards[cards.length - 1].id).toBe(first.id);
  });

  it("reviewAt geçince kart due listesine geri döner", () => {
    const { result } = renderHook(() => useDeck());
    const card = result.current.dueCards[0];
    act(() => result.current.markAsLearned(card.id));
    expect(result.current.dueCards.find((c) => c.id === card.id)).toBeUndefined();

    act(() => {
      localStorage.setItem(
        "yourbook_deck_v7_clean",
        JSON.stringify(
          result.current.cards.map((c) =>
            c.id === card.id ? { ...c, reviewAt: Date.now() - 1000 } : c
          )
        )
      );
    });

    const { result: reloaded } = renderHook(() => useDeck());
    expect(reloaded.current.dueCards.find((c) => c.id === card.id)).toBeDefined();
  });

  // MADDE 9: Kullanicinin deposunda kalan "testwort" test karti yuklenirken ayiklanir.
  it("testwort test kartı yüklenirken elenir, gerçek kartlar korunur", () => {
    localStorage.setItem(
      "yourbook_deck_v7_clean",
      JSON.stringify([
        {
          id: "kullanici-test-karti",
          lang: "DE",
          word: "testwort",
          translation: "test kelimesi",
          createdAt: Date.now(),
          learnedAt: null,
          reviewAt: null,
        },
        {
          id: "gercek-kart",
          lang: "DE",
          article: "die",
          word: "Geduld",
          translation: "sabır",
          createdAt: Date.now(),
          learnedAt: null,
          reviewAt: null,
        },
      ])
    );

    const { result } = renderHook(() => useDeck());
    const words = result.current.cards.map((c) => c.word);

    expect(words).not.toContain("testwort");
    expect(words).toContain("Geduld");
  });
});
