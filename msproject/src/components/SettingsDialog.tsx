import { useEffect } from "react";
import { DATE_STYLES, formatDateLocal, getDateStyle, getLang, t, type Lang } from "../i18n";
import { useLocale } from "../i18n/react";
import { listBackups, saveLocale } from "../settings";
import { CurrencyPicker } from "./CalendarSettings";
import type { Density } from "./layout";

interface Props {
  currency: string;
  onCurrency: (code: string) => void;
  /** Dosya indirme (App'teki yardımcı) */
  download: (content: string, fileName: string) => void;
  onClose: () => void;
  density: Density;
  onDensity: (d: Density) => void;
}

const LANGS: [Lang, string][] = [
  ["tr", "Türkçe"],
  ["en", "English"],
];

/** Ayarlar: dil, tarih biçimi ve satır yoğunluğu (bu bilgisayar), para birimi (bu proje), yükseltme öncesi yedekler */
export function SettingsDialog({ currency, onCurrency, download, onClose, density, onDensity }: Props) {
  useLocale();
  const lang = getLang();
  const dateStyle = getDateStyle();
  const backups = listBackups();
  // Örnek tarih: seçili dile göre biçim önizlemesi
  const example = { locale: lang === "tr" ? "13.11.2026" : "11/13/2026", dmy: "13.11.2026", iso: "2026-11-13" } as const;
  const label = { locale: "settings.dateLocale", dmy: "settings.dateDmy", iso: "settings.dateIso" } as const;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="settings-title">{t("settings.title")}</h2>
        <div className="settings">
          <fieldset className="setting">
            <legend>{t("settings.language")}</legend>
            <div className="segmented" role="radiogroup">
              {LANGS.map(([code, name]) => (
                <button key={code} role="radio" aria-checked={lang === code} className={lang === code ? "on" : ""} lang={code} onClick={() => saveLocale(code, dateStyle)}>
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="setting">
            <legend>{t("settings.dateFormat")}</legend>
            {DATE_STYLES.map((style) => (
              <label key={style} className="check">
                <input type="radio" name="date-style" value={style} checked={dateStyle === style} onChange={() => saveLocale(lang, style)} />
                <span>
                  {t(label[style])} <small className="hint">{example[style]}</small>
                  {style === "locale" && lang === "en" && <small className="hint date-hint">{t("settings.dateLocaleHint")}</small>}
                </span>
              </label>
            ))}
            <small className="modal-note">{t("settings.appNote")}</small>
          </fieldset>
          <fieldset className="setting">
            <legend>{t("settings.density")}</legend>
            <div className="segmented" role="radiogroup">
              {(["compact", "comfortable"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={density === d} className={density === d ? "on" : ""} onClick={() => onDensity(d)}>
                  {t(d === "compact" ? "settings.compact" : "settings.comfortable")}
                </button>
              ))}
            </div>
            <small className="modal-note">{t("settings.densityHint")}</small>
          </fieldset>
          <CurrencyPicker value={currency} onChange={onCurrency} />
          <fieldset className="setting">
            <legend>{t("settings.backup")}</legend>
            {backups.length === 0 && <small>{t("settings.backupNone")}</small>}
            {backups.map((b) => (
              <div key={b.at} className="backup-row">
                <span title={b.name}>{t("settings.backupOf", { name: b.name, date: `${formatDateLocal(b.at.slice(0, 10))} ${b.at.slice(11, 16)}` })}</span>
                <button onClick={() => download(b.text, `${b.name}.bak`)}>{t("settings.backupDownload")}</button>
              </div>
            ))}
          </fieldset>
        </div>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
