import { useEffect, useState } from "react";
import { t, type MessageKey } from "../i18n";
import { EVM_KEYS } from "../model/reports";

export type HelpTopic = "keys" | "evm" | "indicators";

interface Props {
  topic: HelpTopic;
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

/** Kısayol listesi: [tuşlar, açıklama anahtarı] */
const KEYS: [string, MessageKey][] = [
  ["F1 · ?", "help.k.help"],
  ["Insert", "help.k.insert"],
  ["Delete", "help.k.delete"],
  [`${MOD}+Delete`, "help.k.deleteEditing"],
  ["Enter · ↓ / Shift+Enter · ↑", "help.k.enter"],
  ["Tab / Shift+Tab", "help.k.tab"],
  ["Esc", "help.k.esc"],
  ["Shift+↑ / Shift+↓", "help.k.extend"],
  ["Alt+Shift+→ / ←", "help.k.indent"],
  [`${MOD}+F2`, "help.k.link"],
  ["Shift+F2", "help.k.info"],
  [`${MOD}+C / ${MOD}+V`, "help.k.copy"],
  [`${MOD}+D`, "help.k.duplicate"],
  [`${MOD}+Z / ${MOD}+Y`, "help.k.undo"],
  [`${MOD}+F`, "help.k.find"],
  [`${MOD}++ / ${MOD}+− / ${MOD}+0`, "help.k.zoom"],
  ["Home / End", "help.k.homeEnd"],
  [`${MOD}+P`, "help.k.print"],
];

const INDICATORS: [string, string, MessageKey][] = [
  ["!", "issue", "help.i.issue"],
  ["⏰", "late", "help.i.late"],
  ["✎", "note", "help.i.note"],
  ["🔗", "link", "help.i.link"],
  ["✓", "done", "help.i.done"],
  ["⇩", "deadline", "help.i.deadline"],
];

/** Yardım: klavye kısayolları, kazanılmış değer formülleri, gösterge simgeleri */
export function HelpDialog({ topic, onClose }: Props) {
  const [tab, setTab] = useState<HelpTopic>(topic);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="help-title">{t("help.title")}</h2>
        <div className="segmented" role="tablist" aria-label={t("help.title")}>
          {(["keys", "evm", "indicators"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} autoFocus={k === topic}>
              {t(`help.tab.${k}`)}
            </button>
          ))}
        </div>
        <div className="help-body" role="tabpanel">
          {tab === "keys" && (
            <>
              <table className="report-table help-table">
                <tbody>
                  {KEYS.map(([k, d]) => (
                    <tr key={d}>
                      <th scope="row">
                        <kbd>{k}</kbd>
                      </th>
                      <td>{t(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">{t("help.keysNote")}</p>
            </>
          )}
          {tab === "evm" && (
            <>
              <p>{t("help.evmIntro")}</p>
              <table className="report-table help-table">
                <tbody>
                  {EVM_KEYS.map((k) => (
                    <tr key={k}>
                      <th scope="row">{k.toUpperCase()}</th>
                      <td>
                        <b>{t(`evm.${k}` as MessageKey)}</b>
                        <br />
                        <small>{t(`help.evm.${k}` as MessageKey)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">{t("help.evmNote")}</p>
            </>
          )}
          {tab === "indicators" && (
            <table className="report-table help-table">
              <tbody>
                {INDICATORS.map(([sym, cls, d]) => (
                  <tr key={d}>
                    <th scope="row">
                      <span className={`ind ${cls}`}>{sym}</span>
                    </th>
                    <td>{t(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
