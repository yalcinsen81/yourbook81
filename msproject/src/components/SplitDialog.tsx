import { useEffect, useState } from "react";
import { formatDateLocal, t } from "../i18n";
import { addDays, diffDays } from "../model/calendar";
import { DateInput } from "./DateInput";

interface Props {
  taskName: string;
  start: string;
  finish: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

/**
 * Görevi böl: görevin duracağı aralık seçilir; uygulama bunu yalnızca bu göreve uygulanan bir
 * "çalışılamayan dönem" olarak kaydeder (motor bunu zaten destekler), çubukta boşluk görünür.
 */
export function SplitDialog({ taskName, start, finish, onApply, onClose }: Props) {
  const mid = addDays(start, Math.max(1, Math.floor(diffDays(start, finish) / 2)));
  const [from, setFrom] = useState(mid);
  const [to, setTo] = useState(addDays(mid, 2));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const error = from > to ? t("split.badRange") : from <= start || from > finish ? t("split.outside", { start: formatDateLocal(start), finish: formatDateLocal(finish) }) : null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) onApply(from, to);
        }}
      >
        <h2 id="split-title">{t("split.title", { name: taskName || t("common.unnamed") })}</h2>
        <p className="modal-note">{t("split.note")}</p>
        <div className="field-row">
          <label className="field">
            <span>{t("split.from")}</span>
            <DateInput value={from} ariaLabel={t("split.from")} onChange={setFrom} autoFocus />
          </label>
          <label className="field">
            <span>{t("split.to")}</span>
            <DateInput value={to} ariaLabel={t("split.to")} onChange={setTo} />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {t("split.apply")}
          </button>
        </div>
      </form>
    </div>
  );
}
