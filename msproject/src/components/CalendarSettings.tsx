import { currencySymbol, t, weekStartDay, type MessageKey } from "../i18n";
import type { HolidayOptions } from "../model/holidays";
import { yearsWithoutReligiousData } from "../model/holidays";

// Proje takvimi seçimleri: çalışma günleri ve hazır tatil grupları. Yeni proje penceresi ve Proje takvimi
// penceresi aynı parçaları kullanır.

/** Seçili dilin hafta başından başlayan gün sırası (0 = pazar) */
const week = () => Array.from({ length: 7 }, (_, i) => (weekStartDay() + i) % 7);

export function WorkdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => {
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b);
    if (next.length) onChange(next);
  };
  return (
    <fieldset className="setting">
      <legend>{t("calendar.workdays")}</legend>
      <div className="day-toggles" role="group">
        {week().map((d) => (
          <label key={d} className={`day-toggle ${value.includes(d) ? "on" : ""}`} title={t(`day.long.${d}` as MessageKey)}>
            <input type="checkbox" checked={value.includes(d)} onChange={() => toggle(d)} />
            {t(`day.short.${d}` as MessageKey)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function HolidayOptionsPicker(props: {
  value: HolidayOptions;
  onChange: (o: HolidayOptions) => void;
  fromYear: number;
  toYear: number;
}) {
  const { value, onChange } = props;
  const missing = yearsWithoutReligiousData(props.fromYear, props.toYear);
  const box = (key: keyof HolidayOptions, label: MessageKey, hint?: string) => (
    <label className="check">
      <input type="checkbox" checked={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} />
      <span>
        {t(label)}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
  return (
    <fieldset className="setting">
      <legend>{t("calendar.holidays", { from: String(props.fromYear), to: String(props.toYear) })}</legend>
      {box("official", "calendar.official")}
      {box(
        "religious",
        "calendar.religious",
        missing.length ? t("calendar.religiousMissing", { years: missing.join(", ") }) : undefined,
      )}
      {box("halfDays", "calendar.halfDays", t("calendar.halfDaysHint"))}
    </fieldset>
  );
}

export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"];

/** Para birimi: hazır seçenekler ya da özel kod (ör. AED). Tutarlar dönüştürülmez. */
export function CurrencyPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const custom = !CURRENCIES.includes(value);
  return (
    <label className="field">
      <span>{t("settings.currency")}</span>
      <span className="currency-row">
        <select value={custom ? "" : value} onChange={(e) => onChange(e.target.value || "")}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {currencySymbol(c)} {c}
            </option>
          ))}
          <option value="">{t("settings.currencyCustom")}</option>
        </select>
        {custom && (
          <input
            value={value}
            maxLength={8}
            placeholder={t("settings.currencyCustomPlaceholder")}
            aria-label={t("settings.currencyCustom")}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        )}
      </span>
      <small>{t("settings.currencyNote")}</small>
    </label>
  );
}
