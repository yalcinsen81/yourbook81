import { formatDateLocal, getLang, parseDateLocal, parseNumberLocal, t } from "../i18n";
import { isValidDate, WorkCalendar } from "./calendar";
import { parseDuration } from "./duration";
import { nonWorkingDates } from "./holidays";
import { normalizeOutline } from "./outline";
import { assignFromText } from "./resources";
import { newId, toTags } from "./storage";
import type { ReportTable } from "./reports";
import type { XlsxKind, XlsxSheet } from "./xlsx";
import type { Predecessor, Project, Task } from "./types";

// Tablo dışa / içe aktarma (saf): rapor tablosundan CSV ve Excel sayfası; CSV / Excel satırlarından görev içe aktarma
// (sütun eşlemeyle).

// --- CSV ---

/** Ayırıcı: Türkçe Excel noktalı virgül bekler (virgül ondalık ayırıcıdır), İngilizce virgül */
export function csvSeparator(lang = getLang()): string {
  return lang === "tr" ? ";" : ",";
}

function csvCell(v: string, sep: string): string {
  return /["\r\n]/.test(v) || v.includes(sep) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Hücre değerinin CSV metni: sayılar dilin ondalığıyla (binlik ayırıcısız), tarihler seçili tarih biçiminde */
function csvValue(v: string | number | null | undefined, kind: string): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    const s = String(Math.round(v * 1000) / 1000);
    return getLang() === "tr" ? s.replace(".", ",") : s;
  }
  if (kind === "date" && isValidDate(v)) return formatDateLocal(v);
  return v;
}

/** Rapor tablosunu CSV'ye çevirir (UTF-8 BOM ile; Excel Türkçe harfleri doğru açsın) */
export function reportToCsv(table: ReportTable): string {
  const sep = csvSeparator();
  const lines = [table.columns.map((c) => csvCell(c.label, sep)).join(sep)];
  for (const row of [...table.rows, ...(table.total ? [table.total] : [])]) {
    lines.push(table.columns.map((c) => csvCell(csvValue(row[c.key], c.kind), sep)).join(sep));
  }
  for (const note of table.notes ?? []) lines.push(csvCell(note, sep));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** CSV metnini satırlara böler; ayırıcı ilk satırdan sezilir (; , ya da sekme). Tırnaklı hücre ve satır sonu desteklenir. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.replace(/"[^"]*"/g, "").split(ch).length - 1;
  const sep = ["\t", ";", ","].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Rapor tablosundan Excel sayfası (sayılar sayı, tarihler tarih, yüzdeler yüzde biçiminde) */
export function reportToSheet(table: ReportTable): XlsxSheet {
  const kinds: XlsxKind[] = table.columns.map((c) => (c.kind === "days" ? "number" : c.kind));
  return {
    name: table.title,
    header: table.columns.map((c) => c.label),
    kinds,
    rows: table.rows.map((r) => table.columns.map((c) => r[c.key] ?? null)),
    footer: [...(table.total ? [table.columns.map((c) => table.total![c.key] ?? null)] : []), ...(table.notes ?? []).map((n) => [n])],
  };
}

// --- İçe aktarma ---

export type ImportField =
  | "ignore"
  | "id"
  | "name"
  | "duration"
  | "start"
  | "finish"
  | "predecessors"
  | "resources"
  | "percent"
  | "outline"
  | "wbs"
  | "notes"
  | "tags";

export const IMPORT_FIELDS: ImportField[] = ["ignore", "id", "name", "duration", "start", "finish", "predecessors", "resources", "percent", "outline", "wbs", "notes", "tags"];

/** Başlık adlarından (TR / EN, MS Project dışa aktarımı) sütun eşlemesi tahmini */
const GUESS: [ImportField, RegExp][] = [
  ["id", /^(id|no|sıra|sira|#|satır|satir|row|unique id)$/i],
  ["wbs", /^(wbs|yapı|yapi|ayrıştırma|wbs kodu)$/i],
  ["outline", /^(outline level|düzey|duzey|seviye|level|anahat düzeyi)$/i],
  ["name", /^(name|task name|ad|adı|adi|görev|gorev|görev adı|gorev adi|iş|is|activity|faaliyet)$/i],
  ["duration", /^(duration|süre|sure|gün|gun|days)$/i],
  ["start", /^(start|başlangıç|baslangic|başlama|start date)$/i],
  ["finish", /^(finish|end|bitiş|bitis|finish date|end date)$/i],
  ["predecessors", /^(predecessors?|öncüller?|onculler?|bağımlılık|bagimlilik|depends on)$/i],
  ["resources", /^(resource names?|resources?|kaynaklar?|kaynak adları|kaynak adlari)$/i],
  ["percent", /^(% ?complete|percent complete|complete|% ?tamamlanan|tamamlanma|ilerleme|%|% tam\.?)$/i],
  ["notes", /^(notes?|notlar?|açıklama|aciklama|description)$/i],
  ["tags", /^(tags?|etiketler?|kategori|category)$/i],
];

export function guessMapping(header: string[]): ImportField[] {
  const used = new Set<ImportField>();
  return header.map((h) => {
    const key = h.trim();
    const hit = GUESS.find(([f, re]) => !used.has(f) && re.test(key))?.[0];
    if (!hit) return "ignore";
    used.add(hit);
    return hit;
  });
}

export interface ImportOptions {
  /** İlk satır başlık mı */
  hasHeader: boolean;
  /** Projenin sonuna ekle ya da görevleri değiştir */
  mode: "append" | "replace";
}

export interface ImportResult {
  project: Project;
  imported: number;
  /** Satır numarası (kaynak dosyada, 1'den) ve sorun */
  problems: { line: number; message: string }[];
}

/** Tarih: seçili biçim, ISO, diğer dilin biçimi ve MS Project dışa aktarımı ("Pzt 02.11.26", "Mon 11/2/26") */
export function parseImportDate(text: string): string | null {
  const s = text.trim().replace(/^[^\d]+/, "").replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i, "");
  if (!s) return null;
  return parseDateLocal(s);
}

function parsePercent(text: string): number | null {
  const n = parseNumberLocal(text.replace("%", ""));
  if (n === null) return null;
  // Excel yüzdesi oran olarak gelebilir (0,45)
  const v = n > 0 && n <= 1 && !text.includes("%") && /[.,]/.test(text) ? n * 100 : n;
  return v >= 0 && v <= 100 ? Math.round(v) : null;
}

/**
 * Satırlardan görevler: ad zorunlu; süre yoksa başlangıç–bitişten (proje takvimiyle), o da yoksa 1 gün. Başlangıç
 * proje başlangıcından sonraysa SNET kısıtı olur. Öncüller kaynak tablodaki kimlik (id sütunu) ya da veri satırı
 * numarasıyla yazılır. Kaynak adları listede yoksa yeni kaynak olarak eklenir.
 */
export function importTasks(project: Project, table: string[][], mapping: ImportField[], opts: ImportOptions): ImportResult {
  const problems: ImportResult["problems"] = [];
  const data = opts.hasHeader ? table.slice(1) : table;
  const lineOf = (k: number) => k + 1 + (opts.hasHeader ? 1 : 0);
  const colOf = (f: ImportField) => mapping.indexOf(f);
  const get = (row: string[], f: ImportField) => {
    const c = colOf(f);
    return c >= 0 ? (row[c] ?? "").trim() : "";
  };
  if (colOf("name") < 0) return { project, imported: 0, problems: [{ line: 0, message: t("import.needName") }] };
  const cal = new WorkCalendar(project.start, nonWorkingDates(project.holidays), project.workdays);
  const weekLen = project.workdays?.length ?? 5;
  const base = opts.mode === "replace" ? [] : project.tasks;
  const created: { task: Task; line: number; preds: string; resources: string; srcId: string }[] = [];
  data.forEach((row, k) => {
    const line = lineOf(k);
    const name = get(row, "name");
    if (!name) {
      if (row.some((c) => c.trim())) problems.push({ line, message: t("import.noName") });
      return;
    }
    // Düzey: anahat düzeyi (1'den) ya da WBS kodunun derinliği
    let outline = 0;
    const lvl = get(row, "outline");
    const wbs = get(row, "wbs");
    if (lvl && Number.isFinite(Number(lvl))) outline = Math.max(0, Math.round(Number(lvl)) - 1);
    else if (wbs) outline = Math.max(0, wbs.split(".").filter(Boolean).length - 1);
    const startText = get(row, "start");
    const finishText = get(row, "finish");
    const start = startText ? parseImportDate(startText) : null;
    const finish = finishText ? parseImportDate(finishText) : null;
    if (startText && !start) problems.push({ line, message: t("import.badDate", { value: startText }) });
    if (finishText && !finish) problems.push({ line, message: t("import.badDate", { value: finishText }) });
    let duration = 1;
    const durText = get(row, "duration").replace(/\?$/, "");
    if (durText) {
      const d = parseDuration(durText.replace(/^(\d+),(\d+)/, "$1.$2"), weekLen);
      if (d) duration = Math.max(0, d.days);
      else problems.push({ line, message: t("import.badDuration", { value: durText }) });
    } else if (start && finish) {
      if (finish < start) problems.push({ line, message: t("import.finishBeforeStart") });
      else duration = cal.workdaysBetween(start, finish);
    }
    const task: Task = { id: newId(), name, duration: Math.min(10_000, duration), outline, percent: 0, predecessors: [] };
    const pctText = get(row, "percent");
    if (pctText) {
      const pct = parsePercent(pctText);
      if (pct === null) problems.push({ line, message: t("import.badPercent", { value: pctText }) });
      else task.percent = pct;
    }
    if (start && start > project.start) task.constraint = { type: "SNET", date: start };
    const notes = get(row, "notes");
    if (notes) task.notes = notes;
    const tags = toTags(get(row, "tags"));
    if (tags) task.tags = tags;
    created.push({ task, line, preds: get(row, "predecessors"), resources: get(row, "resources"), srcId: get(row, "id") });
  });
  // Öncüller: kimlik sütunu varsa ona, yoksa veri satırı sırasına göre
  const byKey = new Map<string, Task>();
  created.forEach((c, i) => {
    byKey.set(c.srcId || String(i + 1), c.task);
  });
  for (const c of created) {
    if (!c.preds) continue;
    const preds: Predecessor[] = [];
    for (const part of c.preds.split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
      const m = /^(\d+)\s*(FS|SS|FF|SF|BB|BŞBŞ|BTBT|BŞBT)?\s*(?:([+-])\s*(\d+)\s*\S*)?$/i.exec(part);
      const target = m ? byKey.get(m[1]) : undefined;
      if (!m || !target || target === c.task) {
        problems.push({ line: c.line, message: t("import.badPredecessor", { value: part }) });
        continue;
      }
      const alias: Record<string, Predecessor["type"]> = { BB: "FS", BŞBŞ: "SS", BTBT: "FF", BŞBT: "SF" };
      const key = (m[2] ?? "FS").toLocaleUpperCase("tr-TR");
      preds.push({ taskId: target.id, type: alias[key] ?? (key as Predecessor["type"]), lag: m[3] ? (m[3] === "-" ? -1 : 1) * Number(m[4]) : 0 });
    }
    c.task.predecessors = preds;
  }
  let next: Project = { ...project, tasks: normalizeOutline([...base, ...created.map((c) => c.task)]) };
  if (opts.mode === "replace") next = { ...next, baselines: undefined };
  for (const c of created) {
    if (!c.resources) continue;
    const r = assignFromText(next, c.task.id, c.resources);
    if (r.errors.length) problems.push({ line: c.line, message: t("err.resource", { parts: r.errors.join(", ") }) });
    else next = r.project;
  }
  if (!next.baselines) delete next.baselines;
  return { project: next, imported: created.length, problems };
}
