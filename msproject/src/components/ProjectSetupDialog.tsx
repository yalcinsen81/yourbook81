import { useEffect, useState } from "react";
import { t, type MessageKey } from "../i18n";
import { isValidDate, nextWorkday } from "../model/calendar";
import { normalizeCurrency } from "../model/storage";
import { DateInput } from "./DateInput";
import { DEFAULT_SETUP, type ProjectSetup } from "../model/sample";
import type { ProgressWeight } from "../model/types";
import { CurrencyPicker, HolidayOptionsPicker, WorkdayPicker } from "./CalendarSettings";

interface Props {
  today: string;
  onCreate: (setup: ProjectSetup) => void;
  onClose: () => void;
}

const WEIGHTS: ProgressWeight[] = ["cost", "work", "duration"];

/** Yeni proje: ad, başlangıç, çalışma günleri, tatiller ve ilerleme ağırlığı kullanıcı tarafından seçilir. */
export function ProjectSetupDialog({ today, onCreate, onClose }: Props) {
  const [setup, setSetup] = useState<ProjectSetup>({ ...DEFAULT_SETUP, name: t("default.project"), start: nextWorkday(today) });
  const year = Number(setup.start.slice(0, 4)) || Number(today.slice(0, 4));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = isValidDate(setup.start) && setup.name.trim() !== "";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="setup-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="setup-title">{t("setup.title")}</h2>
        <p className="modal-note">{t("setup.note")}</p>
        <div className="settings">
          <label className="field">
            <span>{t("setup.name")}</span>
            <input value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} autoFocus />
          </label>
          <label className="field">
            <span>{t("setup.start")}</span>
            <DateInput value={setup.start} ariaLabel={t("setup.start")} onChange={(start) => setSetup({ ...setup, start })} />
          </label>
          <WorkdayPicker value={setup.workdays} onChange={(workdays) => setSetup({ ...setup, workdays })} />
          <HolidayOptionsPicker
            value={setup.holidays}
            onChange={(holidays) => setSetup({ ...setup, holidays })}
            fromYear={year}
            toYear={year + 3}
          />
          <label className="field">
            <span>{t("setup.weight")}</span>
            <select value={setup.progressWeight} onChange={(e) => setSetup({ ...setup, progressWeight: e.target.value as ProgressWeight })}>
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {t(`weight.option.${w}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <CurrencyPicker value={setup.currency} onChange={(currency) => setSetup({ ...setup, currency })} />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" disabled={!valid} onClick={() => onCreate({ ...setup, name: setup.name.trim(), currency: normalizeCurrency(setup.currency) })}>
            {t("setup.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
