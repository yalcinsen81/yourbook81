import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { formatPercent, monthName, t, weekStartDay } from "../i18n";
import { addDays, formatShort, parseDate, type WorkCalendar } from "../model/calendar";
import type { ResourceUsage } from "../model/resources";

// Bağımlılıksız SVG grafikler. Genişlik kabın gerçek genişliğinden alınır (yazılar ölçeklenip bulanıklaşmasın).
// Yatay eksen iş günüdür; ay başları etiketlenir.

const PAD = { l: 52, r: 16, t: 14, b: 26 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, Math.max(240, width)] as const;
}

/** İş günü ekseninde ay başı etiketleri */
function monthTicks(calendar: WorkCalendar, days: number): { day: number; label: string }[] {
  const ticks: { day: number; label: string }[] = [];
  let last = "";
  for (let d = 0; d < days; d++) {
    const iso = calendar.toDate(d);
    const m = iso.slice(0, 7);
    if (m !== last) {
      // Ay adının ilk üç harfi; yıl yalnızca ilk etikette ve ocakta
      const name = monthName(Number(iso.slice(5, 7)) - 1, true);
      const year = iso.slice(0, 4);
      ticks.push({ day: d, label: !ticks.length || m.endsWith("-01") ? `${name} ${year}` : name });
      last = m;
    }
  }
  // Çok sık etiket olmasın
  const step = Math.ceil(ticks.length / 12);
  return ticks.filter((_, i) => i % step === 0);
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function Frame(props: {
  width: number;
  height: number;
  days: number;
  calendar: WorkCalendar;
  yMax: number;
  yFormat: (v: number) => string;
  children: ReactNode;
  label: string;
}) {
  const { width, height, days, calendar, yMax, yFormat } = props;
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const ticks = monthTicks(calendar, days);
  // Yuvarlak adımlı eksen: 1, 2, 2,5, 5 × 10^k
  const raw = yMax / 4;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= raw) ?? raw;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  return (
    <svg width={width} height={height} className="chart" role="img" aria-label={props.label}>
      {yTicks.map((v) => {
        const y = PAD.t + ih - (v / yMax) * ih;
        return (
          <g key={v}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={y} y2={y} className="grid-line" />
            <text x={PAD.l - 8} y={y + 4} className="axis-label" textAnchor="end">
              {yFormat(v)}
            </text>
          </g>
        );
      })}
      {ticks.map((t) => {
        const x = PAD.l + (t.day / Math.max(days, 1)) * iw;
        return (
          <g key={t.day}>
            <line x1={x} x2={x} y1={PAD.t + ih} y2={PAD.t + ih + 4} className="axis-tick" />
            <text x={x + 3} y={height - 8} className="axis-label">
              {t.label}
            </text>
          </g>
        );
      })}
      {props.children}
    </svg>
  );
}

/** Kaynak histogramı: günlük yük çubukları, kapasite çizgisi; kapasiteyi aşan kısım kırmızı */
export function LoadHistogram({ usage, calendar, height = 240 }: { usage: ResourceUsage; calendar: WorkCalendar; height?: number }) {
  const [ref, width] = useWidth();
  const days = usage.load.length;
  const cap = usage.resource.maxUnits;
  const yMax = niceMax(Math.max(usage.peak, cap) * 1.1);
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const bw = iw / Math.max(days, 1);
  const y = (v: number) => PAD.t + ih - (v / yMax) * ih;
  return (
    <div ref={ref} className="chart-box">
      <Frame width={width} height={height} days={days} calendar={calendar} yMax={yMax} yFormat={(v) => formatPercent(v)} label={t("chart.histAria", { name: usage.resource.name })}>
        {usage.load.map((v, d) => {
          if (!v) return null;
          const x = PAD.l + d * bw + (bw > 4 ? 0.75 : 0);
          const w = Math.max(bw - (bw > 4 ? 1.5 : 0), 0.8);
          const within = Math.min(v, cap);
          return (
            <g key={d}>
              <title>{t(v > cap ? "chart.dayLoadOver" : "chart.dayLoad", { date: formatShort(calendar.toDate(d)), load: String(v), cap: String(cap) })}</title>
              <rect x={x} y={y(within)} width={w} height={y(0) - y(within)} className="hbar ok" />
              {v > cap && <rect x={x} y={y(v)} width={w} height={y(cap) - y(v)} className="hbar over" />}
            </g>
          );
        })}
        <line x1={PAD.l} x2={PAD.l + iw} y1={y(cap)} y2={y(cap)} className="cap-line" />
        <text x={PAD.l + iw} y={y(cap) - 5} className="axis-label cap-text" textAnchor="end">
          {t("chart.capacity", { cap: String(cap) })}
        </text>
      </Frame>
    </div>
  );
}

export interface LinePoint {
  day: number;
  value: number;
}

/** Kümülatif eğri (S eğrisi, maliyet). İsteğe bağlı bugün çizgisi ve gerçekleşen noktası. */
export function CurveChart(props: {
  points: LinePoint[];
  days: number;
  calendar: WorkCalendar;
  yMax: number;
  yFormat: (v: number) => string;
  label: string;
  today?: number;
  actual?: { value: number; good: boolean; label: string };
  plannedToday?: number;
  height?: number;
}) {
  const { points, days, calendar, yMax, yFormat, today, actual, plannedToday, height = 240 } = props;
  const [ref, width] = useWidth();
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  // Nokta günün sonudur: day = -1 başlangıç, day = d → d+1 günlük genişlik
  const x = (day: number) => PAD.l + ((day + 1) / Math.max(days, 1)) * iw;
  const y = (v: number) => PAD.t + ih - (Math.min(v, yMax) / yMax) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${x(points[points.length - 1].day)},${y(0)} L${x(points[0].day)},${y(0)} z` : "";
  const todayIn = today !== undefined && today >= -1 && today < days;
  const tx = todayIn ? x(today!) : 0;
  return (
    <div ref={ref} className="chart-box">
      <Frame width={width} height={height} days={days} calendar={calendar} yMax={yMax} yFormat={yFormat} label={props.label}>
        <path d={area} className="curve-area" />
        <path d={line} className="curve-line" />
        {todayIn && (
          <>
            <line x1={tx} x2={tx} y1={PAD.t} y2={PAD.t + ih} className="today-line" />
            <text x={tx + 4} y={PAD.t + 10} className="axis-label today-text">
              {t("chart.today")}
            </text>
            {plannedToday !== undefined && (
              <circle cx={tx} cy={y(plannedToday)} r={4} className="dot planned">
                <title>{t("chart.plannedTip", { value: yFormat(plannedToday) })}</title>
              </circle>
            )}
            {actual && (
              <g>
                <circle cx={tx} cy={y(actual.value)} r={5.5} className={`dot actual ${actual.good ? "good" : "bad"}`}>
                  <title>{actual.label}</title>
                </circle>
                <text x={tx + 9} y={y(actual.value) + 4} className={`axis-label actual-text ${actual.good ? "good" : "bad"}`}>
                  {actual.label}
                </text>
              </g>
            )}
          </>
        )}
      </Frame>
    </div>
  );
}

/** Yatay çubuklar (kaynak başına maliyet ya da iş) */
export function BarList({ items, format }: { items: { label: string; value: number; over?: boolean }[]; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bar-list">
      {items.map((it) => (
        <div key={it.label} className="bar-item">
          <span className="bar-name" title={it.label}>
            {it.label}
          </span>
          <span className="bar-track">
            <span className={`bar-fill ${it.over ? "over" : ""}`} style={{ width: `${(it.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Kaynak yük haritası: her kaynak bir satır, her iş haftası bir hücre; renk koyuluğu yük/kapasite */
export function LoadHeatmap({ usage, calendar, onPick }: { usage: ResourceUsage[]; calendar: WorkCalendar; onPick?: (id: string) => void }) {
  const days = usage[0]?.load.length ?? 0;
  // Takvim haftalarına grupla (pazartesi başı); tatiller haftanın ilk gününü kaydırabilir
  const weeks: { from: number; to: number; label: string }[] = [];
  let lastWeek = "";
  for (let d = 0; d < days; d++) {
    const iso = calendar.toDate(d);
    const week = addDays(iso, -((parseDate(iso).getUTCDay() - weekStartDay() + 7) % 7));
    if (week !== lastWeek) {
      weeks.push({ from: d, to: d + 1, label: formatShort(week) });
      lastWeek = week;
    } else weeks[weeks.length - 1].to = d + 1;
  }
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `minmax(110px, 160px) repeat(${weeks.length}, minmax(10px, 1fr))` }}>
      {usage.map((u) => (
        <div key={u.resource.id} className="heat-row" role="row">
          <button className="heat-name" onClick={() => onPick?.(u.resource.id)} title={`${u.resource.name} · ${t("chart.showHist")}`}>
            {u.resource.name || t("common.unnamed")}
          </button>
          {weeks.map((w) => {
            const slice = u.load.slice(w.from, w.to);
            const peak = Math.max(0, ...slice);
            const ratio = peak / u.resource.maxUnits;
            const cls = peak === 0 ? "l0" : ratio > 1 ? "over" : ratio > 0.75 ? "l3" : ratio > 0.4 ? "l2" : "l1";
            return (
              <span key={w.from} className={`heat-cell ${cls}`} title={t("chart.heatCell", { name: u.resource.name, week: w.label, peak: String(peak), cap: String(u.resource.maxUnits) })} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  /** CSS sınıfı (renk): planned, baseline, actual */
  cls: string;
  /** Takvim tarihi (ISO) → değer; null nokta çizilmez */
  points: { date: string; value: number | null }[];
  dashed?: boolean;
}

/** Takvim günü ekseninde çok serili çizgi grafik (S eğrisi: planlanan, referans plan, gerçekleşen) */
export function SeriesChart(props: { series: Series[]; yMax: number; yFormat: (v: number) => string; label: string; today?: string; height?: number }) {
  const { series, yMax, yFormat, today, height = 280 } = props;
  const [ref, width] = useWidth();
  const dates = series.flatMap((s) => s.points.map((p) => p.date)).sort();
  if (!dates.length) return <div ref={ref} className="chart-box" />;
  const first = dates[0];
  const span = Math.max(1, diffDaysIso(first, dates[dates.length - 1]));
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const x = (d: string) => PAD.l + (diffDaysIso(first, d) / span) * iw;
  const y = (v: number) => PAD.t + ih - (Math.min(Math.max(v, 0), yMax) / yMax) * ih;
  const raw = yMax / 4;
  const p10 = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((v) => v >= raw) ?? raw;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  // Ay başı etiketleri
  const ticks: { date: string; label: string }[] = [];
  for (let d = `${first.slice(0, 7)}-01`; d <= dates[dates.length - 1]; d = nextMonth(d)) {
    if (d < first) continue;
    const m = Number(d.slice(5, 7)) - 1;
    ticks.push({ date: d, label: !ticks.length || m === 0 ? `${monthName(m, true)} ${d.slice(0, 4)}` : monthName(m, true) });
  }
  const tickStep = Math.ceil(ticks.length / 12);
  const todayIn = today && today >= first && today <= dates[dates.length - 1];
  return (
    <div ref={ref} className="chart-box">
      <svg width={width} height={height} className="chart" role="img" aria-label={props.label}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={PAD.l - 8} y={y(v) + 4} className="axis-label" textAnchor="end">
              {yFormat(v)}
            </text>
          </g>
        ))}
        {ticks
          .filter((_, i) => i % tickStep === 0)
          .map((tk) => (
            <g key={tk.date}>
              <line x1={x(tk.date)} x2={x(tk.date)} y1={PAD.t + ih} y2={PAD.t + ih + 4} className="axis-tick" />
              <text x={x(tk.date) + 3} y={height - 8} className="axis-label">
                {tk.label}
              </text>
            </g>
          ))}
        {todayIn && (
          <>
            <line x1={x(today!)} x2={x(today!)} y1={PAD.t} y2={PAD.t + ih} className="today-line" />
            <text x={x(today!) + 4} y={PAD.t + 10} className="axis-label today-text">
              {t("chart.today")}
            </text>
          </>
        )}
        {series.map((s) => {
          const pts = s.points.filter((p): p is { date: string; value: number } => p.value !== null);
          if (!pts.length) return null;
          const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
          return (
            <g key={s.key} className={`series ${s.cls}`}>
              <path d={d} className={`series-line ${s.dashed ? "dashed" : ""}`} />
              {pts.length <= 60 &&
                pts.map((p) => (
                  <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.5} className="series-dot">
                    <title>{`${s.label} · ${formatShort(p.date)}: ${yFormat(p.value)}`}</title>
                  </circle>
                ))}
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className={`series ${s.cls}`}>
            <i className={`legend-line ${s.dashed ? "dashed" : ""}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dönem çubukları (nakit akışı) ve kümülatif çizgi; isteğe bağlı referans plan çubukları */
export function PeriodBars(props: {
  items: { label: string; value: number; baseline?: number | null; cumulative: number }[];
  format: (v: number) => string;
  label: string;
  height?: number;
  labels: { planned: string; baseline: string; cumulative: string };
}) {
  const { items, format, height = 260 } = props;
  const [ref, width] = useWidth();
  const hasBase = items.some((i) => i.baseline !== null && i.baseline !== undefined);
  // Eksenler 4 eşit adımda; adım 1, 2, 2,5, 5 × 10^k (yuvarlak etiketler)
  const niceStep = (v: number) => {
    const raw = Math.max(v, 1) / 4;
    const p = 10 ** Math.floor(Math.log10(raw));
    return ([1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw) ?? raw) * 4;
  };
  const barMax = niceStep(Math.max(...items.map((i) => Math.max(i.value, i.baseline ?? 0))));
  const cumMax = niceStep(Math.max(...items.map((i) => i.cumulative)));
  const pad = { ...PAD, r: 64 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / Math.max(items.length, 1);
  const yb = (v: number) => pad.t + ih - (v / barMax) * ih;
  const yc = (v: number) => pad.t + ih - (v / cumMax) * ih;
  const step = Math.ceil(items.length / 14);
  const line = items.map((it, i) => `${i ? "L" : "M"}${(pad.l + (i + 0.5) * bw).toFixed(1)},${yc(it.cumulative).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} className="chart-box">
      <svg width={width} height={height} className="chart" role="img" aria-label={props.label}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={pad.l + iw} y1={yb(barMax * f)} y2={yb(barMax * f)} className="grid-line" />
            <text x={pad.l - 8} y={yb(barMax * f) + 4} className="axis-label" textAnchor="end">
              {format(barMax * f)}
            </text>
            <text x={pad.l + iw + 6} y={yc(cumMax * f) + 4} className="axis-label cum-text">
              {format(cumMax * f)}
            </text>
          </g>
        ))}
        {items.map((it, i) => {
          const x0 = pad.l + i * bw;
          const inner = Math.max(1, bw - Math.min(8, bw * 0.25));
          const w = hasBase ? inner / 2 : inner;
          return (
            <g key={i}>
              <title>{`${it.label}: ${format(it.value)}${hasBase ? ` · ${props.labels.baseline}: ${format(it.baseline ?? 0)}` : ""} · ${props.labels.cumulative}: ${format(it.cumulative)}`}</title>
              <rect x={x0 + (bw - inner) / 2} y={yb(it.value)} width={w} height={Math.max(0, yb(0) - yb(it.value))} className="pbar planned" />
              {hasBase && <rect x={x0 + (bw - inner) / 2 + w} y={yb(it.baseline ?? 0)} width={w} height={Math.max(0, yb(0) - yb(it.baseline ?? 0))} className="pbar baseline" />}
              {i % step === 0 && (
                <text x={x0 + bw / 2} y={height - 8} className="axis-label" textAnchor="middle">
                  {it.label}
                </text>
              )}
            </g>
          );
        })}
        <path d={line} className="cum-line" />
      </svg>
      <div className="chart-legend">
        <span className="series planned">
          <i className="legend-box" />
          {props.labels.planned}
        </span>
        {hasBase && (
          <span className="series baseline">
            <i className="legend-box" />
            {props.labels.baseline}
          </span>
        )}
        <span className="series cumulative">
          <i className="legend-line" />
          {props.labels.cumulative}
        </span>
      </div>
    </div>
  );
}

function diffDaysIso(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

function nextMonth(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
