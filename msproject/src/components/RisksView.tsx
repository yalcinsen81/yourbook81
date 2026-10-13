import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateLocal, formatMoney, formatNumber, formatPercent, parseNumberLocal, t, type MessageKey, type Msg } from "../i18n";
import { useLocale } from "../i18n/react";
import { formatShort } from "../model/calendar";
import { planQuality } from "../model/quality";
import { qualityReport } from "../model/reports";
import { exposure, MAX_ITERATIONS, newRiskId, removeRisk, riskChance, riskLevel, riskMatrix, upsertRisk } from "../model/risks";
import { resultIsCurrent, settingsOf } from "../model/simulation";
import { RISK_STATUSES, type Project, type Risk, type RiskStatus, type Schedule, type SimulationSettings } from "../model/types";
import { runSimulation, type SimJob } from "../simRunner";
import { BarList } from "./charts";
import { Icon } from "./icons";
import { ReportTableView } from "./ReportsView";
import { RiskDialog } from "./RiskDialog";
import { CostDistribution, FinishDistribution } from "./SimCharts";

interface Props {
  project: Project;
  schedule: Schedule;
  today: string;
  update: (fn: (p: Project) => Project) => void;
  flash: (text: Msg) => void;
}

type Tab = "register" | "simulation" | "quality";

/** Riskler sayfası: risk sicili (5×5 matris), Monte Carlo benzetimi ve plan kalite denetimi */
export function RisksView(props: Props) {
  const [tab, setTab] = useState<Tab>("register");
  const sim = useSimJob(props.update, props.flash);
  const draftState = useState<Draft>(() => toDraft(settingsOf(props.project)));
  const failed = useMemo(() => planQuality(props.project, props.schedule, props.today).filter((c) => !c.pass).length, [props.project, props.schedule, props.today]);
  return (
    <div className="page risks-page">
      <div className="charts-bar">
        <div className="segmented" role="tablist" aria-label={t("view.risks")}>
          {(["register", "simulation", "quality"] as Tab[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {t(`risk.tab.${k}`)}
              {k === "simulation" && sim.progress !== null && <span className="muted">{formatPercent(sim.progress * 100, 0)}</span>}
              {k === "simulation" && sim.progress === null && props.project.simResult && !resultIsCurrent(props.project) && <i className="dot-alert" aria-label={t("sim.stale")} />}
              {k === "quality" && failed > 0 && <span className="tab-count">{failed}</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === "register" && <Register {...props} />}
      {tab === "simulation" && <Simulation {...props} sim={sim} draftState={draftState} />}
      {tab === "quality" && <Quality {...props} />}
    </div>
  );
}

// --- Risk sicili ---

function Register({ project, schedule, update }: Props) {
  const [editing, setEditing] = useState<{ risk: Risk; isNew: boolean } | null>(null);
  const [cell, setCell] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<RiskStatus | "all" | "active">("active");
  const risks = project.risks ?? [];
  const matrix = useMemo(() => riskMatrix(risks), [risks]);
  const names = useMemo(() => new Map(project.tasks.map((x, i) => [x.id, `${i + 1}. ${x.name}`])), [project.tasks]);
  const shown = risks
    .filter((r) => (status === "all" ? true : status === "active" ? r.status !== "closed" : r.status === status))
    .filter((r) => !cell || (r.probability === cell[0] && r.impact === cell[1]))
    .sort((a, b) => exposure(b) - exposure(a) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const add = () => setEditing({ risk: { id: newRiskId(project), title: "", probability: 3, impact: 3, status: "open", tasks: [] }, isNew: true });
  const open = risks.filter((r) => r.status !== "closed");
  const totals = { days: open.reduce((a, r) => a + r.tasks.reduce((b, x) => b + x.days, 0) * riskChance(r), 0), cost: open.reduce((a, r) => a + r.tasks.reduce((b, x) => b + x.cost, 0) * riskChance(r), 0) };

  return (
    <>
      <div className="risk-top">
        <section className="card risk-matrix-card">
          <header className="card-head">
            <div>
              <h3>{t("risk.matrix")}</h3>
              <p className="card-sub">{t("risk.matrixSub")}</p>
            </div>
          </header>
          <div className="risk-matrix" role="grid" aria-label={t("risk.matrix")}>
            <span className="rm-axis rm-y">{t("risk.probability")}</span>
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="rm-row" role="row">
                <span className="rm-label" role="rowheader">
                  {p}
                </span>
                {[1, 2, 3, 4, 5].map((i) => {
                  const ids = matrix[p][i];
                  const on = cell?.[0] === p && cell?.[1] === i;
                  return (
                    <button
                      key={i}
                      role="gridcell"
                      className={`rm-cell lvl-${riskLevel(p * i)} ${on ? "on" : ""}`}
                      aria-pressed={on}
                      onClick={() => setCell(on ? null : [p, i])}
                      title={t("risk.cellTitle", { p: String(p), i: String(i), n: String(ids.length), ids: ids.join(", ") || "—" })}
                    >
                      {ids.length > 0 ? ids.length : ""}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="rm-row rm-foot">
              <span className="rm-label" />
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="rm-label">
                  {i}
                </span>
              ))}
            </div>
            <span className="rm-axis rm-x">{t("risk.impactScore")}</span>
          </div>
        </section>
        <div className="kpis risk-kpis">
          <Kpi label={t("risk.kpi.open")} value={String(open.length)} sub={t("risk.kpi.of", { n: String(risks.length) })} />
          <Kpi label={t("risk.kpi.high")} value={String(open.filter((r) => exposure(r) >= 10).length)} sub={t("risk.kpi.highSub")} tone={open.some((r) => exposure(r) >= 16) ? "bad" : ""} />
          <Kpi label={t("risk.kpi.days")} value={formatNumber(totals.days, 1)} sub={t("risk.kpi.expected")} />
          <Kpi label={t("risk.kpi.cost")} value={formatMoney(Math.round(totals.cost))} sub={t("risk.kpi.expected")} />
        </div>
      </div>

      <section className="card">
        <div className="charts-bar">
          <button className="tbtn primary" onClick={add} disabled={!project.tasks.length}>
            <Icon name="plus" size={16} />
            <span>{t("risk.add")}</span>
          </button>
          <label className="inline-field">
            <span>{t("risk.status")}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">{t("risk.f.active")}</option>
              <option value="all">{t("risk.f.all")}</option>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`risk.st.${s}`)}
                </option>
              ))}
            </select>
          </label>
          {cell && (
            <button className="chip" onClick={() => setCell(null)}>
              {t("risk.cellFilter", { p: String(cell[0]), i: String(cell[1]) })} ✕
            </button>
          )}
        </div>
        {shown.length ? (
          <div className="report-table-wrap">
            <table className="report-table risk-table">
              <thead>
                <tr>
                  <th scope="col">{t("risk.id")}</th>
                  <th scope="col">{t("risk.title")}</th>
                  <th scope="col" className="num" title={t("risk.exposureHint")}>
                    {t("risk.exposure")}
                  </th>
                  <th scope="col">{t("risk.category")}</th>
                  <th scope="col">{t("risk.owner")}</th>
                  <th scope="col">{t("risk.response")}</th>
                  <th scope="col">{t("risk.status")}</th>
                  <th scope="col">{t("risk.tasks")}</th>
                  <th scope="col">{t("risk.review")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={`clickable ${r.status === "closed" ? "muted-row" : ""}`} onClick={() => setEditing({ risk: r, isNew: false })}>
                    <td>
                      <button className="link-btn" onClick={(e) => (e.stopPropagation(), setEditing({ risk: r, isNew: false }))}>
                        {r.id}
                      </button>
                    </td>
                    <td>{r.title}</td>
                    <td className="num">
                      <span className={`risk-badge lvl-${riskLevel(exposure(r))}`} title={t(`risk.lvl.${riskLevel(exposure(r))}`)}>
                        {exposure(r)}
                      </span>{" "}
                      <small className="muted">
                        {r.probability}×{r.impact}
                      </small>
                    </td>
                    <td>{r.category ?? ""}</td>
                    <td>{r.owner ?? ""}</td>
                    <td>{r.response ? t(`risk.resp.${r.response}`) : ""}</td>
                    <td>{t(`risk.st.${r.status}`)}</td>
                    <td className="risk-task-list">
                      {r.tasks.map((x) => (
                        <span key={x.taskId} title={t("risk.impactShort", { days: formatNumber(x.days, 1), cost: formatMoney(x.cost) })}>
                          {names.get(x.taskId)}
                        </span>
                      ))}
                    </td>
                    <td>{r.review ? <span className={r.review < new Date().toISOString().slice(0, 10) && r.status !== "closed" ? "over-text" : ""}>{formatShort(r.review)}</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{risks.length ? t("risk.noneMatch") : t("risk.none")}</p>
        )}
      </section>

      {editing && (
        <RiskDialog
          project={project}
          schedule={schedule}
          risk={editing.risk}
          isNew={editing.isNew}
          onSave={(r) => update((p) => upsertRisk(p, r))}
          onDelete={(id) => update((p) => removeRisk(p, id))}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// --- Benzetim ---

type Draft = Record<keyof SimulationSettings, string | boolean>;

interface SimControl {
  progress: number | null;
  start: (project: Project, settings: SimulationSettings) => void;
  cancel: () => void;
}

/** Benzetim işi Riskler sayfasında tutulur: alt sekme değişince sürer, sayfadan çıkınca durur */
function useSimJob(update: Props["update"], flash: Props["flash"]): SimControl {
  const [progress, setProgress] = useState<number | null>(null);
  const job = useRef<SimJob | null>(null);
  useEffect(() => () => job.current?.cancel(), []);
  const start = (project: Project, settings: SimulationSettings) => {
    setProgress(0);
    const started = performance.now();
    const j = runSimulation({ ...project, simulation: settings }, settings, (done, total) => setProgress(done / total));
    job.current = j;
    j.promise
      .then((summary) => {
        if (job.current !== j) return;
        job.current = null;
        setProgress(null);
        if (!summary) return flash(() => t("sim.cancelled"));
        // Zaman damgası ana iş parçacığında (worker'ın saati ayrı)
        update((p) => ({ ...p, simulation: settings, simResult: { ...summary, at: new Date().toISOString() } }));
        flash(() => t("sim.done", { n: formatNumber(summary.iterations, 0), s: formatNumber((performance.now() - started) / 1000, 1) }));
      })
      .catch((e: Error) => {
        job.current = null;
        setProgress(null);
        flash(() => t("sim.failed", { error: e.message }));
      });
  };
  return { progress, start, cancel: () => job.current?.cancel() };
}

function Simulation({ project, flash, sim, draftState }: Props & { sim: SimControl; draftState: [Draft, (d: Draft) => void] }) {
  const [draft, setDraft] = draftState;
  const { progress } = sim;
  const result = project.simResult;
  const current = resultIsCurrent(project);
  const names = useMemo(() => new Map(project.tasks.map((x, i) => [x.id, `${i + 1}. ${x.name}`])), [project.tasks]);

  const parse = (): SimulationSettings | string => {
    const n = (k: keyof SimulationSettings) => parseNumberLocal(String(draft[k]));
    const iterations = n("iterations");
    const low = n("uncertaintyLow");
    const high = n("uncertaintyHigh");
    const seed = n("seed");
    if (iterations === null || iterations < 100 || iterations > MAX_ITERATIONS) return t("sim.err.iterations", { max: formatNumber(MAX_ITERATIONS, 0) });
    if (low === null || low < 0 || low > 95 || high === null || high < 0 || high > 500) return t("sim.err.uncertainty");
    if (seed === null || seed < 0 || !Number.isInteger(seed)) return t("sim.err.seed");
    return { iterations: Math.round(iterations), distribution: draft.distribution === "pert" ? "pert" : "triangular", uncertaintyLow: low, uncertaintyHigh: high, seed, includeRisks: !!draft.includeRisks };
  };

  const run = () => {
    const settings = parse();
    if (typeof settings === "string") return flash(() => String(parse()));
    sim.start(project, settings);
  };
  const cancel = sim.cancel;

  const field = (k: "iterations" | "uncertaintyLow" | "uncertaintyHigh" | "seed", label: MessageKey, hint?: string) => (
    <label className="field">
      <span>{t(label)}</span>
      <input value={String(draft[k])} inputMode="numeric" onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} disabled={progress !== null} />
      {hint && <small>{hint}</small>}
    </label>
  );

  return (
    <>
      <section className="card sim-settings">
        <header className="card-head">
          <div>
            <h3>{t("sim.settings")}</h3>
            <p className="card-sub">{t("sim.settingsSub")}</p>
          </div>
        </header>
        <div className="field-row">
          {field("iterations", "sim.iterations")}
          <label className="field">
            <span>{t("sim.distribution")}</span>
            <select value={String(draft.distribution)} onChange={(e) => setDraft({ ...draft, distribution: e.target.value })} disabled={progress !== null}>
              <option value="triangular">{t("sim.dist.triangular")}</option>
              <option value="pert">{t("sim.dist.pert")}</option>
            </select>
          </label>
          {field("uncertaintyLow", "sim.low")}
          {field("uncertaintyHigh", "sim.high")}
          {field("seed", "sim.seed")}
        </div>
        <label className="check">
          <input type="checkbox" checked={!!draft.includeRisks} onChange={(e) => setDraft({ ...draft, includeRisks: e.target.checked })} disabled={progress !== null} />
          <span>{t("sim.includeRisks", { n: String((project.risks ?? []).filter((r) => r.status !== "closed").length) })}</span>
        </label>
        <div className="sim-run">
          {progress === null ? (
            <button className="tbtn primary" onClick={run} disabled={!project.tasks.length}>
              <Icon name="sparkle" size={16} />
              <span>{result ? t("sim.rerun") : t("sim.run")}</span>
            </button>
          ) : (
            <>
              <div className="sim-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={t("sim.running")}>
                <span style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="muted">{formatPercent(progress * 100, 0)}</span>
              <button className="tbtn" onClick={cancel}>
                {t("sim.cancel")}
              </button>
            </>
          )}
          <small className="muted">{t("sim.method")}</small>
        </div>
      </section>

      {result && (
        <>
          {!current && (
            <p className="info-note warn" role="note">
              <Icon name="info" size={15} />
              {t("sim.stale")}
            </p>
          )}
          <div className="kpis">
            <Kpi label={t("sim.onTime")} value={formatPercent(result.onTime * 100, 0)} sub={t("sim.planFinish", { date: formatDateLocal(result.planFinish) })} tone={result.onTime >= 0.8 ? "good" : result.onTime < 0.5 ? "bad" : ""} />
            <Kpi label="P50" value={formatDateLocal(result.finish.p50)} sub={formatMoney(result.cost.p50)} />
            <Kpi label="P80" value={formatDateLocal(result.finish.p80)} sub={formatMoney(result.cost.p80)} />
            <Kpi label="P95" value={formatDateLocal(result.finish.p95)} sub={formatMoney(result.cost.p95)} />
            <Kpi label={t("sim.onBudget")} value={formatPercent(result.onBudget * 100, 0)} sub={t("sim.planCost", { cost: formatMoney(result.planCost) })} tone={result.onBudget >= 0.8 ? "good" : result.onBudget < 0.5 ? "bad" : ""} />
          </div>
          <p className="muted sim-meta">
            {t("report.simRun", { n: formatNumber(result.iterations, 0), seed: String(result.seed), dist: t(`sim.dist.${result.distribution}`), at: formatDateLocal(result.at.slice(0, 10)) })}
          </p>
          <div className="chart-grid">
            <section className="card">
              <header className="card-head">
                <div>
                  <h3>{t("sim.finishChart")}</h3>
                  <p className="card-sub">{t("sim.finishChartSub")}</p>
                </div>
              </header>
              <FinishDistribution result={result} />
            </section>
            <section className="card">
              <header className="card-head">
                <div>
                  <h3>{t("sim.costChart")}</h3>
                  <p className="card-sub">{t("sim.costChartSub")}</p>
                </div>
              </header>
              <CostDistribution result={result} />
            </section>
            <section className="card">
              <header className="card-head">
                <div>
                  <h3>{t("sim.tornado")}</h3>
                  <p className="card-sub">{t("sim.tornadoSub")}</p>
                </div>
              </header>
              {result.tasks.some((x) => x.correlation > 0.01) ? (
                <BarList
                  format={(v) => formatNumber(v, 2)}
                  items={[...result.tasks]
                    .filter((x) => x.correlation > 0.01)
                    .sort((a, b) => b.correlation - a.correlation)
                    .slice(0, 10)
                    .map((x) => ({ label: names.get(x.id) ?? x.id, value: x.correlation }))}
                />
              ) : (
                <p className="empty">{t("sim.noDrivers")}</p>
              )}
            </section>
            <section className="card">
              <header className="card-head">
                <div>
                  <h3>{t("sim.criticality")}</h3>
                  <p className="card-sub">{t("sim.criticalitySub")}</p>
                </div>
              </header>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("col.name")}</th>
                      <th scope="col" className="num">
                        {t("sim.criticalityCol")}
                      </th>
                      <th scope="col" className="num">
                        {t("sim.correlation")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.tasks]
                      .filter((x) => x.criticality > 0)
                      .sort((a, b) => b.criticality - a.criticality || b.correlation - a.correlation)
                      .slice(0, 15)
                      .map((x) => (
                        <tr key={x.id}>
                          <td>{names.get(x.id) ?? x.id}</td>
                          <td className="num">{formatPercent(x.criticality * 100, 0)}</td>
                          <td className="num">{formatNumber(x.correlation, 2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            {result.risks.length > 0 && (
              <section className="card wide">
                <header className="card-head">
                  <div>
                    <h3>{t("sim.riskStats")}</h3>
                    <p className="card-sub">{t("sim.riskStatsSub")}</p>
                  </div>
                </header>
                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("risk.id")}</th>
                        <th scope="col">{t("risk.title")}</th>
                        <th scope="col" className="num">
                          {t("sim.triggered")}
                        </th>
                        <th scope="col" className="num">
                          {t("sim.delay")}
                        </th>
                        <th scope="col" className="num">
                          {t("risk.cost")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...result.risks]
                        .sort((a, b) => b.delay - a.delay)
                        .map((x) => (
                          <tr key={x.id}>
                            <td>{x.id}</td>
                            <td>{project.risks?.find((r) => r.id === x.id)?.title ?? "—"}</td>
                            <td className="num">{formatPercent(x.triggered * 100, 1)}</td>
                            <td className="num">{t("sim.delayDays", { n: formatNumber(x.delay, 1) })}</td>
                            <td className="num">{formatMoney(x.cost)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </>
      )}
      {!result && progress === null && <p className="empty">{t("sim.none")}</p>}
    </>
  );
}

const toDraft = (s: SimulationSettings): Draft => ({
  iterations: String(s.iterations),
  distribution: s.distribution,
  uncertaintyLow: formatNumber(s.uncertaintyLow, 1),
  uncertaintyHigh: formatNumber(s.uncertaintyHigh, 1),
  seed: String(s.seed),
  includeRisks: s.includeRisks,
});

// --- Plan kalitesi ---

function Quality({ project, schedule, today }: Props) {
  const loc = useLocale();
  const table = useMemo(() => qualityReport(project, schedule, today), [project, schedule, today, loc]); // eslint-disable-line react-hooks/exhaustive-deps
  const checks = useMemo(() => planQuality(project, schedule, today), [project, schedule, today, loc]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h3>{t("report.quality")}</h3>
          <p className="card-sub">{t("quality.sub")}</p>
        </div>
      </header>
      {table.notes?.map((n) => (
        <p key={n} className="info-note" role="note">
          <Icon name="info" size={15} />
          {n}
        </p>
      ))}
      <ReportTableView table={table} />
      <dl className="quality-help">
        {checks.map((c) => (
          <div key={c.key}>
            <dt>{t(`quality.${c.key}`)}</dt>
            <dd>{t(`quality.${c.key}.hint`)}</dd>
          </div>
        ))}
      </dl>
    </section>
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
