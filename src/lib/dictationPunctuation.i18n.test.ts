import { describe, it, expect } from "vitest";
import {
  punctuate,
  looksLikeQuestion,
  applySpokenPunctuation,
  supportedPunctuationLangs,
} from "./dictationPunctuation";

/**
 * Kullanıcı sorusu: "sesli yazdırma 7 dilde de çalışıyor mu?"
 * Bu dosya tam olarak onu doğrular.
 */
const UI_LANGS = ["tr", "en", "de", "es", "fr", "it", "ar"] as const;

describe("noktalama motoru tüm arayüz dillerini destekler", () => {
  it("desteklenen diller 7 arayüz dilinin tamamını kapsar", () => {
    const supported = supportedPunctuationLangs();
    for (const l of UI_LANGS) {
      expect(supported, l + " desteklenmiyor").toContain(l);
    }
    expect(supported.length).toBeGreaterThanOrEqual(7);
  });

  it("her dilde cümle sonuna nokta ekler", () => {
    const cases: [string, string, string][] = [
      ["tr", "bugün hava güzel", "Bugün hava güzel."],
      ["en", "the weather is nice today", "The weather is nice today."],
      ["de", "das wetter ist schön heute", "Das wetter ist schön heute."],
      ["es", "hoy hace buen tiempo", "Hoy hace buen tiempo."],
      ["fr", "il fait beau aujourd'hui", "Il fait beau aujourd'hui."],
      ["it", "oggi il tempo è bello", "Oggi il tempo è bello."],
      ["ar", "الطقس جميل اليوم", "الطقس جميل اليوم."],
    ];
    for (const [lang, input, expected] of cases) {
      expect(punctuate(input, { lang, finalComplete: true }), lang).toBe(expected);
    }
  });

  it("her dilde soru işaretini doğru koyar", () => {
    const questions: [string, string][] = [
      ["tr", "bugün hava nasıl"],       // soru sözcüğü
      ["en", "what is the weather"],    // soru sözcüğü
      ["de", "wie ist das wetter"],     // soru sözcüğü
      ["es", "cómo está el tiempo"],    // soru sözcüğü
      ["fr", "comment ça va"],          // soru sözcüğü
      ["it", "come stai oggi"],         // soru sözcüğü
      ["ar", "كيف حالك اليوم"],          // soru sözcüğü
    ];
    for (const [lang, phrase] of questions) {
      expect(looksLikeQuestion(phrase, lang), lang + ": soru tanınmadı").toBe(true);
      const out = punctuate(phrase, { lang, finalComplete: true });
      const expectedMark = lang === "ar" ? "؟" : "?";
      expect(out.endsWith(expectedMark), lang + " -> " + out).toBe(true);
    }
  });

  it("soru olmayan cümleye soru işareti KOYMAZ (yanlış pozitif yok)", () => {
    const statements: [string, string][] = [
      ["en", "the weather is nice"],
      ["de", "das wetter ist schön"],
      ["es", "hoy hace buen tiempo"],
      ["fr", "il fait beau"],
      ["it", "oggi è bello"],
    ];
    for (const [lang, phrase] of statements) {
      expect(looksLikeQuestion(phrase, lang), lang).toBe(false);
      const out = punctuate(phrase, { lang, finalComplete: true });
      expect(out.endsWith("."), lang + " -> " + out).toBe(true);
    }
  });

  it("her dilde söylenen noktalama sözcüğünü sembole çevir", () => {
    expect(applySpokenPunctuation("merhaba nokta", "tr")).toBe("merhaba.");
    expect(applySpokenPunctuation("hello full stop", "en")).toBe("hello.");
    expect(applySpokenPunctuation("hallo punkt", "de")).toBe("hallo.");
    expect(applySpokenPunctuation("hola punto", "es")).toBe("hola.");
    expect(applySpokenPunctuation("bonjour point", "fr")).toBe("bonjour.");
    expect(applySpokenPunctuation("ciao punto", "it")).toBe("ciao.");
    expect(applySpokenPunctuation("مرحبا نقطة", "ar")).toBe("مرحبا.");
  });

  it("virgül de her dilde çalışır", () => {
    expect(applySpokenPunctuation("bir virgül iki", "tr")).toBe("bir, iki");
    expect(applySpokenPunctuation("one comma two", "en")).toBe("one, two");
    expect(applySpokenPunctuation("eins komma zwei", "de")).toBe("eins, zwei");
    expect(applySpokenPunctuation("un virgule deux", "fr")).toBe("un, deux");
  });

  it("Arapça'da büyük harf dönüşümü YAPILMAZ (dilde yok), noktalama yapılır", () => {
    const out = punctuate("الطقس جميل", { lang: "ar", finalComplete: true });
    expect(out).toBe("الطقس جميل.");
    // Harfler değiştirilmemiş olmalı
    expect(out).toContain("الطقس");
  });

  it("Türkçe büyük harf kuralı korunur (i→İ, ı→I)", () => {
    expect(punctuate("istanbul güzel", { lang: "tr", finalComplete: true })).toBe(
      "İstanbul güzel.",
    );
    expect(punctuate("ısparta soğuk", { lang: "tr", finalComplete: true })).toBe(
      "Isparta soğuk.",
    );
  });

  it("ara (interim) sonuçlara hiçbir dilde cümle sonu işareti eklenmez", () => {
    for (const lang of UI_LANGS) {
      const out = punctuate("yarım cümle", { lang });
      expect(out.endsWith("."), lang).toBe(false);
      expect(out.endsWith("?"), lang).toBe(false);
    }
  });

  it("bilinmeyen dil kodu gelirse Türkçe kurallara düşer (çökmez)", () => {
    const out = punctuate("merhaba dünya", { lang: "xx", finalComplete: true });
    expect(out).toBe("Merhaba dünya.");
  });
});
