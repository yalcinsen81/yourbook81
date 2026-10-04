import { SketchGift } from "./icons/sketchIcons";
import { LANGUAGES } from "../lib/languages";
import type * as React from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { DArrowRight as ArrowRight, DBook as BookOpen, DCalendar as Calendar, DFolder, DLayers as Layers, DNote as StickyNote, DSparkles as Sparkles, DTopicEnglish, DTopicGerman } from "./icons/doodle";
import { playPopSound } from "../lib/sound";
import { useEngagement, StreakFlame, type EngagementApi } from "./EngagementSystem";
import { useT } from "../i18n/I18nProvider";
import { Tooltip } from "./Tooltip";
import {
  LightningSticker,
  HeartSticker,
  StarSticker,
  SproutSticker,
  HandDrawnArrow,
  NameLabelSticker,
} from "./SuperrStickers";
import { useState, useEffect } from "react";
import { CoverStickerCluster } from "./CoverStickerCluster";
import { OpeningRitualCard } from "./OpeningRitualCard";
import { GiftNotebookModal } from "./GiftNotebookModal";
import { NotebookCustomizeModal } from "./NotebookCustomizeModal";
import { getCurrentVolume, getOpeningRitualGreeting } from "../lib/notebookConfig";
import VolumeCompleteBanner from "./VolumeCompleteBanner";

interface SuperrHeroProps {
  /** MADDE 4: TEK SAYAC KAYNAGI (App.tsx -> counters). Sabit sayi YAZMA. */
  totalCards?: number;
  dueCards?: number;
  totalNotes?: number;
  xp?: number;
  goalXp?: number;
  goalPercent?: number;
  nextReviewInDays?: number | null;
  onGoToCards: (spaceId?: string) => void;
  onGoToNotes: () => void;
  onGoToDaily: () => void;
  onQuickAdd: () => void;
  engagement?: EngagementApi;
  dueCardsCount?: number;
  spaces?: HeroSpace[];
  onOpenCustomize?: (tab?: 'paper' | 'handwriting' | 'sound' | 'stamp' | 'volumes' | 'ritual') => void;
}

interface HeroSpace {
  id: string;
  name?: string;
  nameKey?: string;
  description?: string;
  descriptionKey?: string;
  languageCode?: string;
  targetLang?: string | null;
}

export function SuperrHero({
  onGoToCards,
  onGoToNotes,
  onGoToDaily,
  onQuickAdd,
  engagement: propEngagement,
  dueCardsCount = 0,
  totalCards = 0,
  dueCards = 0,
  goalXp,
  spaces = [],
  onOpenCustomize,
}: SuperrHeroProps) {
  const hookEngagement = useEngagement();
  const engagement = propEngagement ?? hookEngagement;


  const { t } = useT();

  // v-fix: Kapak kartindaki "ders:" satiri ARTIK SABIT DEGIL (regresyon onlendi).
  // TEK KAYNAK: spaces prop -> languageCode'u olan masalar = dil masalari.
  // v-fix: DIL MASASI sayisi TEK KAYNAKTAN: LANGUAGES (desteklenen hedef diller).
  // Onceden "6" CEVIRI dosyalarina 10 kez kopyalanmisti -> regresyon kaynagi.
  const deskCount = LANGUAGES.length;
  // v-fix(REGRESYON ONLEMI): DIL MASASI sayisi ve adlari TEK KAYNAKTAN gelir.
  // Kaynak: lib/languages.ts -> LANGUAGES (desteklenen hedef diller).
  // Onceden "6" hem koda hem 10 ceviri dosyasina kopyalanmisti;
  // artik yeni dil eklenince her sey OTOMATIK guncellenir.
  const activeDeskSub = useMemo(
    () => LANGUAGES.map((l) => (l.nameKey ? t(l.nameKey) : l.name)).join(" & "),
    [t]
  );
  const activeDeskNames = useMemo(
    () => LANGUAGES.map((l) => (l.nameKey ? t(l.nameKey) : l.name)).filter(Boolean),
    [t]
  );
  const activeDeskLabel = useMemo(() => {
    const tpl = t("hero.n_lang_desks");
    return tpl.includes("{n}") ? tpl.replace("{n}", String(deskCount)) : tpl;
  }, [deskCount, t]);
  // Defter Özelleştirme & Cilt Sistemi State'leri
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [customizeInitialTab, setCustomizeInitialTab] = useState<"paper" | "handwriting" | "sound" | "stamp" | "volumes" | "ritual">("paper");
  const [configRefresh, setConfigRefresh] = useState(0);

  const [currentVolume, setCurrentVolume] = useState<number>(getCurrentVolume);

  useEffect(() => {
    const handleRefresh = () => {
      setCurrentVolume(getCurrentVolume());
    };
    window.addEventListener("notebook-config-changed", handleRefresh);
    return () => window.removeEventListener("notebook-config-changed", handleRefresh);
  }, []);

  const handleOpenCustomize = (tab: "paper" | "handwriting" | "sound" | "stamp" | "volumes" | "ritual" = "paper") => {
    setCustomizeInitialTab(tab);
    setIsCustomizeOpen(true);
  };

  const handleConfigChange = () => {
    setConfigRefresh((r) => r + 1);
    window.dispatchEvent(new Event("notebook-config-changed"));
  };
  const todayXp = engagement.todayXp ?? (engagement.answeredToday * 10 + engagement.masteredToday * 50);
  const goalPct = Math.min(100, Math.round((todayXp / engagement.goal) * 100));

  // ⭐ HAFTALIK RİTİM VE MOTİVASYON GRAFİĞİ (Pzt - Paz)
  const weekDays = useMemo(() => {
    const names = [t("time.mon"), t("time.tue"), t("time.wed"), t("time.thu"), t("time.fri"), t("time.sat"), t("time.sun")];
    const fullNames = [t("time.monday"), t("time.tuesday"), t("time.wednesday"), t("time.thursday"), t("time.friday"), t("time.saturday"), t("time.sunday")];
    const todayJs = new Date().getDay();
    const todayIndex = todayJs === 0 ? 6 : todayJs - 1; // 0=Pzt..6=Paz

    return names.map((name, idx) => {
      const isToday = idx === todayIndex;
      const isPastActive = idx < todayIndex && (todayIndex - idx) < (engagement.streak ?? 1);
      return {
        name,
        fullName: fullNames[idx],
        isToday,
        isPastActive,
      };
    });
  }, [engagement.streak, todayXp, t]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto px-4 sm:px-8 pt-6 sm:pt-[15px] pb-6 sm:pb-10 bg-[var(--app-bg)] text-[var(--ink)] select-none scrollbar-thin">
      {/* Cilt dolduğunda otomatik geçiş önerisi (tercih açıksa) */}
      <VolumeCompleteBanner onVolumeChange={handleConfigChange} />

      {/* 1. Üst Rozet & Dağıtılmış Stickerlar */}
      {/* v-linealign: alt çizgi SOL KENAR ÇUBUĞU çizgisiyle AYNI HİZADA (y=77).
          Ölçüm (önce): sidebar çizgisi y=77, bu başlığın çizgisi y=80 -> 3px fark.
          `pb-6` (24px) -> `pb-[21px]` ile çizgi tam 3px yukarı gelir.
          NOT: Çizginin kalınlığı/rengi bilinçli olarak DEĞİŞTİRİLMEDİ (kullanıcı tercihi). */}
      <div className="relative flex items-center justify-between pb-[21px] border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
        <div className="flex items-center gap-2">
          <span className="font-gelica text-sm text-[var(--accent)] font-semibold">
            yourbook v01.0
          </span>
          <span className="text-[#bebcbb]">/</span>
          <span className="font-geist text-xs text-[var(--ink-soft)]">
            {t("hero.caption")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playPopSound();
              setIsGiftModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[var(--accent)] px-3 py-1 font-gelica text-[14px] font-bold text-white hover:scale-105 transition-transform shadow-2xs"
            title={t("cover.gift.tip")}
          >
            <SketchGift size={15} className="shrink-0 text-white" strokeWidth={1.8} />
            <span>{t("cover.gift")}</span>
          </button>
          <StarSticker />
          <HeartSticker />
        </div>
      </div>

      {/* 2. Hero İki Sütunlu Yerleşim */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Sol Sütun: Lowercase 84px Display Headline & Handwritten Caption */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-start">
          {/* Kişisel Açılış Ritüeli Karşılama Kartı */}
          <div className="w-full max-w-lg mb-2">
            <OpeningRitualCard onOpenSettings={() => handleOpenCustomize("ritual")} />
          </div>
          {/* Handwritten Annotation — görece konteyner: kıvrık ok "defter" kelimesini işaret eder */}
          <div className="relative flex items-center gap-3.5 mb-2">
            <span
              style={{ fontSize: "clamp(30px, 3.4vw, 53px)" }}
              className="font-handwritten text-[var(--accent)] rotate-[-2deg] flex items-center gap-5 leading-none"
            >
              <span>{t("cover.greeting")}</span>
              {/* Gülen yüz + ok = TEK PARÇA: dikey grup, font ne olursa olsun birlikte hareket eder */}
              <span className="inline-flex flex-col items-center leading-none">
              <motion.svg
                initial={{ rotate: 6 }}
                animate={{ rotate: [6, 1, 6] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                width="65"
                height="65"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="inline-block w-[46px] h-[46px] sm:w-[65px] sm:h-[65px] flex-shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)] [filter:saturate(1.15)]"
                style={{ transformOrigin: "50% 60%" }}
              >
                {/* Organik hafif asimetrik kafa dairesi — çift çizgi kalem baskısı */}
                <path d="M12 2.8 C 17.5 2.5, 21.5 6.8, 21.2 12.2 C 20.9 17.6, 17.2 21.5, 11.8 21.2 C 6.4 20.9, 2.5 17.1, 2.8 11.8 C 3.1 6.5, 6.8 3.1, 12 2.8 Z" />
                <path d="M12.3 3.3 C 17.1 3.2, 20.8 7, 20.6 12 C 20.4 16.7, 17 20.6, 12.1 20.5" opacity="0.4" strokeWidth="1.3" />
                {/* Gülen gözler */}
                <path d="M8.2 9.5 C 8.6 8.5, 9.8 8.5, 10.2 9.5" />
                <path d="M13.8 9.5 C 14.2 8.5, 15.4 8.5, 15.8 9.5" />
                {/* Samimi el çizimi tebessüm */}
                <path d="M7.8 13.8 C 9 17.2, 15 17.2, 16.2 13.8" />
                <path d="M8.1 14 C 9.2 16.6, 14.8 16.6, 15.9 14" opacity="0.4" strokeWidth="1.3" />
                {/* Gamzeler */}
                <path d="M6.8 13.2 l 1 1.2" strokeWidth="1.6" />
                <path d="M17.2 13.2 l -1 1.2" strokeWidth="1.6" />
              </motion.svg>
              <HandDrawnArrow
                width={120}
                height={92}
                className="pointer-events-none mt-[-10.3px] hidden sm:block"
              />
              <span className="sm:hidden">
                <HandDrawnArrow
                  width={72}
                  height={55}
                  className="pointer-events-none mt-[-8px]"
                />
              </span>
              </span>
            </span>
          </div>

          {/* Display Headline: Gelica 600, ALL LOWERCASE, Vintage Ink with slight texture feel */}
          <h1
            id="hero-headline"
            className="font-gelica text-[32px] min-[641px]:text-[40px] font-semibold text-[var(--ink)] leading-[1.14] sm:leading-[1.1] tracking-normal text-start"
            style={{
              textShadow: "0.5px 0.5px 1px color-mix(in srgb, var(--ink) 18%, transparent)",
              opacity: 0.94,
              filter: "contrast(96%) sepia(8%)",
            }}>
            {t("cover.tagline.a")}{" "}
            <span id="hero-defter-word" className="marker-highlight">{t("cover.tagline.highlight")}</span>
            {t("cover.tagline.b") ? " " : ""}
            {t("cover.tagline.b")}
            {t("cover.tagline.b") ? " " : ""}
            <span
              className="font-handwritten text-[var(--accent)] text-[1.25em] font-bold lowercase align-baseline inline-block rotate-[-2deg]"
            >
              {t("cover.tagline.c")}
            </span>
            {t("cover.tagline.c") ? " " : ""}
            {t("cover.tagline.d")}
          </h1>

          {/* Cocoa Ink Body Paragraph */}
          
          {/* Kapak: bugün bekleyen tekrar kuyruğu */}
          <div data-hero-review-queue="1" className="mt-5 flex w-full items-center justify-between gap-3 rounded-[14px] border-[1px] border-[var(--ink)] bg-[color-mix(in_srgb,var(--paper)_72%,transparent)] px-3 py-2">
            <span className="min-w-0 truncate font-gelica text-[13px] text-[var(--ink)]">
              {dueCards > 0 ? t("hero.today_due").replace("{n}", String(dueCards)) : t("hero.today_done")}
            </span>
            <button
              type="button"
              onClick={() => {
                playPopSound();
                if (dueCards > 0) onGoToCards();
                else onQuickAdd();
              }}
              className="btn-pill-orange shrink-0 !px-3 !py-1.5 text-xs"
            >
              <span className="font-handwritten text-[17px] font-bold leading-none">
                {dueCards > 0 ? t("hero.start") : t("hero.new_word")}
              </span>
            </button>
          </div>
          {/* Pill Action Button: Cream fill, 1.5px Charcoal border, 20px radius */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                playPopSound();
                onGoToCards("space-de");
              }}
              className="btn-pill-superr text-sm !py-2 !px-5"
            >
              <span className="font-handwritten text-[19px] sm:text-[20px] font-bold tracking-wide leading-none">
                {t("hero.open_work")}
              </span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={() => {
                playPopSound();
                onQuickAdd();
              }}
              className="btn-pill-orange text-sm !py-2 !px-5"
            >
              <span className="font-handwritten text-[19px] sm:text-[20px] font-bold tracking-wide leading-none">
                {t("hero.add_word")}
              </span>
            </button>
          </div>

          {/* Pre-order Info Block */}
          <span className="mt-3 font-gelica text-xs text-[var(--ink-soft)]">
            {t("hero.sub")}
          </span>

        </div>

        {/* Sağ Sütun: Tilted Product Notebook + Name Label Sticker + 2D Sticker Cluster */}
        <div className="lg:col-span-6 xl:col-span-5 relative flex items-center justify-center p-4">
          <div className="relative w-full max-w-[380px] p-6 bg-[var(--paper)] border border-[var(--ink)] rounded-[16px] shadow-superrCard rotate-[2deg] transition-transform hover:rotate-0">
            {/* Üstte Dağılmış Fiziksel Stickerlar */}
            <div className="absolute -top-2 -start-2 z-20">
              <LightningSticker />
            </div>
            <div className="absolute -top-2 -end-1 z-20">
              <SproutSticker />
            </div>

            {/* Gerçek Okul Defteri Etiketi (Name Label Sticker) */}
            <NameLabelSticker
                name={t("hero.notebook_name")}
                volume={currentVolume}
                onClick={() => handleOpenCustomize("volumes")}
                className="w-full mb-3"
                deskSub={activeDeskSub}
                deskNames={activeDeskNames}
              />

            <div className="space-y-3 pt-2">
              {/* 6 Dil Masası — tüm dillerin tek özeti */}
              <div
                onClick={() => {
                  playPopSound();
                  onGoToCards("space-all");
                }}
                className="border p-3.5 bg-[var(--app-bg)] border-[var(--ink)] rounded-[10px] cursor-pointer hover:border-[var(--accent)] hover:shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between font-gelica text-xs text-[var(--ink)] font-semibold pb-1">
                  <div className="flex items-center gap-1.5">
                    <DTopicGerman size={15} className="text-[var(--accent)]" />
                    <span>{activeDeskLabel}</span>
                  </div>
                  <span className="font-handwritten text-[var(--accent)] text-sm">
                    {/* MADDE 5: TEK KAYNAK — "hazir" da "bekliyor" da AYNI sayiyi gosterir
                    (bugun tekrari gelen kart sayisi = dueCards). */}
                    {t("hero.words_ready_n").replace("{n}", String(dueCards))}
                  </span>
                </div>
                <p className="font-geist text-xs text-[var(--ink-soft)]">
                  {t("hero.desks_desc")}
                </p>
              </div>
            </div>

            {/* Günlük Hedef ve Seviye İlerlemesi (Engagement) */}
            <div className="mt-4 pt-3 border-t border-dashed border-[color-mix(in_srgb,var(--border-ink)_30%,transparent)]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-gelica text-xs font-semibold text-[var(--ink)]">
                    {t("xp.daily_goal")}
                  </span>
                  <Tooltip
                    label={t("hero.daily_goal_hint")}
                    side="top"
                    maxWidth={220}
                  >
                    <span className="cursor-help inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--ink-soft)] text-[9px] font-mono font-bold text-[var(--ink-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
                      i
                    </span>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <StreakFlame streak={engagement.streak} />
                  <span className="font-gelica text-[11px] font-semibold text-[var(--ink-soft)]">
                    {engagement.xp ?? 0} / {goalXp ?? engagement.goal} XP
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[var(--app-bg)] border border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalPct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-handwritten text-sm text-[var(--accent)]">
                    {t("xp.level_word")} {engagement.level}
                  </span>
                  <Tooltip
                    label={t("hero.total_xp_hint")}
                    side="top"
                    maxWidth={220}
                  >
                    <span className="cursor-help inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--ink-soft)] text-[9px] font-mono font-bold text-[var(--ink-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
                      i
                    </span>
                  </Tooltip>
                </div>
                <span className="font-geist text-[10px] text-[var(--ink-soft)]">
                  {Math.round(engagement.levelProgress * 100)}% {t("hero.to_next_level")}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--app-bg)] border border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${engagement.levelProgress * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 60%, var(--ink))",
                  }}
                />
              </div>

              {/* ⭐ HAFTALIK RİTİM VE BEKLEYEN KART ÖZETİ (Motivasyon Göstergesi) */}
              <div className="mt-3.5 pt-2.5 border-t border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)]">
                <div className="flex items-center justify-between text-[11px] font-gelica pb-1.5">
                  <span className="text-[var(--ink-soft)] font-medium">{t("hero.weekly_rhythm")}:</span>
                  <span className="font-handwritten text-[var(--accent)] text-xs font-bold">
                    {dueCardsCount > 0 ? t("desk.count_short", { n: dueCardsCount }) : t("hero.desks_done")}
                  </span>
                </div>

          <div className="border flex items-center justify-between gap-1 bg-[var(--app-bg)] p-1.5 rounded-[8px] border-[var(--ink)]">
                  {weekDays.map((d) => (
                    <div key={d.name} className="flex flex-col items-center gap-1 flex-1">
                      <span className={`text-[9px] font-mono ${d.isToday ? "text-[var(--accent)] font-bold" : "text-[var(--ink-soft)]"}`}>
                        {d.name}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                          d.isPastActive
                            ? "bg-[var(--accent)] border-[var(--ink)] text-[var(--app-bg)] font-bold shadow-xs"
                            : d.isToday
                            ? todayXp > 0
                              ? "bg-[#22c55e] border-[var(--ink)] text-white font-bold"
                              : "border-[1.5px] border-dashed border-[var(--accent)] text-[var(--accent)]"
                            : "border border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] bg-[var(--paper)] text-[var(--ink-soft)] opacity-40"
                        }`}
                        title={`${d.fullName}: ${d.isToday ? (todayXp > 0 ? t("xp.today_done") : t("xp.today_pending")) : d.isPastActive ? t("xp.streak_active") : t("xp.pending")}`}
                      >
                        {d.isPastActive ? "✓" : d.isToday ? (todayXp > 0 ? "✓" : "•") : "·"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BİRİKEN KAPAK SAYFASI (Milestone Rozetleri & Defter Cildi) */}
              <CoverStickerCluster
                onOpenCustomize={() => handleOpenCustomize("paper")}
                onOpenVolumes={() => handleOpenCustomize("volumes")}
              />
            </div>
          </div>
        </div>
      </div>
      {/* 3. 3'lü Defter Kartları (12px Card Radius, 1.5px Charcoal Border) */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => {
            playPopSound();
            onGoToCards();
          }}
          style={{ "--card-tilt": "-0.8deg" } as React.CSSProperties}
          className="card-superr p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-handwritten text-base text-[var(--accent)]">
              {t("hero.desks_kicker")}
            </span>
            <Layers size={22} className="text-[var(--accent)]" />
          </div>
          <h3 className="font-gelica text-[21px] sm:text-[22px] lg:text-[24px] font-semibold text-[var(--ink)] leading-tight break-words [overflow-wrap:anywhere] hyphens-auto">
            {t("hero.desks_title")}
          </h3>
          <p className="mt-1.5 font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
            {t("hero.desks_desc")}
          </p>
        </div>

        <div
          onClick={() => {
            playPopSound();
            onGoToNotes();
          }}
          style={{ "--card-tilt": "0.7deg" } as React.CSSProperties}
          className="card-superr p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-handwritten text-base text-[#3b82f6]">
              {t("hero.tab.archive")}
            </span>
            <DFolder size={22} className="text-[#3b82f6]" />
          </div>
          <h3 className="font-gelica text-[21px] sm:text-[22px] lg:text-[24px] font-semibold text-[var(--ink)] leading-tight break-words [overflow-wrap:anywhere] hyphens-auto">
            {t("hero.notes_title")}
          </h3>
          <p className="mt-1.5 font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
            {t("hero.notes_desc")}
          </p>
        </div>

        <div
          onClick={() => {
            playPopSound();
            onGoToDaily();
          }}
          style={{ "--card-tilt": "-0.5deg" } as React.CSSProperties}
          className="card-superr p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-handwritten text-base text-[#22c55e]">
              {t("hero.tab.agenda")}
            </span>
            <Calendar size={22} className="text-[#22c55e]" />
          </div>
          <h3 className="font-gelica text-[21px] sm:text-[22px] lg:text-[24px] font-semibold text-[var(--ink)] leading-tight break-words [overflow-wrap:anywhere] hyphens-auto">
            {t("hero.agenda_title")}
          </h3>
          <p className="mt-1.5 font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
            {t("hero.agenda_desc")}
          </p>
        </div>
      </div>

      {/* 4. ⭐ KILAVUZDAKİ İMZA: 56px Asimetrik Turuncu Footer Bandı */}
      <div className="mt-14 footer-brand-band p-8 flex flex-col sm:flex-row items-center justify-between text-[var(--app-bg)]">
        <div className="flex flex-col">
          <span className="font-gelica text-[26px] font-semibold leading-tight">
            <span className="text-[var(--ink)]">your</span>
            <span className="text-[var(--app-bg)]">book</span>
          </span>
          <span className="font-geist text-[13px] text-[var(--app-bg)]">{t("hero.footer")}</span>
        </div>

        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-[5px]">
          <button
            onClick={() => {
              playPopSound();
              onGoToCards("space-all");
            }}
            className="rounded-[20px] border-2 border-[var(--ink)] bg-[var(--app-bg)] text-[var(--ink)] px-5 py-2 font-gelica text-xs font-semibold shadow-sm hover:bg-[var(--paper)] transition-all"
          >
            <span>{t("hero.btn_desks").replace("{n}", String(deskCount))}</span>
          </button>
          <button
            onClick={() => {
              playPopSound();
              onGoToCards("space-work");
            }}
            className="rounded-[20px] border-2 border-[var(--ink)] bg-[var(--app-bg)] text-[var(--ink)] px-5 py-2 font-gelica text-xs font-semibold shadow-sm hover:bg-[var(--paper)] transition-all"
          >
            <span>{t("hero.btn_work")}</span>
          </button>
          <button
            onClick={() => {
              playPopSound();
              onGoToDaily();
            }}
            className="rounded-[20px] border-2 border-[var(--ink)] bg-[var(--app-bg)] text-[var(--ink)] px-5 py-2 font-gelica text-xs font-semibold shadow-sm hover:bg-[var(--paper)] transition-all"
          >
            <span>{t("hero.btn_calendar")}</span>
          </button>
          <button
            onClick={() => {
              playPopSound();
              onGoToNotes();
            }}
            className="rounded-[20px] border-2 border-[var(--ink)] bg-[var(--app-bg)] text-[var(--ink)] px-5 py-2 font-gelica text-xs font-semibold shadow-sm hover:bg-[var(--paper)] transition-all"
          >
            <span>{t("hero.btn_daily")}</span>
          </button>

        </div>
      </div>
      {/* Defter Özelleştirme Modalı (Kağıt, El Yazısı, Damga, Ciltler) */}
      <GiftNotebookModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        onGiftSent={handleConfigChange}
      />

      <NotebookCustomizeModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        onConfigChange={handleConfigChange}
        initialTab={customizeInitialTab}
      />
    </div>
  );
}

