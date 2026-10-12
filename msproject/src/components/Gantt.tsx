import { useMemo, type MouseEvent, type RefObject, type UIEvent } from "react";
import { addDays, diffDays, formatShort, isWorkday, monthLabel, parseDate } from "../model/calendar";
import type { LinkType } from "../model/types";
import { HEADER_H, PX_PER_DAY, ROW_H, type Zoom } from "./layout";
import type { GridRow } from "./TaskGrid";

interface Props {
  rows: GridRow[];
  /** Zaman çizelgesinin ilk günü (pazartesi) ve gün sayısı */
  timelineStart: string;
  days: number;
  zoom: Zoom;
  today: string;
  selection: Set<string>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onSelect: (id: string, e: MouseEvent) => void;
}

const BAR_H = 14;
const LINK_TURN = 8;

export function Gantt({ rows, timelineStart, days, zoom, today, selection, scrollRef, onScroll, onSelect }: Props) {
  const ppd = PX_PER_DAY[zoom];
  const width = days * ppd;
  const height = rows.length * ROW_H + ROW_H; // son satır: "yeni görev" satırı hizası
  const x = (iso: string) => diffDays(timelineStart, iso) * ppd;

  const header = useMemo(() => buildHeader(timelineStart, days, zoom), [timelineStart, days, zoom]);

  // Çubuk geometrisi (görünür satır indeksine göre)
  const geo = new Map<string, { x1: number; x2: number; y: number; milestone: boolean }>();
  rows.forEach((r, i) => {
    const y = i * ROW_H + ROW_H / 2;
    const x1 = x(r.sched.startDate);
    const milestone = r.sched.isMilestone;
    const x2 = milestone ? x1 : x(r.sched.finishDate) + ppd;
    geo.set(r.task.id, { x1, x2, y, milestone });
  });

  const links: { key: string; d: string; critical: boolean }[] = [];
  for (const r of rows) {
    for (const p of r.task.predecessors) {
      const from = geo.get(p.taskId);
      const to = geo.get(r.task.id);
      if (!from || !to) continue;
      const pred = rows.find((row) => row.task.id === p.taskId)!;
      links.push({
        key: `${p.taskId}-${r.task.id}`,
        d: linkPath(p.type, from, to),
        critical: pred.sched.critical && r.sched.critical && p.type === "FS",
      });
    }
  }

  const todayX = x(today);

  return (
    <div className="pane gantt-pane" ref={scrollRef} onScroll={onScroll}>
      <div style={{ width, position: "relative" }}>
        <div className="gantt-header" style={{ width, height: HEADER_H }}>
          <div className="gh-top">
            {header.top.map((b) => (
              <div key={b.key} className="gh-band" style={{ left: b.start * ppd, width: b.span * ppd }}>
                <span className="sticky-label">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="gh-bottom">
            {header.bottom.map((b) => (
              <div
                key={b.key}
                className={`gh-band ${b.weekend ? "weekend" : ""}`}
                style={{ left: b.start * ppd, width: b.span * ppd }}
                title={b.title}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
        <svg className="gantt-svg" width={width} height={height} role="img" aria-label="Gantt şeması">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" className="arrow-head" />
            </marker>
            <marker id="arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" className="arrow-head critical" />
            </marker>
          </defs>
          {zoom !== "month" &&
            header.weekends.map((w) => (
              <rect key={w} x={w * ppd} y={0} width={ppd * 2} height={height} className="weekend-shade" />
            ))}
          {rows.map((r, i) =>
            selection.has(r.task.id) ? (
              <rect key={`sel-${r.task.id}`} x={0} y={i * ROW_H} width={width} height={ROW_H} className="row-selected" />
            ) : null,
          )}
          {todayX >= 0 && todayX <= width && (
            <line x1={todayX + ppd / 2} x2={todayX + ppd / 2} y1={0} y2={height} className="today-line" />
          )}
          {links.map((l) => (
            <path
              key={l.key}
              d={l.d}
              className={`link ${l.critical ? "critical" : ""}`}
              markerEnd={`url(#${l.critical ? "arrow-crit" : "arrow"})`}
            />
          ))}
          {rows.map((r) => {
            const g = geo.get(r.task.id)!;
            const top = g.y - BAR_H / 2;
            const sel = (e: MouseEvent) => onSelect(r.task.id, e);
            const tip = `${r.task.name || "(adsız)"}\n${formatShort(r.sched.startDate)} – ${formatShort(r.sched.finishDate)} · ${r.sched.duration} g\nBolluk: ${r.sched.slack} g`;
            if (r.sched.isSummary) {
              const w = Math.max(g.x2 - g.x1, 2);
              return (
                <g key={r.task.id} className="summary-bar" onMouseDown={sel}>
                  <title>{tip}</title>
                  <rect x={g.x1} y={top + 2} width={w} height={6} />
                  <path d={`M${g.x1},${top + 8} l0,6 l5,-6 z M${g.x1 + w},${top + 8} l0,6 l-5,-6 z`} />
                  <text x={g.x1 + w + 6} y={g.y + 4} className="bar-label">
                    {r.task.name}
                  </text>
                </g>
              );
            }
            if (g.milestone) {
              const s = 7;
              return (
                <g key={r.task.id} className={`milestone ${r.sched.critical ? "critical" : ""}`} onMouseDown={sel}>
                  <title>{tip}</title>
                  <path d={`M${g.x1},${g.y - s} L${g.x1 + s},${g.y} L${g.x1},${g.y + s} L${g.x1 - s},${g.y} z`} />
                  <text x={g.x1 + s + 5} y={g.y + 4} className="bar-label">
                    {formatShort(r.sched.startDate)}
                  </text>
                </g>
              );
            }
            const w = Math.max(g.x2 - g.x1, 2);
            return (
              <g key={r.task.id} className={`task-bar ${r.sched.critical ? "critical" : ""}`} onMouseDown={sel}>
                <title>{tip}</title>
                <rect x={g.x1} y={top} width={w} height={BAR_H} rx={2} className="bar" />
                {r.task.percent > 0 && (
                  <rect x={g.x1} y={top + BAR_H / 2 - 2} width={(w * r.task.percent) / 100} height={4} className="progress" />
                )}
                <text x={g.x1 + w + 6} y={g.y + 4} className="bar-label">
                  {r.task.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Bağlantı oku: öncülün ucundan ardılın ucuna dik açılı yol */
function linkPath(type: LinkType, from: { x1: number; x2: number; y: number }, to: { x1: number; x2: number; y: number }) {
  const outRight = type === "FS" || type === "FF";
  const inFromLeft = type === "FS" || type === "SS";
  const x1 = outRight ? from.x2 : from.x1;
  const x2 = inFromLeft ? to.x1 : to.x2;
  const y1 = from.y;
  const y2 = to.y;
  const dOut = outRight ? 1 : -1;
  const dIn = inFromLeft ? 1 : -1;
  const a = x1 + dOut * LINK_TURN;
  const b = x2 - dIn * LINK_TURN;
  if (dOut !== dIn) {
    const xm = dOut > 0 ? Math.max(a, b) : Math.min(a, b);
    return `M${x1},${y1} H${xm} V${y2} H${x2}`;
  }
  if ((b - a) * dOut >= 0) {
    // Ardıl, öncülün ucundan sonra başlıyor: önce dikey in, sonra yatay gir
    return `M${x1},${y1} H${a} V${y2} H${x2}`;
  }
  // Geriye dönen bağ: satırlar arasından dolaş
  const ymid = y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2;
  return `M${x1},${y1} H${a} V${ymid} H${b} V${y2} H${x2}`;
}

interface Band {
  key: string;
  start: number;
  span: number;
  label: string;
  title?: string;
  weekend?: boolean;
}

function buildHeader(start: string, days: number, zoom: Zoom) {
  const top: Band[] = [];
  const bottom: Band[] = [];
  const weekends: number[] = [];
  const end = addDays(start, days);

  // Üst bant: ay (gün/hafta ölçeği) ya da yıl (ay ölçeği)
  let cursor = start;
  while (diffDays(cursor, end) > 0) {
    const d = parseDate(cursor);
    const next = zoom === "month" ? `${d.getUTCFullYear() + 1}-01-01` : nextMonthStart(cursor);
    const stop = diffDays(next, end) < 0 ? end : next;
    top.push({
      key: cursor,
      start: diffDays(start, cursor),
      span: diffDays(cursor, stop),
      label: zoom === "month" ? String(d.getUTCFullYear()) : monthLabel(cursor),
    });
    cursor = stop;
  }

  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i);
    const d = parseDate(iso);
    if (d.getUTCDay() === 6) weekends.push(i);
    if (zoom === "day") {
      bottom.push({ key: iso, start: i, span: 1, label: String(d.getUTCDate()), title: formatShort(iso), weekend: !isWorkday(iso) });
    } else if (zoom === "week" && d.getUTCDay() === 1) {
      bottom.push({ key: iso, start: i, span: 7, label: `${d.getUTCDate()}`, title: `Hafta: ${formatShort(iso)}` });
    } else if (zoom === "month" && d.getUTCDate() === 1) {
      const span = diffDays(iso, nextMonthStart(iso));
      bottom.push({ key: iso, start: i, span, label: monthLabel(iso).slice(0, 3) });
    }
  }
  return { top, bottom, weekends };
}

function nextMonthStart(iso: string): string {
  const d = parseDate(iso);
  const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

