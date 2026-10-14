import { useEffect, useState } from "react";
import { t } from "../i18n";
import { clearBaseline, getBaseline, saveBaseline } from "../model/baseline";
import { formatShort } from "../model/calendar";
import { BASELINE_SLOTS, type Project, type Schedule } from "../model/types";

interface Props {
  project: Project;
  schedule: Schedule;
  today: string;
  /** Gantt'ta gösterilen referans plan (-1 = yok) */
  shown: number;
  onShow: (index: number) => void;
  update: (fn: (p: Project) => Project) => void;
  onClose: () => void;
}

/** Referans planlar: 3 yer; kaydet / üzerine yaz / sil ve Gantt'ta hangisinin gösterileceği */
export function BaselineDialog({ project, schedule, today, shown, onShow, update, onClose }: Props) {
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: BASELINE_SLOTS }, (_, i) => getBaseline(project, i)?.name ?? `${t("baseline.default")} ${i + 1}`),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = (i: number) => {
    if (getBaseline(project, i) && !window.confirm(t("baseline.confirmOverwrite", { name: getBaseline(project, i)!.name }))) return;
    update((p) => saveBaseline(p, schedule, i, today, names[i]));
    onShow(i);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bl-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="bl-title">{t("baseline.title")}</h2>
        <p className="modal-note">{t("baseline.note")}</p>
        <div className="settings">
          <label className="check">
            <input type="radio" name="bl-show" checked={shown < 0} onChange={() => onShow(-1)} />
            <span>{t("baseline.hide")}</span>
          </label>
          {Array.from({ length: BASELINE_SLOTS }, (_, i) => {
            const b = getBaseline(project, i);
            return (
              <fieldset key={i} className="setting baseline-slot">
                <legend>{t("baseline.slot", { n: String(i + 1) })}</legend>
                <div className="field-row">
                  <label className="check">
                    <input type="radio" name="bl-show" disabled={!b} checked={shown === i} onChange={() => onShow(i)} />
                    <span>{t("baseline.show")}</span>
                  </label>
                  <input
                    className="grow"
                    value={names[i]}
                    aria-label={t("baseline.name")}
                    onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))}
                    onBlur={() => b && names[i].trim() && names[i] !== b.name && update((p) => ({ ...p, baselines: p.baselines!.map((x) => (x.index === i ? { ...x, name: names[i].trim() } : x)) }))}
                  />
                </div>
                <small className="hint">
                  {b
                    ? t("baseline.saved", { date: b.savedAt ? formatShort(b.savedAt) : "—", finish: formatShort(b.finish), n: Object.keys(b.tasks).length })
                    : t("baseline.empty")}
                </small>
                <div className="row-buttons">
                  <button onClick={() => save(i)}>{b ? t("baseline.overwrite") : t("baseline.save")}</button>
                  {b && (
                    <button
                      onClick={() => {
                        if (!window.confirm(t("baseline.confirmClear", { name: b.name }))) return;
                        update((p) => clearBaseline(p, i));
                        if (shown === i) onShow(-1);
                      }}
                    >
                      {t("baseline.clear")}
                    </button>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
