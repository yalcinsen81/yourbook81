import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SOUND_PROFILES,
  getSavedSoundProfile,
  setSavedSoundProfile,
  getTimeAwareVolumeMultiplier,
  playPenScratch,
  playPenProfileSample,
} from "./sound";

describe("sound.ts - Tactile Sound Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should have all 4 sound profiles configured", () => {
    expect(SOUND_PROFILES).toHaveLength(4);
    const ids = SOUND_PROFILES.map((p) => p.id);
    expect(ids).toContain("fountain");
    expect(ids).toContain("pencil");
    expect(ids).toContain("ballpoint");
    expect(ids).toContain("typewriter");
  });

  it("should default to fountain pen profile when storage is empty", () => {
    expect(getSavedSoundProfile()).toBe("fountain");
  });

  it("should persist and retrieve selected sound profile", () => {
    setSavedSoundProfile("pencil");
    expect(getSavedSoundProfile()).toBe("pencil");

    setSavedSoundProfile("typewriter");
    expect(getSavedSoundProfile()).toBe("typewriter");

    setSavedSoundProfile("ballpoint");
    expect(getSavedSoundProfile()).toBe("ballpoint");
  });

  it("should adjust volume multiplier based on time of day", () => {
    // Mock daytime (14:00)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 24, 14, 0, 0));
    expect(getTimeAwareVolumeMultiplier()).toBe(1.0);

    // Mock nighttime (23:30)
    vi.setSystemTime(new Date(2026, 2, 24, 23, 30, 0));
    expect(getTimeAwareVolumeMultiplier()).toBe(0.40);

    // Mock early morning (03:15)
    vi.setSystemTime(new Date(2026, 2, 24, 3, 15, 0));
    expect(getTimeAwareVolumeMultiplier()).toBe(0.40);
    vi.useRealTimers();
  });

  it("should safely invoke playPenScratch and playPenProfileSample without throwing", () => {
    expect(() => playPenScratch("fountain")).not.toThrow();
    expect(() => playPenScratch("pencil")).not.toThrow();
    expect(() => playPenScratch("ballpoint")).not.toThrow();
    expect(() => playPenScratch("typewriter")).not.toThrow();
    expect(() => playPenProfileSample("pencil")).not.toThrow();
  });
});