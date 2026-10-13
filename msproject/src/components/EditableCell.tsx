import { useEffect, useState, type KeyboardEvent } from "react";
import { t } from "../i18n";

interface Props {
  value: string;
  /** false dönerse değer geçersizdir: hücre kırmızı kalır, taslak korunur. */
  onCommit: (text: string) => boolean | void;
  type?: "text" | "date";
  readOnly?: boolean;
  row: number;
  col: string;
  className?: string;
  title?: string;
  ariaLabel: string;
  /** Boş değerde gösterilen yer tutucu (ör. "—") */
  placeholder?: string;
}

/** Tablo hücresi: her zaman düzenlenebilir düz giriş kutusu; Enter/Tab/odak kaybında kaydeder, Esc vazgeçer. */
export function EditableCell({ value, onCommit, type = "text", readOnly, row, col, className, title, ariaLabel, placeholder }: Props) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
      setInvalid(false);
    }
  }, [value, focused]);

  const commit = () => {
    if (draft === value) {
      setInvalid(false);
      return true;
    }
    const ok = onCommit(draft) !== false;
    setInvalid(!ok);
    return ok;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commit()) focusCell(row + (e.shiftKey ? -1 : 1), col);
    } else if (e.key === "Escape") {
      setDraft(value);
      setInvalid(false);
      e.currentTarget.blur();
    } else if (e.key === "ArrowDown" && type === "text") {
      e.preventDefault();
      if (commit()) focusCell(row + 1, col);
    } else if (e.key === "ArrowUp" && type === "text") {
      e.preventDefault();
      if (commit()) focusCell(row - 1, col);
    }
  };

  return (
    <input
      className={`cell-input ${invalid ? "invalid" : ""} ${className ?? ""}`}
      type={type}
      value={draft ?? ""}
      placeholder={placeholder}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : 0}
      title={invalid ? t("common.invalid") : title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      data-row={row}
      data-col={col}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        if (type === "text") e.currentTarget.select();
      }}
      onBlur={() => {
        commit();
        setFocused(false);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

export function focusCell(row: number, col: string) {
  const el = document.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`);
  el?.focus();
}
