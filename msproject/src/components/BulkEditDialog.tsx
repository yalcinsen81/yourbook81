import { useEffect, useState, type ReactNode } from "react";
import { parseDateLocal, t } from "../i18n";
import { parseDuration } from "../model/duration";
import { parsePercentCell } from "../model/cellInput";
import { CONSTRAINT_TYPES } from "../model/storage";
import type { ConstraintType } from "../model/types";
import { DateInput } from "./DateInput";

/** Toplu düzenleme sonucu: yalnızca işaretlenen alanlar dolu gelir */
export interface BulkPatch {
  duration?: number;
  /** Kaynak metni (tablodaki gibi: "Ali[50%]; Vinç"); boş metin atamaları kaldırır */
  resources?: string;
  percent?: number;
  constraint?: { type: ConstraintType; date?: string };
}

interface Props {
  count: number;
  /** Seçimde özet görev var (özetlere süre, kaynak, yüzde uygulanmaz) */
  summaries: number;
  workweek: number;
  projectStart: string;
  onApply: (patch: BulkPatch) => void;
  onClose: () => void;
}

/** Seçili görevlere süre, kaynak, tamamlanma ve kısıt toplu atama (tek geri al adımı) */
export function BulkEditDialog({ count, summaries, workweek, projectStart, onApply, onClose }: Props) {
  const [on, setOn] = useState({ duration: false, resources: false, percent: false, constraint: false });
  const [duration, setDuration] = useState("");
  const [resources, setResources] = useState("");
  const [percent, setPercent] = useState("");
  const [ctype, setCtype] = useState<ConstraintType>("SNET");
  const [cdate, setCdate] = useState(projectStart);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = () => {
    const patch: BulkPatch = {};
    if (on.duration) {
      const d = parseDuration(duration, workweek);
      if (!d) return setError(t("err.duration"));
      patch.duration = Math.min(10_000, d.days);
    }
    if (on.resources) patch.resources = resources;
    if (on.percent) {
      const p = parsePercentCell(percent);
      if (!p) return setError(t("valid.percent"));
      patch.percent = p.value;
    }
    if (on.constraint) {
      const needsDate = ctype !== "ASAP" && ctype !== "ALAP";
      const date = needsDate ? parseDateLocal(cdate) ?? cdate : undefined;
      if (needsDate && !date) return setError(t("bulk.needDate"));
      patch.constraint = { type: ctype, date };
    }
    if (!Object.keys(patch).length) return setError(t("bulk.nothing"));
    onApply(patch);
  };

  const row = (key: keyof typeof on, label: string, input: ReactNode) => (
    <div className="bulk-row">
      <label className="check">
        <input type="checkbox" checked={on[key]} onChange={(e) => setOn({ ...on, [key]: e.target.checked })} />
        <span>{label}</span>
      </label>
      <div className={on[key] ? "" : "bulk-off"} onFocusCapture={() => !on[key] && setOn({ ...on, [key]: true })}>
        {input}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <h2 id="bulk-title">{t("bulk.title", { n: count })}</h2>
        <p className="modal-note">{summaries ? t("bulk.noteSummary", { n: summaries }) : t("bulk.note")}</p>
        {row("duration", t("col.duration"), <input value={duration} placeholder="5 g, 2w" aria-label={t("col.duration")} onChange={(e) => setDuration(e.target.value)} />)}
        {row("resources", t("col.resources"), <input value={resources} placeholder="Ali[50%]; Vinç" aria-label={t("col.resources")} onChange={(e) => setResources(e.target.value)} />)}
        {row("percent", t("col.percent"), <input value={percent} placeholder="%50" aria-label={t("col.percent")} onChange={(e) => setPercent(e.target.value)} />)}
        {row(
          "constraint",
          t("info.constraint"),
          <div className="bulk-constraint">
            <select value={ctype} aria-label={t("info.constraint")} onChange={(e) => setCtype(e.target.value as ConstraintType)}>
              {CONSTRAINT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c} · {t(`constraint.${c}`)}
                </option>
              ))}
            </select>
            {ctype !== "ASAP" && ctype !== "ALAP" && <DateInput value={cdate} ariaLabel={t("info.constraintDate")} onChange={setCdate} />}
          </div>,
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("bulk.apply")}
          </button>
        </div>
      </form>
    </div>
  );
}
