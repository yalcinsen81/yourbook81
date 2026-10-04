import { NotebookCustomizeModal } from "./components/NotebookCustomizeModal";
import { TimeLightingOverlay } from "./components/TimeLightingOverlay";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SuperrSidebar, type NavView } from "./components/SuperrSidebar";
import { SuperrHero } from "./components/SuperrHero";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { QuickAdd } from "./components/QuickAdd";
import { CommandPalette } from "./components/CommandPalette";
import { AlarmAlert } from "./components/AlarmAlert";
import { useDeck } from "./lib/deck";
import { UndoToast, type UndoToastData } from "./components/UndoToast";
import { buildDeskCounters } from "./lib/counters";
import { useNotes } from "./lib/notes";
import { useSpaces } from "./lib/spaces";
import { languageCodeFromSpaceId, getLanguageByTag } from "./lib/languages";
import { isSoundMuted, toggleSound, playPaperRustle, playSuccessSound, playPopSound } from "./lib/sound";
import { useTheme } from "./lib/themes";
import { useEngagement, EngagementProvider } from "./components/EngagementSystem";
import { XpToast, FloatingXp, type XpToastData } from "./components/XpToast";
import { Confetti } from "./components/Confetti";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthModal } from "./components/AuthModal";
import { MobileHeader } from "./components/MobileHeader";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { getSavedLocalUser, saveLocalUser, getCurrentSessionUser, onAuthStateChange, type AppUser } from "./lib/supabase";
import { performCloudSync } from "./lib/syncEngine";
import { usePwaInstall } from "./lib/usePwaInstall";
import { InstallPwaModal } from "./components/InstallPwaModal";
import {
  playAlarmChime,
  sendDesktopNotification,
  startAlarmBackgroundAlert,
  stopAlarmBackgroundAlert,
  showAlarmViaServiceWorker,
  snoozeAgendaEvent,
} from "./lib/alarm";
import { useT } from "./i18n/I18nProvider";
import {
  getSavedPaperTexture,
  getSavedHandwriting,
  applyCustomHandwritingVars,
  HANDWRITING_STYLES,
  type PaperTextureType,
  type HandwritingStyleType,
} from "./lib/notebookConfig";

import {
  useSidebarVisibility,
  useSidebarWidth,
} from "./lib/useSidebarVisibility";
// Agir görünümler ilk açılışta yüklenmez; ilk ziyarette parça olarak getirilir.
const StudyDesk = lazy(() => import("./components/StudyDesk").then((m) => ({ default: m.StudyDesk })));
const NotesView = lazy(() => import("./components/NotesView").then((m) => ({ default: m.NotesView })));
const DailyNotesView = lazy(() => import("./components/DailyNotesView").then((m) => ({ default: m.DailyNotesView })));
const JournalView = lazy(() => import("./components/JournalView").then((m) => ({ default: m.JournalView })));
const CollectionsView = lazy(() => import("./components/CollectionsView").then((m) => ({ default: m.CollectionsView })));
const WorkProjectsView = lazy(() => import("./components/WorkProjectsView").then((m) => ({ default: m.WorkProjectsView })));
const YouTubeLinksView = lazy(() => import("./components/YouTubeLinksView").then((m) => ({ default: m.YouTubeLinksView })));
const CalendarAgendaView = lazy(() => import("./components/CalendarAgendaView").then((m) => ({ default: m.CalendarAgendaView })));

export default function App() {
  return (
    <EngagementProvider>
      <AppContent />
    </EngagementProvider>
  );
}

function AppContent() {
  const {
    cards,
    dueCards,
    getCardsForSpace,
    markAsLearned,
    reviewAgain,
    returnToQueue,
    updateCardImage,
    updateCard,
    deleteCard,
    restoreCard,
    requeueCard,
    addCard,
    resetAll,
  } = useDeck();
  const { notes, ringingAlarmNote, dismissAlarm, snoozeAlarm } = useNotes();
  const { spaces, activeSpace, switchSpace, addLanguageSpace, languageSpaceExists, langDeskCount } = useSpaces();

  // Kağıt dokusu ve el yazısı stil state'leri
  const [paperTexture, setPaperTexture] = useState<PaperTextureType>(getSavedPaperTexture);
  const [handwritingFont, setHandwritingFont] = useState<HandwritingStyleType>(getSavedHandwriting);

  useEffect(() => {
    const applyNotebookConfig = () => {
      const pt = getSavedPaperTexture();
      const hf = getSavedHandwriting();
      setPaperTexture(pt);
      setHandwritingFont(hf);

      if (hf === "custom") {
        applyCustomHandwritingVars();
      } else {
        const fontObj = HANDWRITING_STYLES.find((f) => f.id === hf);
        if (fontObj) {
          document.documentElement.style.setProperty("--font-handwritten", fontObj.fontFamily);
        }
      }
    };

    applyNotebookConfig();
    window.addEventListener("notebook-config-changed", applyNotebookConfig);
    return () => window.removeEventListener("notebook-config-changed", applyNotebookConfig);
  }, []);
  const { theme, themes, switchTheme } = useTheme();
  const { t, lang } = useT();
  // Panel gizli/gorunur durumu - sidebar ve dis toggle ayni kaynagi kullanir.
  const { isHidden: isSidebarHidden, toggle: toggleSidebar } = useSidebarVisibility();
  const { width: sidebarWidth } = useSidebarWidth();
  const engagement = useEngagement();

  // v-perf: tema crossfade SADECE tema degisiminde olsun (opt-in transition sinifi).
  const prevThemeBgRef = useRef<string | null>(null);
  const themeSwitchTimerRef = useRef<number | undefined>(undefined);

  // Superr Defter Bölümleri:
  // hero | collections (Tüm Notlar) | daily (Günlük Notlar) | work (İş ve Projeler) | calendar (Takvim ve Ajanda) | cards (Masalar: DE / EN)
  const [currentView, setCurrentView] = useState<NavView>("hero");
  // Görünümler arası tarih bağlantısı (agenda ↔ günlük). Bir görünüm, diğerinde
  // belirli bir güne atlamak istediğinde buraya tarih yazar; hedef görünüm okur.
  const [crossLinkDateKey, setCrossLinkDateKey] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSidebarCustomizeOpen, setIsSidebarCustomizeOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const pwa = usePwaInstall();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(getSavedLocalUser);
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => { if (!currentUser) return; const age = Date.now() - Number(currentUser.createdAt || Date.now()); setShowOnboarding(!localStorage.getItem("yourbook_onboarding_v1") && age < 10 * 60 * 1000); }, [currentUser]);

  // v-migrate: ilk bulut aktariminin onayi. syncEngine event yayinlar;
  // hangi cagri once olursa olsun burada YAKALANIR (yaris sorunu cozumu).
  const [migrationNotice, setMigrationNotice] = useState<{ keyCount: number; bytes: number } | null>(null);
  useEffect(() => {
    const onMigrated = (e: Event) => {
      const d = (e as CustomEvent).detail as { happened?: boolean; keyCount?: number; bytes?: number } | undefined;
      if (d && d.happened) setMigrationNotice({ keyCount: d.keyCount ?? 0, bytes: d.bytes ?? 0 });
    };
    window.addEventListener("yourbook:migrated", onMigrated);
    return () => window.removeEventListener("yourbook:migrated", onMigrated);
  }, []);

  // v-auth2: OTURUM KALICILIGI. Acilista bulut oturumunu oku;
  // boylece sayfa yenilenince oturum DUSMEZ. Bulut yoksa hicbir sey degismez.
  useEffect(() => {
    let alive = true;
    // 1) Acilista mevcut oturumu geri yukle
    getCurrentSessionUser().then((u) => {
      if (!alive || !u) return;
      setCurrentUser(u);
      saveLocalUser(u);
    });
    // 2) Giris/cikis/token yenilemeyi dinle
    const unsub = onAuthStateChange((u) => {
      if (!alive) return;
      if (u) {
        setCurrentUser(u);
        saveLocalUser(u);
      }
      // u === null: misafir/yerel kullanima DUSULMEZ (kullanici silinmesin).
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  const [soundMuted, setSoundMuted] = useState(isSoundMuted());
  const [xpToast, setXpToast] = useState<XpToastData | null>(null);
  const toastIdRef = useRef(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [floatingXp, setFloatingXp] = useState<{ id: number; xp: number; levelUp: boolean } | null>(null);

  // ⭐ TÜM CİHAZLARDA (LAPTOP, CEP TELEFONU, TABLET) RENK & TEMA BÜTÜNLÜĞÜ
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // v-perf: TEMA DEGISKENLERI - TEK SENKRON BLOG.
    // DIKKAT: cssText KULLANILMAZ! Aksi halde <html> uzerindeki
    // --font-handwritten (kullanicinin el yazisi fontu) SILINIRDI.
    // setProperty yalnizca tema degiskenlerine dokunur - font korunur.
    const themeVars: Array<[string, string]> = [
      ["--app-bg", theme.appBg],
      ["--paper", theme.paper || theme.panelBg],
      ["--panel-bg", theme.panelBg],
      ["--sidebar-bg", theme.sidebarBg],
      ["--desk-bg", theme.deskBg],
      ["--accent", theme.accent],
            ["--ink", theme.ink],
      ["--ink-soft", theme.inkSoft],
      ["--border-ink", theme.border],
      ["--paper-grain-opacity", theme.grainOpacity || "0.16"],
      ["--paper-secondary", theme.paperSecondary || theme.panelBg],
      ["--shadow-color", theme.shadowColor || theme.ink],
      ["--accent-ink", theme.accentInk || theme.appBg],
      ["--color-success", theme.success || "#287a45"],
      ["--color-danger", theme.danger || "#b42318"],
      ["--color-warning", theme.warning || "#9a6700"],
      ["--article-masc", theme.articleMasc || "#2563a8"],
      ["--article-fem", theme.articleFem || "#b4234d"],
      ["--article-neut", theme.articleNeut || "#287a45"],
      ["--modal-overlay", theme.overlay || "rgba(0,0,0,0.35)"],
    ];
    for (let i = 0; i < themeVars.length; i++) {
      root.style.setProperty(themeVars[i][0], themeVars[i][1]);
    }

    // v-perf: crossfade yalnizca TEMA degisiminde. Sinifi ekle -> 200ms sonra kaldir.
    // (Dil degisimi ve diger islemler artik transition yuku tasimaz.)
    if (prevThemeBgRef.current !== null && prevThemeBgRef.current !== theme.appBg) {
      root.classList.add("theme-switching");
      window.clearTimeout(themeSwitchTimerRef.current);
      themeSwitchTimerRef.current = window.setTimeout(() => {
        root.classList.remove("theme-switching");
      }, 200);
    }
    prevThemeBgRef.current = theme.appBg;

    // Meta tema rengi: YALNIZCA gercekten degistiyse yaz
    // (gereksiz DOM mutasyonu + layout tetiklemesi onlenir).
    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    if (metaThemeColor.getAttribute("content") !== theme.appBg) {
      metaThemeColor.setAttribute("content", theme.appBg);
    }
  }, [theme]);

  // XP değişince toast göster; seviye atlarsa kutlama versiyonu
  const prevXpRef = useRef(engagement.xp);

  // ⭐ OTOMATİK BULUT SENKRONİZASYONU (Kullanıcı girişliyse periyodik ve veri değişiminde)
  useEffect(() => {
    if (!currentUser) return;
    performCloudSync(currentUser);

    const interval = setInterval(() => {
      performCloudSync(currentUser);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Ağ geri geldiğinde, sekme yeniden odaklandığında ve başka bir sekmede
  // veri değiştiğinde anında senkronize et (çevrimdışı-öncelikli davranış).
  useEffect(() => {
    if (!currentUser) return;

    const onOnline = () => performCloudSync(currentUser);
    const onVisible = () => {
      if (document.visibilityState === "visible") performCloudSync(currentUser);
    };
    const onStorage = (e: StorageEvent) => {
      // Başka bir sekmede senkronlanan anahtarlar değiştiyse bu sekmeyi de tazele
      if (e.key && e.key.startsWith("yourbook_")) performCloudSync(currentUser);
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [currentUser]);

  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);

    syncDebounceRef.current = setTimeout(() => {
      performCloudSync(currentUser);
    }, 2500);

    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [cards, notes, engagement.xp, currentUser]);
  useEffect(() => {
    const prevXp = prevXpRef.current;
    const gained = engagement.xp - prevXp;
    prevXpRef.current = engagement.xp;
    if (gained <= 0) return;
    const levelUp = Math.floor(engagement.xp / 500) > Math.floor(prevXp / 500);
    if (levelUp) setConfettiTrigger((c) => c + 1);
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setXpToast({
      id,
      xp: gained,
      levelUp,
      streak: engagement.streak,
      xpAfter: engagement.xp,
    });
    // v-fix(H7): ayni olay icin ikinci kutlama (FloatingXp) KAPATILDI.
    // Tek kutlama kaynagi: XpToast (sag alt). Cift toast cakismasi bitti.
    const ft = window.setTimeout(() => {}, 0);
    return () => clearTimeout(ft);
  }, [engagement.xp, engagement.streak]);

  // Masaya ait dil etiketi: dil masaları için targetLang, diğer masalar için Memo.
  const activeSpaceLangTag =
    activeSpace.targetLang ??
    getLanguageByTag(activeSpace.targetLang)?.langTag ??
    null;
  const activeLanguageCode =
    activeSpace.languageCode ?? languageCodeFromSpaceId(activeSpace.id) ?? null;

  const cardBelongsToActiveSpace = (cardLang: string | null | undefined) => {
    // Dil masasıysa: kartın dil etiketi masanın hedef diliyle eşleşmeli.
    if (activeSpaceLangTag) return cardLang === activeSpaceLangTag;
    // "İş & Proje" ve serbest masalar yalnızca not kartlarını (Memo) gösterir.
    if (activeSpace.id === "space-work" || activeSpace.id === "space-personal") {
      return cardLang === "Memo";
    }
    // Özel (kullanıcı tanımlı) masalar: keşfedilmemiş kartların hepsi görünür.
    return true;
  };

  const spaceAllCards = cards.filter((c) => cardBelongsToActiveSpace(c.lang));
  void activeLanguageCode;
  // Seçili Space'e ait kesin dil ayrımı
  // MADDE 2: silme geri alma bildirimi (5 sn) — kelime kartlari icin.
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

  // ⭐ MADDE 4: TEK SAYAC KAYNAGI — tum ekranlar bu nesneyi kullanir.
  // Kapak, masa basligi, istatistik paneli ve menu ayni degeri gosterir.
  const counters = buildDeskCounters(cards, notes, {
    xp: engagement?.xp ?? 0,
    streak: engagement?.streak ?? 0,
    answeredToday: engagement?.answeredToday ?? 0,
    masteredToday: engagement?.masteredToday ?? 0,
    todayXp: engagement?.todayXp ?? 0,
  });
  const spaceCards = getCardsForSpace(activeSpace.id, activeSpaceLangTag);

  // Durum paneli için: aynı dil filtresiyle TÜM kartlar (öğrenilmiş ve ertelenmiş dahil).
  // Kuyruk (spaceCards) yalnızca tekrar sırası gelmiş kartları içerdiği için panelde
  // öğrenilen/ertelenen kelimeler görünmez olurdu.

  // ⭐ NOT ALARMLARI İZLEYİCİSİ (Arka plan sekme uyarısı + Web Bildirimi)
  const prevAlarmNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (ringingAlarmNote) {
      if (prevAlarmNoteIdRef.current !== ringingAlarmNote.id) {
        prevAlarmNoteIdRef.current = ringingAlarmNote.id;
        playAlarmChime();
        const noteBody = `${ringingAlarmNote.title}\n${ringingAlarmNote.content || ""}`;
        const noteTitle = t("alarm.note_title");
        showAlarmViaServiceWorker({ title: noteTitle, body: noteBody, url: "/?view=notes", lang, snooze: { kind: "note", id: ringingAlarmNote.id } }).then(
          (shown) => {
            if (!shown) sendDesktopNotification(noteTitle, noteBody);
          }
        );
        startAlarmBackgroundAlert(ringingAlarmNote.title, lang);
      }
    } else {
      if (prevAlarmNoteIdRef.current) {
        prevAlarmNoteIdRef.current = null;
        stopAlarmBackgroundAlert();
      }
    }
  }, [ringingAlarmNote]);

  // Bildirimdeki "ertele" aksiyonu: SW mesajı veya /?snooze=kind:id:dk parametresi
  useEffect(() => {
    const apply = (snooze: { kind: string; id: string } | undefined, minutes: number) => {
      if (!snooze?.id) return;
      stopAlarmBackgroundAlert();
      if (snooze.kind === "note") snoozeAlarm(snooze.id, minutes);
      else if (snooze.kind === "agenda") snoozeAgendaEvent(snooze.id, minutes);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "SNOOZE_ALARM") apply(e.data.snooze, Number(e.data.minutes) || 5);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("snooze");
      if (q) {
        const [kind, ...rest] = q.split(":");
        const minutes = Number(rest.pop()) || 5;
        apply({ kind, id: rest.join(":") }, minutes);
        url.searchParams.delete("snooze");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch { /* yok say */ }
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [snoozeAlarm]);

  // ⭐ MERKEZİ AJANDA ALARMI İZLEYİCİSİ (Hangi sayfada olunursa olunsun arka planda çalışır)
  useEffect(() => {
    const checkCalendarAlarms = () => {
      try {
        const raw = localStorage.getItem("superr_agenda_events_v4");
        if (!raw) return;
        const events = JSON.parse(raw);
        if (!Array.isArray(events)) return;
        const now = Date.now();
        let changed = false;

        const updated = events.map((ev: any) => {
          if (ev.hasAlarm && ev.alarmTimestamp && ev.alarmTimestamp <= now && !ev.isAlarmTriggered && !ev.isDone) {
            changed = true;
            playAlarmChime();
            const evBody = `${ev.title}${ev.description ? `\n${ev.description}` : ""}`;
            const evTitle = `${t("alarm.agenda_title")} (${ev.timeStr || t("alarm.time_now")})`;
            // Zengin SW bildirimi (aç / ertele aksiyonlu); SW yoksa klasik bildirime düşer.
            showAlarmViaServiceWorker({ title: evTitle, body: evBody, url: "/?view=calendar", lang, snooze: { kind: "agenda", id: String(ev.id) } }).then(
              (shown) => {
                if (!shown) sendDesktopNotification(evTitle, evBody);
              }
            );
            startAlarmBackgroundAlert(ev.title, lang);
            return { ...ev, isAlarmTriggered: true };
          }
          return ev;
        });

        if (changed) {
          localStorage.setItem("superr_agenda_events_v4", JSON.stringify(updated));
        }
      } catch {}
    };

    const interval = setInterval(checkCalendarAlarms, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isFormField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Form alanındayken Cmd+A / Ctrl+A'nın tümünü seçmesine izin ver, müdahale etme
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
        if (isFormField) {
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            target.select();
          }
          return;
        }
      }

      // Ctrl + K veya Cmd + K: Komut Paletini Aç/Kapat
      if ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === "k" || e.code === "KeyK")) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
        try { playPopSound(); } catch {}
        return;
      }

      // Alt kısayolları harici form içindeyken kısayollar tetiklenmesin
      if (isFormField && !e.altKey) return;

      if (e.altKey && e.key === "1") { playPaperRustle(); setCurrentView("hero"); }
      else if (e.altKey && e.key === "2") { playPaperRustle(); setCurrentView("collections"); }
      else if (e.altKey && e.key === "3") { playPaperRustle(); setCurrentView("daily"); }
      else if (e.altKey && e.key === "4") { playPaperRustle(); setCurrentView("work"); }
      else if (e.altKey && e.key === "5") { playPaperRustle(); setCurrentView("calendar"); }
      else if (e.altKey && e.key === "6") {
        playPaperRustle();
        switchSpace("space-de");
        setCurrentView("cards");
      } else if (e.altKey && e.key === "7") {
        playPaperRustle();
        switchSpace("space-en");
        setCurrentView("cards");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [switchSpace]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__?.invoke);
    if (!isTauri) return;
    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("quick-add", () => setIsQuickAddOpen(true));
      } catch {}
    };
    setup();
    return () => unlisten?.();
  }, []);

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundMuted(next);
  };

  const handleSelectView = (view: NavView) => {
    if (view !== currentView) {
      playPaperRustle();
      setCurrentView(view);
    }
  };

  const isReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // DEFTER SAYFASI CEVIRME GECISI (hafif opacity + 6px kayma, ~160ms toplam).
  const PAGE_MOTION = isReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        // Yalnizca hafif opacity + 6px kayma: 3D/skew kaldirildi (gecis daha akici/hizli).
        initial: { opacity: 0, x: 6 },
        animate: { opacity: 1, x: 0 },
        // exit cok kisa + popLayout: gecis boyunca EKRAN BOS KALMAZ.
        exit: { opacity: 0, x: -6, transition: { duration: 0.07 } },
        transition: { duration: 0.09, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
      };
  return (
    <div
      // v-perf: CSS degiskenleri ARTIK YALNIZCA <html> uzerinde tanimli (useEffect).
      // Buradaki inline kopya KALDIRILDI -> cift yeniden hesaplama bitti.
      // v-scopedfont: `font-${handwritingFont}` SINIFI KALDIRILDI.
      // KOK NEDEN: bu sinif tum uygulamaya el yazisi fontunu (or. font-kalam)
      // uyguluyordu. index.css'teki `body.font-kalam` kurali TUM sayfayi el yazisina
      // ceviriyor, o font bazi karakterlerde cozulemeyince tarayici
      // -apple-system'e dusuyordu -> "font sayfa ile uyumlu degil / yazilar kayik"
      // sikayeti (canlida olculdu: takvim panelindeki 68 element -apple-system).
      // El yazisi fontu ZATEN `--font-handwritten` degiskeniyle (satir ~86) ve
      // `:root[data-handwriting=...]` kuraliyla dogru sekilde uygulaniyor;
      // yalnizca `font-handwritten` sinifini kullanan yerlerde gecerli olur.
      className={`paper-grain texture-${paperTexture} relative flex flex-col lg:flex-row min-h-[100dvh] w-full overflow-y-auto overflow-x-hidden lg:h-screen lg:w-screen lg:overflow-hidden bg-[var(--app-bg)] text-[var(--ink)] font-sans selection:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] selection:text-[var(--ink)]`}>
      {/* Genel Kağıt Dokusu (Tüm temalarda ve yüzeylerde aktif) */}
      <div id="paper-texture-overlay" className={`global-paper-texture texture-${paperTexture}`} aria-hidden="true" />

        {/* Zamana Duyarlı Işık / Renk Tonu Katmanı */}
        <TimeLightingOverlay />

      {/* ⭐ MOBİL ÜST BAR (< md Ekranlar: Cep Telefonu ve Küçük Tablet) */}
      <MobileHeader
        onOpenMenu={() => setIsMobileDrawerOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        currentUser={currentUser}
        activeSpace={activeSpace}
        onSwitchSpace={(id) => {
          playPaperRustle();
          switchSpace(id);
          setCurrentView("cards");
        }}
        spaces={spaces}
        theme={theme}
        themes={themes}
        onSelectTheme={switchTheme}
      // v-mobile: masa degistirici yalnizca kelime masasi ekranlarinda gorunsun
      showDeskSwitcher={currentView === "cards"}
      />

      {/* 1. MASAÜSTÜ SOL MENÜSÜ (>= md Ekranlar: Laptop ve Geniş Ekranlar) */}
      <div className="relative hidden lg:flex h-full shrink-0 w-fit overflow-hidden bg-[var(--sidebar-bg,#f3ece2)] transition-[width] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
        <SuperrSidebar
          currentView={currentView}
          onSelectView={handleSelectView}
          activeSpace={activeSpace}
          onSelectSpace={(id) => {
            playPaperRustle();
            switchSpace(id);
            setCurrentView("cards");
          }}
          theme={theme}
          themes={themes}
          onSelectTheme={switchTheme}
          languageSpaceExists={languageSpaceExists}
          onCreateLanguageDesk={(code) => {
            playPaperRustle();
            addLanguageSpace(code);
            setCurrentView("cards");
          }}
          spaces={spaces}
          dueCardsCount={counters.dueCards}
          // MADDE 4: tum notlar SADECE notlari sayar — kelime kartlari SAYILMAZ.
          notesCount={counters.totalCards + counters.totalNotes}
          streak={engagement.streak}
          level={engagement.level}
          levelProgress={engagement.levelProgress}
          todayXp={engagement.todayXp}
          totalXp={counters.xp}
          goalPercent={counters.goalPercent}
          goalXp={counters.goal}
          dueCards={counters.dueCards}
          totalCards={counters.totalCards}
          langDeskCount={langDeskCount}
          isMuted={soundMuted}
          onToggleSound={handleToggleSound}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onQuickAdd={() => setIsQuickAddOpen(true)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenInstall={() => setIsInstallModalOpen(true)}
          onOpenCustomize={() => setIsSidebarCustomizeOpen(true)}
        />
      </div>

      {/* ⭐ PANEL GİZLE/GÖSTER
          aside'ın DIŞINDA durur: <aside> overflow:hidden olduğu için içindeki
          buton, panel kayarken kırpılıyor ve tıklanamıyordu.
          Konum, sidebar genişliğini paylaşan useSidebarWidth'ten gelir. */}
      {!isSidebarHidden && (
        <button
          type="button"
          onClick={() => toggleSidebar()}
          data-sidebar-toggle="1"
          aria-label={t("sidebar.hide")}
          title={t("sidebar.hide")}
          className="hidden lg:flex fixed z-[70] h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-md transition-colors hover:bg-[var(--accent)]"
          style={{ top: 21.5, left: sidebarWidth - 85 }}
        >
          <span className="font-mono text-[17px] font-bold leading-none">‹</span>
        </button>
      )}

      {/* Gizliyken aynı buton, kenarda durur ve geri getir */}
      {isSidebarHidden && (
        <button
          type="button"
          onClick={() => toggleSidebar()}
          data-sidebar-toggle="1"
          aria-label={t("sidebar.show")}
          title={t("sidebar.show")}
          className="hidden lg:flex fixed z-[70] h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-md transition-colors hover:bg-[var(--accent)]"
          style={{ top: 21.5, left: 12 }}
        >
          <span className="font-mono text-[17px] font-bold leading-none">›</span>
        </button>
      )}


      {/* ⭐ MOBİL OFF-CANVAS ÇEKMECE MENÜSÜ (Açılır-Kapanır Defter Çekmecesi) */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex"
            onClick={() => setIsMobileDrawerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 h-full w-[280px]"
            >
              <SuperrSidebar
                currentView={currentView}
                onSelectView={(v) => {
                  handleSelectView(v);
                  setIsMobileDrawerOpen(false);
                }}
                activeSpace={activeSpace}
                onSelectSpace={(id) => {
                  playPaperRustle();
                  switchSpace(id);
                  setCurrentView("cards");
                  setIsMobileDrawerOpen(false);
                }}
                theme={theme}
                themes={themes}
                onSelectTheme={switchTheme}
                languageSpaceExists={languageSpaceExists}
                onCreateLanguageDesk={(code) => {
                  playPaperRustle();
                  addLanguageSpace(code);
                  setCurrentView("cards");
                  setIsMobileDrawerOpen(false);
                }}
                spaces={spaces}
                dueCardsCount={spaceCards.length}
                notesCount={cards.length + notes.length}
                streak={engagement.streak}
                level={engagement.level}
                levelProgress={engagement.levelProgress}
                todayXp={engagement.todayXp}
                totalXp={engagement.xp}
                langDeskCount={langDeskCount}
                isMuted={soundMuted}
                onToggleSound={handleToggleSound}
                onOpenCommandPalette={() => {
                  setIsMobileDrawerOpen(false);
                  setIsCommandPaletteOpen(true);
                }}
                onQuickAdd={() => {
                  setIsMobileDrawerOpen(false);
                  setIsQuickAddOpen(true);
                }}
                currentUser={currentUser}
                onOpenAuth={() => {
                  setIsMobileDrawerOpen(false);
                  setIsAuthModalOpen(true);
                }}
                onOpenInstall={() => {
                  setIsMobileDrawerOpen(false);
                  setIsInstallModalOpen(true);
                }}
                isMobileDrawer={true}
                onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Ana Tuval (Cream Paper Canvas) */}
        {/* MADDE 1: ALT NAV PAYI. Alt nav h-[52px] + py-1 + border ~62px; onceki pb-16
            (64px) sinirdaydi ve safe-area yoktu -> kart altindaki butonlar YARIM
            kaliyordu. Yeni: 52 + 8 nefes + safe-area. Masaustunde alt nav yok -> lg:pb-0. */}
        <main className="relative flex-1 min-w-0 lg:h-full overflow-x-hidden bg-[var(--app-bg)] pb-[calc(60px+env(safe-area-inset-bottom))] lg:pb-0 lg:overflow-hidden">
          {/* Sayfa kivrimi: masa gecisinde hafif bir kivrim efekti. */}
          {!isReducedMotion && (
          <motion.div
            key={"curl-" + currentView}
            initial={{ opacity: 0.55, scaleX: 1 }}
            animate={{ opacity: 0, scaleX: 0.6 }}
            transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] as [number, number, number, number] }}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 origin-right"
            style={{
              background:
                "linear-gradient(to left, color-mix(in srgb, var(--ink) 22%, transparent), transparent)",
              transformOrigin: "right center",
            }}
          />
        )}
        {/* Çapraz fade: eski sayfa fade-out olurken yenisi fade-in gelir — boş ekran oluşmaz.
            Ana tuval her zaman --app-bg dolgulu olduğu için "beyaz flash" da imkânsız. */}
        {/* mode="popLayout": yeni sayfa ANINDA mount olur, eski sayfa ayni anda cikar.
            popLayout eski+yeni icerigi ayni anda gosteriyordu (masa gecisinde "hayalet" metin). */}
        <Suspense fallback={null}>
        <AnimatePresence mode="wait" initial={false}>
          {/* 1. Giriş ve Defter */}
          {currentView === "hero" && (
            <motion.div
              key="hero"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <SuperrHero
                engagement={engagement}
                totalCards={counters.totalCards}
                dueCards={counters.dueCards}
                goalXp={counters.goal}
                goalPercent={counters.goalPercent}
                nextReviewInDays={counters.nextReviewInDays}
                dueCardsCount={counters.dueCards}
                spaces={spaces}
                onGoToCards={(spaceId) => {
                  playPaperRustle();
                  if (spaceId) switchSpace(spaceId);
                  setCurrentView("cards");
                }}
                onGoToNotes={() => {
                  // "sınıflandırılmış notlar" kartı, verinin gerçekten bulunduğu
                  // İş ve Projeler görünümüne yönlendirir (aynı veri kaynağı,
                  // tutarlı başlık ve aktif menü durumu).
                  playPaperRustle();
                  setCurrentView("work");
                }}
                onGoToDaily={() => {
                  playPaperRustle();
                  setCurrentView("daily");
                }}
                onQuickAdd={() => setIsQuickAddOpen(true)}
              />
            </motion.div>
          )}

          {/* 2. Tüm Notlar */}
          {currentView === "collections" && (
            <motion.div
              key="collections"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <CollectionsView />
            </motion.div>
          )}

          {/* 3. Günlük Notlar ve Görevler */}
          {currentView === "daily" && (
            <motion.div
              key="daily"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <DailyNotesView onOpenJournal={() => setCurrentView("journal")} />
            </motion.div>
          )}

          {currentView === "journal" && (
            <motion.div
              key="journal"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <JournalView
                initialDateKey={crossLinkDateKey}
                onConsumedDateKey={() => setCrossLinkDateKey(null)}
                onAwardXp={(xpAmount) => {
                  try { engagement.addXp(xpAmount); } catch {}
                  void (xpAmount); // v-fix(H7): cift kutlama onlendi (XpToast tek kaynak)
                  try { playSuccessSound(); } catch {}
                }}
              />
            </motion.div>
          )}

          {/* 4. İş ve Projeler */}
          {currentView === "work" && (
            <motion.div
              key="work"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <WorkProjectsView />
            </motion.div>
          )}

          {/* 5. Takvim ve Ajanda */}
          {currentView === "calendar" && (
            <motion.div
              key="calendar"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <CalendarAgendaView
                onOpenJournal={(dateKey) => {
                  setCrossLinkDateKey(dateKey);
                  setCurrentView("journal");
                }}
              />
            </motion.div>
          )}

          {/* 6. Sınıflandırılmış Notlar */}
          {currentView === "notes" && (
            <motion.div
              key="notes"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <NotesView
                onSendToJournal={(title, content) => {
                  // Notu günlüğe taşı: metni tek kullanımlık istem tohumu olarak sakla.
                  try {
                    sessionStorage.setItem("yourbook_journal_seed_v1", JSON.stringify({ title: title || content.slice(0, 60), dateKey: null, fromNote: true }));
                  } catch {
                    /* yoksay */
                  }
                  setCrossLinkDateKey(null);
                  setCurrentView("journal");
                }}
              />
            </motion.div>
          )}

          {/* 7. Çalışma Masaları (🇩🇪 Almanca Masası & 🇬🇧 İngilizce Masası) */}
          {currentView === "cards" && (
            <motion.div
              key={`cards-${activeSpace.id}`}
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <ErrorBoundary>
                <StudyDesk
                  theme={theme}
                  space={activeSpace}
                  cards={spaceCards}
                  onLearn={(cardId) => {
                    markAsLearned(cardId);
                    engagement.recordAnswer();
                    engagement.recordMastered();
                  }}
                  // MADDE 5: hatirlayamadim -> kart kuyrugun SONUNA tasinir
                  // (ayni oturumda birkac kart sonra tekrar gelir), SAYAC DUSMEZ.
                  onForgot={(cardId) => {
                    reviewAgain(cardId);
                    requeueCard(cardId);
                  }}
                  // MADDE 7: kart duzenle / sil
                  onEditCard={updateCard}
                  onDeleteCard={(cardId) => {
                    // MADDE 2: silme geri ALINABILIR — kart ve KONUMU saklanir.
                    const index = cards.findIndex((c) => c.id === cardId);
                    const deleted = cards[index];
                    deleteCard(cardId);
                    if (deleted) {
                      setUndoToast({
                        id: Date.now(),
                        message: "Silindi · Geri al",
                        onUndo: () => {
                          // Ayni konuma geri koy: useDeck'teki addCard basa ekler,
                          // bu yuzden state'i dogrudan degistiren bir yol kullaniyoruz.
                          restoreCard(deleted, index);
                        },
                      });
                    }
                  }}
                  onUpdateImage={updateCardImage}
                  // MADDE 6: masanin TOPLAM kart sayisi — 'hic kelime yok' ile 'hepsi tamam' ayrilir.
                  deskTotal={spaceAllCards.length}
                  onReset={resetAll}
                  onQuickAdd={() => setIsQuickAddOpen(true)}
                  allCards={spaceAllCards}
                  onReturnToQueue={returnToQueue}
                  onAwardXp={(xpAmount) => {
                    if (xpAmount <= 0) return;
                    // Gerçek sayaç ve kalıcı depolama güncellemesi
                    try {
                      engagement.addXp(xpAmount);
                    } catch (err) {
                      console.error("XP ekleme hatası:", err);
                    }
                    // Uçan XP parçacık animasyonu
                    void (xpAmount); // v-fix(H7): cift kutlama onlendi (XpToast tek kaynak)
                    // Güvenli ses çalma (başarısız olsa bile XP state'i asla etkilenmez)
                    try {
                      playSuccessSound();
                    } catch {}
                  }}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* 8. YouTube Video ve Ders Arşivi */}
          {currentView === "youtube" && (
            <motion.div
              key="youtube"
              {...PAGE_MOTION}
              className="relative w-full min-h-full overflow-x-hidden lg:absolute lg:inset-0 lg:h-full lg:w-full lg:overflow-y-auto"
            >
              <YouTubeLinksView />
            </motion.div>
          )}
        </AnimatePresence>
        </Suspense>
      </main>

      {/* 3. Komut Paleti (Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view, spaceId) => {
          if (spaceId) switchSpace(spaceId);
          setCurrentView(view as NavView);
        }}
        onQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* 4. Hızlı Ekle (Alt + N) */}
      <QuickAdd
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={addCard}
        existingCards={cards.map((c) => ({ id: c.id, lang: c.lang, word: c.word }))}
        defaultLang={
          activeSpace.targetLang ??
          (activeSpace.id === "space-work" || activeSpace.id === "space-personal" ? "Memo" : "DE")
        }
      />

      {/* 6. XP / Seviye Kutlama Toast'u + Süzülen +XP etiketi + Konfeti */}
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      {/* v-fix(H7): FloatingXp kaldirildi - tek kutlama XpToast */}
      <Confetti trigger={confettiTrigger} particleCount={40} />

      {/* 5. Gerçek Zamanlı Alarm Uyarısı */}
      <AlarmAlert
        note={ringingAlarmNote}
        onDismiss={dismissAlarm}
        onSnooze={snoozeAlarm}
        onOpenJournal={(title, dateKey) => {
          // Hatırlatıcıyı günlüğe taşı: günlüğü o güne aç ve metni istem olarak sakla.
          try {
            sessionStorage.setItem("yourbook_journal_seed_v1", JSON.stringify({ title, dateKey }));
          } catch {
            /* yoksay */
          }
          setCrossLinkDateKey(dateKey);
          setCurrentView("journal");
        }}
      />

      {/* ⭐ Defterimi Özelleştir Modalı (Sol menü ve global erişim) */}
      <NotebookCustomizeModal
        isOpen={isSidebarCustomizeOpen}
        onClose={() => setIsSidebarCustomizeOpen(false)}
        onConfigChange={() => window.dispatchEvent(new Event("notebook-config-changed"))}
      />

      {/* ⭐ 7. Kullanıcı Giriş & Profil Modalı (Vintage Kimlik Kartı) */}
      {showOnboarding && <OnboardingFlow displayName={currentUser?.displayName} onDone={() => setShowOnboarding(false)} />}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        migrationNotice={migrationNotice}
        onMigrationSeen={() => setMigrationNotice(null)}
      />

      {/* ⭐ PWA UYGULAMAYI YÜKLE MODALI (Desktop/Android/iOS Standalone) */}
      <InstallPwaModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        canInstall={pwa.canInstall}
        isInstalled={pwa.isInstalled}
        isIOS={pwa.isIOS}
        onTriggerInstall={pwa.triggerInstall}
      />

      {/* ⭐ 8. Mobil Alt Gezinme Çubuğu (< md Ekranlar: Cep Telefonu ve Tablet) */}
      <MobileBottomNav
        currentView={currentView}
        onSelectView={handleSelectView}
      />

      {/* MADDE 2: silme geri alma bildirimi (5 sn) — kelime kartlari */}
      <UndoToast toast={undoToast} onDone={() => setUndoToast(null)} />

    </div>
  );
}
