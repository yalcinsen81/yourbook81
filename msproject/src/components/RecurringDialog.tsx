import { useEffect, useMemo, useState } from "react";
import { dayName, t } from "../i18n";
import { addDays, parseDate } from "../model/calendar";
import { parseDuration } from "../model/duration";
import { MAX_OCCURRENCES, recurrenceDates, type Recurrence } from "../model/recurrence";
import { DateInput } from "./DateInput";

interface Props {
  workweek: number;
  /** Varsayılan ilk tarih (seçili görevin başı ya da proje başı) */
  from: string;
  onApply: (name: string, duration: number, dates: string[]) => void;
  onClose: () => void;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Yinelenen görev ekle (haftalık / aylık): özet + her tekrar için SNET kısıtlı görev */
export function RecurringDialog({ workweek, from: initialFrom, onApply, onClose }: Props) {
  const [name, setName] = useState(t("recur.defaultName"));
  const [durText, setDurText] = useState("1");
  const [kind, setKind] = useState<Recurrence["kind"]>("weekly");
  const [weekday, setWeekday] = useState(parseDate(initialFrom).getUTCDay());
  const [day, setDay] = useState(parseDate(initialFrom).getUTCDate());
  const [every, setEvery] = useState(1);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(addDays(initialFrom, 7 * 8 - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rule: Recurrence = kind === "weekly" ? { kind, weekday, every } : { kind, day, every };
  const dates = useMemo(() => recurrenceDates(rule, from, to, MAX_OCCURRENCES + 1), [kind, weekday, day, every, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const dur = parseDuration(durText, workweek);
  const error = !name.trim()
    ? t("recur.needName")
    : !dur
      ? t("err.duration")
      : from > to
        ? t("split.badRange")
        : dates.length === 0
          ? t("recur.none")
          : dates.length > MAX_OCCURRENCES
            ? t("recur.tooMany", { n: MAX_OCCURRENCES })
            : null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recur-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!error && dur) onApply(name.trim(), Math.min(10_000, dur.days), dates);
        }}
      >
        <h2 id="recur-title">{t("recur.title")}</h2>
        <p className="modal-note">{t("recur.note")}</p>
        <div className="settings">
          <div className="field-row">
            <label className="field">
              <span>{t("col.name")}</span>
              <input value={name} autoFocus onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>{t("col.duration")}</span>
              <input value={durText} onChange={(e) => setDurText(e.target.value)} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>{t("recur.pattern")}</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as Recurrence["kind"])}>
                <option value="weekly">{t("recur.weekly")}</option>
                <option value="monthly">{t("recur.monthly")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("recur.every")}</span>
              <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {[1, 2, 3, 4, 6].map((n) => (
                  <option key={n} value={n}>
                    {kind === "weekly" ? t("recur.everyWeeks", { n }) : t("recur.everyMonths", { n })}
                  </option>
                ))}
              </select>
            </label>
            {kind === "weekly" ? (
              <label className="field">
                <span>{t("recur.weekday")}</span>
                <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEK_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {dayName(d, false)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>{t("recur.dayOfMonth")}</span>
                <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="field-row">
            <label className="field">
              <span>{t("recur.from")}</span>
              <DateInput value={from} ariaLabel={t("recur.from")} onChange={setFrom} />
            </label>
            <label className="field">
              <span>{t("recur.to")}</span>
              <DateInput value={to} ariaLabel={t("recur.to")} onChange={setTo} />
            </label>
          </div>
        </div>
        <p className="modal-note" role="status">
          {error ?? t("recur.count", { n: dates.length })}
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {t("recur.apply")}
          </button>
        </div>
      </form>
    </div>
  );
}
