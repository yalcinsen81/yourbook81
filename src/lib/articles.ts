import type { Article } from "./types";

export interface ArticleConfig {
  label: string;
  nameKey?: string;
  name: string;
  /** Tailwind benzeri görsel sınıflardan bağımsız, tema değişkeni tabanlı ipuçları (opsiyonel) */
  code?: string;
}

/**
 * Tarayıcının yerleşik Text-to-Speech motoruyla kelimeyi seslendir.
 * `lang` alanı "DE"/"EN"/"Memo" şeklinde gelir; ISO koduna çevrilir.
 */
// Konusma motoru icin dil kodu eslemesi (masa dilleri: DE/EN/ES/FR/IT/AR).
const SPEECH_LOCALES: Record<string, string> = {
  DE: "de-DE",
  EN: "en-US",
  ES: "es-ES",
  FR: "fr-FR",
  IT: "it-IT",
  AR: "ar-SA",
};

export interface SpeakOptions {
  /** Konusma hizi (0.5 = yavas, 1 = normal). Varsayilan 0.92. */
  rate?: number;
  /** Perde (0.5 = kalin, 2 = ince). Varsayilan 1. */
  pitch?: number;
  /** Bittiginde cagrilir (buton animasyonu icin). */
  onEnd?: () => void;
  /** Baslarken cagrilir. */
  onStart?: () => void;
  /** Hata olursa (ses motoru yok / engellendi). */
  onError?: () => void;
}

/**
 * Konusma motoru icin dil kodu eslemesi (masa dilleri: DE/EN/ES/FR/IT/AR).
 * RTL diller (AR) icin daha yavas bir varsayilan hiz kullanilir.
 */
export function speechLocaleOf(lang: string): string {
  return SPEECH_LOCALES[lang] ?? SPEECH_LOCALES.EN;
}

/** Bu ortamda sesli okuma destekleniyor mu? */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Dile uygun en iyi sesi bulur (yoksa null -> tarayici varsayilani). */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  try {
    const target = speechLocaleOf(lang).toLowerCase();
    const base = target.split("-")[0];
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;
    // 1) tam eslesme (de-DE), 2) ayni dil kokü (de-*), 3) yok
    return (
      voices.find((v) => v.lang.toLowerCase() === target) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base + "-")) ??
      voices.find((v) => v.lang.toLowerCase() === base) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Kelimeyi seslendir. Geriye 'iptal' fonksiyonu doner (yeni okuma baslatirken kullan).
 * Arapca (RTL) icin varsayilan hiz daha yavastir.
 */
export function speak(text: string, lang: string, opts: SpeakOptions = {}): void {
  if (!canSpeak()) {
    opts.onError?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const locale = speechLocaleOf(lang);
    utterance.lang = locale;
    const isRtl = locale.startsWith("ar") || locale.startsWith("he") || locale.startsWith("fa");
    utterance.rate = opts.rate ?? (isRtl ? 0.78 : 0.92);
    utterance.pitch = opts.pitch ?? 1;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    if (opts.onStart) utterance.onstart = () => opts.onStart?.();
    if (opts.onEnd) utterance.onend = () => opts.onEnd?.();
    utterance.onerror = () => opts.onError?.();
    window.speechSynthesis.speak(utterance);
  } catch {
    opts.onError?.();
  }
}

/** Devam eden okumayi durdur. */
export function stopSpeaking(): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch { }
}
