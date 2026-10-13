import { useEffect, useRef, useState } from "react";
import { formatNumber, t } from "../i18n";
import { sanitizeProject } from "../model/storage";
import type { Project } from "../model/types";
import { listBackups, listSnapshots } from "../settings";

interface Props {
  /** Bozuk dosya açılırken gelindiyse hata açıklaması */
  problem?: { name: string; detail: string };
  onRestore: (p: Project, label: string) => void;
  onClose: () => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** JSON metninden proje (bozuksa null) */
export function projectFromText(text: string): Project | null {
  try {
    return sanitizeProject(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Kurtarma: otomatik anlık görüntüler (dakikada bir, son 8), eski sürümlü dosyaların yükseltme yedekleri ve diskten
 * bir yedek (.bak / .json) dosyası. Geri yükleme geri alınabilir bir adımdır.
 */
export function RecoveryDialog({ problem, onRestore, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshots = listSnapshots();
  const backups = listBackups();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = (text: string, label: string) => {
    const p = projectFromText(text);
    if (!p) {
      setError(t("recovery.bad", { name: label }));
      return;
    }
    onRestore(p, label);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="recovery-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="recovery-title">{problem ? t("recovery.corruptTitle") : t("recovery.title")}</h2>
        {problem ? (
          <div className="issue-box" role="alert">
            <p>{t("recovery.corrupt", { name: problem.name })}</p>
            {problem.detail && <p className="mono">{problem.detail}</p>}
            <p>{t("recovery.corruptHint")}</p>
          </div>
        ) : (
          <p className="modal-note">{t("recovery.note")}</p>
        )}
        <div className="settings">
          <fieldset className="setting">
            <legend>{t("recovery.bak")}</legend>
            <button onClick={() => fileRef.current?.click()} autoFocus>
              {t("recovery.pickBak")}
            </button>
            <small className="hint">{t("recovery.bakHint")}</small>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".bak,.json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) restore(await f.text(), f.name);
              }}
            />
          </fieldset>
          <fieldset className="setting">
            <legend>{t("recovery.snapshots")}</legend>
            {snapshots.length ? (
              <ul className="recover-list">
                {snapshots.map((s) => (
                  <li key={s.at}>
                    <span>
                      <b>{s.name || t("common.unnamed")}</b> <small>{t("recovery.meta", { when: when(s.at), n: formatNumber(s.tasks) })}</small>
                    </span>
                    <button onClick={() => restore(s.text, s.name)}>{t("recovery.restore")}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <small className="hint">{t("recovery.noSnapshots")}</small>
            )}
          </fieldset>
          {backups.length > 0 && (
            <fieldset className="setting">
              <legend>{t("recovery.upgrades")}</legend>
              <ul className="recover-list">
                {backups.map((b) => (
                  <li key={b.at + b.name}>
                    <span>
                      <b>{b.name}</b> <small>{when(b.at)}</small>
                    </span>
                    <button onClick={() => restore(b.text, b.name)}>{t("recovery.restore")}</button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
