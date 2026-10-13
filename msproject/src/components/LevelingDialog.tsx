import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatPercent, t } from "../i18n";
import { formatShort } from "../model/calendar";
import { clearLeveling, overallocations, proposeLeveling, type LevelingKind } from "../model/leveling";
import type { Project, Schedule } from "../model/types";

interface Props {
  project: Project;
  schedule: Schedule;
  onApply: (project: Project) => void;
  onClose: () => void;
}

/**
 * Kaynak seviyeleme: aşırı yüklü kaynaklar listelenir, üç çözüm önizlemesiyle sunulur (geciktir / birimi düşür /
 * kapasiteyi artır). Proje yalnızca "Uygula" ile değişir; değişiklik tek geri al adımıdır.
 */
export function LevelingDialog({ project, schedule, onApply, onClose }: Props) {
  const over = useMemo(() => overallocations(project, schedule), [project, schedule]);
  const options = useMemo(() => proposeLeveling(project), [project]);
  const [kind, setKind] = useState<LevelingKind>("delay");
  const option = options.find((o) => o.kind === kind);
  const hasDelays = project.tasks.some((x) => x.levelingDelay);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="lv-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="lv-title">{t("level.title")}</h2>
        <p className="modal-note">{over.length ? t("level.note") : t("level.none")}</p>
        <div className="settings">
          {over.length > 0 && (
            <ul className="holiday-list compact">
              {over.map((o) => (
                <li key={o.resourceId}>
                  <span className="name">{o.name}</span>
                  <span className="over-text">{t("level.overRow", { n: o.days, peak: formatPercent(o.peak), max: formatPercent(o.maxUnits), date: formatShort(o.firstDate) })}</span>
                </li>
              ))}
            </ul>
          )}
          {options.length > 0 && (
            <div className="segmented level-kinds" role="radiogroup" aria-label={t("level.strategy")}>
              {options.map((o) => (
                <button key={o.kind} role="radio" aria-checked={kind === o.kind} className={kind === o.kind ? "on" : ""} onClick={() => setKind(o.kind)}>
                  {t(`level.kind.${o.kind}`)}
                </button>
              ))}
            </div>
          )}
          {option && (
            <div className="level-preview">
              <p className="hint">{t(`level.hint.${option.kind}`)}</p>
              <dl className="cost-breakdown">
                <div>
                  <dt>{t("level.finish")}</dt>
                  <dd className={option.finishAfter > option.finishBefore ? "over-text" : ""}>
                    {formatShort(option.finishBefore)} → {formatShort(option.finishAfter)}
                  </dd>
                </div>
                <div>
                  <dt>{t("level.cost")}</dt>
                  <dd>
                    {formatMoney(option.costBefore)} → {formatMoney(option.costAfter)}
                  </dd>
                </div>
                <div>
                  <dt>{t("level.remaining")}</dt>
                  <dd className={option.remainingOver ? "over-text" : ""}>
                    {option.remainingOver ? t("level.remainingN", { n: option.remainingOver }) : t("level.resolved")}
                  </dd>
                </div>
              </dl>
              <table className="level-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{option.kind === "capacity" ? t("res.col.name") : t("col.name")}</th>
                    <th>{t(`level.col.${option.kind}`)}</th>
                    {option.kind !== "capacity" && <th>{t("col.start")}</th>}
                    {option.kind !== "capacity" && <th>{t("col.finish")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {option.changes.map((c, k) => (
                    <tr key={k}>
                      <td>{c.row || ""}</td>
                      <td>
                        {c.name}
                        {c.resource && <small> · {c.resource}</small>}
                      </td>
                      <td className="num">
                        {option.kind === "delay"
                          ? t("level.delayDays", { from: String(c.before), to: String(c.after) })
                          : `${formatPercent(c.before)} → ${formatPercent(c.after)}`}
                      </td>
                      {option.kind !== "capacity" && (
                        <td className="num">
                          {c.startBefore === c.startAfter ? formatShort(c.startAfter) : `${formatShort(c.startBefore)} → ${formatShort(c.startAfter)}`}
                        </td>
                      )}
                      {option.kind !== "capacity" && (
                        <td className="num">
                          {c.finishBefore === c.finishAfter ? formatShort(c.finishAfter) : `${formatShort(c.finishBefore)} → ${formatShort(c.finishAfter)}`}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!option.changes.length && (
                    <tr>
                      <td colSpan={5} className="muted">
                        {t("level.noChange")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-actions">
          {hasDelays && (
            <button
              className="left"
              onClick={() => {
                onApply(clearLeveling(project));
                onClose();
              }}
            >
              {t("level.clear")}
            </button>
          )}
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="primary"
            disabled={!option || !option.changes.length}
            onClick={() => {
              if (!option) return;
              onApply(option.project);
              onClose();
            }}
          >
            {t("level.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
