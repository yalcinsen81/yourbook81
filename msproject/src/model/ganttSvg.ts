import { formatDateLocal, t } from "../i18n";
import { addDays, diffDays, parseDate } from "./calendar";
import { nonWorkingDates } from "./holidays";
import { wbsCodes } from "./outline";
import { bands, headerUnits, scaleFor, type Scale } from "./timescale";
import type { Baseline, Project, Schedule } from "./types";

// Gantt çıktısı (saf): yazdırma / PDF için sayfalara bölünmüş SVG'ler ve PNG için tek parça SVG. Ekrandaki Gantt
// etkileşimli ve sanallaştırılmış olduğundan çıktı ayrı çizilir; renkler her zaman açık temadır (kağıt).

export type PageSize = "A4" | "A3";
export type Orientation = "landscape" | "portrait";
export type ExportScale = "day" | "week" | "month" | "fit";

export interface GanttExportOptions {
  from: string;
  to: string;
  scale: ExportScale;
  size: PageSize;
  orientation: Orientation;
  /** Gösterilecek satırlar (proje sırasıyla görev dizinleri); yoksa tümü */
  indexes?: number[];
  baseline?: Baseline;
  today?: string;
  title?: string;
}

/** 96 dpi'da sayfa boyutu (piksel) */
export function pageSize(size: PageSize, orientation: Orientation): { width: number; height: number } {
  const [w, h] = size === "A3" ? [1123, 1587] : [794, 1123];
  return orientation === "landscape" ? { width: h, height: w } : { width: w, height: h };
}

const MARGIN = 36;
const ROW = 22;
const TITLE_H = 34;
const HEAD_H = 36;
const COLS = [
  { key: "row", w: 30 },
  { key: "name", w: 210 },
  { key: "start", w: 74 },
  { key: "finish", w: 74 },
];
export const TABLE_W = COLS.reduce((a, c) => a + c.w, 0);
const PPD: Record<Exclude<ExportScale, "fit">, number> = { day: 22, week: 5, month: 1.4 };

// Ekrandaki sıcak paletle aynı (açık tema): normal mat mavi, kritik koyu kiremit, bugün turuncu
const C = {
  ink: "#141413",
  muted: "#5e5d58",
  line: "#e8e6dc",
  head: "#f5f3ec",
  weekend: "#f3f1ea",
  holiday: "#fbeee8",
  bar: "#4c6a88",
  barDone: "#344a60",
  crit: "#7c3a24",
  critDone: "#562818",
  summary: "#141413",
  link: "#8f8d85",
  today: "#d97757",
  baseline: "#8f8d85",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Metni piksel genişliğine sığdırır (yaklaşık karakter genişliğiyle) */
function clip(s: string, px: number, size = 11): string {
  const max = Math.max(1, Math.floor(px / (size * 0.56)));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface Layout {
  ppd: number;
  days: number;
  start: string;
  rows: number[];
}

function layout(p: Project, s: Schedule, o: GanttExportOptions, chartW: number): Layout {
  const from = o.from <= o.to ? o.from : o.to;
  const to = o.from <= o.to ? o.to : o.from;
  const days = diffDays(from, to) + 1;
  const ppd = o.scale === "fit" ? Math.max(0.05, chartW / days) : PPD[o.scale];
  const rows = (o.indexes ?? p.tasks.map((_, i) => i)).filter((i) => {
    const r = s.rows[i];
    // Aralığın dışında kalan görevler çıkmaz
    return r && r.finishDate >= from && r.startDate <= to;
  });
  return { ppd, days, start: from, rows };
}

/** Bir sayfa parçası: [dayFrom, dayTo) gün aralığı ve satır aralığı */
function renderPart(
  p: Project,
  s: Schedule,
  o: GanttExportOptions,
  L: Layout,
  dayFrom: number,
  dayTo: number,
  rowFrom: number,
  rowTo: number,
  width: number,
  height: number,
  pageLabel: string,
  withTable: boolean,
): string {
  const wbs = wbsCodes(p.tasks);
  const ppd = L.ppd;
  const left = (withTable ? TABLE_W : 0) + MARGIN;
  const top = MARGIN + TITLE_H + HEAD_H;
  const x = (iso: string) => left + (diffDays(L.start, iso) - dayFrom) * ppd;
  const chartRight = left + (dayTo - dayFrom) * ppd;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Inter, Segoe UI, Arial, sans-serif">`);
  out.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  // Başlık
  const title = o.title ?? p.name;
  out.push(`<text x="${MARGIN}" y="${MARGIN + 14}" font-size="15" font-weight="600" fill="${C.ink}">${esc(clip(title, width - 2 * MARGIN - 200, 15))}</text>`);
  out.push(
    `<text x="${width - MARGIN}" y="${MARGIN + 14}" font-size="10" fill="${C.muted}" text-anchor="end">${esc(`${formatDateLocal(addDays(L.start, dayFrom))} – ${formatDateLocal(addDays(L.start, dayTo - 1))}${pageLabel ? ` · ${pageLabel}` : ""}`)}</text>`,
  );
  const bodyH = (rowTo - rowFrom) * ROW;
  const chartTop = MARGIN + TITLE_H;
  // Zaman başlığı
  const scale: Scale = scaleFor(ppd);
  const [topUnit, bottomUnit] = headerUnits(scale);
  out.push(`<clipPath id="c"><rect x="${left}" y="${chartTop}" width="${chartRight - left}" height="${HEAD_H + bodyH}"/></clipPath>`);
  out.push(`<g clip-path="url(#c)">`);
  out.push(`<rect x="${left}" y="${chartTop}" width="${chartRight - left}" height="${HEAD_H}" fill="${C.head}"/>`);
  // Hafta sonu ve tatil gölgeleri (gün ölçeğinde ve haftada görünür)
  if (ppd >= 3) {
    const off = new Set(nonWorkingDates(p.holidays));
    const week = new Set(p.workdays ?? [1, 2, 3, 4, 5]);
    for (let d = dayFrom; d < dayTo; d++) {
      const iso = addDays(L.start, d);
      const hol = off.has(iso);
      if (hol || !week.has(parseDate(iso).getUTCDay())) {
        out.push(`<rect x="${x(iso)}" y="${top}" width="${ppd}" height="${bodyH}" fill="${hol ? C.holiday : C.weekend}"/>`);
      }
    }
  }
  for (const [unit, row] of [
    [topUnit, "top"],
    [bottomUnit, "bottom"],
  ] as const) {
    const y = chartTop + (row === "top" ? 0 : HEAD_H / 2);
    for (const b of bands(L.start, unit, row, dayFrom, dayTo)) {
      const bx = left + (b.start - dayFrom) * ppd;
      const bw = b.span * ppd;
      out.push(`<line x1="${bx}" x2="${bx}" y1="${y}" y2="${row === "top" ? y + HEAD_H / 2 : top + bodyH}" stroke="${C.line}"/>`);
      if (bw >= 12) {
        const lx = Math.max(bx, left) + 3;
        out.push(`<text x="${lx}" y="${y + 13}" font-size="10" fill="${C.ink}">${esc(clip(b.label, Math.min(bw, chartRight - lx) - 4, 10))}</text>`);
      }
    }
  }
  out.push(`<line x1="${left}" x2="${chartRight}" y1="${chartTop + HEAD_H / 2}" y2="${chartTop + HEAD_H / 2}" stroke="${C.line}"/>`);
  // Satır çizgileri
  for (let k = rowFrom; k <= rowTo; k++) {
    const y = top + (k - rowFrom) * ROW;
    out.push(`<line x1="${left}" x2="${chartRight}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width="0.5"/>`);
  }
  // Bugün çizgisi
  if (o.today && o.today >= addDays(L.start, dayFrom) && o.today < addDays(L.start, dayTo)) {
    const tx = x(o.today) + ppd / 2;
    out.push(`<line x1="${tx}" x2="${tx}" y1="${chartTop}" y2="${top + bodyH}" stroke="${C.today}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
  }
  // Bağ okları (yalnızca bu sayfadaki satırlar arasında)
  const yOf = new Map<string, number>();
  for (let k = rowFrom; k < rowTo; k++) yOf.set(p.tasks[L.rows[k]].id, top + (k - rowFrom) * ROW + ROW / 2);
  for (let k = rowFrom; k < rowTo; k++) {
    const i = L.rows[k];
    const task = p.tasks[i];
    const r = s.rows[i];
    for (const pr of task.predecessors) {
      const pi = s.byId.get(pr.taskId);
      const py = yOf.get(pr.taskId);
      if (!pi || py === undefined) continue;
      const fromX = pr.type === "FS" || pr.type === "FF" ? x(pi.finishDate) + ppd : x(pi.startDate);
      const toX = pr.type === "FS" || pr.type === "SS" ? x(r.startDate) : x(r.finishDate) + ppd;
      const ty = yOf.get(task.id)!;
      const crit = r.critical && pi.critical;
      out.push(
        `<path d="M${fromX},${py} H${fromX + 5} V${ty} H${toX}" fill="none" stroke="${crit ? C.crit : C.link}" stroke-width="1"/><path d="M${toX},${ty} l-5,-3 v6 z" fill="${crit ? C.crit : C.link}"/>`,
      );
    }
  }
  // Çubuklar
  for (let k = rowFrom; k < rowTo; k++) {
    const i = L.rows[k];
    const task = p.tasks[i];
    const r = s.rows[i];
    const cy = top + (k - rowFrom) * ROW + ROW / 2;
    const x1 = x(r.startDate);
    const x2 = x(r.finishDate) + ppd;
    const b = o.baseline?.tasks[task.id];
    if (b && !r.isSummary) {
      const bx1 = x(b.start);
      if (r.isMilestone) out.push(`<path d="M${bx1 + (r.atDayEnd ? ppd : 0)},${cy + 4} l3,3 l-3,3 l-3,-3 z" fill="none" stroke="${C.baseline}"/>`);
      else out.push(`<rect x="${bx1}" y="${cy + 6}" width="${Math.max(2, x(b.finish) + ppd - bx1)}" height="3" fill="${C.baseline}"/>`);
    }
    const label = (lx: number) =>
      `<text x="${lx}" y="${cy + 4}" font-size="10" fill="${C.ink}">${esc(clip(task.name, Math.max(40, chartRight - lx), 10))}</text>`;
    if (r.isSummary) {
      const w = Math.max(2, x2 - x1);
      out.push(`<path d="M${x1},${cy - 5} h${w} v10 l-5,-5 h${-(w - 10)} l-5,5 z" fill="${C.summary}"/>`);
      out.push(label(x2 + 6));
    } else if (r.isMilestone) {
      const mx = r.atDayEnd ? x2 : x1;
      out.push(`<path d="M${mx},${cy - 6} l6,6 l-6,6 l-6,-6 z" fill="${C.ink}"/>`);
      out.push(label(mx + 10));
    } else {
      const w = Math.max(2, x2 - x1);
      out.push(`<rect x="${x1}" y="${cy - 6}" width="${w}" height="12" rx="3" fill="${r.critical ? C.crit : C.bar}"/>`);
      if (task.percent > 0) out.push(`<rect x="${x1}" y="${cy - 6}" width="${(w * task.percent) / 100}" height="12" rx="3" fill="${r.critical ? C.critDone : C.barDone}"/>`);
      out.push(label(x2 + 6));
    }
  }
  out.push(`</g>`);
  // Tablo
  if (withTable) {
    out.push(`<rect x="${MARGIN}" y="${chartTop}" width="${TABLE_W}" height="${HEAD_H}" fill="${C.head}"/>`);
    let cx = MARGIN;
    const labels: Record<string, string> = { row: "#", name: t("col.name"), start: t("col.start"), finish: t("col.finish") };
    for (const c of COLS) {
      out.push(`<text x="${cx + 4}" y="${chartTop + HEAD_H - 12}" font-size="10" font-weight="600" fill="${C.ink}">${esc(labels[c.key])}</text>`);
      cx += c.w;
    }
    for (let k = rowFrom; k < rowTo; k++) {
      const i = L.rows[k];
      const task = p.tasks[i];
      const r = s.rows[i];
      const y = top + (k - rowFrom) * ROW + ROW / 2 + 4;
      const weight = r.isSummary ? ' font-weight="600"' : "";
      cx = MARGIN;
      const cells = [String(i + 1), `${wbs[i]} ${task.name}`, formatDateLocal(r.startDate), formatDateLocal(r.finishDate)];
      COLS.forEach((c, j) => {
        const indent = j === 1 ? task.outline * 10 : 0;
        out.push(`<text x="${cx + 4 + indent}" y="${y}" font-size="10"${weight} fill="${j === 0 ? C.muted : C.ink}">${esc(clip(cells[j], c.w - 8 - indent, 10))}</text>`);
        cx += c.w;
      });
      out.push(`<line x1="${MARGIN}" x2="${MARGIN + TABLE_W}" y1="${y + 7}" y2="${y + 7}" stroke="${C.line}" stroke-width="0.5"/>`);
    }
    out.push(`<line x1="${MARGIN + TABLE_W}" x2="${MARGIN + TABLE_W}" y1="${chartTop}" y2="${top + bodyH}" stroke="${C.line}"/>`);
  }
  // Açıklama
  out.push(
    `<text x="${MARGIN}" y="${height - MARGIN / 2}" font-size="9" fill="${C.muted}">${esc(`${t("legend.normal")} ■  ${t("legend.critical")} ■  ${t("legend.summary")} ▬  ${t("legend.milestone")} ◆${o.baseline ? `  ${o.baseline.name} ▁` : ""}`)}</text>`,
  );
  out.push(`</svg>`);
  return out.join("");
}

/** Sayfalara bölünmüş Gantt (yazdırma / PDF): önce zaman, sonra satır yönünde sayfa sırası */
export function ganttPages(p: Project, s: Schedule, o: GanttExportOptions): string[] {
  const { width, height } = pageSize(o.size, o.orientation);
  const chartW = width - 2 * MARGIN - TABLE_W;
  const L = layout(p, s, o, chartW);
  // "Sığdır" ölçeği tek sayfa genişliğindedir (kayan nokta yuvarlaması bölmesin)
  const daysPerPage = o.scale === "fit" ? L.days : Math.max(1, Math.floor(chartW / L.ppd + 1e-9));
  const rowsPerPage = Math.max(1, Math.floor((height - 2 * MARGIN - TITLE_H - HEAD_H - 14) / ROW));
  const hPages = Math.max(1, Math.ceil(L.days / daysPerPage));
  const vPages = Math.max(1, Math.ceil(L.rows.length / rowsPerPage));
  const pages: string[] = [];
  const total = hPages * vPages;
  for (let v = 0; v < vPages; v++) {
    for (let h = 0; h < hPages; h++) {
      const n = pages.length + 1;
      pages.push(
        renderPart(
          p,
          s,
          o,
          L,
          h * daysPerPage,
          Math.min(L.days, (h + 1) * daysPerPage),
          v * rowsPerPage,
          Math.min(L.rows.length, (v + 1) * rowsPerPage),
          width,
          height,
          t("export.page", { n, total }),
          true,
        ),
      );
    }
  }
  return pages;
}

/** Tek parça Gantt (PNG): genişlik tarih aralığına, yükseklik satır sayısına göre */
export function ganttImage(p: Project, s: Schedule, o: GanttExportOptions): { svg: string; width: number; height: number } {
  const L = layout(p, s, o, pageSize(o.size, o.orientation).width - 2 * MARGIN - TABLE_W);
  const width = Math.ceil(2 * MARGIN + TABLE_W + L.days * L.ppd);
  const height = Math.ceil(2 * MARGIN + TITLE_H + HEAD_H + L.rows.length * ROW + 14);
  return { svg: renderPart(p, s, o, L, 0, L.days, 0, L.rows.length, width, height, "", true), width, height };
}
