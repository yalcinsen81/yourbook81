import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatNumber, formatPercent, parseNumberLocal, t } from "../i18n";
import { useLocale } from "../i18n/react";
import type { Variance } from "../model/baseline";
import { formatShort } from "../model/calendar";
import { taskCostBreakdown } from "../model/costs";
import { constraintOf, OpError, withActualFinish, withActualStart, withPercent, withRemaining } from "../model/ops";
import { exposure, riskLevel, risksByTask, validEstimate } from "../model/risks";
import { settingsOf } from "../model/simulation";
import { CONSTRAINT_TYPES, safeUrl, toTags } from "../model/storage";
import { TASK_COLORS, type ConstraintType, type CostAccrual, type Project, type Schedule, type Task, type TaskColor, type TaskLink } from "../model/types";
import { DateInput } from "./DateInput";

interface Props {
  project: Project;
  schedule: Schedule;
  taskId: string;
  /** Seçili referans planın bu görevdeki değerleri ve sapması */
  baseline?: { start: string; finish: string; variance?: Variance; name: string };
  issues: string[];
  onSave: (task: Task) => void;
  onClose: () => void;
}

/**
 * Görev bilgisi (MS Project'teki "Görev Bilgileri"): kısıt ve son tarih, gerçekleşen tarihler ve kalan süre,
 * sabit maliyet ve maliyet dağılımı, çalışılamayan dönemler. Kaydet tek bir geri al adımıdır.
 */
export function TaskInfoDialog({ project, schedule, taskId, baseline, issues, onSave, onClose }: Props) {
  const index = project.tasks.findIndex((x) => x.id === taskId);
  const task = project.tasks[index];
  const row = schedule.rows[index];
  const [ctype, setCtype] = useState<ConstraintType>(task.constraint?.type ?? "ASAP");
  const [cdate, setCdate] = useState(task.constraint?.date ?? row.startDate);
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [percent, setPercent] = useState(String(task.percent));
  const [actualStart, setActualStart] = useState(task.actualStart ?? "");
  const [actualFinish, setActualFinish] = useState(task.actualFinish ?? "");
  const remainingNow = (task.duration * (100 - task.percent)) / 100;
  const [remaining, setRemaining] = useState(formatNumber(remainingNow, 1));
  const [fixedCost, setFixedCost] = useState(task.fixedCost ? formatNumber(task.fixedCost, 2) : "");
  const [accrual, setAccrual] = useState<CostAccrual>(task.costAccrual ?? "prorated");
  const [blackouts, setBlackouts] = useState<Set<string>>(new Set(task.blackouts ?? []));
  const [clearDelay, setClearDelay] = useState(false);
  const [actualCost, setActualCost] = useState(task.actualCost !== undefined ? formatNumber(task.actualCost, 2) : "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [tags, setTags] = useState((task.tags ?? []).join(", "));
  const [color, setColor] = useState<TaskColor | undefined>(task.color);
  const [estimate, setEstimate] = useState<[string, string, string]>(
    task.estimate ? [formatNumber(task.estimate.optimistic, 1), formatNumber(task.estimate.likely, 1), formatNumber(task.estimate.pessimistic, 1)] : ["", "", ""],
  );
  const [error, setError] = useState<string | null>(null);
  const linkedRisks = useMemo(() => risksByTask(project).get(taskId) ?? [], [project, taskId]);
  const sim = settingsOf(project);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loc = useLocale();
  const cost = useMemo(() => taskCostBreakdown(task, project), [task, project, loc]); // eslint-disable-line react-hooks/exhaustive-deps
  const needsDate = ctype !== "ASAP" && ctype !== "ALAP";
  const leaf = !row.isSummary;
  const workRemaining = (task.assignments ?? []).reduce((sum, a) => {
    const r = project.resources.find((x) => x.id === a.resourceId);
    return sum + (r && r.type !== "material" ? (a.units * remainingNow) / 100 : 0);
  }, 0);

  const save = () => {
    try {
      let next: Task = { ...task };
      const c = constraintOf(ctype, needsDate ? cdate : undefined);
      if (c) next.constraint = c;
      else delete next.constraint;
      if (deadline) next.deadline = deadline;
      else delete next.deadline;
      if (leaf) {
        // İlerleme alanları MS Project'teki sırayla: gerçekleşen başlangıç, yüzde, gerçekleşen bitiş, kalan süre
        if (actualStart !== (task.actualStart ?? "")) next = withActualStart(next, actualStart);
        const pct = parseNumberLocal(percent);
        if (pct === null || pct < 0 || pct > 100) throw new OpError(t("err.percent"));
        if (Math.round(pct) !== task.percent) next = withPercent(next, pct, schedule);
        if (actualFinish !== (task.actualFinish ?? "")) next = withActualFinish(next, actualFinish, schedule);
        const rem = parseNumberLocal(remaining);
        if (rem === null || rem < 0) throw new OpError(t("err.remaining"));
        if (Math.abs(rem - remainingNow) > 0.05) next = withRemaining(next, rem, schedule);
        const fc = fixedCost.trim() ? parseNumberLocal(fixedCost) : 0;
        if (fc === null || fc < 0) throw new OpError(t("err.fixedCost"));
        if (fc > 0) next.fixedCost = fc;
        else delete next.fixedCost;
        if (accrual === "prorated") delete next.costAccrual;
        else next.costAccrual = accrual;
        const ids = [...blackouts].filter((id) => project.blackouts?.some((b) => b.id === id));
        if (ids.length) next.blackouts = ids;
        else delete next.blackouts;
        if (clearDelay) delete next.levelingDelay;
        const ac = actualCost.trim() ? parseNumberLocal(actualCost) : null;
        if (actualCost.trim() && (ac === null || ac < 0)) throw new OpError(t("err.actualCost"));
        if (ac !== null) next.actualCost = ac;
        else delete next.actualCost;
        // Üç nokta tahmin: üçü birden ya da hiçbiri
        if (estimate.every((v) => !v.trim())) delete next.estimate;
        else {
          const [o, m, pe] = estimate.map((v) => parseNumberLocal(v));
          const e = { optimistic: o ?? NaN, likely: m ?? NaN, pessimistic: pe ?? NaN };
          if (!validEstimate(e)) throw new OpError(t("err.estimate"));
          next.estimate = e;
        }
      }
      // Not, bağlantı, etiket, renk özet görevlerde de tutulur
      if (notes.trim()) next.notes = notes.slice(0, 20_000);
      else delete next.notes;
      // Eklenmemiş ama yazılmış bağlantı da kaydedilir
      const pending = linkUrl.trim() ? safeUrl(linkUrl) : null;
      if (linkUrl.trim() && !pending) throw new OpError(t("err.linkUrl"));
      const allLinks = pending ? [...links, linkTitle.trim() ? { url: pending, title: linkTitle.trim() } : { url: pending }] : links;
      if (allLinks.length) next.links = allLinks;
      else delete next.links;
      const tagList = toTags(tags);
      if (tagList) next.tags = tagList;
      else delete next.tags;
      if (color) next.color = color;
      else delete next.color;
      onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const dash = (iso?: string) => (iso ? formatShort(iso) : "—");
  const signed = (n: number) => (n > 0 ? `+${formatNumber(n, 1)}` : formatNumber(n, 1));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="info-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="info-title" title={task.name}>
          {t("info.title", { row: String(index + 1), name: task.name || "—" })}
        </h2>
        <p className="modal-note">
          {formatShort(row.startDate)} – {formatShort(row.finishDate)} · {t("info.slack", { n: formatNumber(row.slack, 1) })}
          {row.critical && ` · ${t("legend.critical")}`}
        </p>
        <div className="settings info-body">
          {issues.length > 0 && (
            <div className="issue-box" role="alert">
              {issues.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
          )}
          <fieldset className="setting">
            <legend>{t("info.scheduling")}</legend>
            <div className="field-row">
              <label className="field">
                <span>{t("info.constraint")}</span>
                <select value={ctype} onChange={(e) => setCtype(e.target.value as ConstraintType)} disabled={!leaf}>
                  {CONSTRAINT_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c} · {t(`constraint.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
              {needsDate && (
                <label className="field">
                  <span>{t("info.constraintDate")}</span>
                  <DateInput value={cdate} ariaLabel={t("info.constraintDate")} onChange={setCdate} />
                </label>
              )}
            </div>
            <div className="field-row">
              <label className="field">
                <span>{t("info.deadline")}</span>
                <span className="with-clear">
                  <DateInput value={deadline} ariaLabel={t("info.deadline")} onChange={setDeadline} />
                  {deadline && (
                    <button type="button" className="link-btn" onClick={() => setDeadline("")}>
                      {t("info.clear")}
                    </button>
                  )}
                </span>
                <small>{t("info.deadlineHint")}</small>
              </label>
            </div>
            {!!task.levelingDelay && (
              <label className="check">
                <input type="checkbox" checked={clearDelay} onChange={(e) => setClearDelay(e.target.checked)} />
                <span>{t("info.clearDelay", { n: String(task.levelingDelay) })}</span>
              </label>
            )}
          </fieldset>

          {leaf && (
            <fieldset className="setting">
              <legend>{t("info.progress")}</legend>
              <div className="field-row">
                <label className="field narrow">
                  <span>{t("col.percent")}</span>
                  <input value={percent} inputMode="numeric" onChange={(e) => setPercent(e.target.value)} />
                </label>
                <label className="field">
                  <span>{t("info.actualStart")}</span>
                  <span className="with-clear">
                    <DateInput value={actualStart} ariaLabel={t("info.actualStart")} onChange={setActualStart} />
                    {actualStart && (
                      <button type="button" className="link-btn" onClick={() => setActualStart("")}>
                        {t("info.clear")}
                      </button>
                    )}
                  </span>
                </label>
                <label className="field">
                  <span>{t("info.actualFinish")}</span>
                  <span className="with-clear">
                    <DateInput value={actualFinish} ariaLabel={t("info.actualFinish")} onChange={setActualFinish} />
                    {actualFinish && (
                      <button type="button" className="link-btn" onClick={() => setActualFinish("")}>
                        {t("info.clear")}
                      </button>
                    )}
                  </span>
                </label>
              </div>
              <div className="field-row">
                <label className="field narrow">
                  <span>{t("info.remaining")}</span>
                  <input value={remaining} inputMode="decimal" onChange={(e) => setRemaining(e.target.value)} />
                </label>
                <div className="field readonly">
                  <span>{t("col.duration")}</span>
                  <b>{t("unit.workdays", { n: task.duration })}</b>
                </div>
                <div className="field readonly">
                  <span>{t("info.remainingWork")}</span>
                  <b>{t("unit.personDays", { n: formatNumber(workRemaining, 1) })}</b>
                </div>
              </div>
              <small className="hint">{t("info.progressHint")}</small>
            </fieldset>
          )}

          {leaf && (
            <fieldset className="setting">
              <legend>{t("info.cost")}</legend>
              <div className="field-row">
                <label className="field">
                  <span>{t("info.fixedCost")}</span>
                  <input value={fixedCost} inputMode="decimal" placeholder="0" onChange={(e) => setFixedCost(e.target.value)} />
                </label>
                <label className="field">
                  <span>{t("info.accrual")}</span>
                  <select value={accrual} onChange={(e) => setAccrual(e.target.value as CostAccrual)}>
                    {(["prorated", "start", "end"] as const).map((a) => (
                      <option key={a} value={a}>
                        {t(`accrual.${a}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("info.actualCost")}</span>
                  <input value={actualCost} inputMode="decimal" placeholder={t("info.actualCostEmpty")} onChange={(e) => setActualCost(e.target.value)} />
                  <small>{t("info.actualCostHint")}</small>
                </label>
              </div>
              <dl className="cost-breakdown">
                {(["labor", "equipment", "material", "fixed", "overhead"] as const).map((k) =>
                  cost[k] ? (
                    <div key={k}>
                      <dt>{k === "overhead" ? `${t("cost.overhead")} (${formatPercent(project.overheadPercent ?? 0)})` : t(`cost.${k}`)}</dt>
                      <dd>{formatMoney(cost[k])}</dd>
                    </div>
                  ) : null,
                )}
                <div className="total">
                  <dt>{t("cost.total")}</dt>
                  <dd>{formatMoney(cost.total)}</dd>
                </div>
              </dl>
            </fieldset>
          )}

          {leaf && task.duration > 0 && (
            <fieldset className="setting">
              <legend>{t("info.uncertainty")}</legend>
              <div className="field-row">
                {(["optimistic", "likely", "pessimistic"] as const).map((k, i) => (
                  <label key={k} className="field">
                    <span>{t(`est.${k}`)}</span>
                    <input
                      value={estimate[i]}
                      inputMode="decimal"
                      placeholder={formatNumber(i === 0 ? task.duration * (1 - sim.uncertaintyLow / 100) : i === 1 ? task.duration : task.duration * (1 + sim.uncertaintyHigh / 100), 1)}
                      onChange={(e) => setEstimate(estimate.map((v, j) => (j === i ? e.target.value : v)) as [string, string, string])}
                    />
                  </label>
                ))}
              </div>
              <small className="hint">{t("info.uncertaintyHint", { low: formatNumber(sim.uncertaintyLow, 0), high: formatNumber(sim.uncertaintyHigh, 0) })}</small>
              {linkedRisks.length > 0 && (
                <ul className="risk-mini">
                  {linkedRisks.map((r) => {
                    const impact = r.tasks.find((x) => x.taskId === taskId)!;
                    return (
                      <li key={r.id}>
                        <span className={`risk-badge lvl-${riskLevel(exposure(r))}`}>{exposure(r)}</span>
                        <b>{r.id}</b> {r.title}
                        <small>
                          {" "}
                          · {t("risk.impactShort", { days: formatNumber(impact.days, 1), cost: formatMoney(impact.cost) })}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}

          {leaf && (
            <fieldset className="setting">
              <legend>{t("info.periods")}</legend>
              {(project.blackouts ?? []).map((b) => (
                <label key={b.id} className="check">
                  <input
                    type="checkbox"
                    checked={blackouts.has(b.id)}
                    onChange={(e) => {
                      const n = new Set(blackouts);
                      if (e.target.checked) n.add(b.id);
                      else n.delete(b.id);
                      setBlackouts(n);
                    }}
                  />
                  <span>
                    {b.name} <small>{formatShort(b.from)} – {formatShort(b.to)}</small>
                  </span>
                </label>
              ))}
              {!project.blackouts?.length && <small className="hint">{t("info.noPeriods")}</small>}
            </fieldset>
          )}

          <fieldset className="setting">
            <legend>{t("info.notesLinks")}</legend>
            <label className="field">
              <span>{t("info.notes")}</span>
              <textarea value={notes} rows={4} maxLength={20_000} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="field">
              <span>{t("info.links")}</span>
              {links.length > 0 && (
                <ul className="link-list">
                  {links.map((l, i) => (
                    <li key={`${l.url}-${i}`}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.title || l.url}
                      </a>
                      <button type="button" className="link-btn" onClick={() => setLinks(links.filter((_, k) => k !== i))} aria-label={t("info.removeLink", { name: l.title || l.url })}>
                        {t("info.clear")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="field-row">
                <input value={linkUrl} placeholder={t("info.linkUrl")} aria-label={t("info.linkUrl")} onChange={(e) => setLinkUrl(e.target.value)} />
                <input value={linkTitle} placeholder={t("info.linkTitle")} aria-label={t("info.linkTitle")} onChange={(e) => setLinkTitle(e.target.value)} />
                <button
                  type="button"
                  disabled={!linkUrl.trim()}
                  onClick={() => {
                    const url = safeUrl(linkUrl);
                    if (!url) {
                      setError(t("err.linkUrl"));
                      return;
                    }
                    setError(null);
                    setLinks([...links, linkTitle.trim() ? { url, title: linkTitle.trim() } : { url }]);
                    setLinkUrl("");
                    setLinkTitle("");
                  }}
                >
                  {t("common.add")}
                </button>
              </div>
              <small>{t("info.linksHint")}</small>
            </div>
            <div className="field-row">
              <label className="field">
                <span>{t("info.tags")}</span>
                <input value={tags} placeholder={t("info.tagsPlaceholder")} onChange={(e) => setTags(e.target.value)} />
              </label>
              <div className="field">
                <span id="color-label">{t("info.color")}</span>
                <div className="swatches" role="radiogroup" aria-labelledby="color-label">
                  <button type="button" role="radio" aria-checked={!color} className={`swatch none ${!color ? "on" : ""}`} onClick={() => setColor(undefined)} title={t("color.none")} aria-label={t("color.none")} />
                  {TASK_COLORS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={color === c} className={`swatch tc-${c} ${color === c ? "on" : ""}`} onClick={() => setColor(c)} title={t(`color.${c}`)} aria-label={t(`color.${c}`)} />
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          {baseline && (
            <fieldset className="setting">
              <legend>{baseline.name}</legend>
              <div className="field-row">
                <div className="field readonly">
                  <span>{t("info.baselineStart")}</span>
                  <b>{dash(baseline.start)}</b>
                </div>
                <div className="field readonly">
                  <span>{t("info.baselineFinish")}</span>
                  <b>{dash(baseline.finish)}</b>
                </div>
                {baseline.variance && (
                  <div className="field readonly">
                    <span>{t("col.variance")}</span>
                    <b className={baseline.variance.finish > 0 ? "over-text" : ""}>{t("info.varianceDays", { n: signed(baseline.variance.finish) })}</b>
                  </div>
                )}
              </div>
            </fieldset>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" onClick={save}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
