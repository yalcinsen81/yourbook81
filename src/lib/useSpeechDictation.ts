import { useCallback, useEffect, useRef, useState } from "react";
import { punctuate } from "./dictationPunctuation";

/** Konuşma tanıma için minimal Web Speech API tipleri (lib.dom'da tam değil). */
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Arayüz dilini bir BCP-47 konuşma tanıma yereline çevir. */
const LANG_LOCALE: Record<string, string> = {
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

/**
 * Web Speech API hata kodunu bir i18n anahtarına çevir.
 * Bu kod doğrudan kullanıcıya gösterilir (JournalView'da `t("dict.err." + code)`).
 */
function mapRecognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "audio-capture":
      return "audio-capture";
    case "network":
      return "network";
    case "language-not-supported":
      return "unsupported";
    case "start-failed":
      return "start-failed";
    default:
      return "error";
  }
}

export interface SpeechDictation {
  /** Tarayıcı konuşma tanımayı destekliyor mu? */
  supported: boolean;
  /** Şu an dinliyor mu? */
  listening: boolean;
  /** Anlık (henüz kesinleşmemiş) metin. */
  interim: string;
  /** Hata mesajı (varsa). */
  error: string | null;
  /** Kullanıcı hata uyarısını kapattığında çağrılır. */
  clearError: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Web Speech API tabanlı dikte kancası.
 * Kesinleşen ve ara sonuçları ayrı ayrı verir; çağıran taraf bunları metne ekler.
 */
export function useSpeechDictation(opts: {
  /** Arayüz dili kodu (tr/en/de/...). Konuşma yerelini belirler. */
  lang: string;
  /** Kesinleşen metin parçası hazır olduğunda çağrılır. */
  onFinal: (text: string) => void;
  /** Ara (henüz kesinleşmemiş) metin güncellendiğinde çağrılır. */
  onInterim?: (text: string) => void;
}): SpeechDictation {
  const { lang, onFinal, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Kullanıcı "durdur" dedi mi? onend'i yeniden başlatmamak için.
  const manualStopRef = useRef(false);

  const supported = getRecognitionCtor() !== null;

  // En güncel callback'leri tut (recreate gerektirmeden)
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
  }, [onFinal, onInterim]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    setListening(false);
    setInterim("");
    onInterimRef.current?.("");
    try {
      recRef.current?.stop();
    } catch {
      /* yoksay */
    }
  }, []);

  /**
   * Tarayıcının mikrofon izni diyaloğunu AÇIKÇA tetikler.
   *
   * Neden gerekli: SpeechRecognition, izin verilmemişse hiç sormadan
   * "not-allowed" ile dönebiliyor. getUserMedia() çağırmak izin diyaloğunu
   * gösteren güvenilir yoldur. Akış hemen durdurulur; yalnızca izin için.
   */
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return true; // dokunma, eski API yolu
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: string }).name)
          : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("not-allowed");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("audio-capture");
      } else {
        setError("error");
      }
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    setError(null);

    // 1) Önce mikrofon iznini AÇIKÇA iste. SpeechRecognition kendi başına
    //    izin diyaloğunu göstermeyip sessizce "not-allowed" dönebiliyor.
    setListening(true); // kullanıcıya anında geri bildirim (izin beklenirken)
    const permitted = await requestMicPermission();
    if (!permitted) {
      setListening(false);
      return;
    }

    manualStopRef.current = false;

    // Zaten çalışıyorsa yeniden kurma
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* yoksay */
      }
      recRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = LANG_LOCALE[lang] || "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) {
          const clean = txt.trim();
          // Konuşma tanıma noktalama üretmez — cümle sonu işareti ve büyük
          // harf bizim tarafımızda eklenir (bkz. dictationPunctuation.ts).
          if (clean)
            onFinalRef.current(
              punctuate(clean, { lang, finalComplete: true }),
            );
        } else {
          interimText += txt;
        }
      }
      const preview = interimText ? punctuate(interimText, { lang }) : "";
      setInterim(preview);
      onInterimRef.current?.(preview);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" ve "aborted" zararsız — kullanıcıya hata göstermeyelim.
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(mapRecognitionError(e.error));
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      onInterimRef.current?.("");
      // "continuous" olmasına rağmen bazı tarayıcılar sessizlikte bitir;
      // kullanıcı elle durdurmadıysa yeniden başlat.
      if (!manualStopRef.current) {
        try {
          rec.start();
        } catch {
          /* zaten çalışıyor olabilir */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("start-failed");
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Bileşen kalkarken tanımayı bırak
  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      try {
        recRef.current?.abort();
      } catch {
        /* yoksay */
      }
      recRef.current = null;
    };
  }, []);

  // Dil değişirse dinlemeyi durdur (yerel değişir)
  useEffect(() => {
    if (listening) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  };
}
