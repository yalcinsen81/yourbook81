import { describe, it, expect } from "vitest";
import {
  punctuate,
  capitalizeSentences,
  applySpokenPunctuation,
  looksLikeQuestion,
  splitRunOnSentence,
} from "./dictationPunctuation";

describe("applySpokenPunctuation", () => {
  it("converts spoken punctuation words into symbols", () => {
    expect(applySpokenPunctuation("merhaba nokta")).toBe("merhaba.");
    expect(applySpokenPunctuation("bir virgül iki")).toBe("bir, iki");
    expect(applySpokenPunctuation("geldin mi soru işareti")).toBe("geldin mi?");
  });

  it("does not eat the word when it is part of a longer word", () => {
    // 'noktalar' içindeki 'nokta' yakalanmamalı
    expect(applySpokenPunctuation("noktalar önemlidir")).toBe("noktalar önemlidir");
  });
});

describe("capitalizeSentences", () => {
  it("capitalises the first letter", () => {
    expect(capitalizeSentences("merhaba dünya")).toBe("Merhaba dünya");
  });

  it("capitalises after sentence-ending punctuation", () => {
    expect(capitalizeSentences("merhaba. bugün hava güzel")).toBe(
      "Merhaba. Bugün hava güzel",
    );
    expect(capitalizeSentences("geldi mi? evet geldi")).toBe(
      "Geldi mi? Evet geldi",
    );
  });

  it("uses Turkish rules (i → İ, ı → I)", () => {
    expect(capitalizeSentences("istanbul güzel")).toBe("İstanbul güzel");
    expect(capitalizeSentences("ısparta soğuk")).toBe("Isparta soğuk");
  });

  it("capitalises after a newline", () => {
    expect(capitalizeSentences("bir satır\nikinci satır")).toBe(
      "Bir satır\nİkinci satır",
    );
  });
});

describe("looksLikeQuestion", () => {
  it("detects question-word starts", () => {
    expect(looksLikeQuestion("neden gelmedin")).toBe(true);
    expect(looksLikeQuestion("nasıl gidiyor")).toBe(true);
    expect(looksLikeQuestion("nereye gidiyorsun")).toBe(true);
  });

  it("detects the mi/mı particle at the end", () => {
    expect(looksLikeQuestion("geldin mi")).toBe(true);
    expect(looksLikeQuestion("hazır mısın")).toBe(true);
  });

  it("does not fire on plain statements", () => {
    expect(looksLikeQuestion("bugün hava güzel")).toBe(false);
    expect(looksLikeQuestion("yarın erken kalkacağım")).toBe(false);
  });
});

describe("splitRunOnSentence", () => {
  it("leaves short text untouched", () => {
    const s = "bugün hava çok güzel";
    expect(splitRunOnSentence(s)).toBe(s);
  });

  it("breaks a long run-on at a conjunction", () => {
    const words = Array.from({ length: 40 }, (_, i) => "kelime" + i);
    words[20] = "ve";
    const out = splitRunOnSentence(words.join(" "));
    expect(out).toContain("\n");
    expect(out.split("\n").length).toBeGreaterThan(1);
  });
});

describe("punctuate — the behaviour the user asked for", () => {
  it("adds a full stop to a finished statement", () => {
    expect(punctuate("bugün hava güzel", { finalComplete: true })).toBe(
      "Bugün hava güzel.",
    );
  });

  it("adds a question mark when the phrase is a question", () => {
    expect(punctuate("neden gelmedin", { finalComplete: true })).toBe(
      "Neden gelmedin?",
    );
    expect(punctuate("geldin mi", { finalComplete: true })).toBe("Geldin mi?");
  });

  it("does NOT add end punctuation to a still-open interim phrase", () => {
    // Cümle daha bitmemiş olabilir; nokta koymak yanlış olur.
    expect(punctuate("bugün hava")).toBe("Bugün hava");
  });

  it("keeps punctuation the user already spoke", () => {
    expect(punctuate("merhaba nokta", { finalComplete: true })).toBe(
      "Merhaba.",
    );
    expect(punctuate("geldin mi soru işareti", { finalComplete: true })).toBe(
      "Geldin mi?",
    );
  });

  it("handles several sentences in one phrase", () => {
    expect(
      punctuate("merhaba nokta bugün hava güzel nokta", { finalComplete: true }),
    ).toBe("Merhaba. Bugün hava güzel.");
  });

  it("is idempotent — punctuating twice changes nothing", () => {
    const once = punctuate("bugün hava güzel", { finalComplete: true });
    const twice = punctuate(once, { finalComplete: true });
    expect(twice).toBe(once);
  });

  it("returns an empty string for empty input", () => {
    expect(punctuate("")).toBe("");
  });
});
