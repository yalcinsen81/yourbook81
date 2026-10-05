import { useMemo } from "react";
import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import type { WordCard } from "../lib/types";
import { calculateAllStats, type EngagementSnapshot } from "../lib/stats";

interface LearningStatsProps {
  /** Tum kartlar (masa disi dahil) */
  cards: WordCard[];
  /** XP / streak durumu */
  engagement: EngagementSnapshot;
  onClose: () => void;
}

const MATURITY_COLORS: Record<string, string> = {
  new: "bg-[color-mix(in_srgb,var(--ink)_24%,transparent)]",
  learning: "bg-[var(--accent)]",
  reviewing: "bg-[color-mix(in_srgb,var(--accent)_62%,var(--ink))]",
  mastered: "bg-[color-mix(in_srgb,var(--accent)_92%,black)]",
};

export default function LearningStats({ cards, engagement, onClose }: LearningStatsProps) {
  const { t } = useT();
  const stats = useMemo(() => calculateAllStats(cards, engagement), [cards, engagement]);

  const hasData = stats.maturity.total > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      data-qa-modal="stats"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[86vh] overflow-y-auto rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--accent)]">
              {t("stats.kicker")}
            </p>
            <h3 className="font-gelica text-[17px] font-bold text-[var(--ink)]">{t("stats.title")}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("act.close")}
            title={t("act.close")}
            className="rounded-full border border-[color-mix(in_srgb,var(--ink)_24%,transparent)] px-2 py-0.5 font-mono text-[11px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>

        {!hasData ? (
          <div className="py-6 text-center">
            <p className="font-gelica text-[14px] text-[var(--ink)] mb-1">{t("stats.empty")}</p>
            <p className="font-mono text-[11px] text-[var(--ink-soft)]">{t("stats.empty_hint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1) Kelime olgunlugu */}
            <Section title={t("stats.maturity")} hint={`${stats.maturity.avgReviews} ${t("stats.avg_reviews")}`}>
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--ink)_18%,transparent)]">
                {stats.maturity.buckets.map((b) =>
                  b.percent > 0 ? (
                    <div
                      key={b.key}
                      className={"h-full " + (MATURITY_COLORS[b.key] ?? "")}
                      style={{ width: b.percent + "%" }}
                      data-maturity={b.key}
                      title={`${t("stats.mat." + b.key)} · ${b.count} (${b.percent}%)`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {stats.maturity.buckets.map((b) => (
                  <div key={b.key} className="flex items-center gap-1.5">
                    <span className={"inline-block h-2 w-2 rounded-[2px] " + (MATURITY_COLORS[b.key] ?? "")} />
                    <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                      {t("stats.mat." + b.key)}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[var(--ink)]" data-maturity-count={b.key}>
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 2) Masa dagilimi */}
            <Section title={t("stats.desks")}>
              <div className="space-y-1.5">
                {stats.desks.map((d) => (
                  <div key={d.lang} className="flex items-center gap-2" data-desk-stat={d.lang}>
                    <span className="w-9 shrink-0 font-mono text-[11px] font-bold text-[var(--ink)]">
                      {d.lang}
                    </span>
                    <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{ width: d.masteredPercent + "%" }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--ink-soft)]">
                      {t("stats.mastered_of")
                        .replace("{m}", String(d.mastered))
                        .replace("{n}", String(d.total))}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 3) Kart kalitesi */}
            <Section title={t("stats.quality")} hint={`${stats.quality.qualityScore}%`}>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "stats.q.translation", n: stats.quality.withTranslation },
                  { key: "stats.q.article", n: stats.quality.withArticle },
                  { key: "stats.q.grammar", n: stats.quality.withGrammar },
                  { key: "stats.q.tags", n: stats.quality.withTags },
                ].map((row) => {
                  const pct = stats.quality.total === 0 ? 0 : Math.round((row.n / stats.quality.total) * 100);
                  return (
                    <div key={row.key} data-quality={row.key}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="font-mono text-[10px] text-[var(--ink-soft)]">{t(row.key)}</span>
                        <span className="font-mono text-[10px] font-bold text-[var(--ink)]">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: pct + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* 4) Seri & seviye */}
            <Section title={t("stats.streak")} hint={`${t("stats.goal")} ✦`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-gelica text-[22px] font-bold text-[var(--ink)]">
                  {stats.streak.xp}
                  <span className="ms-1 font-mono text-[11px] font-normal text-[var(--ink-soft)]">XP</span>
                </span>
                <span className="font-mono text-[11px] text-[var(--accent)]">
                  {t("stats.goal")}: {stats.streak.goalPercent}%
                </span>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: stats.streak.goalPercent + "%" }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label={`${t("stats.answered_today")}`} value={stats.streak.answeredToday} />
                <MiniStat label={`${t("stats.mastered_today")}`} value={stats.streak.masteredToday} />
                <MiniStat label={`${t("stats.bonus_today")}`} value={stats.streak.bonusXpToday} />
              </div>
            </Section>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--ink)_16%,transparent)] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-gelica text-[12px] font-bold text-[var(--ink)]">{title}</p>
        {hint ? <span className="font-mono text-[9px] text-[var(--ink-soft)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-1.5 py-1.5">
      <div className="font-gelica text-[15px] font-bold leading-none text-[var(--ink)]">{value}</div>
      <div className="mt-0.5 font-mono text-[8px] leading-tight text-[var(--ink-soft)]">{label}</div>
    </div>
  );
}
