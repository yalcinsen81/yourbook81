import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { calculateYearHeatmap, HeatmapDay } from "../lib/journalMoodAnalytics";
import { JournalEntry } from "./JournalView";

interface JournalHeatmapProps {
  entries: JournalEntry[];
  /** Dışarıdan yönetilen yıl (verilirse iç state kullanılmaz). */
  year?: number;
  /** Yıl değiştiğinde bildir. */
  onYearChange?: (year: number) => void;
  onSelectDay?: (dateKey: string) => void;
}

// Yoğunluk -> renk (0 = boş, 4 = en yoğun). Aksan renginin opaklık merdiveni.
const LEVEL_BG = [
  "color-mix(in srgb, var(--ink) 7%, transparent)",
  "color-mix(in srgb, var(--accent) 25%, transparent)",
  "color-mix(in srgb, var(--accent) 50%, transparent)",
  "color-mix(in srgb, var(--accent) 75%, transparent)",
  "var(--accent)",
];

const CELL = 11;
const GAP = 3;

/**
 * Yıllık katkı ısı haritası (contribution graph).
 * 53 hafta × 7 gün; çok girdi = koyu turuncu. Hover'da gün detayı, tıkla -> o güne git.
 */
export default function JournalHeatmap({ entries, onSelectDay, year: yearProp, onYearChange }: JournalHeatmapProps) {
  const { t, lang } = useT();
  const thisYear = new Date().getFullYear();
  const [innerYear, setInnerYear] = useState(thisYear);
  const year = yearProp ?? innerYear;
  const setYear = (y: number) => { setInnerYear(y); onYearChange?.(y); };
  const [overlayYear, setOverlayYear] = useState<number | null>(null);
  const [hover, setHover] = useState<HeatmapDay | null>(null);

  const map = useMemo(() => calculateYearHeatmap(entries, year), [entries, year, t]);

  // Ay isimleri: month.1 .. month.12 (render sırasında çevrilir)
  const monthShort = (m: number) => {
    const full = t(`month.${m + 1}`);
    return full.length > 4 ? full.slice(0, 3) : full;
  };

  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    for (const e of entries) {
      const k = (e as { dateKey?: string }).dateKey || "";
      const y = parseInt(k.slice(0, 4), 10);
      if (!Number.isNaN(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [entries, thisYear]);

  // Iki yil ust uste bindirme: ikinci yilin gun haritasi (ayni izgara hizasi).
  const overlayMap = useMemo(() => {
    if (overlayYear == null || overlayYear === year) return null;
    return calculateYearHeatmap(entries, overlayYear);
  }, [entries, overlayYear, year]);

  const fmtDate = (key: string) => {
    try {
      const d = new Date(key + "T00:00:00");
      return d.toLocaleDateString(lang === "tr" ? "tr-TR" : lang === "de" ? "de-DE" : lang === "ar" ? "ar-EG" : lang === "es" ? "es-ES" : lang === "pt" ? "pt-PT" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return key;
    }
  };

  const tooltipText = (d: HeatmapDay) => {
    if (d.entryCount === 0) return `${fmtDate(d.dateKey)} · ${t("heat.no_entry")}`;
    return `${fmtDate(d.dateKey)} · ${d.entryCount} ${t("heat.entries")} · ${d.words} ${t("spread.words")}`;
  };

  const width = map.weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <div className="mt-5 pt-4 border-t border-black/5 w-full"
      data-lovable-target="journal-heatmap"
      data-lovable-name="Bölüm: Yazma Isı Haritası"
      data-lovable-file="src/components/JournalHeatmap.tsx"
      data-lovable-desc="Günlük yazma sıklığı ısı haritası"
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-geist text-xs font-bold lowercase text-[var(--ink)]">{t("heat.title")}</span>
          <span className="font-mono text-[10px] text-[var(--ink-soft)]">
            {map.activeDays} {t("heat.active_days")} · {map.totalEntries} {t("heat.entries")}
          </span>
        </div>
        {years.length > 1 && (
          <div className="flex items-center gap-1">
            {years.slice(0, 4).map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition ${
                  y === year
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--line)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {/* Iki yil ust uste bindirme (overlay) secici */}
        {years.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (overlayYear != null) { setOverlayYear(null); return; }
                const other = years.find((y) => y !== year) ?? null;
                setOverlayYear(other);
              }}
              aria-pressed={overlayYear != null}
              title={t("heat.overlay_hint")}
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition ${
                overlayYear != null
                  ? "bg-[var(--accent)] text-white"
                  : "border border-dashed border-[var(--line-strong)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
              }`}
            >
              {t("heat.overlay")}
            </button>
            {overlayYear != null && (
              <button
                onClick={() => {
                  const nxt = years.filter((y) => y !== year);
                  const cur = nxt.indexOf(overlayYear);
                  setOverlayYear(nxt[(cur + 1) % nxt.length] ?? null);
                }}
                className="rounded-full border-dashed border-[var(--accent)] px-2 py-0.5 font-mono text-[10px] text-[var(--accent)]"
              >
                {overlayYear}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Isı haritası ızgarası */}
      <div className="relative overflow-x-auto scrollbar-thin pb-1">
        <svg
          viewBox={`-14 0 ${width + 14} ${height + 16}`}
          width="100%"
          style={{ minWidth: Math.min(width + 14, 720), height: "auto" }}
          role="img"
          aria-label={t("heat.title")}
        >
          {/* Ay etiketleri (üstte) */}
          {map.monthMarkers.map((m) => (
            <text
              key={m.month}
              x={m.weekIndex * (CELL + GAP)}
              y={-3}
              className="fill-[var(--ink-soft)]"
              style={{ fontSize: 8, fontFamily: "monospace", textTransform: "uppercase" }}
            >
              {monthShort(m.month)}
            </text>
          ))}

          {/* Gün hücreleri */}
          {map.days.map((d, i) =>
            d.isFuture ? null : (
              <motion.rect
                key={d.dateKey}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.0012, 0.6) }}
                x={d.weekIndex * (CELL + GAP)}
                y={d.weekday * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={LEVEL_BG[d.level]}
                stroke={d.isToday ? "var(--ink)" : "transparent"}
                strokeWidth={d.isToday ? 1.4 : 0}
                style={{ cursor: onSelectDay ? "pointer" : "default" }}
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelectDay && onSelectDay(d.dateKey)}
                role={onSelectDay ? "button" : undefined}
                tabIndex={onSelectDay ? 0 : undefined}
                aria-label={tooltipText(d)}
                data-heat-day={d.dateKey}
                onKeyDown={(e) => {
                  if (!onSelectDay) return;
                  // Enter / Space ile o günü aç
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDay(d.dateKey);
                    return;
                  }
                  // Ok tuşlarıyla günler arası gezinme
                  let delta = 0;
                  if (e.key === "ArrowRight") delta = 1;
                  else if (e.key === "ArrowLeft") delta = -1;
                  else if (e.key === "ArrowDown") delta = 7;
                  else if (e.key === "ArrowUp") delta = -7;
                  if (!delta) return;
                  e.preventDefault();
                  const cur = map.days.indexOf(d);
                  const next = map.days[cur + delta];
                  if (!next || next.isFuture) return;
                  const el = document.querySelector<SVGRectElement>(
                    `[data-heat-day="${next.dateKey}"]`
                  );
                  el?.focus();
                  setHover(next);
                }}
              />
            )
          )}

          {/* Ikinci yil bindirmesi: kesikli cerceveli halkalar */}
          {overlayMap &&
            overlayMap.days.map((d) =>
              d.isFuture ? null : (
                <rect
                  key={"ov-" + d.dateKey}
                  x={d.weekIndex * (CELL + GAP) - 1}
                  y={d.weekday * (CELL + GAP) - 1}
                  width={CELL + 2}
                  height={CELL + 2}
                  rx={3}
                  fill="none"
                  stroke={d.level > 0 ? "var(--accent)" : "transparent"}
                  strokeWidth={1.1}
                  strokeDasharray="2.5 2"
                  pointerEvents="none"
                  data-heat-overlay={d.dateKey}
                />
              ),
            )}

          {/* Haftalık gün satır etiketleri (sol) */}
          {[0, 2, 4].map((wd) => (
            <text
              key={wd}
              x={-5}
              y={wd * (CELL + GAP) + CELL - 1}
              textAnchor="end"
              className="fill-[var(--ink-soft)]"
              style={{ fontSize: 7.5, fontFamily: "monospace" }}
            >
              {t(["time.mon", "time.tue", "time.wed", "time.thu", "time.fri", "time.sat", "time.sun"][wd])}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div className="pointer-events-none absolute start-0 -top-1 rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono text-[10px] text-[var(--ink)] shadow-md whitespace-nowrap">
            {tooltipText(hover)}
          </div>
        )}
      </div>

      {/* Az / Çok göstergesi */}
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">{t("heat.less")}</span>
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: bg }} />
        ))}
        <span className="font-mono text-[9px] text-[var(--ink-soft)]">{t("heat.more")}</span>
        {overlayYear != null && (
          <span className="ms-2 inline-flex items-center gap-1 font-mono text-[9px] text-[var(--accent)]">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] border-dashed border-[var(--accent)]" />
            {overlayYear} · {t("heat.overlay_legend")}
          </span>
        )}
      </div>
    </div>
  );
}
