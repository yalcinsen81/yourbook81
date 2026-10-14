import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../i18n";
import type { LinkType } from "../model/types";

const TYPES: LinkType[] = ["FS", "SS", "FF", "SF"];

interface Props {
  x: number;
  y: number;
  /** "3 Kaba yapı → 4 Çatı" */
  title: string;
  type: LinkType;
  lag: number;
  onSave: (type: LinkType, lag: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Bağ okuna tıklayınca açılan küçük pencere: bağ türü, gecikme (iş günü; eksi değer öne çekme) ve silme */
export function LinkEditor({ x, y, title, type, lag, onSave, onDelete, onClose }: Props) {
  const [kind, setKind] = useState<LinkType>(type);
  const [lagText, setLagText] = useState(String(lag));
  const ref = useRef<HTMLFormElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y + 8, window.innerHeight - r.height - 8)) });
  }, [x, y]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);
  const lagValue = Number(lagText.replace(",", ".").replace("−", "-"));
  const valid = lagText.trim() !== "" && Number.isFinite(lagValue) && Math.abs(lagValue) <= 1000;
  return (
    <form
      ref={ref}
      className="link-editor"
      style={pos}
      role="dialog"
      aria-label={t("linkEd.title")}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(kind, Math.round(lagValue));
      }}
    >
      <div className="link-editor-title">{title}</div>
      <label className="field">
        <span>{t("linkEd.type")}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as LinkType)} autoFocus>
          {TYPES.map((k) => (
            <option key={k} value={k}>
              {k} · {t(`link.type.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t("linkEd.lag")}</span>
        <input value={lagText} inputMode="numeric" onChange={(e) => setLagText(e.target.value)} aria-invalid={!valid} />
      </label>
      <small className="hint">{t("linkEd.lagHint")}</small>
      <div className="link-editor-actions">
        <button type="button" className="danger" onClick={onDelete}>
          {t("linkEd.delete")}
        </button>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="primary" disabled={!valid}>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}
