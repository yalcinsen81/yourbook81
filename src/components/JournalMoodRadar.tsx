import React, { useState, useMemo } from "react";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  SketchMoodPeaceful,
  SketchMoodProductive,
  SketchMoodCalm,
  SketchMoodTired,
  SketchMoodTense,
  SketchMoodRain,
  SketchLightbulb,
} from "./icons/sketchIcons";
import {
  filterJournalByDateRange,
  calculateMoodDistribution,
  getMoodCompassInsight,
  calculateRadarGeometry,
  calculateWritingHabits,
  getMonthCalendarGrid,
  MoodRange,
  MOOD_ORDER,
} from "../lib/journalMoodAnalytics";
import { JournalEntry } from "./JournalView";
import JournalMoodTrend from "./JournalMoodTrend";
import JournalHeatmap from "./JournalHeatmap";
import JournalYearCompare from "./JournalYearCompare";
import { playPopSound, playPaperRustle } from "../lib/sound";

interface JournalMoodRadarProps {
  entries: JournalEntry[];
  onSelectDate: (dateKey: string) => void;
  onNewEntry?: () => void;
}

const MOOD_META: Record<
  string,
  { color: string; badgeBg: string; textColor: string; icon: React.ReactNode }
> = {
  peaceful: {
    color: "#10b981",
    badgeBg: "bg-emerald-500/15 border-emerald-400",
    textColor: "text-emerald-700",
    icon: <SketchMoodPeaceful size={14} strokeWidth={1.8} />,
  },
  productive: {
    color: "#f97316",
    badgeBg: "bg-orange-500/15 border-orange-400",
    textColor: "text-orange-700",
    icon: <SketchMoodProductive size={14} strokeWidth={1.8} />,
  },
  calm: {
    color: "#3b82f6",
    badgeBg: "bg-blue-500/15 border-blue-400",
    textColor: "text-blue-700",
    icon: <SketchMoodCalm size={14} strokeWidth={1.8} />,
  },
  tired: {
    color: "#f59e0b",
    badgeBg: "bg-amber-500/15 border-amber-400",
    textColor: "text-amber-700",
    icon: <SketchMoodTired size={14} strokeWidth={1.8} />,
  },
  tense: {
    color: "#a855f7",
    badgeBg: "bg-purple-500/15 border-purple-400",
    textColor: "text-purple-700",
    icon: <SketchMoodTense size={14} strokeWidth={1.8} />,
  },
  hard: {
    color: "#64748b",
    badgeBg: "bg-slate-500/15 border-slate-400",
    textColor: "text-slate-700",
    icon: <SketchMoodRain size={14} strokeWidth={1.8} />,
  },
};

export function JournalMoodRadar({
  entries,
  onSelectDate,
  onNewEntry,
}: JournalMoodRadarProps) {
  const { t, lang } = useT();
  // Isı haritası ve yıl karşılaştırması aynı yılı paylaşır.
  const [heatYear, setHeatYear] = useState(new Date().getFullYear());
  const monthNames = [t("month.1"), t("month.2"), t("month.3"), t("month.4"), t("month.5"), t("month.6"), t("month.7"), t("month.8"), t("month.9"), t("month.10"), t("month.11"), t("month.12")];
  const weekdayNames = [t("time.mon"), t("time.tue"), t("time.wed"), t("time.thu"), t("time.fri"), t("time.sat"), t("time.sun")];
  const moodLabel = (id: string | null | undefined) => (id ? t(`journal.mood.${id}`) : "");
  const [range, setRange] = useState<MoodRange>("30d");
  const [activeMoodHover, setActiveMoodHover] = useState<string | null>(null);

  // Calendar month state
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Filtered entries for radar chart & insight
  const filteredEntries = useMemo(() => {
    return filterJournalByDateRange(entries, range, new Date(), range === "year" ? heatYear : undefined);
  }, [entries, range, heatYear]);

  const moodStats = useMemo(() => {
    return calculateMoodDistribution(filteredEntries);
  }, [filteredEntries]);

  const insight = useMemo(() => {
    return getMoodCompassInsight(moodStats.dominantMood, moodStats.total, lang);
  }, [moodStats]);

  const radarData = useMemo(() => {
    return calculateRadarGeometry(moodStats.counts, 96, { x: 130, y: 130 });
  }, [moodStats]);

  const habits = useMemo(() => {
    return calculateWritingHabits(filteredEntries, lang);
  }, [filteredEntries]);

  // Trend referansi: secili aralik gecmiste bir yila kilitliyse, o yilin son gunu;
  // aksi halde bugun. Boylece trend paneli duygu paneliyle AYNI kapsamda kalir.
  const trendReference = useMemo(() => {
    if (range !== "year") return new Date();
    const y = heatYear;
    const prefix = String(y) + "-";
    const inYear = entries.filter((e) => (e.dateKey || "").startsWith(prefix));
    if (!inYear.length) return new Date(y, 11, 31);
    const last = inYear.map((e) => e.dateKey).sort().pop()!;
    return new Date(last + "T00:00:00");
  }, [range, heatYear, entries]);

  const calendarCells = useMemo(() => {
    return getMonthCalendarGrid(viewYear, viewMonth, entries);
  }, [viewYear, viewMonth, entries]);

  const handlePrevMonth = () => {
    playPopSound();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    playPopSound();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleTodayMonth = () => {
    playPaperRustle();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <div className="mt-6 flex flex-col gap-6 max-w-5xl"
      data-lovable-target="journal-mood-radar"
      data-lovable-name="Bölüm: Ruh Hali Radarı"
      data-lovable-file="src/components/JournalMoodRadar.tsx"
      data-lovable-desc="Günlük ruh hali radar grafiği, üst filtre ve başlık"
    >
      {/* 1. ÜST FİLTRE VE BAŞLIK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--paper)] p-4 rounded-[16px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
              {t("radar.subtitle")}
            </span>
            <span className="text-[10px] rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 font-mono text-[var(--accent)] font-bold">
              {t("radar.entry_count").replace("{n}", String(filteredEntries.length))}
            </span>
          </div>
          <h3 className="font-gelica text-xl font-bold text-[var(--ink)] mt-0.5">
            {t("radar.title")}
          </h3>
        </div>

        {/* Zaman Aralığı Butonları */}
        <div className="flex items-center rounded-[20px] border border-[var(--line)] bg-[var(--app-bg)] p-0.5 shadow-2xs">
          {(
            [
              { id: "7d", label: t("time.last_7") },
              { id: "30d", label: t("time.last_30") },
              { id: "year", label: t("time.this_year") },
              { id: "all", label: t("time.all_time") },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                playPopSound();
                setRange(t.id);
              }}
              className={`rounded-[18px] px-3 py-1 font-gelica text-xs font-semibold transition-all ${
                range === t.id
                  ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. ANA IZGARA: RADAR PUSULA + AYLIK TAKVİM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SOL: DUYGU PUSULASI RADAR KARTI (5 Kolon) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Radar Kartı */}
          <div className="card-superr p-5 sm:p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-black/5">
              <span className="font-gelica text-xs font-bold lowercase text-[var(--ink)]">
                {t("radar.compass")}
              </span>
              {moodStats.dominantMood && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-gelica border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] font-semibold">
                  <span>{t("radar.dominant")}</span>
                  <span>{moodLabel(moodStats.dominantMood)}</span>
                </span>
              )}
            </div>

            {/* SVG Radar Spider Web */}
            <div className="relative my-3 flex items-center justify-center">
              <svg
                width={260}
                height={260}
                viewBox="0 0 260 260"
                className="overflow-visible select-none"
              >
                {/* Çokgenli Konsantrik Kılavuz Çizgileri */}
                {radarData.gridPolygons.map((pts, idx) => (
                  <polygon
                    key={idx}
                    points={pts}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={idx === 3 ? 1.4 : 0.9}
                    strokeDasharray={idx === 3 ? undefined : "3 3"}
                    className="text-[var(--ink-soft)] opacity-20"
                  />
                ))}

                {/* Merkezden Köşelere Eksen Işınları */}
                {radarData.points.map((pt, idx) => (
                  <line
                    key={idx}
                    x1={130}
                    y1={130}
                    x2={130 + 96 * Math.cos((-Math.PI / 2 + (idx * 2 * Math.PI) / 6))}
                    y2={130 + 96 * Math.sin((-Math.PI / 2 + (idx * 2 * Math.PI) / 6))}
                    stroke="currentColor"
                    strokeWidth={0.8}
                    className="text-[var(--ink-soft)] opacity-25"
                  />
                ))}

                {/* Kullanıcının Duygu Veri Poligonu */}
                <motion.polygon
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  points={radarData.polygonPoints}
                  fill="var(--accent)"
                  fillOpacity={0.24}
                  stroke="var(--accent)"
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                />

                {/* Köşe Düğümleri (Noktalar) */}
                {radarData.points.map((pt) => {
                  const isHovered = activeMoodHover === pt.mood;
                  const isDominant = moodStats.dominantMood === pt.mood;
                  const meta = MOOD_META[pt.mood];
                  return (
                    <g
                      key={pt.mood}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        playPopSound();
                        setActiveMoodHover(pt.mood);
                      }}
                      onMouseLeave={() => setActiveMoodHover(null)}
                    >
                      {/* Genişletilmiş Görünmez Dokunma Alanı */}
                      <circle cx={pt.x} cy={pt.y} r={16} fill="transparent" />

                      {/* Düğüm Çemberi */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : isDominant ? 4.5 : 3.5}
                        fill={meta?.color || "var(--accent)"}
                        stroke="var(--paper)"
                        strokeWidth={1.5}
                        className="transition-all duration-150"
                      />

                      {/* Dış Eksen Başlığı */}
                      {(() => {
                        const angle = (-Math.PI / 2 + (MOOD_ORDER.indexOf(pt.mood as any) * 2 * Math.PI) / 6);
                        const labelR = 118;
                        const lx = 130 + labelR * Math.cos(angle);
                        const ly = 130 + labelR * Math.sin(angle);
                        return (
                          <text
                            x={lx}
                            y={ly + 4}
                            textAnchor="middle"
                            className={`font-gelica text-[10px] select-none transition-colors ${
                              isHovered
                                ? "fill-[var(--accent)] font-bold text-[11px]"
                                : "fill-[var(--ink-soft)]"
                            }`}
                          >
                            {moodLabel(pt.mood)}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}

                {/* Merkez Pusula Noktası */}
                <circle cx={130} cy={130} r={2.5} fill="var(--ink)" opacity={0.4} />
              </svg>
            </div>

            {/* Hover Tooltip veya Bilgi Çubuğu */}
            <div className="h-6 flex items-center justify-center text-center">
              {activeMoodHover ? (
                <div className="flex items-center gap-1.5 font-gelica text-xs font-bold text-[var(--accent)]">
                  <span>{MOOD_META[activeMoodHover]?.icon}</span>
                  <span>{moodLabel(activeMoodHover)}:</span>
                  <span className="font-mono">{moodStats.counts[activeMoodHover] || 0} gün</span>
                  <span className="text-[10px] opacity-75">
                    (%{moodStats.percents[activeMoodHover] || 0})
                  </span>
                </div>
              ) : (
                <span className="font-handwritten text-[11px] text-[var(--ink-soft)] italic">
                  {t("radar.hover_hint")}
                </span>
              )}
            </div>

            {/* Yatay İlerleme Çubukları (Tüm Duyguların Dökümü) */}
            <div className="w-full mt-4 space-y-2 pt-3 border-t border-black/5">
              {MOOD_ORDER.map((mId) => {
                const meta = MOOD_META[mId];
                const count = moodStats.counts[mId] || 0;
                const pct = moodStats.percents[mId] || 0;
                return (
                  <div
                    key={mId}
                    className="flex items-center gap-2 text-xs font-gelica group cursor-pointer"
                    onMouseEnter={() => setActiveMoodHover(mId)}
                    onMouseLeave={() => setActiveMoodHover(null)}
                  >
                    <span className="w-4 shrink-0 flex items-center justify-center">
                      {meta?.icon}
                    </span>
                    <span className="w-16 shrink-0 truncate text-[11px] text-[var(--ink)]">
                      {moodLabel(mId)}
                    </span>
                    <div className="flex-1 bg-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: meta?.color || "var(--accent)" }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-end font-mono text-[10px] text-[var(--ink-soft)]">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}

                {/* Haftalık duygu trendi — mürekkep eğrisi */}
                <JournalMoodTrend entries={entries} referenceDate={trendReference} />

                {/* Yıllık yazma karşılaştırması */}
                <JournalYearCompare
                  entries={entries}
                  activeYear={heatYear}
                  onSelectYear={setHeatYear}
                />

                {/* Yıllık yazma haritası (katkı ısı haritası) */}
                <JournalHeatmap
                  entries={entries}
                  onSelectDay={onSelectDate}
                  year={heatYear}
                  onYearChange={(y) => { setHeatYear(y); setRange("year"); }}
                />
            </div>
          </div>

          {/* Defter İç Görü ve Rehberlik Notu */}
          <div className="rounded-[16px] border border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-[9px] font-mono uppercase px-2 py-0.5 font-bold tracking-wider">
                {insight.tag}
              </span>
              <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
                {t("radar.whisper")}
              </span>
            </div>
            <h4 className="font-gelica text-sm font-bold text-[var(--ink)]">
              {insight.title}
            </h4>
            <p className="font-gelica text-xs leading-relaxed text-[var(--ink)] mt-1 opacity-90 italic">
              "{insight.message}"
            </p>
          </div>
        </div>

        {/* SAĞ: AYLIK DEFTER TAKVİM MATRİSİ + YAZMA METRİKLERİ (7 Kolon) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Takvim Kartı */}
          <div className="card-superr p-5 sm:p-6">
            {/* Takvim Üst Gezinti Barı */}
            <div className="flex items-center justify-between pb-4 border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className="font-gelica text-base font-bold text-[var(--ink)]">
                  {monthNames[viewMonth]} {viewYear}
                </span>
                <button
                  onClick={handleTodayMonth}
                  className="rounded-full border border-[var(--line)] px-2 py-0.5 font-handwritten text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--app-bg)] transition-colors"
                >
                  bu ay
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  title={t("time.prev_month")}
                  className="h-7 w-7 rounded-full border border-[var(--line)] flex items-center justify-center text-xs hover:bg-[var(--ink)] hover:text-[var(--app-bg)] transition-colors font-mono"
                >
                  ‹
                </button>
                <button
                  onClick={handleNextMonth}
                  title="Sonraki ay"
                  className="h-7 w-7 rounded-full border border-[var(--line)] flex items-center justify-center text-xs hover:bg-[var(--ink)] hover:text-[var(--app-bg)] transition-colors font-mono"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Haftanın Günleri Başlıkları */}
            <div className="grid grid-cols-7 gap-1 pt-3 pb-2 text-center">
              {weekdayNames.map((day) => (
                <div
                  key={day}
                  className="font-gelica text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Takvim Hücreleri Matrisi */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarCells.map((cell) => {
                const moodMeta = cell.primaryMood ? MOOD_META[cell.primaryMood] : null;

                return (
                  <button
                    key={cell.dateKey}
                    onClick={() => {
                      playPaperRustle();
                      onSelectDate(cell.dateKey);
                    }}
                    title={
                      cell.hasEntry
                        ? `${cell.dateKey}: ${cell.entryCount} x (${moodLabel(cell.primaryMood)}), ${cell.totalWords} ${t("radar.words_suffix")}`
                        : `${cell.dateKey}: ${t("radar.write_today")}`
                    }
                    className={`relative min-h-[58px] sm:min-h-[64px] rounded-[12px] p-1.5 flex flex-col justify-between items-start text-start border transition-all ${
                      cell.isCurrentMonth
                        ? "bg-[var(--paper)] text-[var(--ink)]"
                        : "bg-transparent text-[var(--ink-soft)] opacity-40"
                    } ${
                      cell.isToday
                        ? "border-2 border-[var(--accent)] shadow-xs"
                        : cell.hasEntry
                        ? "border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] hover:border-[var(--accent)] hover:-translate-y-0.5 shadow-2xs"
                        : "border-[color-mix(in_srgb,var(--border-ink)_12%,transparent)] hover:border-[var(--ink)]"
                    }`}
                  >
                    {/* Gün Numarası + Bugün Göstergesi (tek turuncu nefes alan nokta) */}
                    <div className="w-full flex items-center justify-between">
                      <span
                        className={`font-mono text-xs ${
                          cell.isToday ? "font-bold text-[var(--accent)]" : "font-medium"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {cell.isToday ? (
                        <span
                          aria-hidden="true"
                          title={t("time.today_title")}
                          className="calendar-today-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                        />
                      ) : cell.entryCount > 1 ? (
                        <span className="font-mono text-[9px] text-[var(--ink-soft)]">
                          {cell.entryCount}x
                        </span>
                      ) : null}
                    </div>

                    {/* Günlük Duygu Damgası / Rozeti */}
                    {cell.hasEntry ? (
                      <div
                        className={`w-full mt-1 flex items-center gap-1 rounded-[8px] border px-1.5 py-0.5 text-[9px] font-gelica ${
                          moodMeta?.badgeBg || "bg-[var(--app-bg)] border-[var(--border-ink)]"
                        }`}
                      >
                        <span className="shrink-0">{moodMeta?.icon}</span>
                        <span className="truncate hidden sm:inline text-[9px] font-medium">
                          {moodLabel(cell.primaryMood)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-end">
                        <span className="font-handwritten text-[10px] text-[var(--ink-soft)] opacity-0 group-hover:opacity-100">
                          +
                        </span>
                      </div>
                    )}

                  </button>
                );
              })}
            </div>

            {/* Takvim Alt Bilgisi */}
            <div className="mt-4 pt-3 border-t border-black/5 flex flex-wrap items-center justify-between text-xs font-gelica text-[var(--ink-soft)] gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]" />
                <span className="text-[11px]">{t("radar.calendar_hint")}</span>
              </div>
              {onNewEntry && (
                <button
                  onClick={onNewEntry}
                  className="font-handwritten text-xs font-bold text-[var(--accent)] hover:underline"
                >
                  {t("radar.new_page")}
                </button>
              )}
            </div>
          </div>

          {/* Yazma Ritmi ve Alışkanlık Metrikleri (4'lü Kart) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] p-3.5 shadow-2xs">
              <span className="font-mono text-xs text-[var(--ink-soft)] block mb-1">{t("radar.stat.total")}</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)] block">
                {habits.totalWords.toLocaleString(langToLocale(lang))}
              </span>
              <span className="font-handwritten text-[10px] text-[var(--ink-soft)] italic">
                {t("radar.total_words")}
              </span>
            </div>

            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] p-3.5 shadow-2xs">
              <span className="font-mono text-xs text-[var(--ink-soft)] block mb-1">{t("radar.stat.avg")}</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)] block">
                {habits.avgWordsPerEntry}
              </span>
              <span className="font-handwritten text-[10px] text-[var(--ink-soft)] italic">
                {t("radar.avg_words")}
              </span>
            </div>

            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] p-3.5 shadow-2xs">
              <span className="font-mono text-xs text-[var(--ink-soft)] block mb-1">{t("radar.stat.peak")}</span>
              <span className="font-gelica text-xs font-bold text-[var(--accent)] block truncate mt-1">
                {habits.peakHourSlot}
              </span>
              <span className="font-handwritten text-[10px] text-[var(--ink-soft)] italic">
                {t("radar.peak_slot")}
              </span>
            </div>

            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] p-3.5 shadow-2xs">
              <span className="font-mono text-xs text-[var(--ink-soft)] block mb-1">{t("radar.stat.prompt")}</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)] block">
                {habits.entriesWithPrompt}
              </span>
              <span className="font-handwritten text-[10px] text-[var(--ink-soft)] italic">
                {t("radar.prompt_pages")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
