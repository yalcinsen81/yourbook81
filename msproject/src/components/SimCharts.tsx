import { formatNumber, formatPercent, monthName, t, weekStartDay } from "../i18n";
import { costBins, finishBuckets } from "../model/simulation";
import type { SimulationSummary } from "../model/types";
import { PeriodBars } from "./charts";

const pct = (v: number) => formatPercent(v, 0);
// Eksen etiketleri kısa: "1 Mar", "650 bin"
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${monthName(Number(iso.slice(5, 7)) - 1, true)}`;
const amount = (v: number) => (Math.abs(v) >= 1_000_000 ? t("charts.million", { n: formatNumber(v / 1_000_000, 2) }) : Math.abs(v) >= 1000 ? t("charts.thousand", { n: formatNumber(Math.round(v / 1000), 0) }) : formatNumber(v, 0));
const labels = () => ({ planned: t("sim.probability"), baseline: "", cumulative: t("sim.cumulative") });

/** Bitiş tarihi dağılımı: dönem başına olasılık (çubuk) ve birikimli olasılık (çizgi) */
export function FinishDistribution({ result }: { result: SimulationSummary }) {
  const items = finishBuckets(result.finishCdf, weekStartDay()).map((b) => ({ label: dayLabel(String(b.from)), value: b.p * 100, cumulative: b.cumulative * 100 }));
  return <PeriodBars label={t("sim.finishChart")} format={pct} items={items} labels={labels()} />;
}

/** Maliyet dağılımı: eşit genişlikte tutar aralıkları */
export function CostDistribution({ result }: { result: SimulationSummary }) {
  const items = costBins(result.costCdf, 10).map((b) => ({ label: amount(Number(b.from)), value: b.p * 100, cumulative: b.cumulative * 100 }));
  return <PeriodBars label={t("sim.costChart")} format={pct} items={items} labels={labels()} />;
}
