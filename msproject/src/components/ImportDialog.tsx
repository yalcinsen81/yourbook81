import { useEffect, useMemo, useRef, useState } from "react";
import { t, type MessageKey } from "../i18n";
import { useLocale } from "../i18n/react";
import { guessMapping, IMPORT_FIELDS, importTasks, parseCsv, type ImportField } from "../model/tabular";
import type { Project } from "../model/types";
import { readXlsx } from "../model/xlsx";

interface Props {
  project: Project;
  onImport: (next: Project, imported: number) => void;
  onClose: () => void;
}

/** Bir dosyayı tabloya çevirir: .xlsx (ilk sayfa) ya da CSV / sekmeli metin */
export async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) return readXlsx(new Uint8Array(await file.arrayBuffer()));
  return parseCsv(await file.text());
}

/** CSV / Excel'den görev içe aktarma: dosya → sütun eşleme → önizleme ve sorunlar → aktar */
export function ImportDialog({ project, onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = async (file: File) => {
    setError(null);
    try {
      const rows = (await readTable(file)).filter((r) => r.some((c) => c.trim()));
      if (!rows.length) throw new Error(t("import.empty"));
      setFileName(file.name);
      setTable(rows);
      const guess = guessMapping(rows[0]);
      // Başlıktan hiçbir sütun tanınmadıysa ilk satır veri sayılır; ad ilk metin sütunu olur
      const header = guess.some((f) => f !== "ignore");
      setHasHeader(header);
      setMapping(header ? guess : rows[0].map((_, i) => (i === 0 ? "name" : "ignore")));
    } catch (e) {
      setTable(null);
      setError(t("import.readFailed", { detail: e instanceof Error && e.message ? e.message : "" }));
    }
  };

  const width = table ? Math.max(...table.slice(0, 50).map((r) => r.length)) : 0;
  const loc = useLocale();
  const result = useMemo(() => (table ? importTasks(project, table, mapping, { hasHeader, mode }) : null), [table, mapping, hasHeader, mode, project, loc]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasName = mapping.includes("name");
  const preview = table ? table.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 6) : [];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="import-title">{t("import.title")}</h2>
        <p className="modal-note">{t("import.note")}</p>
        <div className="settings">
          <div className="field-row">
            <button onClick={() => fileRef.current?.click()} autoFocus>
              {t("import.pick")}
            </button>
            <span className="hint">{fileName || t("import.none")}</span>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void load(f);
                e.target.value = "";
              }}
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {table && (
            <>
              <div className="field-row">
                <label className="check">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                  <span>{t("import.hasHeader")}</span>
                </label>
                <div className="segmented" role="radiogroup" aria-label={t("import.mode")}>
                  {(["append", "replace"] as const).map((m) => (
                    <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                      {t(`import.mode.${m}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="report-table-wrap import-map">
                <table className="report-table">
                  <thead>
                    <tr>
                      {Array.from({ length: width }, (_, c) => (
                        <th key={c} scope="col">
                          <select
                            aria-label={t("import.columnLabel", { n: c + 1, name: hasHeader ? (table[0][c] ?? "") : "" })}
                            value={mapping[c] ?? "ignore"}
                            onChange={(e) => {
                              const f = e.target.value as ImportField;
                              // Aynı alan iki sütuna eşlenmez (yoksay hariç)
                              setMapping(Array.from({ length: width }, (_, k) => (k === c ? f : f !== "ignore" && mapping[k] === f ? "ignore" : (mapping[k] ?? "ignore"))));
                            }}
                          >
                            {IMPORT_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {t(`import.field.${f}` as MessageKey)}
                              </option>
                            ))}
                          </select>
                          {hasHeader && <div className="import-head">{table[0][c]}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, r) => (
                      <tr key={r}>
                        {Array.from({ length: width }, (_, c) => (
                          <td key={c} className={mapping[c] === "ignore" ? "muted" : ""}>
                            {row[c] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!hasName && (
                <p className="form-error" role="alert">
                  {t("import.needName")}
                </p>
              )}
              {result && hasName && (
                <div className="import-summary" role="status">
                  <p>{t("import.summary", { n: result.imported, total: table.length - (hasHeader ? 1 : 0) })}</p>
                  {result.problems.length > 0 && (
                    <ul className="issue-box">
                      {result.problems.slice(0, 12).map((x, i) => (
                        <li key={i}>{t("import.problemLine", { line: x.line, message: x.message })}</li>
                      ))}
                      {result.problems.length > 12 && <li>{t("import.moreProblems", { n: result.problems.length - 12 })}</li>}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="primary"
            disabled={!result || !hasName || !result.imported}
            onClick={() => {
              if (!result) return;
              if (mode === "replace" && project.tasks.length && !window.confirm(t("import.confirmReplace", { n: project.tasks.length }))) return;
              onImport(result.project, result.imported);
              onClose();
            }}
          >
            {t("import.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
