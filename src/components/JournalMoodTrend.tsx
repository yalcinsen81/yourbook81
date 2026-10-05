import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { calculateWeeklyMoodTrend, buildMoodTrendPath } from "../lib/journalMoodAnalytics";
import { JournalEntry } from "./JournalView";

interface JournalMoodTrendProps {
  entries: JournalEntry[];
  /** Trendin hangi haftaya gore hesaplanacagi (varsayilan: bugun). */
  referenceDate?: Date;
}

const W = 100;
const H = 44;
const PAD = 6;

/**
 * Haftalık duygu trendi — mürekkep eğrisi.
 * Pzt..Paz günlerinin ortalama duygu tonunu (-2..+2) yumuşak bir el çizimi
 * eğriyle birleştir. Girdisi olmayan günler eğriyi böler (boşluk bırakır).
 */
export default function JournalMoodTrend({ entries, referenceDate }: JournalMoodTrendProps) {
  const { t } = useT();

  const points = useMemo(() => calculateWeeklyMoodTrend(entries, referenceDate), [entries, referenceDate]);
  const { segments } = useMemo(() => buildMoodTrendPath(points, W, H, PAD), [points]);

  const hasAny = points.some((p) => p.score !== null);
  // Haftanın ortalama tonu (yalnızca girdisi olan günler)
  const avg = useMemo(() => {
    const scored = points.filter((p) => p.score !== null) as { score: number }[];
    if (!scored.length) return null;
    return scored.reduce((s, p) => s + p.score, 0) / scored.length;
  }, [points]);

  const label = (score: number | null) => {
    if (score === null) return t("trend.no_data");
    if (score >= 1.5) return t("journal.mood.peaceful");
    if (score >= 0.5) return t("journal.mood.calm");
    if (score > -0.5) return t("journal.mood.tired");
    if (score > -1.5) return t("journal.mood.tense");
    return t("journal.mood.hard");
  };

  return (
    <div className="mt-4 pt-4 border-t border-black/5 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="font-geist text-xs font-bold lowercase text-[var(--ink)]">
          {t("trend.title")}
        </span>
        {hasAny && avg !== null && (
          <span className="font-mono text-[10px] text-[var(--ink-soft)]">
            {t("trend.avg")}: {avg > 0 ? "+" : ""}
            {avg.toFixed(1)}
          </span>
        )}
      </div>

      {/* Mürekkep eğrisi */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-16 overflow-visible select-none"
          preserveAspectRatio="none"
          role="img"
          aria-label={t("trend.title")}
        >
          {/* Sıfır (nötr) referans çizgisi */}
          <line
            x1={PAD}
            y1={PAD + (H - PAD * 2) * (1 - ((0 - (-2)) / 4))}
            x2={W - PAD}
            y2={PAD + (H - PAD * 2) * (1 - ((0 - (-2)) / 4))}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="2 2"
            className="text-[var(--ink-soft)] opacity-30"
          />

          {/* Segmentler: bitişik dolu gün grubu = tek polyline */}
          {segments.map((seg, i) => (
            <g key={i}>
              {seg.length > 1 && (
                <motion.polyline
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  points={seg.map((s) => `${s.x},${s.y}`).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {seg.map((s) => (
                <circle
                  key={s.point.dateKey}
                  cx={s.x}
                  cy={s.y}
                  r={s.point.isToday ? 2.4 : 1.6}
                  fill={s.point.isToday ? "var(--ink)" : "var(--accent)"}
                  stroke="var(--paper)"
                  strokeWidth={0.7}
                >
                  <title>
                    {t(s.point.weekdayKey)} · {label(s.point.score)}
                  </title>
                </circle>
              ))}
            </g>
          ))}
        </svg>

        {!hasAny && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-geist text-[11px] text-[var(--ink-soft)] opacity-70">
              {referenceDate ? t("trend.empty_period") : t("trend.empty")}
            </span>
          </div>
        )}
      </div>

      {/* Gün etiketleri */}
      <div className="grid grid-cols-7 gap-1 mt-1 text-center">
        {points.map((p) => (
          <span
            key={p.dateKey}
            className={`font-mono text-[9px] uppercase tracking-wide ${
              p.isToday ? "text-[var(--accent)] font-bold" : "text-[var(--ink-soft)]"
            }`}
          >
            {t(p.weekdayKey)}
          </span>
        ))}
      </div>
    </div>
  );
}
