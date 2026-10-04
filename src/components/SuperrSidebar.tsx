import {
  SketchJournalPen,
  SketchPalette,
  SketchTranslate,
  SketchDocument,
} from "./icons/sketchIcons";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { spaceTopicIcon, DBook as BookOpen, DBriefcase as Briefcase, DCalendar as Calendar, DCalendarDays as CalendarDays, DDownload as Download, DFolder as FolderKanban, DLayers as Layers, DNote as StickyNote, DPlus as Plus, DSearch as Search, DTopicEnglish, DTopicGerman, DUser as User, DVideo as VideoIcon, DVolume as Volume2, DVolumeMute as VolumeX, DX as X, DChevronRight } from "./icons/doodle";
import { playPopSound } from "../lib/sound";
import type { CraftSpace } from "../lib/spaces";
import { LANGUAGES, getLanguageByCode } from "../lib/languages";
import { useSidebarVisibility } from "../lib/useSidebarVisibility";
import { useT } from "../i18n/I18nProvider";
import { UI_LANGUAGES } from "../i18n";
import type { LanguageDef } from "../lib/types";
import type { SuperrTheme } from "../lib/themes";
import type { AppUser } from "../lib/supabase";
import { StreakFlame } from "./EngagementSystem";

/** Genişlik sınırları — sürükleme bu aralıkta çalışır. */
const SIDEBAR_MIN_W = 180;
const SIDEBAR_MAX_W = 460;
const SIDEBAR_DEFAULT_W = 280;
/** Çok daralınca otomatik yapışılacak ikon-modu genişliği. */
const SIDEBAR_RAIL_W = 72;
const SIDEBAR_RAIL_SNAP = 180;


/* --- Organik / Sketchy El Çizimi Tema Piktogramları --- */
function ThemeDoodleIcon({ themeId, size = 15 }: { themeId: string; size?: number }) {
  if (themeId === "theme-cream") {
    // Krem portakal / narenciye
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"
        data-lovable-target="superr-sidebar"
        data-lovable-name="Navigasyon: Sol Kenar Çubuğu"
        data-lovable-file="src/components/SuperrSidebar.tsx"
        data-lovable-desc="Sol menü; bölümler, dil seçici, kullanıcı"
      >
        <circle cx="12" cy="13.5" r="7.5" />
        <path d="M12 6V3.2" />
        <path d="M12 4.2c2.5-1.5 5 0 5 2.5-2.5 0-4-1.2-5-2.5Z" fill="currentColor" fillOpacity={0.25} />
        {/* Narenciye doku benekleri */}
        <circle cx="10" cy="13" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="14" cy="14" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (themeId === "theme-mint") {
    // Taze nane yaprağı dalı
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <path d="M5 20c4.5-2 8.5-5.5 9.5-13.5-5.5.9-9 4.5-11 9.5" />
        <path d="M7.5 15c2.5-2.5 6-4.5 10.5-4.5-.9 4.5-2.8 8-5.5 10.5" />
        <path d="M5 20l4-4" />
      </svg>
    );
  }
  if (themeId === "theme-ocean") {
    // Okyanus dalgaları
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <path d="M2.5 10c2.3-2 4.6-2 6.8 0s4.4 2 6.8 0 4.4-2 5.6 0" />
        <path d="M2.5 15c2.3-2 4.6-2 6.8 0s4.4 2 6.8 0 4.4-2 5.6 0" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M19.5 13A8 8 0 1 1 11 4.5a6.5 6.5 0 0 0 8.5 8.5Z" />
      <path d="M18 5l.8 1.5L20.5 7l-1.7.5L18 9l-.5-1.5L16 7l1.5-.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Organik el çizimi renk damlası */
function SketchyColorDot({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
      <path
        d="M10 2.2 C 14.5 2.5, 17.8 5.6, 17.5 10.1 C 17.2 14.4, 14.1 17.6, 9.8 17.3 C 5.3 17, 2.3 13.9, 2.6 9.4 C 2.9 5, 5.7 2, 10 2.2 Z"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* İnce beyaz ışıltı yansıması */}
      <path d="M7 6.5 C 8.5 5.5, 11 5.5, 12.5 6.2" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}

/* Organik el çizimi onay tiki rozeti */
function SketchyCheck({ color = "var(--app-bg)" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M4 10.5l4.5 4.5 8-10" />
    </svg>
  );
}

/* Organik el çizimi defter logosu — rozet ikonlarıyla aynı sketch dilinde */
function SketchyLogo({ size = 40 }: { size?: number }) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--accent)] border border-[var(--line-strong)] shadow-sm flex-shrink-0 rotate-[-2deg]">
      <svg
        width="27"
        height="27"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--app-bg)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <filter id="sideLogoWobble" x="-18%" y="-18%" width="136%" height="136%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={4} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#sideLogoWobble)">
          {/* Sol sayfa — yamuk, titrek kontur */}
          <path d="M19.4 10.6c-3.4-1.8-7-2.4-10.5-2-1 .1-1.5.6-1.5 1.7v17.4c0 1 .5 1.4 1.6 1.4 3.3-.2 6.9.4 9.9 2" />
          {/* Sağ sayfa — asimetrik */}
          <path d="M20.6 10.8c3.3-1.9 7-2.5 10.6-2.1 1 .1 1.4.6 1.4 1.6v17.5c0 1-.5 1.4-1.6 1.4-3.3-.2-6.9.5-10 2.1" />
          {/* Orta dikiş — çift titrek çizgi */}
          <path d="M19.9 11.1c.4 6.2.3 12.4-.1 18.6" />
          <path d="M20.5 11.5c-.3 6.1-.2 12.2.1 18.3" opacity="0.4" strokeWidth="1.3" />
          {/* Sayfa satırları — elle çizilmiş, hafif eğri */}
          <path d="M12.3 17.4c1.9-.5 3.9-.5 5.8-.1" strokeWidth="1.5" />
          <path d="M12.5 21.6c1.8-.4 3.7-.4 5.5 0" strokeWidth="1.5" />
          <path d="M22.2 17.6c1.9-.5 3.9-.6 5.8-.3" strokeWidth="1.5" />
          <path d="M22.1 21.8c1.8-.4 3.7-.4 5.4.1" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

/** En son girilen iş/proje notundan tek kelimelik sıcak turuncu etiket çıkarır */
function getLatestWorkWord(): string {
  try {
    const raw = localStorage.getItem("superr_work_section_items_v2");
    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        const latest = items[0];
        if (latest?.title) {
          const words = latest.title.trim().split(/\s+/);
          for (const w of words) {
            const clean = w.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "").toLowerCase();
            if (clean.length >= 3 && clean !== "yeni" && clean !== "bir") {
              return clean.slice(0, 8);
            }
          }
          if (words[0]) {
            return words[0].replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "").toLowerCase().slice(0, 8);
          }
        }
      }
    }
  } catch {}
  return "work";
}

export type NavView = "hero" | "cards" | "notes" | "daily" | "journal" | "collections" | "work" | "calendar" | "youtube";

interface SuperrSidebarProps {
  currentView: NavView;
  onSelectView: (v: NavView) => void;
  activeSpace: CraftSpace;
  onSelectSpace: (spaceId: string) => void;
  theme: SuperrTheme;
  themes: SuperrTheme[];
  onSelectTheme: (themeId: string) => void;
  dueCardsCount: number;
  notesCount: number;
  streak: number;
  level: number;
  levelProgress: number;
  todayXp?: number;
  /** Toplam XP (sidebar gostergesi; istatistik paneliyle AYNI deger). */
  totalXp?: number;
  /** MADDE 4: gunluk hedef yuzdesi (0-100) — XP'den AYRI gosterilir. */
  goalPercent?: number;
  /** MADDE 4: gunluk hedef (XP) — "1716 / 2000 XP" icin. */
  goalXp?: number;
  /** MADDE 4: tekrari bekleyen kart sayisi. */
  dueCards?: number;
  /** MADDE 4: toplam kart sayisi. */
  totalCards?: number;
  /** Aktif DIL masasi sayisi (spaces.ts langDeskCount). SABIT YAZMA. */
  langDeskCount?: number;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenCommandPalette: () => void;
  onQuickAdd: () => void;
  currentUser?: AppUser | null;
  onOpenAuth?: () => void;
  onOpenCustomize?: () => void;
  onOpenInstall?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
  /** Tüm masalar (sabit + dil masaları) — dil masaları buradan listelenir. */
  spaces?: CraftSpace[];
  /** Verilen dil kodunda masa aç / varsa ona geç. */
  onCreateLanguageDesk?: (code: string) => void;
  /** Verilen dil kodunda masa zaten var mı? */
  languageSpaceExists?: (code: string) => boolean;
}

const SPRING_PILL = {
  type: "spring",
  stiffness: 800,
  damping: 44,
} as const;

export function SuperrSidebar({
  currentView,
  onSelectView,
  activeSpace,
  onSelectSpace,
  theme,
  themes,
  onSelectTheme,
  dueCardsCount,
  notesCount,
  streak,
  level,
  levelProgress,
  todayXp,
  totalXp,
  goalPercent,
  goalXp,
  dueCards,
  totalCards,
  langDeskCount,
  isMuted,
  onToggleSound,
  onOpenCommandPalette,
  onQuickAdd,
  currentUser,
  onOpenAuth,
  onOpenCustomize,
  onOpenInstall,
  isMobileDrawer,
  onCloseMobileDrawer,
  spaces = [],
  onCreateLanguageDesk,
  languageSpaceExists,
}: SuperrSidebarProps) {
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  // Sol menude TUM dil masalari TEK satirda toplanir (6+ dil icin olceklenir).
  // Varsayilan: KAPALI (sol menu kisa kalsin). Kullanici acarsa tercihi hatirlanir.
  const [isDesksOpen, setIsDesksOpen] = useState<boolean>(() => {
    return localStorage.getItem("yourbook_desks_group_open_v1") === "1";
  });
  useEffect(() => {
    try { localStorage.setItem("yourbook_desks_group_open_v1", isDesksOpen ? "1" : "0"); } catch {}
  }, [isDesksOpen]);
  // Dil masası açıldığında önerilecek arayüz dili (varsa).
  const [isUiLangPickerOpen, setIsUiLangPickerOpen] = useState(false);
  const { t, lang: uiLang, setLanguage } = useT();

  // Sidebar'da listelenen dil masaları: hook'tan gelen tüm masalardan,
  // dile bağlı olanlar (Almanca/İngilizce + kullanıcının açtığı diller).
  const languageSpaces: CraftSpace[] = spaces.filter(
    (s) => Boolean(s.languageCode) || s.id === "space-de" || s.id === "space-en"
  );

  const ICON_BY_LANG: Record<string, "german" | "english" | "generic"> = {
    de: "german",
    en: "english",
  };

  const LEGACY_LANGUAGE_SPACES = ([
    {
      id: "space-de",
      nameKey: "desk.de",
      badgeKey: "desk.de_badge",
      name: "Almanca Masası",
      icon: "",
      badge: "A1-B2 SRS",
    },
    {
      id: "space-en",
      nameKey: "desk.en",
      badgeKey: "desk.en_badge",
      name: "İngilizce Masası",
      icon: "",
      badge: "B2-C2 SRS",
    },
  ] as unknown as CraftSpace[]);

  const [latestWorkWord, setLatestWorkWord] = useState<string>(getLatestWorkWord);


  const { isHidden, toggle: toggleSidebar } = useSidebarVisibility();
  // Boylece panel DISINDAKI buton ile Ctrl+B hicbir zaman celismez.
  // Gizli/gorunur durumu App.tsx ile AYNI kaynaktan gelir (useSidebarVisibility).
  // ⭐ AYARLANABİLİR / GENİŞLETİLEBİLİR DİKEY PANEL (260px - 420px arası serbestçe çekilebilir)

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("yourbook_sidebar_width_v2");
      if (saved) {
        const w = parseInt(saved, 10);
        if (w >= SIDEBAR_MIN_W && w <= SIDEBAR_MAX_W) return w;
      }
    } catch {}
    return SIDEBAR_DEFAULT_W;
  });
  // Klavye kısayolu: Ctrl/Cmd + B ile paneli gizle/göster.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const t = e.target as HTMLElement | null;
        const tag = (t?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);


  useEffect(() => {
    setLatestWorkWord(getLatestWorkWord());
    const updateWord = () => setLatestWorkWord(getLatestWorkWord());
    window.addEventListener("storage", updateWord);
    window.addEventListener("yourbook_data_synced", updateWord);
    return () => {
      window.removeEventListener("storage", updateWord);
      window.removeEventListener("yourbook_data_synced", updateWord);
    };
  }, [currentView]);

  return (
    <aside
      data-sidebar-root="1"
      data-sidebar-hidden={isHidden ? "1" : "0"}
      style={{
        backgroundColor: theme.sidebarBg,
        width: isMobileDrawer ? undefined : `${isHidden ? 0 : sidebarWidth}px`,
        // Gizle/göster yumuşak animasyonlu olsun.
        transition:
          "width 260ms cubic-bezier(0.22,1,0.36,1), transform 260ms cubic-bezier(0.22,1,0.36,1)",
        transform: isHidden ? `translateX(-${sidebarWidth}px)` : "translateX(0)",
        overflow: "hidden",
      }}
      className={`relative z-20 flex h-full ${
        isMobileDrawer ? "w-[285px]" : ""
      } flex-col border-r border-[var(--line)] text-[var(--ink)] select-none flex-shrink-0`}
    >
      {/* Gizle/göster butonu artık App.tsx içinde, panelin DIŞINDA durur (SidebarToggle). */}
      {/* 1. yourbook Markası & Hızlı Ekle (Taktil Yaylar) */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--app-bg)]">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          role="button"
          tabIndex={0}
          aria-label={t("sidebar.item.study_desk")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectView("hero");
            }
          }}
          data-lovable-target="sidebar-hero"
          data-lovable-name="Menü: Ana Ekran"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="ana ekran / çalışma masası"
          data-nav="hero" onClick={() => {
            playPopSound();
            onSelectView("hero");
          }}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          {/* Organik El Çizimi Defter Logosu */}
          <SketchyLogo size={34} />

          <div className="flex flex-col">
            {/* Marka: LTR icerik -> RTL sayfada bidi izolasyonu sart (yoksa "bookyour" olur) */}
            <span dir="ltr" className="flex items-baseline">
             <span className="font-gelica text-[21px] font-semibold text-[var(--ink)] leading-none tracking-tight">your</span>
             <span className="font-gelica text-[21px] font-semibold text-[var(--accent)] leading-none tracking-tight">book</span>
            </span>
          </div>
        </motion.div>

        {/* Takvim ve Ajandayı Açan + Butonu (Eskisi gibi tam yuvarlak) */}
        <div className="flex items-center gap-0.5 flex-shrink-0">

          <motion.button
            whileHover={{ scale: 1.10 }}
            whileTap={{ scale: 0.90 }}
            onClick={() => {
              playPopSound();
              onSelectView("calendar");
              if (isMobileDrawer) onCloseMobileDrawer?.();
            }}
            title={t("tip.open_agenda")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--app-bg)] border border-[var(--line)] hover:[background-color:var(--accent)] transition-colors shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
          </motion.button>

          {isMobileDrawer && (
            <button
              onClick={() => {
                playPopSound();
                onCloseMobileDrawer?.();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] hover:bg-black/5"
              title={t("act.close")}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ⭐ KULLANICI KİMLİK / BULUT SENKRONİZASYON KARTI */}
      <div className="px-3 pt-1 pb-1">
        <motion.button
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            playPopSound();
            onOpenAuth?.();
            if (isMobileDrawer) onCloseMobileDrawer?.();
          }}
          className="flex items-center justify-between w-full px-3 py-2 rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] hover:border-[var(--accent)] transition-colors text-start shadow-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg border border-[var(--line-strong)] bg-[var(--accent)] text-white flex items-center justify-center font-gelica text-xs font-bold flex-shrink-0 shadow-xs">
              {currentUser ? currentUser.avatarLetter : <User size={13} />}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-geist text-[13px] font-semibold text-[var(--ink)] truncate leading-tight">
                {currentUser ? currentUser.displayName : t("auth.sign_in_up")}
              </span>
              <span className="font-geist text-[9.5px] text-[var(--ink-soft)] flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentUser?.isCloud ? "bg-[#22c55e]" : "bg-[var(--accent)]"}`} />
                <span className="truncate">
                  {currentUser?.isCloud ? t("auth.cloud") : currentUser ? t("auth.local") : t("auth.device")}
                </span>
              </span>
            </div>
          </div>
          <span className="font-mono text-[9px] text-[var(--accent)] font-bold px-1.5 py-0.5 rounded-[4px] bg-[var(--paper)] border border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)]">
            {currentUser ? t("sidebar.profile.badge_identity") : t("sidebar.profile.badge_login")}
          </span>
        </motion.button>
      </div>

      {/* 2. Komut Paleti & Arama (Turuncu Defter Bandı) */}
      <div className="p-3 border-b border-[var(--line)] bg-[var(--accent)] shadow-xs">
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenCommandPalette}
          className="flex w-full items-center justify-between rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-3.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--paper)] transition-all shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-2.5">
            <Search size={14} className="text-[var(--accent)]" />
            <span className="font-geist text-xs font-semibold text-[var(--ink)]">{t("sidebar.search_ph")}</span>
          </div>
          <span className="font-mono text-[10px] font-bold text-[var(--accent)] bg-[var(--app-bg)] border border-[var(--line)] px-1.5 py-0.5 rounded-[6px]">
            ⌘K
          </span>
        </motion.button>
      </div>

      {/* 3. DEFTER BÖLÜMLERİ (⭐ EMIL KOWALSKI FLOATING PILL INDICATOR) */}
      <div className="relative z-0 flex-1 overflow-y-auto px-3.5 pt-[9px] pb-6 space-y-[3px] scrollbar-none">
        <div className="pb-0">
        <span className="font-geist text-[11px] uppercase tracking-[0.08em] text-[var(--ink-soft)] block px-2 mb-1.5 font-semibold">
            {t("sidebar.sections")}
        </span>
        </div>

        {/* 1. Giriş ve Defter */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            playPopSound();
            onSelectView("hero");
          }}
          className={`relative flex w-full items-center justify-between rounded-[20px] px-2.5 py-1.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "hero" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "hero" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex min-w-0 items-center gap-2.5 flex-1">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <BookOpen size={17} />
            </span>
            <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.cover")}</span>
          </div>
          <span className="font-handwritten text-[13px] text-[var(--accent)] font-bold"></span>
        </motion.button>

        {/* 2. Tüm Notlar */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-collections"
          data-lovable-name="Menü: Koleksiyonlar"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="not koleksiyonları"
          data-nav="collections" onClick={() => {
            playPopSound();
            onSelectView("collections");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "collections" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "collections" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <FolderKanban size={17} />
            </span>
            <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.archive")}</span>
          </div>
          <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-[var(--app-bg)]">{notesCount}</span>
        </motion.button>

        {/* 3. Günlük Notlar ve Görevler */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-daily"
          data-lovable-name="Menü: Günlük Notlar & Görevler"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="günlük not ve görev listesi"
          data-nav="daily" onClick={() => {
            playPopSound();
            onSelectView("daily");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "daily" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "daily" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <CalendarDays size={17} />
            </span>
            <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.journal")}</span>
          </div>
            <span className="font-handwritten text-[var(--accent)] text-[11px] flex-shrink-0 ms-auto ps-1">{t("time.today")}</span>
        </motion.button>

        {/* 3.1 Sevgili Günlük (Kişisel Günlük Tutma & İç Dökme) */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-journal"
          data-lovable-name="Menü: Sevgili Günlük"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="kişisel günlük / iç dökme"
          data-nav="journal" onClick={() => {
            playPopSound();
            onSelectView("journal");
          }}
          className={`hidden relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "journal" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "journal" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] shrink-0 items-center justify-center"><SketchJournalPen size={15} className="shrink-0 text-current" strokeWidth={1.8} /></span>
            <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.dear_journal")}</span>
          </div>
          <span className="font-handwritten text-[var(--accent)] text-[11px] flex-shrink-0 ms-auto ps-1">{t("sidebar.item.unload")}</span>
        </motion.button>

        {/* 3.2 Notlar (Sınıflandırılmış Notlar) */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-notes"
          data-lovable-name="Menü: Tüm Notlar"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="tüm notlar"
          data-nav="notes" onClick={() => {
            playPopSound();
            onSelectView("notes");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition border-[var(--ink)] z-10 ${
            currentView === "notes" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000]"
          }`}
        >
          {currentView === "notes" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border-[var(--ink)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] shrink-0 items-center justify-center"><SketchDocument size={15} className="shrink-0 text-current" strokeWidth={1.8} /></span>
            <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.notes")}</span>
          </div>
          <span className="font-handwritten text-[var(--accent)] text-[11px] flex-shrink-0 ms-auto ps-1">
            {t("sidebar.item.notes_short")}
          </span>
        </motion.button>

        {/* 4. İş ve Projeler */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-work"
          data-lovable-name="Menü: İş & Projeler"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="iş ve proje takibi"
          data-nav="work" onClick={() => {
            playPopSound();
            onSelectView("work");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "work" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "work" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <Briefcase size={17} />
            </span>
            <span className="text-[13px] whitespace-nowrap">{t("work.title")}</span>
          </div>
          {/* ⭐ En Son Notu Anlatan Turuncu El Yazısı Etiket */}
          <span className="font-handwritten text-[var(--accent)] text-[12px] flex-shrink-0 ms-auto ps-1 font-bold">
            {uiLang === "tr" && latestWorkWord !== "work" ? latestWorkWord : t("sidebar.work_badge")}
          </span>
        </motion.button>

        {/* 5. Takvim ve Ajanda */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-calendar"
          data-lovable-name="Menü: Takvim & Ajanda"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="takvim ve ajanda"
          data-nav="calendar" onClick={() => {
            playPopSound();
            onSelectView("calendar");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "calendar" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "calendar" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <Calendar size={17} />
            </span>
              <span className="text-[13px] whitespace-nowrap">{t("sidebar.item.agenda")}</span>
          </div>
          <span className="font-handwritten text-[var(--accent)] text-[12px] flex-shrink-0 ms-auto ps-1 font-bold">
            {t("sidebar.item.agenda_short")}
          </span>
        </motion.button>
        {/* 4. ÇALIŞMA MASALARI — TEK giriş noktası (6+ dil için ölçeklenir) */}
        <motion.button
          type="button"
          onClick={() => { playPopSound(); setIsDesksOpen((v) => !v); }}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.97 }}
          aria-expanded={isDesksOpen}
          className="relative flex w-full items-center gap-2 rounded-[20px] px-3.5 py-2 text-[13px] font-geist font-medium text-[var(--ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
        >
         <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
            <motion.span animate={{ rotate: isDesksOpen ? 90 : 0 }} transition={SPRING_PILL} className="flex">
              <DChevronRight size={14} className="text-current" />
            </motion.span>
         </span>
         <span className="font-geist font-medium text-[13px] leading-tight">{t("sidebar.desks_group")}</span>
         <span className="font-handwritten text-[10px] text-[var(--accent)] ms-auto ps-1 flex-shrink-0">
            {t("hero.n_lang_desks").replace("{n}", String(LANGUAGES.length))}
         </span>
        </motion.button>

        {isDesksOpen &&
            (languageSpaces.length > 0 ? languageSpaces : LEGACY_LANGUAGE_SPACES).map((space) => {
          const isSelected = activeSpace.id === space.id && currentView === "cards";
          const langCode =
            space.languageCode ??
            (space.id === "space-de" ? "de" : space.id === "space-en" ? "en" : null);
          return (
            <motion.button
              data-lovable-target="sidebar-cards"
              data-lovable-name="Menü: Kelime Kartları"
              data-lovable-file="src/components/SuperrSidebar.tsx"
              data-lovable-desc="kelime kartları ve çalışma"
              data-nav="cards"
              data-space={space.id}
              aria-label={t("desk.open_aria")}
              key={space.id}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playPopSound();
                onSelectSpace(space.id);
                onSelectView("cards");
              }}
              className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
                isSelected ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="sidebar-view-indicator"
                  transition={SPRING_PILL}
                  className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
                />
              )}
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className={"craft-cover-strip " + (space.coverClass || "")} />
                <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
                  {(() => {
                    const LangIcon = spaceTopicIcon(langCode || space.targetLang);
                    return <LangIcon size={17} className="text-current" />;
                  })()}
                </span>
                <span className="whitespace-nowrap font-geist font-medium text-[13px] leading-none">{space.nameKey ? t(space.nameKey) : space.name}</span>
              </div>
              <span className="ms-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-[var(--app-bg)]">
{space.badgeKey ? t(space.badgeKey) : space.badge}
              </span>
            </motion.button>
          );
        })}

        {/* + YENİ ÇALIŞMA MASASI — mevcut "+" düğmesinden ayrı, dil seçimli akış */}
        {false && onCreateLanguageDesk && (
          <motion.button
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              playPopSound();
              setIsLanguagePickerOpen(true);
            }}
            title={t("tip.new_desk")}
            className="relative flex h-8 w-full min-w-0 items-center gap-2.5 rounded-[20px] box-border border-[1.5px] border-dashed border-[var(--line-strong)] px-3.5 py-1 text-[13px] font-geist font-medium text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors"
          >
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <Plus size={14} className="text-current" />
            </span>
            <span className="font-geist font-medium text-[13px]">{t("sidebar.desk.new")}</span>
          </motion.button>
        )}

        {/* YouTube Arşivi (Floating Pill) */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.96 }}
          data-lovable-target="sidebar-youtube"
          data-lovable-name="Menü: YouTube Bağlantıları"
          data-lovable-file="src/components/SuperrSidebar.tsx"
          data-lovable-desc="kaydedilmiş videolar"
          data-nav="youtube" onClick={() => {
            playPopSound();
            onSelectView("youtube");
          }}
          className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
            currentView === "youtube" ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
          }`}
        >
          {currentView === "youtube" && (
            <motion.div
              layoutId="sidebar-view-indicator"
              transition={SPRING_PILL}
              className="absolute inset-0 rounded-[20px] bg-[var(--ink)] -z-10 border border-[var(--line)] shadow-sm"
            />
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[22px] flex-shrink-0 items-center justify-center">
              <VideoIcon size={17} className="text-current" />
            </span>
            <span className="font-geist font-medium text-[13px]">{t("sidebar.youtube")}</span>
          </div>
          <span className="font-handwritten text-[11px] text-[var(--accent)]">
              0
          </span>
        </motion.button>

        {/* 5. TEMALAR (⭐ EMIL KOWALSKI FLOATING PILL INDICATOR) */}
        <div className="pb-0">
          <span className="font-geist text-[11px] uppercase tracking-[0.08em] text-[var(--ink-soft)] block px-2 mb-1.5 font-semibold">
            {t("sidebar.themes")}
          </span>
        </div>

        {themes.map((th) => {
          const isSelected = theme.id === th.id;
          return (
            <motion.button
              key={th.id}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playPopSound();
                onSelectTheme(th.id);
              }}
              title={t(th.descKey)}
              className={`relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium transition-colors z-10 ${
                isSelected ? "text-[var(--app-bg)]" : "text-[var(--ink)] hover:text-[#000000]"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="sidebar-theme-indicator"
                  transition={SPRING_PILL}
                  className="absolute inset-0 rounded-[20px] -z-10 border border-[var(--line)] shadow-sm"
                  style={{ backgroundColor: th.accent }}
                />
              )}
              <div className="flex items-center gap-2.5">
                <span className="w-5 flex items-center justify-center flex-shrink-0">
                  <ThemeDoodleIcon themeId={th.id} size={15} />
                </span>
                <span className="font-geist font-medium whitespace-nowrap text-[13px]">{t(th.nameKey)}</span>
              </div>
              {isSelected ? (
                <SketchyCheck color="var(--app-bg)" />
              ) : (
                <SketchyColorDot color={th.accent} />
              )}
            </motion.button>
          );
        })}

        {/* ARAYÜZ DİLİ — tema seçiciyle aynı görsel dilde, kullanıcı profili alanına yakın */}
                {/* ARAYÜZ DİLİ ÖNERİSİ — yeni açılan masa ile eşleşen arayüz dili varsa */}

<div className="pb-0">
          <span className="font-geist text-[11px] uppercase tracking-[0.08em] text-[var(--ink-soft)] block px-2 mb-1.5 font-semibold">
            {t("ui_language.title")}
          </span>
        </div>

        <div className="relative">
          <motion.button
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              playPopSound();
              setIsUiLangPickerOpen((v) => !v);
            }}
            title={t("ui_language.tip")}
            className="relative flex h-8 w-full items-center justify-between rounded-[20px] px-3.5 text-[13px] font-geist font-medium text-[var(--ink)] hover:text-[#000] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 flex items-center justify-center flex-shrink-0">
                <SketchTranslate size={15} />
              </span>
              <span className="font-geist font-medium whitespace-nowrap text-[13px]">
                {(UI_LANGUAGES.find((l) => l.code === uiLang) || UI_LANGUAGES[0]).label}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase text-[var(--ink-soft)]">
              {(UI_LANGUAGES.find((l) => l.code === uiLang) || UI_LANGUAGES[0]).flag}
            </span>
          </motion.button>

          {/* v-perf: AnimatePresence KALDIRILDI - exit animasyonu yok, kapanma anlik. */}
            {isUiLangPickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                /* v-perf: exit KALDIRILDI - secim sonrasi kapanma ANLIK olsun (200ms bekleme yok) */
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="mt-1 flex flex-col gap-1 overflow-hidden"
              >
                {UI_LANGUAGES.map((l) => {
                  const active = l.code === uiLang;
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        playPopSound();
                        setLanguage(l.code);
                        setIsUiLangPickerOpen(false);
                      }}
                      className={`flex items-center justify-between rounded-[16px] px-3 py-1 text-[11px] font-gelica font-semibold transition-colors ${
                        active
                          ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                          : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] leading-none">{l.flag}</span>
                        <span>{l.label}</span>
                      </span>
                      {active && <SketchyCheck color="var(--accent)" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
        </div>

        {/* Defteri Özelleştir (Kağıt Dokusu & El Yazısı) */}
        {onOpenCustomize && (
          <button
            onClick={() => {
              playPopSound();
              onOpenCustomize();
            }}
            className="flex w-full items-center justify-between rounded-[20px] box-border border-[1.5px] border-dashed border-[var(--line-strong)] bg-transparent px-3 py-1.5 font-gelica text-[11px] font-semibold text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <SketchPalette size={14} className="shrink-0 text-current" strokeWidth={1.8} />
              <span>{t("sidebar.customize.paper")}</span>
            </span>
            <span className="text-[9.5px] opacity-75">{t("sidebar.customize.action")}</span>
          </button>
        )}
      </div>

      {/* 4.5. Seri & Seviye Göstergesi */}
      <div className="relative z-20 shrink-0 isolate px-3 pt-1.5 pb-1 bg-[var(--app-bg)] border-t-2 border-dashed border-[var(--border-ink)]">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            {/* v105: seri 0 iken gizle -> '0 XP' ile karismasin */}
            {streak > 0 ? <StreakFlame streak={streak} /> : null}
            {/* MADDE 4: TOPLAM XP / gunluk hedef — "86 / 2000 XP" bicimi.
                Onceden yalnizca totalXp yaziliyordu ve istatistik panelindeki
                "86" (yuzde) ile karisiyordu. Simdi ikisi AYRI gosterilir. */}
            <span className="font-gelica text-xs font-bold text-[var(--accent)]" title={t("tip.total_xp")} data-xp-display="1">
              {totalXp ?? todayXp ?? 0}{" / "}{goalXp ?? 2000}{" XP"}
            </span>
            {/* Gunluk hedef yuzdesi ayri rozet */}
            {goalPercent != null && (
              <span className="font-mono text-[10px] font-bold text-[var(--ink-soft)]" data-goal-percent="1">
                %{goalPercent}
              </span>
            )}
          </div>
          <span className="text-[11px] font-gelica font-semibold text-[var(--ink)]/60">
            {t("xp.level_word")} {level}
          </span>
        </div>
        <div
          id="xp-bar-anchor"
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper)] border-[1.5px] border-[var(--border-ink)]"
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
            animate={{ width: `${Math.min(100, levelProgress * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* 5. Alt Bar: Taktil Ses & Yükle & Marka Kapanışı */}
      <div className="flex items-center justify-between shrink-0 px-3 py-2.5 border-t border-[var(--line)] bg-[var(--app-bg)]">
        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={onToggleSound}
            title={isMuted ? t("tip.unmute") : t("tip.mute")}
            className="flex items-center gap-1.5 rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-2.5 py-1 text-xs text-[var(--ink)] hover:bg-[var(--paper)] transition-colors shadow-superrButton"
          >
            {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} className="text-[var(--accent)]" />}
            <span className="font-gelica text-xs font-semibold">
              {isMuted ? t("sidebar.muted") : t("sidebar.tactile_sound")}
            </span>
          </motion.button>

          {onOpenInstall && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                playPopSound();
                onOpenInstall();
                if (isMobileDrawer) onCloseMobileDrawer?.();
              }}
              title={t("cust.pwa.title")}
              className="flex items-center gap-1 rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--paper)] transition-colors shadow-superrButton"
            >
              <Download size={11} />
              <span className="font-gelica text-[11px] font-bold">{t("act.upload")}</span>
            </motion.button>
          )}
        </div>

        {/* Marka: LTR icerik, RTL sayfada bidi izolasyonu sart (yoksa "bookyour" olur) */}
        <span dir="ltr" className="inline-block font-handwritten text-sm font-bold leading-none">
         <span className="text-[var(--ink)]">your</span><span className="text-[var(--accent)]">book</span>
        </span>
      </div>

      {/* DİL SEÇİCİ — yeni çalışma masası akışı */}
      <AnimatePresence>
        {isLanguagePickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setIsLanguagePickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-superrCard"
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <div>
                  <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
                    {t("sidebar.desk.section")}
                  </span>
                  <h3 className="font-gelica text-lg font-bold text-[var(--ink)]">
                    {t("sidebar.desk.picker.title")}
                  </h3>
                </div>
                <button
                  onClick={() => { playPopSound(); setIsLanguagePickerOpen(false); }}
                  className="p-1 rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {LANGUAGES.map((lang) => {
                  const exists = languageSpaceExists ? languageSpaceExists(lang.code) : false;
                  const alreadyOpen = exists && spaces.some((s) => s.id === `space-${lang.code}`);
                  return (
                    <button
                      key={lang.code}
                      disabled={alreadyOpen}
                      onClick={() => {
                        if (alreadyOpen || !onCreateLanguageDesk) return;
                        playPopSound();
                        onCreateLanguageDesk(lang.code);
                        // Dil masası açıldı: eşleşen arayüz dili VARSA ve
                        // şu anki dilden farklıysa kullanıcıya öner.
                        const uiMatch = UI_LANGUAGES.find((u) => u.code === lang.code);
                        // KALDIRILDI (v71): masa dili ile arayuz dili BAGIMSIZ olmali - oneri yok.
                        setIsLanguagePickerOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-start transition-all ${
                        alreadyOpen
                          ? "cursor-not-allowed border-[color-mix(in_srgb,var(--border-ink)_14%,transparent)] bg-[var(--app-bg)] opacity-45"
                          : "border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--app-bg)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:-translate-y-0.5"
                      }`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[16px] shrink-0">
                        {lang.flag}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-gelica text-sm font-bold text-[var(--ink)]">
                          {t(lang.deskNameKey || lang.deskName)}
                        </span>
                        <span className="block font-gelica text-[11px] text-[var(--ink-soft)] truncate">
                          {t(lang.descriptionKey || lang.description)}
                        </span>
                      </span>
                      <span className="font-gelica text-[10px] font-semibold text-[var(--accent)] shrink-0">
                        {alreadyOpen ? t("common.open_state") : t("common.open")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 font-handwritten text-[11px] text-[var(--ink-soft)] italic text-center">
                {t("sidebar.desk.picker.note")}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </aside>
  );
}
