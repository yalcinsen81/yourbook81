import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  evaluateMilestones,
  getCurrentVolume,
  getSavedInkStamp,
  INK_STAMPS,
  MilestoneSticker,
} from "../lib/notebookConfig";
import { playPenScratch, playPopSound } from "../lib/sound";
import {
  SketchBadgeCheck,
  SketchBadgeIcon,
  SketchBadgeLock,
} from "./icons/sketchBadges";
import { SketchPalette } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";

interface CoverStickerClusterProps {
  onOpenCustomize: () => void;
  onOpenVolumes: () => void;
}

export function CoverStickerCluster({
  onOpenCustomize,
  onOpenVolumes,
}: CoverStickerClusterProps) {
  const [currentVolume, setCurrentVolume] = useState<number>(getCurrentVolume);
  const [milestones, setMilestones] = useState(() => evaluateMilestones());
  const [activeStamp, setActiveStamp] = useState(getSavedInkStamp);

  useEffect(() => {
    const handleRefresh = () => {
      setCurrentVolume(getCurrentVolume());
      setMilestones(evaluateMilestones());
      setActiveStamp(getSavedInkStamp());
    };
    window.addEventListener("notebook-config-changed", handleRefresh);
    return () =>
      window.removeEventListener("notebook-config-changed", handleRefresh);
  }, []);

  const { t } = useT();
  const stampConfig = INK_STAMPS.find((s) => s.id === activeStamp);
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  return (
    <div className="relative mt-3 pt-4 border-t border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)]">
      {/* Üst Başlık & Rozet Sayacı */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
            {t("cover.badges.title")}
          </span>
          <span className="font-mono text-[9.5px] font-semibold text-[var(--ink-soft)] px-1.5 py-0.2 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
            {unlockedCount}/{milestones.length}
          </span>
        </div>
        {/* Özelleştir ve Ciltler Butonu */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              playPopSound();
              onOpenVolumes();
            }}
            title={t("cover.volumes.tip")}
            className="rounded-full border-[var(--line-strong)] bg-[var(--paper)] px-2.5 py-0.5 font-geist text-[10px] font-semibold text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white active:scale-95 transition-all shadow-2xs"
          >
            {t("cover.badges.volume")} 0{currentVolume}
          </button>
          <button
            onClick={() => {
              playPopSound();
              onOpenCustomize();
            }}
            title={t("cover.customize.tip")}
            className="flex items-center gap-1 rounded-full border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-0.5 font-geist text-[10px] font-bold text-[var(--accent)] hover:scale-105 active:scale-95 transition-all shadow-2xs"
          >
            <SketchPalette size={13} strokeWidth={1.8} className="shrink-0" />
            <span>{t("cover.customize")}</span>
          </button>
        </div>
      </div>

      {/* 9 Rozet Yuvası — Gerçekçi Postit & Organik El Çizimi Defter Koleksiyonu
          Dar ekranda yatay kaydırılabilir (snap), geniş ekranda 9 kolon grid.
          Etiketler kart genişliğinde kelime kaydırmalı (asıla taşmaz). */}
      <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-2 sm:overflow-visible sm:pb-1 sm:mx-0 sm:px-0 lg:grid-cols-9 lg:pe-2">
        {milestones.map((m: MilestoneSticker) => {
          const unlocked = m.unlocked;
          const tilt = m.rotation ?? 0;

          return (
            <motion.div
              key={m.id}
              initial={
                unlocked ? { scale: 0.84, opacity: 0, y: 8, rotate: 0 } : false
              }
              animate={
                unlocked
                  ? { scale: 1, opacity: 1, y: 0, rotate: tilt }
                  : { rotate: tilt * 0.6 }
              }
              whileHover={{ rotate: 0, scale: 1.07, y: -4, zIndex: 20 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              title={
                unlocked
                  ? t("milestone.won").replace("{title}", t(`badge.${m.id}`)).replace("{desc}", t(`badge.${m.id}.desc`))
                  : t("milestone.locked").replace("{title}", t(`badge.${m.id}`)).replace("{desc}", t(`badge.${m.id}.desc`))
              }
              onClick={() => {
                if (unlocked) playPenScratch();
              }}
              style={{ transformOrigin: "center" }}
              className={`postit-card group relative shrink-0 w-[78px] min-h-[88px] snap-start flex-col items-center justify-start gap-1 rounded-[3px] px-1.5 pt-2 pb-1.5 cursor-pointer select-none border ${m.badgeBg} ${
                unlocked ? "" : "postit-locked"
              }`}
            >
              {/* Kağıt dokusu ve hafif kırışıklık katmanı */}
              <span className="postit-grain" aria-hidden="true" />
              <span className="postit-crease" aria-hidden="true" />

              {/* Washi bant (kazanılmış) / iğne+asmalık (kilitli) */}
              {unlocked ? (
                <span className="postit-tape" aria-hidden="true" />
              ) : (
                <span className="postit-pin" aria-hidden="true">
                  <SketchBadgeLock size={10} strokeWidth={1.7} />
                </span>
              )}

              {/* Organik El Çizimi Kontur İkon */}
              <div
                className={`relative z-10 mt-0.5 flex h-7 w-7 items-center justify-center ${m.color}`}
              >
                <SketchBadgeIcon
                  badgeId={m.id}
                  size={27}
                  isUnlocked={unlocked}
                  strokeWidth={unlocked ? 1.75 : 1.4}
                />
              </div>

              {/* Etiket — kart genişliğinde, gerekirse 2 satıra bölünür */}
              <span
                className={`relative z-10 block w-full text-center font-handwritten leading-[1.15] text-[9.5px] font-bold break-words hyphens-auto ${
                  unlocked ? m.color : "text-[var(--ink-soft)]"
                }`}
              >
                {t(`badge.${m.id}`) || m.title}
              </span>

              {/* Gerçek ilerleme */}
              {typeof m.current === "number" && typeof m.target === "number" && (
                <div className="relative z-10 mt-0.5 w-full">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_16%,transparent)]">
                    <span className="block h-full rounded-full bg-current transition-[width] duration-300" style={{ width: Math.min(100, Math.round((m.current / Math.max(1, m.target)) * 100)) + "%" }} />
                  </div>
                  <span className="mt-0.5 block font-mono text-[8px] text-[var(--ink-soft)]">{m.current}/{m.target}</span>
                </div>
              )}
              {/* Kazanılmış rozet tik damgası */}
              {unlocked && (
                <span className="absolute bottom-1.5 end-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-2xs">
                  <SketchBadgeCheck size={9} strokeWidth={2.4} />
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Mürekkep Damgası (Vintage Ink Stamp) */}
      {stampConfig && activeStamp !== "none" && (
        <div className="mt-2.5 flex justify-end">
          <div className={`ink-stamp-box rotate-[-4deg] ${stampConfig.color}`}>
            <span className="font-mono text-[9px] font-extrabold tracking-wider">
              {t(stampConfig.titleKey)}
            </span>
            <span className="font-handwritten text-[8.5px] font-semibold opacity-90">
              {t(stampConfig.subtitleKey)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
