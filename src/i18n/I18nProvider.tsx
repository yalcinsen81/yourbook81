import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  getSavedUiLanguage,
  isDictionaryLoaded,
  loadDictionary,
  setSavedUiLanguage,
  translate,
  UI_LANGUAGE_EVENT,
  UI_LANGUAGES,
} from "./index";

interface I18nContextValue {
  lang: string;
  dir: "ltr" | "rtl";
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLanguage: (code: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<string>(() => getSavedUiLanguage());
  // Seçili dilin sözlüğü yüklenene kadar (tr hariç) ilk render bekletilir: yanlış dilde parlama olmaz.
  const [ready, setReady] = useState<boolean>(() => isDictionaryLoaded(getSavedUiLanguage()));

  useEffect(() => {
    let cancelled = false;
    if (isDictionaryLoaded(lang)) { setReady(true); return; }
    loadDictionary(lang).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const detail = typeof custom.detail === "string" ? custom.detail : getSavedUiLanguage();
      if (UI_LANGUAGES.some((language) => language.code === detail)) {
        loadDictionary(detail).then(() => setLang(detail));
      }
    };
    window.addEventListener(UI_LANGUAGE_EVENT, onChange as EventListener);
    window.addEventListener("storage", onChange as EventListener);
    return () => {
      window.removeEventListener(UI_LANGUAGE_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onChange as EventListener);
    };
  }, []);

  const dir = (UI_LANGUAGES.find((l) => l.code === lang)?.dir || "ltr") as "ltr" | "rtl";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      document.title = translate(lang, "app.title");
    } catch {
      /* ignore */
    }
  }, [lang, dir, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  const setLanguage = useCallback((code: string) => {
    if (!UI_LANGUAGES.some((language) => language.code === code) || code === lang) return;
    setSavedUiLanguage(code);
  }, [lang]);

  // v-perf: memoize edilmemis obje -> dil degisiminde TUM useT() tuketicileri
  // yeniden render olurdu (192 DOM mutasyonu / 220ms). Deger sabitlendi.
  const ctxValue = useMemo(
    () => ({ lang, dir, t, setLanguage }),
    [lang, dir, t, setLanguage]
  );

  return (
    <I18nContext.Provider value={ctxValue}>
      {ready ? children : null}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provider dışında güvenli geri dönüş (kaynak dil)
    return {
      lang: "tr",
      dir: "ltr" as const,
      t: (key: string, vars?: Record<string, string | number>) => translate("tr", key, vars),
      setLanguage: setSavedUiLanguage,
    };
  }
  return ctx;
}
