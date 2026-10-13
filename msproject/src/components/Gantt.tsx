import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject, type UIEvent } from "react";
import { formatMoney, formatPercent, t } from "../i18n";
import { useLocale } from "../i18n/react";
import { addDays, diffDays, formatShort, parseDate } from "../model/calendar";
import { bands, headerUnits, scaleFor, visibleRange } from "../model/timescale";
import type { LinkType } from "../model/types";
import { HEADER_H, ROW_H } from "./layout";
import type { GridRow } from "./TaskGrid";
import { useViewport } from "./useViewport";

interface Props {
  rows: GridRow[];
  /** Zaman çizelgesinin ilk günü ve gün sayısı */
  timelineStart: string;
  days: number;
  /** Piksel / gün (yakınlaştırma) */
  ppd: number;
  today: string;
  selection: Set<string>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onSelect: (id: string, e: MouseEvent) => void;
  /** Tatil günleri (tarih → seçili dildeki ad, yarım gün mü); çalışılan günlere denk gelenler gölgelenir */
  holidays: Map<string, { name: string; halfDay: boolean }>;
  /** Haftanın çalışılan günleri (0 = pazar); diğerleri gölgelenir */
  workdays: number[];
  /** Çubuk sürüklendi: taşıma ya da sağ uçtan süre değiştirme, takvim günü cinsinden */
  onDragTask: (id: string, mode: "move" | "resize", days: number) => void;
  /** Yakınlaştırma isteği: yeni piksel/gün ve imlecin görünüm içindeki x konumu (bu nokta yerinde kalır) */
  onZoom: (ppd: number, anchorX: number) => void;
  /** Gösterilen referans planın görev tarihleri (çubuğun altında gri çizgi) */
  baseline?: Record<string, { start: string; finish: string }>;
  baselineName?: string;
  /** Çubuğa çift tık: görev bilgisi */
  onInfo: (id: string) => void;
}

interface Drag {
  id: string;
  mode: "move" | "resize";
  startX: number;
  dx: number;
}

interface Hover {
  index: number;
  x: number;
  y: number;
}

const BAR_H = 16;
const LINK_TURN = 8;

export function Gantt(props: Props) {
  const { rows, timelineStart, days, ppd, today, selection, scrollRef, onScroll, onSelect, holidays, workdays, onDragTask, onZoom, baseline } =
    props;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const vp = useViewport(scrollRef);
  const width = Math.ceil(days * ppd);
  const height = rows.length * ROW_H + ROW_H; // son satır: "yeni görev" satırı hizası
  const x = (iso: string) => diffDays(timelineStart, iso) * ppd;
  const scale = scaleFor(ppd);

  // Görünen aralık (iki yanda yarım ekran yedek)
  const fromDay = Math.max(0, Math.floor((vp.left - vp.width / 2) / ppd));
  const toDay = Math.min(days, Math.ceil((vp.left + vp.width * 1.5) / ppd));
  const { first, last } = visibleRange(vp.top, vp.height - HEADER_H, ROW_H, rows.length);

  const loc = useLocale();
  const header = useMemo(() => {
    const [topUnit, bottomUnit] = headerUnits(scale);
    return {
      top: bands(timelineStart, topUnit, "top", fromDay, toDay),
      bottom: bands(timelineStart, bottomUnit, "bottom", fromDay, toDay),
    };
  }, [scale, timelineStart, fromDay, toDay, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Çalışılmayan hafta günleri (ardışık bloklar) ve tatiller; yalnızca görünen günler
  const shading = useMemo(() => {
    const off: { start: number; span: number }[] = [];
    if (scale === "day" || scale === "week") {
      for (let i = fromDay; i < toDay; i++) {
        if (workdays.includes(parseDate(addDays(timelineStart, i)).getUTCDay())) continue;
        const prev = off[off.length - 1];
        if (prev && prev.start + prev.span === i) prev.span++;
        else off.push({ start: i, span: 1 });
      }
    }
    const hol: { i: number; date: string; name: string; halfDay: boolean }[] = [];
    for (const [date, h] of holidays) {
      const i = diffDays(timelineStart, date);
      if (i >= fromDay && i < toDay && workdays.includes(parseDate(date).getUTCDay())) hol.push({ i, date, ...h });
    }
    return { off, hol };
  }, [scale, fromDay, toDay, workdays, timelineStart, holidays]);

  const snap = drag ? Math.round(drag.dx / ppd) : 0;

  // Sürükleme: fare bırakılınca gün farkı bildirilir; tıklama (0 gün) yalnızca seçimdir
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: globalThis.MouseEvent) => setDrag((d) => (d ? { ...d, dx: e.clientX - d.startX } : d));
    const onUp = () => {
      const moved = Math.round(drag.dx / ppd);
      if (moved !== 0) onDragTask(drag.id, drag.mode, moved);
      setDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, ppd, onDragTask]);

  const startDrag = (id: string, mode: Drag["mode"], e: MouseEvent) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    setHover(null);
    setDrag({ id, mode, startX: e.clientX, dx: 0 });
  };

  // Ctrl + tekerlek (dokunmatik yüzeyde iki parmak sıkıştırma da böyle gelir): imlecin altındaki tarih sabit kalarak
  // yakınlaştır. Düz tekerlek dikey, Shift + tekerlek yatay kaydırır (tarayıcının kendi davranışı).
  const ppdRef = useRef(ppd);
  ppdRef.current = ppd;
  const zoomRef = useRef(onZoom);
  zoomRef.current = onZoom;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        zoomRef.current(ppdRef.current * factor, e.clientX - el.getBoundingClientRect().left);
      } else if (e.shiftKey && e.deltaX === 0 && e.deltaY !== 0) {
        // Bazı sistemler Shift + tekerleği dikey bildirir
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    // Dokunmatik ekranda iki parmakla sıkıştırma
    let pinch: { dist: number; x: number } | null = null;
    const touchInfo = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2 - el.getBoundingClientRect().left };
    };
    const onTouchStart = (e: TouchEvent) => {
      pinch = e.touches.length === 2 ? touchInfo(e) : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const now = touchInfo(e);
      if (pinch.dist > 0 && Math.abs(now.dist - pinch.dist) > 2) {
        zoomRef.current(ppdRef.current * (now.dist / pinch.dist), now.x);
        pinch = now;
      }
    };
    const onTouchEnd = () => {
      pinch = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scrollRef]);

  // Boş alanı ya da orta tuşla sürükleyerek kaydırma
  const startPan = (e: MouseEvent) => {
    const onBar = (e.target as Element).closest?.(".task-bar, .milestone, .summary-bar");
    if (!(e.button === 1 || (e.button === 0 && !onBar))) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.classList.add("panning");
    const onMove = (ev: globalThis.MouseEvent) => {
      el.scrollLeft = start.left - (ev.clientX - start.x);
      el.scrollTop = start.top - (ev.clientY - start.y);
    };
    const onUp = () => {
      el.classList.remove("panning");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Çubuk geometrisi: tüm satırlar (okların öbür ucu ekran dışında olabilir); ucuz hesap
  const indexOf = useMemo(() => new Map(rows.map((r, i) => [r.task.id, i])), [rows]);
  const geo = (i: number) => {
    const r = rows[i];
    const y = i * ROW_H + ROW_H / 2;
    const x1 = x(r.sched.startDate) + (r.sched.atDayEnd ? ppd : 0);
    const milestone = r.sched.isMilestone;
    const x2 = milestone ? x1 : x(r.sched.finishDate) + ppd;
    if (drag?.id === r.task.id) {
      // Sürüklenen çubuğun önizlemesi
      if (drag.mode === "move") return { x1: x1 + snap * ppd, x2: x2 + snap * ppd, y, milestone };
      return { x1, x2: Math.max(x1 + ppd, x2 + snap * ppd), y, milestone };
    }
    return { x1, x2, y, milestone };
  };

  // Bağ okları: iki ucundan biri görünen satırlarda olan ya da görünen aralığı dikey kesen bağlar
  const links: { key: string; d: string; critical: boolean; type: LinkType }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (const p of r.task.predecessors) {
      const j = indexOf.get(p.taskId);
      if (j === undefined) continue;
      if (Math.max(i, j) < first || Math.min(i, j) >= last) continue;
      const pred = rows[j];
      links.push({
        key: `${p.taskId}-${r.task.id}`,
        d: linkPath(p.type, geo(j), geo(i)),
        // Kritik bağ: iki ucu kritik ve ardılın tarihini bu bağ belirliyor
        critical: pred.sched.critical && r.sched.critical && isDriving(p.type, p.lag, pred.sched, r.sched),
        type: p.type,
      });
    }
  }

  const todayX = x(today) + ppd / 2;
  const showToday = todayX >= 0 && todayX <= width;
  const hovered = hover ? rows[hover.index] : undefined;

  return (
    <div className="pane gantt-pane" ref={scrollRef} onScroll={onScroll} onMouseDown={startPan} onMouseLeave={() => setHover(null)}>
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
            {header.bottom.map((b) => {
              const hol = scale === "day" ? holidays.get(b.key) : undefined;
              const off = scale === "day" && !workdays.includes(parseDate(b.key).getUTCDay());
              return (
                <div
                  key={b.key}
                  className={`gh-band ${off || (hol && !hol.halfDay) ? "weekend" : ""} ${hol?.halfDay ? "half" : ""}`}
                  style={{ left: b.start * ppd, width: b.span * ppd }}
                  title={hol ? `${b.title} · ${hol.name}${hol.halfDay ? ` (${t("calendar.halfDay")})` : ""}` : b.title}
                >
                  {b.span * ppd >= 14 ? b.label : ""}
                </div>
              );
            })}
          </div>
          {showToday && (
            <div className="today-pill" style={{ left: todayX }} title={formatShort(today)}>
              {t("gantt.today")}
            </div>
          )}
        </div>
        <svg className="gantt-svg" width={width} height={height} role="img" aria-label={t("gantt.aria")}>
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" className="arrow-head" />
            </marker>
            <marker id="arrow-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" className="arrow-head critical" />
            </marker>
            {/* Kritik çubuk renge ek olarak çizgili desenle de ayrılır (renk körlüğü) */}
            <pattern id="crit-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="hatch" />
            </pattern>
            <pattern id="holiday-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="5" className="hatch-holiday" />
            </pattern>
          </defs>
          {shading.off.map((w) => (
            <rect key={`w${w.start}`} x={w.start * ppd} y={0} width={ppd * w.span} height={height} className="weekend-shade" />
          ))}
          {shading.hol.map((h) => (
            <rect
              key={`h${h.i}`}
              x={h.i * ppd}
              y={0}
              width={Math.max(ppd, 2)}
              height={height}
              className={h.halfDay ? "holiday-shade half" : "holiday-shade"}
            >
              <title>{`${formatShort(h.date)} · ${h.name}${h.halfDay ? ` (${t("calendar.halfDay")})` : ""}`}</title>
            </rect>
          ))}
          {rows.slice(first, last).map((r, k) =>
            selection.has(r.task.id) ? (
              <rect key={`sel-${r.task.id}`} x={0} y={(first + k) * ROW_H} width={width} height={ROW_H} className="row-selected" />
            ) : null,
          )}
          {showToday && <line x1={todayX} x2={todayX} y1={0} y2={height} className="today-line" />}
          {links.map((l) => (
            <path
              key={l.key}
              d={l.d}
              className={`link ${l.critical ? "critical" : ""}`}
              markerEnd={`url(#${l.critical ? "arrow-crit" : "arrow"})`}
              data-type={l.type}
            />
          ))}
          {baseline &&
            rows.slice(first, last).map((r, k) => {
              // Referans plan: çubuğun altında ince gri çizgi (kilometre taşında küçük boş elmas)
              const b = baseline[r.task.id];
              if (!b) return null;
              const y = (first + k) * ROW_H + ROW_H / 2 + BAR_H / 2 + 1;
              const bx1 = x(b.start);
              if (r.sched.isMilestone) {
                const mx = bx1 + (r.sched.atDayEnd ? ppd : 0);
                return <path key={`b-${r.task.id}`} d={`M${mx},${y - 3} l3,3 l-3,3 l-3,-3 z`} className="baseline-ms" />;
              }
              const bw = Math.max(x(b.finish) + ppd - bx1, 2);
              return <rect key={`b-${r.task.id}`} x={bx1} y={y} width={bw} height={4} rx={1} className="baseline-bar" />;
            })}
          {rows.slice(first, last).map((r, k) => {
            // Son tarih: gün sonunda aşağı ok; aşılmışsa kırmızı
            if (!r.task.deadline) return null;
            const dx = x(r.task.deadline) + ppd;
            const y = (first + k) * ROW_H + 3;
            const missed = r.sched.finishDate > r.task.deadline;
            return (
              <path key={`d-${r.task.id}`} d={`M${dx - 5},${y} h10 l-5,7 z`} className={`deadline ${missed ? "missed" : ""}`}>
                <title>{`${t("info.deadline")}: ${formatShort(r.task.deadline)}`}</title>
              </path>
            );
          })}
          {rows.slice(first, last).map((r, k) => {
            const i = first + k;
            const g = geo(i);
            const top = g.y - BAR_H / 2;
            const sel = (e: MouseEvent) => onSelect(r.task.id, e);
            const hoverProps = {
              onMouseMove: (e: MouseEvent) => !drag && setHover({ index: i, x: e.clientX, y: e.clientY }),
              onMouseLeave: () => setHover(null),
              onDoubleClick: () => props.onInfo(r.task.id),
            };
            if (r.sched.isSummary) {
              // MS Project'teki gibi köşeli parantez: iki ucunda aşağı inen uçlar
              const w = Math.max(g.x2 - g.x1, 2);
              const yT = g.y - 5;
              const yB = g.y + 1;
              const tip = Math.min(6, w / 2);
              return (
                <g key={r.task.id} className={`summary-bar ${r.sched.critical ? "critical" : ""}`} onMouseDown={sel} {...hoverProps}>
                  <path
                    d={`M${g.x1},${yT} H${g.x1 + w} V${yB + 5} L${g.x1 + w - tip},${yB} H${g.x1 + tip} L${g.x1},${yB + 5} Z`}
                  />
                  <text x={g.x1 + w + 6} y={g.y + 4} className="bar-label">
                    {r.task.name}
                  </text>
                </g>
              );
            }
            if (g.milestone) {
              const s = 7;
              return (
                <g
                  key={r.task.id}
                  className={`milestone draggable ${r.sched.critical ? "critical" : ""}`}
                  onMouseDown={(e) => {
                    sel(e);
                    startDrag(r.task.id, "move", e);
                  }}
                  {...hoverProps}
                >
                  <path d={`M${g.x1},${g.y - s} L${g.x1 + s},${g.y} L${g.x1},${g.y + s} L${g.x1 - s},${g.y} z`} />
                  <text x={g.x1 + s + 5} y={g.y + 4} className="bar-label">
                    {r.task.name ? `${r.task.name} · ` : ""}
                    {formatShort(r.sched.startDate)}
                  </text>
                </g>
              );
            }
            const w = Math.max(g.x2 - g.x1, 2);
            return (
              <g
                key={r.task.id}
                className={`task-bar draggable ${r.sched.critical ? "critical" : ""} ${drag?.id === r.task.id ? "dragging" : ""} ${r.issues.length ? "issue" : ""} ${r.task.color ? `tc-${r.task.color}` : ""} ${r.warnings.some((w) => w.kind === "late") ? "late" : ""}`}
                onMouseDown={(e) => {
                  sel(e);
                  startDrag(r.task.id, "move", e);
                }}
                {...hoverProps}
              >
                <rect x={g.x1} y={top} width={w} height={BAR_H} rx={4} className="bar" />
                {r.task.percent > 0 && <rect x={g.x1} y={top} width={(w * r.task.percent) / 100} height={BAR_H} rx={4} className="progress" />}
                {r.issues.length > 0 && <rect x={g.x1} y={top} width={w} height={BAR_H} rx={4} className="issue-outline" />}
                {r.sched.critical && <rect x={g.x1} y={top} width={w} height={BAR_H} rx={4} className="crit-pattern" fill="url(#crit-hatch)" />}
                <rect
                  x={g.x1 + w - 4}
                  y={top}
                  width={8}
                  height={BAR_H}
                  className="resize-handle"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    sel(e);
                    startDrag(r.task.id, "resize", e);
                  }}
                />
                <text x={g.x1 + w + 6} y={g.y + 4} className="bar-label">
                  {drag?.id === r.task.id && snap !== 0 ? (
                    `${snap > 0 ? "+" : ""}${t("unit.days", { n: snap })}`
                  ) : (
                    <>
                      {r.task.name}
                      {r.resText && (
                        <tspan dx={8} className={`res-label ${r.overallocated ? "over" : ""}`}>
                          {r.overallocated ? "⚠ " : ""}
                          {r.resText}
                        </tspan>
                      )}
                    </>
                  )}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hovered && hover && (
        <BarTooltip row={hovered} x={hover.x} y={hover.y} baseline={baseline?.[hovered.task.id]} baselineName={props.baselineName} />
      )}
    </div>
  );
}

/** Çubuğun üzerine gelince: ad, tarihler, süre, %, bolluk, kaynaklar, maliyet */
function BarTooltip(props: { row: GridRow; x: number; y: number; baseline?: { start: string; finish: string }; baselineName?: string }) {
  const { row, x, y, baseline } = props;
  const s = row.sched;
  const task = row.task;
  const items: [string, string][] = [
    [t("gantt.tipStart"), formatShort(s.startDate)],
    [t("gantt.tipFinish"), formatShort(s.finishDate)],
    [t("gantt.tipDuration"), t("unit.workdays", { n: s.duration })],
    [t("gantt.tipPercent"), formatPercent(s.percent)],
    [t("gantt.tipSlack"), t("unit.workdays", { n: s.slack })],
  ];
  if (task.constraint && !s.isSummary) {
    items.push([t("info.constraint"), `${t(`constraint.${task.constraint.type}`)}${task.constraint.date ? ` ${formatShort(task.constraint.date)}` : ""}`]);
  }
  if (task.deadline) items.push([t("info.deadline"), formatShort(task.deadline)]);
  if (task.actualStart) items.push([t("info.actualStart"), formatShort(task.actualStart)]);
  if (task.actualFinish) items.push([t("info.actualFinish"), formatShort(task.actualFinish)]);
  if (row.resText) items.push([t("gantt.tipResources"), row.resText]);
  if (row.cost) items.push([t("gantt.tipCost"), formatMoney(row.cost)]);
  if (baseline) items.push([props.baselineName ?? t("baseline.default"), `${formatShort(baseline.start)} – ${formatShort(baseline.finish)}`]);
  if (row.variance !== undefined) items.push([t("col.variance"), t("info.varianceDays", { n: `${row.variance > 0 ? "+" : ""}${row.variance}` })]);
  const kind = s.isSummary ? t("gantt.tipSummary") : s.isMilestone ? t("gantt.tipMilestone") : "";
  // Ekranın sağına ya da altına taşmasın
  const left = Math.min(x + 14, window.innerWidth - 300);
  const top = y + 16 + 190 > window.innerHeight ? y - 200 : y + 16;
  return (
    <div className="bar-tip" role="tooltip" style={{ left, top }}>
      <div className="bar-tip-name">{row.task.name || t("common.unnamed")}</div>
      {(kind || s.critical) && (
        <div className="bar-tip-tags">
          {kind && <span>{kind}</span>}
          {s.critical && <span className="crit">{t("gantt.tipCritical")}</span>}
        </div>
      )}
      {row.issues.map((m) => (
        <div key={m} className="bar-tip-issue">
          {m}
        </div>
      ))}
      <dl>
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bağ ardılın tarihini belirliyor mu (bağın iki ucu arasında boşluk yok) */
export function isDriving(type: LinkType, lag: number, pred: { es: number; ef: number }, succ: { es: number; ef: number }): boolean {
  switch (type) {
    case "FS":
      return succ.es === pred.ef + lag;
    case "SS":
      return succ.es === pred.es + lag;
    case "FF":
      return succ.ef === pred.ef + lag;
    case "SF":
      return succ.ef === pred.es + lag;
  }
}

/** Bağlantı oku: öncülün ucundan ardılın ucuna dik açılı yol */
export function linkPath(type: LinkType, from: { x1: number; x2: number; y: number }, to: { x1: number; x2: number; y: number }) {
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
