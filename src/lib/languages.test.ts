import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  getLanguageByCode,
  getLanguageByTag,
  spaceIdForLanguage,
  languageCodeFromSpaceId,
  SUPPORTED_LANGUAGE_CODES,
} from "./languages";

describe("languages.ts - target-language registry", () => {
  it("includes stage-1 (de, en) and stage-2 (es) languages", () => {
    expect(SUPPORTED_LANGUAGE_CODES).toContain("de");
    expect(SUPPORTED_LANGUAGE_CODES).toContain("en");
    expect(SUPPORTED_LANGUAGE_CODES).toContain("es");
  });

  it("every language declares a complete LanguageDef", () => {
    for (const l of LANGUAGES) {
      expect(l.code).toMatch(/^[a-z]{2,3}$/);
      expect(l.langTag.length).toBeGreaterThanOrEqual(2);
      expect(l.deskName).toContain("Masası");
      expect(Array.isArray(l.fields)).toBe(true);
    }
  });

  it("resolves by code and by tag", () => {
    expect(getLanguageByCode("es")?.name).toBe("İspanyolca");
    expect(getLanguageByTag("ES")?.code).toBe("es");
    expect(getLanguageByCode("zz")).toBeNull();
    expect(getLanguageByTag("ZZ")).toBeNull();
  });

  it("maps language code <-> space id consistently", () => {
    expect(spaceIdForLanguage("es")).toBe("space-es");
    expect(languageCodeFromSpaceId("space-es")).toBe("es");
    expect(languageCodeFromSpaceId("space-de")).toBe("de");
    expect(languageCodeFromSpaceId("space-work")).toBeNull();
    expect(languageCodeFromSpaceId("space-personal")).toBeNull();
  });

  it("keeps German-specific fields on the German def, not on others", () => {
    const de = getLanguageByCode("de")!;
    const es = getLanguageByCode("es")!;
    expect(de.fields.some((f) => f.key === "artikel")).toBe(true);
    expect(es.fields.some((f) => f.key === "artikel")).toBe(false);
    expect(es.fields.some((f) => f.key === "gender")).toBe(true);
  });
});
