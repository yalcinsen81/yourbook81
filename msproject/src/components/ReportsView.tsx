import { useMemo, useState } from "react";
import { formatDateLocal, formatMoney, formatMoneyShort, formatNumber, formatPercent, t, type MessageKey } from "../i18n";
import { useLocale } from "../i18n/react";
import { formatShort } from "../model/calendar";
import type { Orientation } from "../model/ganttSvg";
import { buildReport, cashFlow, earnedValue, noActualCost, REPORT_KINDS, sCurveSeries, type CashPeriod, type Cell, type CellKind, type ReportKind, type ReportTable } from "../model/reports";
import type { Curves, ResourceUsage } from "../model/resources";
import { reportToCsv, reportToSheet } from "../model/tabular";
import type { Project, Schedule } from "../model/types";
import { writeXlsx } from "../model/xlsx";
import { downloadBlob, fileNameFor, XLSX_TYPE } from "../download";
import { LoadHistogram, PeriodBars, SeriesChart } from "./charts";
import { Icon } from "./icons";
import { PrintPreview } from "./PrintPreview";
import { CostDistribution, FinishDistribution } from "./SimCharts";

interface Props {
  project: Project;
  schedule: Schedule;
  usage: ResourceUsage[];
  curves: Curves;
  today: string;
  /** Gantt'ta gösterilen referans plan (-1 yok); raporlar varsayılan olarak onu kullanır */
  baselineIndex: number;
  onHelp: (topic: "evm") => void;
  /** Görev bilgisi penceresini açar (eksik gerçekleşen maliyet listesinden) */
  onOpenTask?: (id: string) => void;
}

const ICONS: Record<ReportKind, string> = {
  evm: "◎",
  scurve: "∫",
  critical: "⚑",
  resources: "☰",
  histogram: "▥",
  cashflow: "₺",
  tasks: "≡",
  milestones: "◆",
  risks: "⚠",
  simulation: "≈",
  quality: "✓",
};

/** Raporlar: kazanılmış değer, S eğrisi, kritik yol, kaynak, histogram, nakit akışı, görev ve kilometre taşı listeleri */
export function ReportsView({ project, schedule, usage, curves, today, baselineIndex, onHelp, onOpenTask }: Props) {
  const [kind, setKind] = useState<ReportKind>("evm");
  const [period, setPeriod] = useState<CashPeriod>("month");
  const [base, setBase] = useState<number>(baselineIndex >= 0 ? baselineIndex : (project.baselines?.[0]?.index ?? -1));
  const workRes = usage.filter((u) => u.resource.type !== "material");
  const [resId, setResId] = useState<string>(workRes[0]?.resource.id ?? "");
  const [printing, setPrinting] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const baselines = project.baselines ?? [];
  const baseIdx = baselines.some((b) => b.index === base) ? base : -1;
  const opts = { today, baselineIndex: baseIdx >= 0 ? baseIdx : undefined, period };
  const loc = useLocale();
  const table = useMemo(() => buildReport(kind, project, schedule, opts), [kind, project, schedule, today, baseIdx, period, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileBase = [project.name, table.title.split(" · ")[0], today];
  const exportCsv = () => downloadBlob(new Blob([reportToCsv(table)], { type: "text/csv;charset=utf-8" }), fileNameFor(fileBase, "csv"));
  const exportXlsx = () => downloadBlob(new Blob([writeXlsx([reportToSheet(table)]) as BlobPart], { type: XLSX_TYPE }), fileNameFor(fileBase, "xlsx"));
  const exportAll = () => {
    const sheets = REPORT_KINDS.map((k) => reportToSheet(buildReport(k, project, schedule, opts)));
    downloadBlob(new Blob([writeXlsx(sheets) as BlobPart], { type: XLSX_TYPE }), fileNameFor([project.name, t("report.all"), today], "xlsx"));
  };

  if (!project.tasks.length) {
    return (
      <div className="page">
        <section className="card">
          <p className="empty">{t("charts.needTask")}</p>
        </section>
      </div>
    );
  }

  const body = (
    <ReportBody kind={kind} table={table} project={project} schedule={schedule} curves={curves} usage={workRes} resId={resId} today={today} baseIdx={baseIdx} period={period} onOpenTask={onOpenTask} />
  );

  return (
    <div className="page reports-page">
      <nav className="report-nav" aria-label={t("report.nav")}>
        {REPORT_KINDS.map((k) => (
          <button key={k} className={k === kind ? "on" : ""} aria-current={k === kind ? "page" : undefined} onClick={() => setKind(k)}>
            <span className="report-ico" aria-hidden>
              {ICONS[k]}
            </span>
            {t(`report.${k}` as MessageKey)}
          </button>
        ))}
      </nav>
      <section className="report-main">
        <div className="charts-bar report-bar">
          <h2 className="report-title">{table.title}</h2>
          {baselines.length > 0 && (kind === "evm" || kind === "scurve" || kind === "cashflow" || kind === "milestones") && (
            <label className="inline-field">
              <span>{t("report.baseline")}</span>
              <select value={baseIdx} onChange={(e) => setBase(Number(e.target.value))}>
                {kind !== "evm" && <option value={-1}>{t("report.noBaseline")}</option>}
                {baselines.map((b) => (
                  <option key={b.index} value={b.index}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "cashflow" && (
            <div className="segmented" role="radiogroup" aria-label={t("report.col.period")}>
              {(["month", "week"] as const).map((p) => (
                <button key={p} role="radio" aria-checked={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
                  {t(`report.period.${p}`)}
                </button>
              ))}
            </div>
          )}
          {kind === "histogram" && workRes.length > 0 && (
            <label className="inline-field">
              <span>{t("report.resource")}</span>
              <select value={resId} onChange={(e) => setResId(e.target.value)}>
                {workRes.map((u) => (
                  <option key={u.resource.id} value={u.resource.id}>
                    {u.resource.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "evm" && (
            <button className="link-btn" onClick={() => onHelp("evm")}>
              <Icon name="info" size={14} /> {t("report.formulas")}
            </button>
          )}
          <span className="spacer" />
          <div className="tgroup">
            <button className="tbtn" onClick={exportCsv} title={t("report.csvTitle")}>
              <Icon name="download" size={16} />
              <span>CSV</span>
            </button>
            <button className="tbtn" onClick={exportXlsx} title={t("report.xlsxTitle")}>
              <Icon name="download" size={16} />
              <span>Excel</span>
            </button>
            <button className="tbtn" onClick={exportAll} title={t("report.allTitle")}>
              <Icon name="download" size={16} />
              <span>{t("report.allShort")}</span>
            </button>
            <button className="tbtn" onClick={() => setPrinting(true)} title={t("report.printTitle")}>
              <Icon name="file" size={16} />
              <span>{t("report.print")}</span>
            </button>
          </div>
        </div>
        {body}
      </section>
      {printing && (
        <PrintPreview title={table.title} size="A4" orientation={orientation} onOrientation={setOrientation} onClose={() => setPrinting(false)}>
          <header className="print-head">
            <h1>{table.title}</h1>
            <p>
              {project.name} · {formatDateLocal(today)}
            </p>
          </header>
          {body}
        </PrintPreview>
      )}
    </div>
  );
}

function ReportBody(props: {
  kind: ReportKind;
  table: ReportTable;
  project: Project;
  schedule: Schedule;
  curves: Curves;
  usage: ResourceUsage[];
  resId: string;
  today: string;
  baseIdx: number;
  period: CashPeriod;
  onOpenTask?: (id: string) => void;
}) {
  const { kind, table, project, schedule, curves, today, baseIdx, onOpenTask } = props;
  const bi = baseIdx >= 0 ? baseIdx : undefined;
  let visual: React.ReactNode = null;
  if (kind === "evm") {
    const e = earnedValue(project, schedule, today, bi);
    const ratio = (v: number | null) => (v === null ? "—" : formatNumber(v, 2));
    const tone = (v: number | null) => (v === null ? "" : v >= 1 ? "good" : "bad");
    // Hiç gerçekleşen maliyet yoksa CPI ve ona bağlı tahminler gösterilmez (hesap aynı)
    const noAc = noActualCost(e);
    const estimated = e.acEstimatedRows.length;
    visual = (
      <>
        <div className="kpis">
          <Kpi label="BAC" value={formatMoney(e.bac)} sub={t("evm.short.bac")} />
          <Kpi label="PV" value={formatMoney(e.pv)} sub={t("evm.short.pv")} />
          <Kpi label="EV" value={formatMoney(e.ev)} sub={t("evm.short.ev")} />
          <Kpi label="AC" value={formatMoney(e.ac)} sub={noAc ? t("evm.acNone") : estimated ? t("evm.short.acEstimated", { n: estimated }) : t("evm.short.ac")} />
          <Kpi label="SPI" value={ratio(e.spi)} sub={e.spi === null ? t("evm.notStarted") : e.spi >= 1 ? t("evm.ahead") : t("evm.behind")} tone={tone(e.spi)} />
          {noAc ? (
            <>
              <Kpi label="CPI" value="—" sub={t("evm.acNone")} />
              <Kpi label="EAC" value="—" sub={t("evm.acNone")} />
              <Kpi label="ETC" value="—" sub={t("evm.acNone")} />
              <Kpi label="VAC" value="—" sub={t("evm.acNone")} />
            </>
          ) : (
            <>
              <Kpi label="CPI" value={ratio(e.cpi)} sub={e.cpi === null ? t("evm.notStarted") : e.cpi >= 1 ? t("evm.underBudget") : t("evm.overBudget")} tone={tone(e.cpi)} />
              <Kpi label="EAC" value={formatMoney(e.eac)} sub={`VAC ${formatMoney(e.vac)}`} tone={e.vac >= 0 ? "good" : "bad"} />
            </>
          )}
        </div>
        <AcMissing project={project} rows={e.acEstimatedRows} onOpenTask={onOpenTask} />
      </>
    );
  } else if (kind === "scurve") {
    const pts = sCurveSeries(project, schedule, curves, today, bi);
    const hasBase = pts.some((p) => p.baseline !== null);
    visual = (
      <section className="card">
        <SeriesChart
          label={table.title}
          yMax={100}
          yFormat={(v) => formatPercent(v)}
          today={today}
          series={[
            { key: "planned", label: t("report.col.planned"), cls: "planned", points: pts.map((p) => ({ date: p.date, value: p.planned })) },
            ...(hasBase ? [{ key: "baseline", label: t("report.col.baselineCost"), cls: "baseline", dashed: true, points: pts.map((p) => ({ date: p.date, value: p.baseline })) }] : []),
            { key: "actual", label: t("report.col.actual"), cls: "actual", points: pts.map((p) => ({ date: p.date, value: p.actual })) },
          ]}
        />
      </section>
    );
  } else if (kind === "cashflow") {
    const rows = cashFlow(project, schedule, curves, props.period, bi);
    visual = (
      <section className="card">
        <PeriodBars
          label={table.title}
          format={(v) => formatMoneyShort(v)}
          items={rows.map((r) => ({ label: props.period === "month" ? r.label : formatShort(r.from), value: r.planned, baseline: r.baseline, cumulative: r.cumulative }))}
          labels={{ planned: t("report.col.planned"), baseline: t("report.col.baselineCost"), cumulative: t("report.col.cumulative") }}
        />
      </section>
    );
  } else if (kind === "simulation" && project.simResult) {
    visual = (
      <div className="chart-grid">
        <section className="card">
          <header className="card-head">
            <h3>{t("sim.finishChart")}</h3>
          </header>
          <FinishDistribution result={project.simResult} />
        </section>
        <section className="card">
          <header className="card-head">
            <h3>{t("sim.costChart")}</h3>
          </header>
          <CostDistribution result={project.simResult} />
        </section>
      </div>
    );
  } else if (kind === "histogram") {
    const u = props.usage.find((x) => x.resource.id === props.resId) ?? props.usage[0];
    visual = u ? (
      <section className="card">
        <header className="card-head">
          <h3>{u.resource.name}</h3>
        </header>
        <LoadHistogram usage={u} calendar={schedule.calendar} />
      </section>
    ) : (
      <p className="empty">{t("report.noResources")}</p>
    );
  }
  return (
    <>
      {visual}
      {table.notes?.map((n) => (
        <p key={n} className="info-note" role="note">
          <Icon name="info" size={15} />
          {n}
        </p>
      ))}
      <ReportTableView table={table} />
    </>
  );
}

/** "Eksik gerçekleşen maliyet" bağlantısı: başlamış ama gerçekleşen maliyeti girilmemiş görevleri açar */
function AcMissing({ project, rows, onOpenTask }: { project: Project; rows: number[]; onOpenTask?: (id: string) => void }) {
  return (
    <details className="ac-missing">
      <summary>{t("evm.acMissing", { n: rows.length })}</summary>
      {rows.length === 0 ? (
        <p className="hint">{t("evm.acMissingNone")}</p>
      ) : (
        <>
          <p className="hint">{t("evm.acMissingNote")}</p>
          <ul>
            {rows.map((r) => {
              const task = project.tasks[r - 1];
              const label = `${r}. ${task.name || "—"}`;
              return (
                <li key={task.id}>
                  {onOpenTask ? (
                    <button type="button" className="link-btn" onClick={() => onOpenTask(task.id)}>
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </details>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function formatCell(v: Cell, kind: CellKind): string {
  if (v === null || v === undefined || v === "") return "—";
  // Tarih: görev tablosundaki gibi gün kısaltması + seçili biçim ("Pzt 02.11.2026")
  if (typeof v === "string") return kind === "date" ? formatShort(v) : v;
  switch (kind) {
    case "money":
      return formatMoney(v);
    case "percent":
      return formatPercent(v, 1);
    case "days":
      return `${formatNumber(v, 1)} ${t("unit.dayLetter")}`;
    case "number":
      return formatNumber(v, 2);
    default:
      return String(v);
  }
}

/** Rapor tablosu: sayılar sağa yaslı, toplam satırı altta */
export function ReportTableView({ table }: { table: ReportTable }) {
  // Sayı, para ve tarih sütunları sağa yaslı
  const numeric = (k: CellKind) => k !== "text";
  // Plan kalitesi: Geçti / Kaldı hücresi renkli
  const resultClass = (v: unknown) => (v === t("quality.pass") ? "res-pass" : v === t("quality.fail") ? "res-fail" : "");
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c.key} className={numeric(c.kind) ? "num" : ""} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className={row.status === t("report.status.late") || row.result === t("quality.fail") ? "late" : ""}>
              {table.columns.map((c) => (
                <td key={c.key} className={`${numeric(c.kind) ? "num" : ""} ${c.key === "result" ? resultClass(row[c.key]) : ""}`}>
                  {formatCell(row[c.key], c.kind)}
                </td>
              ))}
            </tr>
          ))}
          {!table.rows.length && (
            <tr>
              <td colSpan={table.columns.length} className="empty">
                {t("report.empty")}
              </td>
            </tr>
          )}
        </tbody>
        {table.total && (
          <tfoot>
            <tr>
              {table.columns.map((c) => (
                <td key={c.key} className={numeric(c.kind) ? "num" : ""}>
                  {table.total![c.key] === undefined ? "" : formatCell(table.total![c.key], c.kind)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
