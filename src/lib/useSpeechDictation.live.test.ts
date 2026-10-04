import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSpeechDictation } from "./useSpeechDictation";

/**
 * start() artık önce mikrofon iznini getUserMedia ile ister (tarayıcı izin
 * diyaloğunu tetikleyen yol). Testlerde bunu anında onaylayan bir sahte
 * mediaDevices kurarız.
 */
beforeEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
});

/**
 * Gerçek konuşma akışını taklit eden sahte tanıma:
 * once interim ("merhaba"), sonra final ("merhaba dünya").
 */
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

/**
 * SpeechRecognitionEvent benzeri bir olay üretir.
 * `allResults` KÜMÜLATİF listedir (Chrome böyle davranır); `resultIndex`
 * bu olayda yeni/Değişen ilk sonucun indeksidir.
 */
function resultEvent(
  allResults: { text: string; final: boolean }[],
  resultIndex = 0,
) {
  const results: Record<number, unknown> = {};
  allResults.forEach((it, i) => {
    results[i] = {
      length: 1,
      0: { transcript: it.text, confidence: 0.9 },
      isFinal: it.final,
    };
  });
  (results as { length: number }).length = allResults.length;
  return { resultIndex, results };
}

function setup(onFinal: (t: string) => void, onInterim?: (t: string) => void) {
  let fake: FakeRecognition;
  fake = new FakeRecognition();
  (globalThis as unknown as { FakeRecognition: unknown }).FakeRecognition = fake;
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
    function () {
      return fake;
    };
  const view = renderHook(() =>
    useSpeechDictation({ lang: "tr", onFinal, onInterim }),
  );
  return { view, get fake() { return fake; } };
}

describe("live dictation streaming", () => {
  it("emits the interim transcript while the user is still speaking", async () => {
    const onFinal = vi.fn();
    const onInterim = vi.fn();
    const { view, fake } = setup(onFinal, onInterim);

    await act(async () => { await view.result.current.start(); });
    act(() =>
      fake.onresult?.(resultEvent([{ text: "merhaba", final: false }], 0)),
    );

    // The user is mid-sentence: the partial text must be visible NOW.
    // Ara metin büyük harfle başlar (noktalama cümlenin sonunda eklenir)
    expect(view.result.current.interim).toBe("Merhaba");
    expect(onInterim).toHaveBeenCalledWith("Merhaba");
    // Nothing is committed yet.
    expect(onFinal).not.toHaveBeenCalled();
    view.unmount();
  });

  it("commits the text only once the phrase is final", async () => {
    const onFinal = vi.fn();
    const onInterim = vi.fn();
    const { view, fake } = setup(onFinal, onInterim);

    await act(async () => { await view.result.current.start(); });
    act(() =>
      fake.onresult?.(resultEvent([{ text: "merhaba dünya", final: true }], 0)),
    );

    // Kesinleşen cümleye nokta eklenir ve büyük harfle başlar
    expect(onFinal).toHaveBeenCalledWith("Merhaba dünya.");
    view.unmount();
  });

  it("handles the real Chrome sequence: interim then final for the SAME index", async () => {
    const onFinal = vi.fn();
    const onInterim = vi.fn();
    const { view, fake } = setup(onFinal, onInterim);

    await act(async () => { await view.result.current.start(); });
    // Chrome fires interim first...
    act(() => fake.onresult?.(resultEvent([{ text: "bugün", final: false }], 0)));
    expect(onInterim).toHaveBeenLastCalledWith("Bugün");
    // ...then promotes the same result to final.
    act(() =>
      fake.onresult?.(resultEvent([{ text: "bugün hava", final: true }], 0)),
    );
    expect(onFinal).toHaveBeenCalledWith("Bugün hava.");
    view.unmount();
  });

  it("keeps streaming across multiple phrases (continuous mode)", async () => {
    const finals: string[] = [];
    const { view, fake } = setup((t) => finals.push(t));

    await act(async () => { await view.result.current.start(); });
    act(() =>
      fake.onresult?.(
        resultEvent([{ text: "birinci", final: true }], 0),
      ),
    );
    act(() =>
      fake.onresult?.(
        resultEvent(
          [
            { text: "birinci", final: true },
            { text: "ikinci", final: true },
          ],
          1,
        ),
      ),
    );

    expect(finals).toEqual(["Birinci.", "İkinci."]);
    view.unmount();
  });

  it("joins several interim fragments in one event", async () => {
    const onInterim = vi.fn();
    const { view, fake } = setup(vi.fn(), onInterim);

    await act(async () => { await view.result.current.start(); });
    act(() =>
      fake.onresult?.(
        resultEvent(
          [
            { text: "çok ", final: false },
            { text: "güzel", final: false },
          ],
          0,
        ),
      ),
    );
    expect(view.result.current.interim).toBe("Çok güzel");
    view.unmount();
  });

  it("restarts itself after a silence-triggered end (keeps listening)", async () => {
    const { view, fake } = setup(vi.fn());
    await act(async () => { await view.result.current.start(); });
    const startCalls = fake.start.mock.calls.length;
    act(() => fake.onend?.());
    // The browser ended on silence; without a user stop we must resume.
    expect(fake.start.mock.calls.length).toBeGreaterThan(startCalls);
    view.unmount();
  });

  it("does NOT restart after the user stops it", async () => {
    const { view, fake } = setup(vi.fn());
    await act(async () => { await view.result.current.start(); });
    act(() => view.result.current.stop());
    const after = fake.start.mock.calls.length;
    act(() => fake.onend?.());
    expect(fake.start.mock.calls.length).toBe(after);
    view.unmount();
  });
});
