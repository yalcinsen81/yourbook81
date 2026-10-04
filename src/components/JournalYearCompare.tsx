import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { calculateYearComparison, YearSummary } from "../lib/journalMoodAnalytics";
import { JournalEntry } from "./JournalView";

interface JournalYearCompareProps {
  entries: JournalEntry[];
  /** Bir yıla tıklanınca o yıla geç (ısı haritasını senkronlar). */
  onSelectYear?: (year: number) => void;
  /** Isı haritasında seçili yıl. */
  activeYear?: number;
}

/**
 * Yıllık Yazma Karşılaştırması
 * Girdilerin bulunduğu tüm yılları yan yana özetler: aktif gün, girdi, kelime.
 * Çubuklar yılın en yüksek değerine göre ölçeklenir; tıklayınca ısı haritası o yıla geçer.
 */
export default function JournalYearCompare({ entries, onSelectYear, activeYear }: JournalYearCompareProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const summaries = useMemo(() => calculateYearComparison(entries), [entries]);
  const maxEntries = Math.max(1, ...summaries.map((s) => s.totalEntries));

  // Tek yıl varsa ve o yıl hiç girdi yoksa gösterme
  const hasAny = summaries.some((s) => s.totalEntries > 0);
  if (!summaries.length || (!hasAny && summaries.length <= 1)) return null;

  const monthShort = (m: number) => {
    const full = t(`month.${m + 1}`);
    return full.length > 4 ? full.slice(0, 3) : full;
  };

  const row = (s: YearSummary) => {
    const pct = Math.round((s.totalEntries / maxEntries) * 100);
    const isActive = activeYear === s.year;
    return (
      <button
        key={s.year}
        type="button"
        data-year-row={s.year}
        onClick={() => onSelectYear?.(s.year)}
        title={t("year.compare_hint")}
        className={
          "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-start transition " +
          (isActive
            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            : "hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]")
        }
      >
        <span className="w-9 shrink-0 font-mono text-[11px] font-bold text-[var(--ink)]">{s.year}</span>
        <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: pct + "%" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
          />
        </span>
        <span className="w-16 shrink-0 text-end font-mono text-[10px] text-[var(--ink-soft)]">
          {s.totalEntries} · {s.activeDays}
        </span>
      </button>
    );
  };

  return (
    <div className="mt-5 pt-4 border-t border-black/5 w-full">
      <button
        type="button"
        data-year-compare-toggle="1"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <span className="font-gelica text-xs font-bold lowercase text-[var(--ink)]">
          {t("year.compare_title")}
        </span>
        <span className="font-mono text-[10px] text-[var(--ink-soft)]">
          {summaries.length} {t("year.years")} {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 overflow-hidden"
        >
          <div className="flex items-center justify-end gap-2 pb-1">
            <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ink-soft)]">
              {t("year.entries")} · {t("year.active_days")}
            </span>
          </div>

          {summaries.map((s) => (
            <div key={s.year}>
              {row(s)}
              {/* Aylık mini dağılım */}
              <div className="mt-0.5 mb-1.5 grid grid-cols-12 gap-[2px] ps-11 pe-16">
                {s.monthly.map((n, m) => (
                  <span
                    key={m}
                    title={monthShort(m) + ": " + n}
                    className="h-1.5 rounded-[2px]"
                    style={{
                      background:
                        n > 0
                          ? "color-mix(in srgb, var(--accent) " + Math.min(100, 30 + n * 14) + "%, transparent)"
                          : "color-mix(in srgb, var(--ink) 7%, transparent)",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Seçili yılın detayları */}
          {summaries
            .filter((s) => s.year === activeYear)
            .map((s) => (
              <div
                key={"det-" + s.year}
                data-year-detail={s.year}
                className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] px-2.5 py-1.5 font-mono text-[10px] text-[var(--ink-soft)]"
              >
                <span>
                  <strong className="text-[var(--ink)]">{s.totalWords}</strong> {t("vol.words_unit")}
                </span>
                <span>·</span>
                <span>
                  {t("year.avg")} <strong className="text-[var(--ink)]">{s.avgWordsPerActiveDay}</strong>
                </span>
                <span>·</span>
                <span>
                  {t("year.peak")} <strong className="text-[var(--ink)]">{s.maxEntries}</strong>
                </span>
                {s.firstDate && s.lastDate && (
                  <>
                    <span>·</span>
                    <span>
                      {s.firstDate.slice(5)} → {s.lastDate.slice(5)}
                    </span>
                  </>
                )}
              </div>
            ))}
        </motion.div>
      )}
    </div>
  );
}
