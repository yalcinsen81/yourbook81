import { useEffect, useState } from "react";
import { t } from "../i18n";

interface Props {
  title: string;
  label: string;
  note?: string;
  initial: string;
  okLabel: string;
  onOk: (value: string) => void;
  onClose: () => void;
}

/** Tek alanlı küçük pencere (ör. şablon adı) */
export function PromptDialog({ title, label, note, initial, okLabel, onOk, onClose }: Props) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ok = value.trim() !== "";
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onOk(value.trim());
        }}
      >
        <h2 id="prompt-title">{title}</h2>
        {note && <p className="modal-note">{note}</p>}
        <label className="field">
          <span>{label}</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary" disabled={!ok}>
            {okLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
