import { SketchSunRising, SketchSunBright, SketchSunSetting, SketchMoon, SketchGear, SketchClose } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getOpeningRitualGreeting,
  TIME_PERIOD_META,
  getCurrentTimePeriod,
  STORAGE_KEY_RITUAL_WINDOW,
  type TimeLightingPeriod,
} from "../lib/notebookConfig";
import { playPaperRustle } from "../lib/sound";

interface OpeningRitualCardProps {
  onOpenSettings?: () => void;
}

export function OpeningRitualCard({ onOpenSettings }: OpeningRitualCardProps) {
  const { t, lang } = useT();
  const [isVisible, setIsVisible] = useState(false);
  const [greetingKey, setGreetingKey] = useState<string>("");
  const [period, setPeriod] = useState<TimeLightingPeriod>("day");

  useEffect(() => {
    // Kullanıcının tercih ettiği vakit penceresi
    const savedWindow = localStorage.getItem(STORAGE_KEY_RITUAL_WINDOW) || "auto";
    const currentPeriod = getCurrentTimePeriod();

    // Eğer kullanıcı belirli bir vakti seçmişse sadece o vakitte göster
    if (savedWindow !== "auto" && savedWindow !== currentPeriod) {
      return;
    }

    // Bugün bu vaktin karşılama kartı zaten kapatıldı mı kontrol et
    const today = new Date().toISOString().slice(0, 10);
    const dismissedKey = `yourbook_ritual_dismissed_${today}_${currentPeriod}`;
    if (localStorage.getItem(dismissedKey) === "true") {
      return;
    }

    const item = getOpeningRitualGreeting();
    setGreetingKey(item.textKey);
    setPeriod(item.period);
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    playPaperRustle();
    setIsVisible(false);
    const today = new Date().toISOString().slice(0, 10);
    const currentPeriod = getCurrentTimePeriod();
    localStorage.setItem(`yourbook_ritual_dismissed_${today}_${currentPeriod}`, "true");
  };

  if (!isVisible) return null;

  
  const renderPeriodSketchIcon = (p: TimeLightingPeriod) => {
    switch (p) {
      case "morning":
        return <SketchSunRising size={29} className="text-amber-600" strokeWidth={1.8} />;
      case "day":
        return <SketchSunBright size={29} className="text-amber-600" strokeWidth={1.8} />;
      case "afternoon":
        return <SketchSunSetting size={29} className="text-orange-600" strokeWidth={1.8} />;
      case "night":
      default:
        return <SketchMoon size={29} className="text-indigo-600" strokeWidth={1.8} />;
    }
  };

  const meta = TIME_PERIOD_META[period];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full mb-4 relative overflow-hidden rounded-[18px] border-[2.5px] border-dashed border-[color-mix(in_srgb,var(--ink)_55%,transparent)] bg-[color-mix(in_srgb,var(--paper)_80%,transparent)] p-3.5 sm:p-4 shadow-superrCard backdrop-blur-xs"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="shrink-0 select-none drop-shadow-xs flex items-center justify-center w-[35px] h-[35px]">
              {renderPeriodSketchIcon(period)}
            </span>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[9.5px] uppercase tracking-wider font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-1.5 py-0.5 rounded">
              {t("ritual.badge_prefix")} · {meta ? t(meta.labelKey) : ""}
                </span>
                <span className="text-[10px] text-[var(--ink-soft)] font-mono">
                  {new Date().toLocaleTimeString(langToLocale(lang), { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="font-handwritten text-lg sm:text-xl text-[var(--ink)] leading-snug">
                {t(greetingKey)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title={t("ritual.tip")}
                className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs p-1 rounded-md hover:bg-black/5 transition-colors"
              >
                <SketchGear size={15} strokeWidth={1.8} />
              </button>
            )}
            <button
              onClick={handleDismiss}
              title={t("common.close")}
              className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-xs p-1 rounded-md hover:bg-black/5 transition-colors"
            >
              <SketchClose size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
