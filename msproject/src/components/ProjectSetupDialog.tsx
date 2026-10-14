import { useEffect, useState } from "react";
import { getLang, t, type MessageKey } from "../i18n";
import { BUILTIN_TEMPLATES, type BuiltinTemplate, type UserTemplate } from "../model/templates";
import { listTemplates, removeTemplate } from "../settings";
import { isValidDate, nextWorkday } from "../model/calendar";
import { normalizeCurrency } from "../model/storage";
import { DateInput } from "./DateInput";
import { DEFAULT_SETUP, type ProjectSetup } from "../model/sample";
import type { ProgressWeight } from "../model/types";
import { CurrencyPicker, HolidayOptionsPicker, WorkdayPicker } from "./CalendarSettings";

interface Props {
  today: string;
  /** Açılışta seçili şablon ("b:konut", "u:<kimlik>"; boş = boş proje) */
  initialTemplate?: string;
  onCreate: (setup: ProjectSetup, template?: BuiltinTemplate | UserTemplate) => void;
  onClose: () => void;
}

const WEIGHTS: ProgressWeight[] = ["cost", "work", "duration"];

/** Yeni proje: ad, başlangıç, çalışma günleri, tatiller ve ilerleme ağırlığı kullanıcı tarafından seçilir. */
export function ProjectSetupDialog({ today, initialTemplate = "", onCreate, onClose }: Props) {
  const [setup, setSetup] = useState<ProjectSetup>({ ...DEFAULT_SETUP, name: t("default.project"), start: nextWorkday(today) });
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>(listTemplates);
  const [tplKey, setTplKey] = useState(initialTemplate);
  const li = getLang() === "tr" ? 0 : 1;
  const builtin = tplKey.startsWith("b:") ? BUILTIN_TEMPLATES.find((x) => x.id === tplKey.slice(2)) : undefined;
  const user = tplKey.startsWith("u:") ? userTemplates.find((x) => x.id === tplKey.slice(2)) : undefined;
  const template = builtin ?? user;
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
            <span>{t("setup.template")}</span>
            <span className="with-clear">
              <select value={template ? tplKey : ""} onChange={(e) => setTplKey(e.target.value)}>
                <option value="">{t("setup.templateNone")}</option>
                <optgroup label={t("setup.templateBuiltin")}>
                  {BUILTIN_TEMPLATES.map((x) => (
                    <option key={x.id} value={`b:${x.id}`}>
                      {x.name[li]}
                    </option>
                  ))}
                </optgroup>
                {userTemplates.length > 0 && (
                  <optgroup label={t("setup.templateMine")}>
                    {userTemplates.map((x) => (
                      <option key={x.id} value={`u:${x.id}`}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {user && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    if (!window.confirm(t("setup.templateDeleteConfirm", { name: user.name }))) return;
                    removeTemplate(user.id);
                    setUserTemplates(listTemplates());
                    setTplKey("");
                  }}
                >
                  {t("setup.templateDelete")}
                </button>
              )}
            </span>
            <small>
              {builtin
                ? `${builtin.description[li]} ${t("setup.templateBuiltinHint", { n: builtin.rows.length })}`
                : user
                  ? t("setup.templateUserHint", { n: user.tasks.length })
                  : t("setup.templateNoneHint")}
            </small>
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
          <button className="primary" disabled={!valid} onClick={() => onCreate({ ...setup, name: setup.name.trim(), currency: normalizeCurrency(setup.currency) }, template)}>
            {t("setup.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
