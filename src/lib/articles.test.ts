import { describe, it, expect } from "vitest";
import { speechLocaleOf } from "./articles";

describe("speech locale mapping (v101 pronunciation)", () => {
  it("maps every desk language to a speech locale", () => {
    const cases: Array<[string, string]> = [
      ["DE", "de-DE"],
      ["EN", "en-US"],
      ["ES", "es-ES"],
      ["FR", "fr-FR"],
      ["IT", "it-IT"],
      ["AR", "ar-SA"],
    ];
    for (const [lang, expected] of cases) {
      expect(speechLocaleOf(lang)).toBe(expected);
    }
  });

  it("falls back to en-US for an unknown language", () => {
    expect(speechLocaleOf("XX")).toBe("en-US");
    expect(speechLocaleOf("")).toBe("en-US");
  });

  it("returns a BCP-47 style locale (lang-COUNTRY) for all known desks", () => {
    for (const lang of ["DE", "EN", "ES", "FR", "IT", "AR"]) {
      expect(speechLocaleOf(lang)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it("marks Arabic as an RTL speech locale", () => {
    const ar = speechLocaleOf("AR");
    expect(ar.startsWith("ar")).toBe(true);
  });
});
