import { useEffect, useState } from "react";
import { t } from "../i18n";
import { formatShort, isValidDate } from "../model/calendar";
import { LAST_RELIGIOUS_YEAR } from "../model/holidayData";
import { DEFAULT_HOLIDAY_OPTIONS, holidayLabel, mergeHolidays, turkishHolidays, type Holiday, type HolidayOptions } from "../model/holidays";
import type { Blackout } from "../model/types";
import { defaultHolidays } from "../model/sample";
import { HolidayOptionsPicker, WorkdayPicker } from "./CalendarSettings";
import { DateInput } from "./DateInput";

export interface CalendarChanges {
  holidays: Holiday[];
  workdays: number[];
  halfDayMode: "full" | "half";
  blackouts: Blackout[];
}

interface Props extends CalendarChanges {
  projectStart: string;
  /** Proje bitiş yılı (varsayılana dönerken tatil yılları) */
  finishYear: number;
  /** Dönem kimliği → onu kullanan görev sayısı */
  blackoutUse: Map<string, number>;
  onSave: (changes: CalendarChanges) => void;
  onClose: () => void;
}

/**
 * Proje takvimi: çalışma günleri, tatil listesi (ekle/sil, yarım gün, varsayılana dön), arifelerin yarım gün sayılması
 * ve çalışılamayan dönemler (görev bilgisinden görevlere uygulanır).
 */
export function CalendarDialog({ holidays, workdays, halfDayMode, blackouts, projectStart, finishYear, blackoutUse, onSave, onClose }: Props) {
  const [list, setList] = useState<Holiday[]>(holidays);
  const [days, setDays] = useState<number[]>(workdays);
  const [half, setHalf] = useState(halfDayMode);
  const [periods, setPeriods] = useState<Blackout[]>(blackouts);
  const [pName, setPName] = useState("");
  const [pFrom, setPFrom] = useState("");
  const [pTo, setPTo] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [options, setOptions] = useState<HolidayOptions>(DEFAULT_HOLIDAY_OPTIONS);
  const year = Number(projectStart.slice(0, 4));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = () => {
    if (!isValidDate(date) || list.some((h) => h.date === date)) return;
    setList(mergeHolidays(list, [{ date, name: name.trim() || t("default.holiday"), ...(halfDay ? { halfDay: true } : {}) }]));
    setDate("");
    setName("");
    setHalfDay(false);
  };

  // Var olan tatillere dokunmadan seçilen grupları ekler
  const addTurkish = () => setList(mergeHolidays(list, defaultHolidays(projectStart, options)));
  // Varsayılana dön: liste seçili gruplardan baştan kurulur (elle eklenenler silinir)
  const resetDefaults = () => {
    if (!window.confirm(t("calendar.resetConfirm"))) return;
    setList(turkishHolidays(year, Math.max(year + 3, finishYear), options));
  };
  const addPeriod = () => {
    if (!isValidDate(pFrom)) return;
    const to = isValidDate(pTo) ? pTo : pFrom;
    const [from, until] = pFrom <= to ? [pFrom, to] : [to, pFrom];
    let n = periods.length + 1;
    while (periods.some((b) => b.id === `b${n}`)) n++;
    setPeriods([...periods, { id: `b${n}`, name: pName.trim() || t("calendar.periodDefault"), from, to: until }]);
    setPName("");
    setPFrom("");
    setPTo("");
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cal-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="cal-title">{t("calendar.title")}</h2>
        <p className="modal-note">{t("calendar.note")}</p>
        {finishYear > LAST_RELIGIOUS_YEAR && (
          <p className="info-note warn" role="note">
            {t("calendar.noDataAfter", { year: String(LAST_RELIGIOUS_YEAR) })}
          </p>
        )}
        <div className="settings">
          <WorkdayPicker value={days} onChange={setDays} />
          <label className="check">
            <input type="checkbox" checked={half === "half"} onChange={(e) => setHalf(e.target.checked ? "half" : "full")} />
            <span>
              {t("calendar.halfDayMode")}
              <small>{t("calendar.halfDayModeHint")}</small>
            </span>
          </label>
        </div>
        <ul className="holiday-list">
          {list.map((h) => (
            <li key={h.date}>
              <span className="date">{formatShort(h.date)}</span>
              <span className="name" title={holidayLabel(h)}>
                {holidayLabel(h)}
                {h.halfDay && <span className="pill half">{t("calendar.halfDay")}</span>}
              </span>
              <button aria-label={t("calendar.remove", { name: holidayLabel(h) })} onClick={() => setList(list.filter((x) => x.date !== h.date))}>
                ✕
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="name">{t("calendar.empty")}</li>}
        </ul>
        <div className="holiday-add">
          <DateInput value={date} ariaLabel={t("calendar.date")} onChange={setDate} />
          <input
            type="text"
            value={name}
            placeholder={t("calendar.descPlaceholder")}
            aria-label={t("calendar.desc")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <label className="check inline" title={t("calendar.halfDaysHint")}>
            <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
            <span>{t("calendar.halfDay")}</span>
          </label>
          <button onClick={add} disabled={!isValidDate(date)}>
            {t("common.add")}
          </button>
        </div>
        <details className="preset">
          <summary>{t("calendar.addPreset")}</summary>
          <div className="settings">
            <HolidayOptionsPicker value={options} onChange={setOptions} fromYear={year} toYear={year + 3} />
            <div className="row-buttons">
              <button onClick={addTurkish}>{t("calendar.addSelected")}</button>
              <button onClick={resetDefaults} title={t("calendar.resetHint")}>
                {t("calendar.reset")}
              </button>
            </div>
          </div>
        </details>
        <details className="preset" open={periods.length > 0}>
          <summary>{t("calendar.periods")}</summary>
          <p className="modal-note">{t("calendar.periodsNote")}</p>
          <ul className="holiday-list compact">
            {periods.map((b) => (
              <li key={b.id}>
                <span className="date">
                  {formatShort(b.from)} – {formatShort(b.to)}
                </span>
                <span className="name" title={b.name}>
                  {b.name}
                  {(blackoutUse.get(b.id) ?? 0) > 0 && <span className="pill">{t("calendar.periodUse", { n: blackoutUse.get(b.id)! })}</span>}
                </span>
                <button aria-label={t("calendar.remove", { name: b.name })} onClick={() => setPeriods(periods.filter((x) => x.id !== b.id))}>
                  ✕
                </button>
              </li>
            ))}
            {!periods.length && <li className="name">{t("calendar.noPeriods")}</li>}
          </ul>
          <div className="holiday-add">
            <input
              type="text"
              value={pName}
              placeholder={t("calendar.periodName")}
              aria-label={t("calendar.periodName")}
              onChange={(e) => setPName(e.target.value)}
            />
            <DateInput value={pFrom} ariaLabel={t("calendar.periodFrom")} onChange={setPFrom} />
            <DateInput value={pTo} ariaLabel={t("calendar.periodTo")} onChange={setPTo} />
            <button onClick={addPeriod} disabled={!isValidDate(pFrom)}>
              {t("common.add")}
            </button>
          </div>
        </details>
        <div className="modal-actions">
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="primary"
            onClick={() => {
              onSave({ holidays: list, workdays: days, halfDayMode: half, blackouts: periods });
              onClose();
            }}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
