import { describe, it, expect, beforeEach, vi } from "vitest";
import { getNotebookAgeTier } from "./notebookConfig";

describe("notebookConfig.ts - getNotebookAgeTier (silent aging tiers)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns 0 (yeni) with no activity", () => {
    expect(getNotebookAgeTier()).toBe(0);
  });

  it("returns tier 1 (gelişen) around an 8+ day streak", () => {
    localStorage.setItem("lexi_engagement_v1", JSON.stringify({ streak: 10 }));
    expect(getNotebookAgeTier()).toBe(1);
  });

  it("returns tier 2 (yerleşik) for a long streak / many mastered words", () => {
    localStorage.setItem("lexi_engagement_v1", JSON.stringify({ streak: 40 }));
    expect(getNotebookAgeTier()).toBe(2);
  });

  it("returns tier 3 (eski dost) at high maturity", () => {
    localStorage.setItem("lexi_engagement_v1", JSON.stringify({ streak: 100 }));
    expect(getNotebookAgeTier()).toBe(3);
  });

  it("accounts for mastered words even with a short streak", () => {
    const deck = Array.from({ length: 150 }, (_, i) => ({ id: `w${i}`, learnedAt: 1 }));
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(deck));
    // 150 mastered / 3 = 50 -> tier 2
    expect(getNotebookAgeTier()).toBe(2);
  });

  it("never throws on malformed storage", () => {
    localStorage.setItem("lexi_engagement_v1", "{not json");
    localStorage.setItem("yourbook_deck_v7_clean", "also bad");
    expect(() => getNotebookAgeTier()).not.toThrow();
    expect(getNotebookAgeTier()).toBe(0);
  });
});
