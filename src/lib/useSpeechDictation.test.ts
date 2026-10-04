import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechDictation } from "./useSpeechDictation";
import { translate } from "../i18n";

/** Basit sahte tanıma nesnesi — Web Speech API'yi taklit eder. */
class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

let fake: FakeRecognition;

beforeEach(() => {
  // start() önce mikrofon iznini getUserMedia ile ister; testlerde onayla.
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
  fake = new FakeRecognition();
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
    function () {
      return fake;
    };
});

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

describe("useSpeechDictation", () => {
  it("reports supported when the browser exposes the API", async () => {
    const { result } = renderHook(() => useSpeechDictation({ lang: "tr", onFinal: () => {} }));
    expect(result.current.supported).toBe(true);
  });

  it("surface an error key (not a raw code) so the UI can translate it", async () => {
    const { result } = renderHook(() => useSpeechDictation({ lang: "tr", onFinal: () => {} }));
    await act(async () => { await result.current.start(); });
    act(() => fake.onerror?.({ error: "not-allowed" }));
    expect(result.current.error).toBe("not-allowed");
  });

  it("maps every error code the Speech API can emit to a translation key", async () => {
    const cases: [string, string][] = [
      ["not-allowed", "not-allowed"],
      ["service-not-allowed", "not-allowed"],
      ["audio-capture", "audio-capture"],
      ["network", "network"],
      ["language-not-supported", "unsupported"],
      ["made-up-code", "error"],
    ];
    for (const [raw, expected] of cases) {
      const { result, unmount } = renderHook(() => useSpeechDictation({ lang: "tr", onFinal: () => {} }));
      await act(async () => { await result.current.start(); });
      act(() => fake.onerror?.({ error: raw }));
      expect(result.current.error).toBe(expected);
      unmount();
    }
  });

  it("stays silent for harmless no-speech / aborted events", async () => {
    const { result } = renderHook(() => useSpeechDictation({ lang: "tr", onFinal: () => {} }));
    await act(async () => { await result.current.start(); });
    act(() => fake.onerror?.({ error: "no-speech" }));
    expect(result.current.error).toBeNull();
    act(() => fake.onerror?.({ error: "aborted" }));
    expect(result.current.error).toBeNull();
  });

  it("clearError() dismisses the alert", async () => {
    const { result } = renderHook(() => useSpeechDictation({ lang: "tr", onFinal: () => {} }));
    await act(async () => { await result.current.start(); });
    act(() => fake.onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("listens in the interface language (incl. the newer fr/it/ru/nl)", async () => {
    const expected: Record<string, string> = {
      tr: "tr-TR",
      en: "en-GB",
      de: "de-DE",
      es: "es-ES",
      pt: "pt-PT",
      ar: "ar-SA",
      fr: "fr-FR",
      it: "it-IT",
      ru: "ru-RU",
      nl: "nl-NL",
    };
    for (const [lang, locale] of Object.entries(expected)) {
      const { result, unmount } = renderHook(() =>
        useSpeechDictation({ lang, onFinal: () => {} }),
      );
      await act(async () => {
        await result.current.start();
      });
      expect(fake.lang).toBe(locale);
      unmount();
    }
  });
});

describe("dictation error messages are translated in every UI language", () => {
  const langs = ["tr", "en", "de", "es", "fr", "it", "ar"];
  const codes = [
    "not-allowed",
    "audio-capture",
    "network",
    "unsupported",
    "error",
  ];

  it("every dict.err.* key resolves to real, non-empty text", async () => {
    for (const lang of langs) {
      for (const code of codes) {
        const msg = translate(lang, `dict.err.${code}`);
        expect(msg, `${lang} / dict.err.${code}`).toBeTruthy();
        // A missing key falls back to the key itself — that is the failure mode we guard.
        expect(msg).not.toContain("dict.err.");
      }
    }
  });

  it("message text differs per language (i.e. it is really translated)", async () => {
    const tr = translate("tr", "dict.err.network");
    const en = translate("en", "dict.err.network");
    const it = translate("it", "dict.err.network");
    expect(tr).not.toBe(en);
    expect(it).not.toBe(en);
  });
});
