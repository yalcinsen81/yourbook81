import { useEffect, useRef, useState } from "react";
import { datePattern, formatDateLocal, invalidDateMessage, parseDateLocal, t } from "../i18n";
import { Icon } from "./icons";

/**
 * Tarih kutusu: seçili biçimde yazılır (TR 13.11.2026, EN 11/13/2026, ISO 2026-11-13); düğme tarayıcının takvimini açar.
 * Geçerli bir tarih yazılınca (ya da seçilince) onChange ISO değerle çağrılır.
 */
export function DateInput(props: { value: string; onChange: (iso: string) => void; ariaLabel: string; autoFocus?: boolean }) {
  const [draft, setDraft] = useState(formatDateLocal(props.value));
  const [focused, setFocused] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const shown = formatDateLocal(props.value);
  useEffect(() => {
    if (!focused) setDraft(props.value ? shown : "");
  }, [props.value, shown, focused]);
  const invalid = draft.trim() !== "" && !parseDateLocal(draft);
  return (
    <span className="date-input">
      <input
        type="text"
        value={draft}
        placeholder={datePattern()}
        aria-label={props.ariaLabel}
        aria-invalid={invalid}
        className={invalid ? "invalid" : ""}
        title={invalid ? invalidDateMessage() : datePattern()}
        autoFocus={props.autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          const iso = parseDateLocal(e.target.value);
          if (iso) props.onChange(iso);
        }}
      />
      <button
        type="button"
        className="date-pick"
        title={t("grid.pickDate")}
        aria-label={t("grid.pickDate")}
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          el.value = props.value;
          try {
            el.showPicker();
          } catch {
            el.click();
          }
        }}
      >
        <Icon name="calendar" size={14} />
      </button>
      <input
        ref={picker}
        type="date"
        className="date-picker-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.value) {
            props.onChange(e.target.value);
            setDraft(formatDateLocal(e.target.value));
          }
        }}
      />
    </span>
  );
}
