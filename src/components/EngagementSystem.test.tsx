import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEngagement } from "./EngagementSystem";

describe("useEngagement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("başlangıç değerleri doğru", () => {
    const { result } = renderHook(() => useEngagement());
    expect(result.current.xp).toBe(0);
    expect(result.current.streak).toBe(0);
    expect(result.current.level).toBe(1);
    expect(result.current.levelProgress).toBe(0);
    expect(result.current.goal).toBe(2000);
  });

  it("recordAnswer +10 XP verir", () => {
    const { result } = renderHook(() => useEngagement());
    act(() => result.current.recordAnswer());
    expect(result.current.xp).toBe(10);
    expect(result.current.answeredToday).toBe(1);
  });

  it("recordMastered +50 XP verir", () => {
    const { result } = renderHook(() => useEngagement());
    act(() => result.current.recordMastered());
    expect(result.current.xp).toBe(50);
    expect(result.current.masteredToday).toBe(1);
  });

  it("negatif XP eklenmez", () => {
    const { result } = renderHook(() => useEngagement());
    act(() => result.current.addXp(-100));
    expect(result.current.xp).toBe(0);
  });

  it("her 500 XP bir seviye", () => {
    const { result } = renderHook(() => useEngagement());
    act(() => result.current.addXp(1200));
    expect(result.current.level).toBe(3);
    expect(result.current.levelProgress).toBeCloseTo(200 / 500);
  });

  it("state localStorage'a kaydedilir ve geri yüklenir", () => {
    const { result, unmount } = renderHook(() => useEngagement());
    act(() => result.current.addXp(60));
    unmount();

    const raw = JSON.parse(localStorage.getItem("lexi_engagement_v1")!);
    expect(raw.xp).toBe(60);

    const { result: reloaded } = renderHook(() => useEngagement());
    expect(reloaded.current.xp).toBe(60);
  });

  it("eski tarihli kayıtta answeredToday sıfırlanır, streak boşlukta 1'e düşer", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    localStorage.setItem(
      "lexi_engagement_v1",
      JSON.stringify({
        today: threeDaysAgo.toISOString().slice(0, 10),
        xp: 100,
        streak: 5,
        answeredToday: 3,
        masteredToday: 2,
      })
    );

    const { result } = renderHook(() => useEngagement());
    expect(result.current.xp).toBe(100);
    expect(result.current.streak).toBe(1);
    expect(result.current.answeredToday).toBe(0);
    expect(result.current.masteredToday).toBe(0);
  });

  it("dün aktifse streak devam eder", () => {
    vi.useFakeTimers();
    const now = new Date();

    localStorage.setItem(
      "lexi_engagement_v1",
      JSON.stringify({
        today: new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
        xp: 100,
        streak: 4,
        answeredToday: 0,
        masteredToday: 0,
      })
    );

    const { result } = renderHook(() => useEngagement());
    expect(result.current.streak).toBe(5);
    vi.useRealTimers();
  });
});
