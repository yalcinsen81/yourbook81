import { useEffect, useState } from "react";
import { t } from "../i18n";
import { formatShort, isValidDate } from "../model/calendar";
import { DEFAULT_HOLIDAY_OPTIONS, mergeHolidays, type Holiday, type HolidayOptions } from "../model/holidays";
import { defaultHolidays } from "../model/sample";
import { HolidayOptionsPicker, WorkdayPicker } from "./CalendarSettings";

interface Props {
  holidays: Holiday[];
  workdays: number[];
  projectStart: string;
  onSave: (holidays: Holiday[], workdays: number[]) => void;
  onClose: () => void;
}

/** Proje takvimi: çalışma günleri, tatil listesi (ekle/sil, yarım gün) ve hazır Türkiye tatillerinden seçerek ekleme. */
export function CalendarDialog({ holidays, workdays, projectStart, onSave, onClose }: Props) {
  const [list, setList] = useState<Holiday[]>(holidays);
  const [days, setDays] = useState<number[]>(workdays);
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
    setList(mergeHolidays(list, [{ date, name: name.trim() || "Tatil", ...(halfDay ? { halfDay: true } : {}) }]));
    setDate("");
    setName("");
    setHalfDay(false);
  };

  // Var olan tatillere dokunmadan seçilen grupları ekler
  const addTurkish = () => setList(mergeHolidays(list, defaultHolidays(projectStart, options)));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cal-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="cal-title">Proje takvimi</h2>
        <p className="modal-note">{t("calendar.note")}</p>
        <div className="settings">
          <WorkdayPicker value={days} onChange={setDays} />
        </div>
        <ul className="holiday-list">
          {list.map((h) => (
            <li key={h.date}>
              <span className="date">{formatShort(h.date)}</span>
              <span className="name">
                {h.name}
                {h.halfDay && <span className="pill half">{t("calendar.halfDay")}</span>}
              </span>
              <button aria-label={`${h.name} tatilini kaldır`} onClick={() => setList(list.filter((x) => x.date !== h.date))}>
                ✕
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="name">Tatil günü yok.</li>}
        </ul>
        <div className="holiday-add">
          <input type="date" value={date} aria-label="Tatil tarihi" onChange={(e) => setDate(e.target.value)} />
          <input
            type="text"
            value={name}
            placeholder="Açıklama (ör. Şantiye bakımı)"
            aria-label="Tatil açıklaması"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <label className="check inline" title={t("calendar.halfDaysHint")}>
            <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
            <span>{t("calendar.halfDay")}</span>
          </label>
          <button onClick={add} disabled={!isValidDate(date)}>
            Ekle
          </button>
        </div>
        <details className="preset">
          <summary>{t("calendar.addPreset")}</summary>
          <div className="settings">
            <HolidayOptionsPicker value={options} onChange={setOptions} fromYear={year} toYear={year + 3} />
            <button onClick={addTurkish}>{t("calendar.addSelected")}</button>
          </div>
        </details>
        <div className="modal-actions">
          <button onClick={onClose}>Vazgeç</button>
          <button
            className="primary"
            onClick={() => {
              onSave(list, days);
              onClose();
            }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
