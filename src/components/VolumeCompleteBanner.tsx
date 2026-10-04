import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SketchBooks, SketchSparkles, SketchClose } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import {
  evaluateVolumeFill,
  getCurrentVolume,
  advanceToNextVolume,
  getVolumeAutoswitchState,
  isVolumeAutoswitchEnabled,
  setVolumeAutoswitchEnabled,
  VolumeFill,
} from "../lib/notebookConfig";

interface VolumeCompleteBannerProps {
  /** Cilt değiştiğinde üst bileşene haber ver (rozetler/arşiv yenilensin). */
  onVolumeChange?: (newVolume: number) => void;
}

/**
 * Cilt Doluluk Bandı
 * Otomatik geçiş açıkken ve cilt dolduğunda görünür; tek tıkla yeni cilde geçer.
 * Tercih kapalıyken hiç görünmez (davranış değişmez).
 */
export default function VolumeCompleteBanner({ onVolumeChange }: VolumeCompleteBannerProps) {
  const { t } = useT();
  const [fill, setFill] = useState<VolumeFill | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [volume, setVolume] = useState(1);

  const refresh = useCallback(() => {
    setVolume(getCurrentVolume());
    // Tercih kapalıysa pahalı hesaplamayı yapma
    if (!isVolumeAutoswitchEnabled()) {
      setFill(null);
      return;
    }
    setFill(evaluateVolumeFill());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    // Kendi sekme içi değişiklikler için periyodik hafif yenileme
    const iv = window.setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(iv);
    };
  }, [refresh]);

  const visible =
    !dismissed &&
    fill !== null &&
    fill.isFull &&
    getVolumeAutoswitchState() === "prompt";

  const handleSwitch = () => {
    setSwitching(true);
    const next = advanceToNextVolume(fill?.wordsLearned ?? 0, fill?.journalCount ?? 0);
    setVolume(next);
    setDismissed(true);
    setSwitching(false);
    onVolumeChange?.(next);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Kullanıcı istemedi: otomatik geçişi kapat ki tekrar tekrar görünmesin
    setVolumeAutoswitchEnabled(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="mx-auto mb-4 w-full max-w-3xl rounded-[16px] border-[1.5px] border-[var(--ink)] bg-[var(--paper)] p-4 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-[var(--accent)]">
              <SketchBooks size={26} strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-gelica text-sm font-bold lowercase text-[var(--ink)]">
                  {t("volume.full_title")}
                </span>
                <span className="font-mono text-[10px] text-[var(--accent)]">
                  {t("volume.current").replace("{n}", String(volume).padStart(2, "0"))}
                </span>
              </div>

              <p className="mt-1 font-gelica text-[12px] leading-relaxed text-[var(--ink-soft)]">
                {t("volume.full_desc")}
              </p>

              {fill && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--ink-soft)]">
                  <span>{fill.badges}/{fill.totalBadges} {t("volume.badges")}</span>
                  <span>·</span>
                  <span>{fill.journalCount} {t("volume.journals")}</span>
                  <span>·</span>
                  <span>{fill.wordsLearned} {t("vol.words_unit")}</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  data-volume-switch="1"
                  onClick={handleSwitch}
                  disabled={switching}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ink)] bg-[var(--accent)] px-3.5 py-1.5 font-gelica text-xs font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  <SketchSparkles size={13} strokeWidth={1.8} />
                  {t("volume.start_new")}
                </button>
                <button
                  data-volume-dismiss="1"
                  onClick={handleDismiss}
                  className="rounded-full border border-[var(--ink)] px-3 py-1.5 font-gelica text-xs font-semibold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                >
                  {t("volume.later")}
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              aria-label={t("act.close")}
              className="shrink-0 rounded-full p-1 text-[var(--ink-soft)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
            >
              <SketchClose size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
