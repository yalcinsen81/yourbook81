import { useCallback, useEffect, useState } from "react";

const KEY = "yourbook_sidebar_hidden_v1";

/** Aynı sekmedeki bileşenleri haberdar etmek için basit bir olay adı. */
const EVT = "yourbook:sidebar-visibility";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Sol panelin gizli olup olmadığını TEK bir yerden yönetir.
 *
 * Neden hook: paneli gizleyen buton panelin İÇİNDE olursa, panel kayınca
 * buton da kaybolur ve kullanıcı geri getiremez. Bu yüzden gizli/görünür
 * durumu localStorage + bir window olayı üzerinden paylaşılır; göster
 * butonu panelin dışında (App.tsx) yaşayabilir.
 */
const WIDTH_KEY = "yourbook_sidebar_width_v2";
const WIDTH_EVT = "yourbook:sidebar-width";

export const SIDEBAR_MIN_W = 180;
export const SIDEBAR_MAX_W = 460;
export const SIDEBAR_DEFAULT_W = 280;

function readWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw) {
      const w = parseInt(raw, 10);
      if (w >= SIDEBAR_MIN_W && w <= SIDEBAR_MAX_W) return w;
    }
  } catch {
    /* yoksay */
  }
  return SIDEBAR_DEFAULT_W;
}

/** Sidebar genişliğini paylaşan küçük bir store (panel dışındaki buton için). */
export function useSidebarWidth() {
  const [width, setWidth] = useState<number>(readWidth);

  useEffect(() => {
    const sync = () => setWidth(readWidth());
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === WIDTH_KEY) sync();
    };
    window.addEventListener(WIDTH_EVT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WIDTH_EVT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setWidthPersisted = useCallback((next: number) => {
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* yoksay */
    }
    window.dispatchEvent(new Event(WIDTH_EVT));
  }, []);

  return { width, setWidth: setWidthPersisted };
}

export function useSidebarVisibility() {
  const [isHidden, setIsHidden] = useState<boolean>(read);

  // Kendi değişikliğimizi ve diğer bileşenlerinkini dinle.
  useEffect(() => {
    const sync = () => setIsHidden(read());
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener(EVT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setIsHidden(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* yoksay */
    }
    window.dispatchEvent(new Event(EVT));
  }, []);

  const toggle = useCallback(() => {
    setHidden(!read());
  }, [setHidden]);

  return { isHidden, setHidden, toggle };
}
