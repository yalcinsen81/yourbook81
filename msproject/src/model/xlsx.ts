// Kütüphanesiz .xlsx yazma ve okuma (saf). Yazarken sıkıştırmasız ZIP (store), okurken store ve deflate
// (tarayıcının / Node'un DecompressionStream'i ile) desteklenir. Yalnızca tablo verisi: hücre değeri, kalın başlık,
// sayı / para / yüzde / tarih biçimi ve sütun genişliği.

import { dateOrder } from "../i18n";

// --- ZIP ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Sıkıştırmasız ZIP arşivi */
export function zipStore(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 ad
    local.setUint16(8, 0, true); // store
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP arşivini açar (store ve deflate). Bozuksa hata fırlatır. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + size);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// --- XLSX yazma ---

export type XlsxKind = "text" | "number" | "money" | "percent" | "date";
export interface XlsxSheet {
  name: string;
  /** İlk satır başlık (kalın) */
  header: string[];
  kinds: XlsxKind[];
  rows: (string | number | null)[][];
  /** Tablo altındaki ek satırlar (toplam, açıklama) */
  footer?: (string | number | null)[][];
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML'de geçersiz denetim karakterleri atılır
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** YYYY-AA-GG → Excel seri günü (1900 tarih sistemi) */
export function excelSerial(iso: string): number {
  return (Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export function fromExcelSerial(n: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10);
}

// Stil dizinleri: 0 normal, 1 kalın başlık, 2 tarih, 3 para, 4 yüzde, 5 ondalık sayı
const STYLE: Record<XlsxKind, number> = { text: 0, number: 5, date: 2, money: 3, percent: 4 };

function cellXml(ref: string, v: string | number | null, kind: XlsxKind, bold = false): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    const value = kind === "percent" ? v / 100 : v;
    return `<c r="${ref}"${bold ? ' s="1"' : STYLE[kind] ? ` s="${STYLE[kind]}"` : ""}><v>${value}</v></c>`;
  }
  const s = String(v);
  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return `<c r="${ref}" s="2"><v>${excelSerial(s)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
}

function sheetXml(sh: XlsxSheet): string {
  const widths = sh.header.map((h, c) =>
    Math.min(60, Math.max(8, h.length + 2, ...sh.rows.slice(0, 500).map((r) => (r[c] === null || r[c] === undefined ? 0 : String(r[c]).length + 2)))),
  );
  const rows: string[] = [];
  const all: { cells: (string | number | null)[]; bold: boolean }[] = [
    { cells: sh.header, bold: true },
    ...sh.rows.map((cells) => ({ cells, bold: false })),
    ...(sh.footer ?? []).map((cells) => ({ cells, bold: true })),
  ];
  all.forEach(({ cells, bold }, r) => {
    const xml = cells.map((v, c) => cellXml(`${colName(c)}${r + 1}`, v, r === 0 ? "text" : (sh.kinds[c] ?? "text"), bold)).join("");
    rows.push(`<row r="${r + 1}">${xml}</row>`);
  });
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${rows.join("")}</sheetData></worksheet>`
  );
}

/** Sayfa adı: Excel'in yasakladığı karakterler atılır, en çok 31 karakter, tekrarsız */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n, i) => {
    let base = n.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Sheet${i + 1}`;
    for (let k = 2; used.has(base.toLowerCase()); k++) base = `${base.slice(0, 28)} ${k}`;
    used.add(base.toLowerCase());
    return base;
  });
}

/** Tarih hücrelerinin Excel biçimi, uygulamadaki tarih biçimi ayarına göre */
const DATE_CODES = { dmy: "dd.mm.yyyy", mdy: "m/d/yyyy", iso: "yyyy-mm-dd" } as const;

/** Tablo sayfalarından .xlsx dosyası */
export function writeXlsx(sheets: XlsxSheet[]): Uint8Array {
  const names = sheetNames(sheets.map((s) => s.name));
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.###"/><numFmt numFmtId="165" formatCode="${DATE_CODES[dateOrder()]}"/></numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="6">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `</cellXfs></styleSheet>`;
  return zipStore([
    {
      name: "[Content_Types].xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { name: "xl/styles.xml", data: styles },
    ...sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sh) })),
  ]);
}

// --- XLSX okuma ---

const unesc = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** <t> parçalarının birleşimi (zengin metinde birden çok <r><t>) */
function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join("");
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Tarih biçimli stil dizinleri */
function dateStyles(stylesXml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) custom.set(Number(attr(m[0], "numFmtId")), unesc(attr(m[0], "formatCode") ?? ""));
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  const out = new Set<number>();
  [...xfs.matchAll(/<xf\s[^>]*?\/?>/g)].forEach((m, i) => {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    const code = custom.get(id)?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
    if ((id >= 14 && id <= 17) || id === 22 || (id >= 164 && /[dy]/i.test(code))) out.add(i);
  });
  return out;
}

/** .xlsx dosyasının ilk sayfası: satırlar × hücre metinleri (tarihler YYYY-AA-GG) */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes);
  const text = (name: string) => {
    const f = files.get(name);
    return f ? dec.decode(f) : "";
  };
  const workbook = text("xl/workbook.xml");
  const firstSheet = /<sheet\s[^>]*>/.exec(workbook)?.[0];
  const rid = firstSheet ? (attr(firstSheet, "r:id") ?? "") : "";
  const rels = text("xl/_rels/workbook.xml.rels");
  const rel = [...rels.matchAll(/<Relationship\s[^>]*>/g)].find((m) => attr(m[0], "Id") === rid)?.[0];
  let target = rel ? (attr(rel, "Target") ?? "") : "worksheets/sheet1.xml";
  target = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheet = text(target) || text("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("xlsx");
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const dates = dateStyles(text("xl/styles.xml"));
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const r = Number(attr(rm[0].slice(0, rm[0].indexOf(">") + 1), "r") ?? rows.length + 1) - 1;
    const cells: string[] = [];
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = `<c${cm[1]}>`;
      const ref = attr(head, "r") ?? "";
      const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "";
      const c = letters ? [...letters].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : cells.length;
      const type = attr(head, "t");
      const style = Number(attr(head, "s") ?? 0);
      const body = cm[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) {
        value = unesc(v);
        if (type !== "str" && type !== "e" && dates.has(style) && Number.isFinite(Number(value))) value = fromExcelSerial(Number(value));
      }
      cells[c] = value;
    }
    rows[r] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (x) => x ?? []);
}
