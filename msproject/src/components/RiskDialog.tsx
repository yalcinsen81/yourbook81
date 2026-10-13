import { useEffect, useMemo, useState } from "react";
import { formatNumber, parseNumberLocal, t } from "../i18n";
import { RISK_CHANCE, riskLevel } from "../model/risks";
import { RISK_RESPONSES, RISK_STATUSES, type Project, type Risk, type RiskResponse, type RiskStatus, type Schedule } from "../model/types";
import { DateInput } from "./DateInput";
import { Icon } from "./icons";

interface Props {
  project: Project;
  schedule: Schedule;
  risk: Risk;
  isNew: boolean;
  onSave: (risk: Risk) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface LinkDraft {
  taskId: string;
  days: string;
  cost: string;
}

/** Risk ayrıntısı: puanlar, yanıt, durum ve bağlı görevlere etkisi (ek gün, ek maliyet) */
export function RiskDialog({ project, schedule, risk, isNew, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(risk.title);
  const [category, setCategory] = useState(risk.category ?? "");
  const [owner, setOwner] = useState(risk.owner ?? "");
  const [description, setDescription] = useState(risk.description ?? "");
  const [probability, setProbability] = useState(risk.probability);
  const [impact, setImpact] = useState(risk.impact);
  const [chance, setChance] = useState(risk.chance === undefined ? "" : formatNumber(risk.chance, 1));
  const [response, setResponse] = useState<RiskResponse | "">(risk.response ?? "");
  const [mitigation, setMitigation] = useState(risk.mitigation ?? "");
  const [status, setStatus] = useState<RiskStatus>(risk.status);
  const [review, setReview] = useState(risk.review ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(risk.tasks.map((x) => ({ taskId: x.taskId, days: formatNumber(x.days, 1), cost: formatNumber(x.cost, 2) })));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bağlanabilir görevler: özet olmayan satırlar
  const leaves = useMemo(() => project.tasks.flatMap((x, i) => (schedule.rows[i].isSummary ? [] : [{ id: x.id, label: `${i + 1}. ${x.name || "—"}` }])), [project.tasks, schedule.rows]);
  const score = probability * impact;
  const categories = useMemo(() => [...new Set((project.risks ?? []).flatMap((r) => (r.category ? [r.category] : [])))].sort(), [project.risks]);

  const save = () => {
    if (!title.trim()) return setError(t("risk.err.title"));
    const ch = chance.trim() ? parseNumberLocal(chance) : undefined;
    if (ch === null || (ch !== undefined && (ch < 0 || ch > 100))) return setError(t("risk.err.chance"));
    const tasks = [];
    for (const l of links) {
      if (!l.taskId) continue;
      const days = l.days.trim() ? parseNumberLocal(l.days) : 0;
      const cost = l.cost.trim() ? parseNumberLocal(l.cost) : 0;
      if (days === null || cost === null || days < 0 || cost < 0) return setError(t("risk.err.impact"));
      tasks.push({ taskId: l.taskId, days, cost });
    }
    const next: Risk = { id: risk.id, title: title.trim(), probability, impact, status, tasks };
    if (category.trim()) next.category = category.trim();
    if (owner.trim()) next.owner = owner.trim();
    if (description.trim()) next.description = description.trim();
    if (ch !== undefined) next.chance = ch;
    if (response) next.response = response;
    if (mitigation.trim()) next.mitigation = mitigation.trim();
    if (review) next.review = review;
    onSave(next);
    onClose();
  };

  const used = new Set(links.map((l) => l.taskId));
  const score5 = (label: string, value: number, set: (v: number) => void, id: string) => (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="segmented score" role="radiogroup" aria-labelledby={id}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => set(v)} title={t(`risk.scale.${v}` as "risk.scale.1")}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="risk-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="risk-title">{isNew ? t("risk.new") : t("risk.edit", { id: risk.id })}</h2>
        <p className="modal-note">
          <span className={`risk-badge lvl-${riskLevel(score)}`}>{score}</span> {t(`risk.lvl.${riskLevel(score)}`)} · {t("risk.exposureHint")}
        </p>
        <div className="settings info-body">
          <fieldset className="setting">
            <legend>{t("risk.identity")}</legend>
            <label className="field">
              <span>{t("risk.title")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>{t("risk.category")}</span>
                <input value={category} list="risk-categories" onChange={(e) => setCategory(e.target.value)} placeholder={t("risk.categoryPlaceholder")} maxLength={60} />
                <datalist id="risk-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>{t("risk.owner")}</span>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={80} />
              </label>
            </div>
            <label className="field">
              <span>{t("risk.description")}</span>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </fieldset>

          <fieldset className="setting">
            <legend>{t("risk.assessment")}</legend>
            <div className="field-row">
              {score5(t("risk.probability"), probability, setProbability, "risk-p")}
              {score5(t("risk.impactScore"), impact, setImpact, "risk-i")}
            </div>
            <label className="field narrow-field">
              <span>{t("risk.chance")}</span>
              <input value={chance} inputMode="decimal" placeholder={formatNumber(RISK_CHANCE[probability], 0)} onChange={(e) => setChance(e.target.value)} />
              <small>{t("risk.chanceHint", { p: String(probability), v: String(RISK_CHANCE[probability]) })}</small>
            </label>
          </fieldset>

          <fieldset className="setting">
            <legend>{t("risk.responsePlan")}</legend>
            <div className="field-row">
              <label className="field">
                <span>{t("risk.response")}</span>
                <select value={response} onChange={(e) => setResponse(e.target.value as RiskResponse | "")}>
                  <option value="">—</option>
                  {RISK_RESPONSES.map((r) => (
                    <option key={r} value={r}>
                      {t(`risk.resp.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("risk.status")}</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)}>
                  {RISK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`risk.st.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("risk.review")}</span>
                <span className="with-clear">
                  <DateInput value={review} ariaLabel={t("risk.review")} onChange={setReview} />
                  {review && (
                    <button type="button" className="link-btn" onClick={() => setReview("")}>
                      {t("info.clear")}
                    </button>
                  )}
                </span>
              </label>
            </div>
            <label className="field">
              <span>{t("risk.mitigation")}</span>
              <textarea rows={2} value={mitigation} onChange={(e) => setMitigation(e.target.value)} />
            </label>
          </fieldset>

          <fieldset className="setting">
            <legend>{t("risk.tasks")}</legend>
            {links.length > 0 && (
              <table className="risk-links">
                <thead>
                  <tr>
                    <th scope="col">{t("risk.task")}</th>
                    <th scope="col" className="num">
                      {t("risk.days")}
                    </th>
                    <th scope="col" className="num">
                      {t("risk.cost")}
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {links.map((l, i) => {
                    const set = (patch: Partial<LinkDraft>) => setLinks(links.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={i}>
                        <td>
                          <select value={l.taskId} onChange={(e) => set({ taskId: e.target.value })} aria-label={t("risk.task")}>
                            <option value="">{t("risk.pickTask")}</option>
                            {leaves
                              .filter((x) => x.id === l.taskId || !used.has(x.id))
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.label}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="num">
                          <input value={l.days} inputMode="decimal" onChange={(e) => set({ days: e.target.value })} aria-label={t("risk.days")} />
                        </td>
                        <td className="num">
                          <input value={l.cost} inputMode="decimal" onChange={(e) => set({ cost: e.target.value })} aria-label={t("risk.cost")} />
                        </td>
                        <td>
                          <button type="button" className="icon-btn" onClick={() => setLinks(links.filter((_, j) => j !== i))} title={t("risk.unlink")} aria-label={t("risk.unlink")}>
                            <Icon name="trash" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <button type="button" className="link-btn" onClick={() => setLinks([...links, { taskId: "", days: "", cost: "" }])} disabled={links.length >= leaves.length}>
              <Icon name="plus" size={14} /> {t("risk.linkTask")}
            </button>
            <small className="hint">{t("risk.tasksHint")}</small>
          </fieldset>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {!isNew && (
            <button
              className="danger"
              onClick={() => {
                if (!window.confirm(t("risk.confirmDelete", { id: risk.id, title: risk.title }))) return;
                onDelete(risk.id);
                onClose();
              }}
            >
              {t("common.delete")}
            </button>
          )}
          <span className="spacer" />
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" onClick={save}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
