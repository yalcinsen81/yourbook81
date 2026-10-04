import { translate } from "../i18n";

const LOCALE_MAP: Record<string, string> = {
  tr: "tr-TR", en: "en-GB", de: "de-DE", es: "es-ES",
  pt: "pt-PT", ar: "ar-SA", ru: "ru-RU", fr: "fr-FR",
};
function localeOf(lang: string): string {
  return LOCALE_MAP[lang] || "tr-TR";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export function formatNoteDate(ts: number, lang = "tr"): string {
  try {
    return new Date(ts).toLocaleDateString(localeOf(lang), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function formatAlarmDate(ts: number, lang = "tr"): string {
  try {
    return new Date(ts).toLocaleString(localeOf(lang), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Alarm çalması (Web Audio, dosya gerektirmez). */
export function playAlarmChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — kısa arp
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.75);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {}
}

/** Bildirim izni iste (Kullanıcı etkileşimiyle çağrılır) */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      }
    }
  } catch {}
  return false;
}

// ⭐ ARKA PLAN SEKME ALARM UYARISI (Başlık & Favicon Yanıp Sönmesi)
let flashInterval: ReturnType<typeof setInterval> | null = null;
let originalFaviconHref: string | null = null;
/** Alarmdan önceki sekme başlığı (i18n'e saygı duymak için saklanır). */
let restoreTitle: string | null = null;

const BELL_FAVICON_DATA_URI =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='16' fill='%23ff6f1e'/><path d='M16 7c-3.3 0-5.5 2.4-5.5 5.6 0 3.8-1 5-2 5.9-.5.4-.2 1.5.6 1.5h13.8c.8 0 1.1-1.1.6-1.5-1-.9-2-2.1-2-5.9C21.5 9.4 19.3 7 16 7z' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/><path d='M13.6 23.2a2.6 2.6 0 0 0 4.8 0' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round'/></svg>";

function setFavicon(href: string) {
  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  } catch {}
}

/** Sekme arka plandayken veya odak dışındayken başlıkta ve faviconda alarm uyarısı başlatır. */
export function startAlarmBackgroundAlert(alertTitle: string, lang = "tr") {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  stopAlarmBackgroundAlert();

  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (link && !originalFaviconHref) originalFaviconHref = link.href;
  // Alarmdan önceki başlığı sakla; kapanınca i18n'in güncel değerini geri koyarız.
  restoreTitle = document.title;

  let toggle = false;
  flashInterval = setInterval(() => {
    toggle = !toggle;
    if (toggle) {
      document.title = `\u23F0 (1) ${translate(lang, "alarm.title_flash")} - ${alertTitle.slice(0, 30)}`;
      setFavicon(BELL_FAVICON_DATA_URI);
    } else {
      document.title = `${translate(lang, "alarm.tab_prefix")}: ${alertTitle.slice(0, 30)}`;
      if (originalFaviconHref) setFavicon(originalFaviconHref);
    }
  }, 1000);
}

/** Yanıp sönen alarm uyarısını durdurur ve sekme başlığını/faviconunu aslına döndürür. */
export function stopAlarmBackgroundAlert() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (typeof document !== "undefined") {
    document.title = restoreTitle || "yourbook";
    if (originalFaviconHref) setFavicon(originalFaviconHref);
  }
}

// Kullanıcı sekmeye geri dönüp odaklandığında alarm kapatıldıysa başlığı sıfırla
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    // modal açık değilse başlığı temizle
    const modal = document.querySelector(".fixed.z-\\[950\\]");
    if (!modal) stopAlarmBackgroundAlert();
  });
}

/** Masaüstü bildirimi gönder (Tauri'de native, tarayıcıda Service Worker / Web Notification). */
export async function sendDesktopNotification(title: string, body: string) {
  const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__?.invoke);
  if (isTauri) {
    try {
      const tauri = await import("@tauri-apps/plugin-notification");
      const isGranted = await tauri.isPermissionGranted?.();
      if (isGranted) {
        tauri.sendNotification({ title, body });
        return;
      }
      const granted = await tauri.requestPermission?.();
      if (granted === "granted" || (granted as any) === true) {
        tauri.sendNotification({ title, body });
        return;
      }
    } catch {
      // Tauri yok veya hata verdi — Web Notification'a düş
    }
  }

  // Web ortamı: Service Worker hazırsa showNotification kullan (arka planda daha güçlüdür)
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "yourbook-alarm",
        });
        return;
      }
    }
  } catch {}

  // Fallback: Standart Web Notification API
  try {
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icon-192.png" });
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") new Notification(title, { body, icon: "/icon-192.png" });
      }
    }
  } catch {}
}

/** Kalan süreyi insan-okunur biçimde döndür. */
export function getAlarmRemainingText(ts: number, lang = "tr"): string {
  const diff = ts - Date.now();
  if (diff <= 0) return translate(lang, "alarm.due_now");
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const mins = Math.floor((diff % HOUR_MS) / MIN_MS);
  if (days > 0) return translate(lang, "alarm.in_future", { d: days, h: hours });
  if (hours > 0) return translate(lang, "alarm.remaining_hours_mins", { h: hours, m: mins });
  return translate(lang, "alarm.remaining_mins", { m: mins });
}

/**
 * Alarmı Service Worker üzerinden zengin bir bildirimle gösterir
 * ("aç" / "5 dk ertele" aksiyonları ile). SW yoksa classik bildirime düşer.
 */
export async function showAlarmViaServiceWorker(opts: {
  title: string;
  body?: string;
  url?: string;
  lang?: string;
}): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) return false;
    const lang = (opts.lang || "tr").slice(0, 2);
  const actionOpen = translate(lang, "alarm.open");
  const actionSnooze = translate(lang, "alarm.snooze");
    reg.active.postMessage({
      type: "SHOW_ALARM",
      title: opts.title,
      body: opts.body || "",
      url: opts.url || "/",
      icon: "/icon-192.png",
      tag: "yourbook-alarm",
      actionOpen,
      actionSnooze,
    });
    return true;
  } catch {
    return false;
  }
}
