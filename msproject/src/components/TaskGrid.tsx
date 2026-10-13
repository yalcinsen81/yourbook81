import { useRef, type MouseEvent, type RefObject, type UIEvent } from "react";
import { datePattern, formatDateLocal, formatNumber, parseDateLocal, t, type MessageKey } from "../i18n";
import { formatShort } from "../model/calendar";
import { visibleRange } from "../model/timescale";
import type { ScheduledTask, Task } from "../model/types";
import { EditableCell } from "./EditableCell";
import { Icon } from "./icons";
import { HEADER_H, ROW_H } from "./layout";
import { useViewport } from "./useViewport";

export interface GridRow {
  task: Task;
  sched: ScheduledTask;
  wbs: string;
  predText: string;
  /** "Ali[50%]; Vinç" */
  resText: string;
  /** Atandığı kaynaklardan biri bu görev sırasında kapasitesini aşıyor */
  overallocated: boolean;
  /** Maliyet ağırlığında maliyeti olmayan görev (ilerleme ağırlığı 0) */
  noCost?: boolean;
  /** Görev maliyeti; özet görevde alt görevlerin toplamı */
  cost: number;
  collapsed: boolean;
}

interface Props {
  rows: GridRow[];
  selection: Set<string>;
  cycle: Set<string>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onSelect: (id: string, e: MouseEvent) => void;
  onToggle: (id: string) => void;
  onName: (id: string, name: string) => void;
  onDuration: (id: string, text: string) => boolean;
  onStart: (id: string, iso: string) => boolean;
  onPredecessors: (id: string, text: string) => boolean;
  onPercent: (id: string, text: string) => boolean;
  onResources: (id: string, text: string) => boolean;
  onAddAtEnd: () => void;
}

export const COLUMNS: { key: string; label: MessageKey | ""; width: number }[] = [
  { key: "row", label: "", width: 40 },
  { key: "wbs", label: "col.wbs", width: 52 },
  { key: "name", label: "col.name", width: 250 },
  { key: "duration", label: "col.duration", width: 72 },
  { key: "start", label: "col.start", width: 128 },
  { key: "finish", label: "col.finish", width: 112 },
  { key: "preds", label: "col.predecessors", width: 92 },
  { key: "resources", label: "col.resources", width: 150 },
  { key: "percent", label: "col.percent", width: 64 },
  { key: "slack", label: "col.slack", width: 64 },
];

export const GRID_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

export function TaskGrid(props: Props) {
  const { rows, selection, cycle, scrollRef, onScroll } = props;
  const template = COLUMNS.map((c) => `${c.width}px`).join(" ");
  const vp = useViewport(scrollRef);
  // Yalnızca görünen satırlar çizilir (1000+ görevde akıcı kaydırma); üst ve alt boşluk yüksekliği korur
  const { first, last } = visibleRange(vp.top, vp.height - HEADER_H, ROW_H, rows.length);
  const dayLetter = t("unit.dayLetter");

  return (
    <div className="pane grid-pane" ref={scrollRef} onScroll={onScroll}>
      <div style={{ width: GRID_WIDTH }}>
        <div className="grid-header" style={{ gridTemplateColumns: template, height: HEADER_H }}>
          {COLUMNS.map((c) => {
            const label = c.label ? t(c.label) : "";
            return (
              <div key={c.key} className={`gh gh-${c.key}`} title={label}>
                {label}
              </div>
            );
          })}
        </div>
        <div style={{ height: first * ROW_H }} aria-hidden />
        {rows.slice(first, last).map((r, k) => {
          const i = first + k;
          const { task, sched } = r;
          const selected = selection.has(task.id);
          const cls = [
            "grid-row",
            selected && "selected",
            sched.isSummary && "summary",
            sched.critical && "critical",
            cycle.has(task.id) && "cyclic",
          ]
            .filter(Boolean)
            .join(" ");
          const row = String(sched.row);
          return (
            <div
              key={task.id}
              className={cls}
              style={{ gridTemplateColumns: template, height: ROW_H }}
              onMouseDown={(e) => props.onSelect(task.id, e)}
            >
              <div className="gc gc-row" title={t("grid.row", { row })}>
                {sched.row}
              </div>
              <div className="gc gc-wbs" title={r.wbs}>
                {r.wbs}
              </div>
              <div className="gc gc-name" style={{ paddingInlineStart: 4 + task.outline * 16 }}>
                {sched.isSummary ? (
                  <button
                    className="twisty"
                    aria-label={r.collapsed ? t("grid.expand") : t("grid.collapse")}
                    aria-expanded={!r.collapsed}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => props.onToggle(task.id)}
                  >
                    {r.collapsed ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className={`twisty-space ${sched.isMilestone ? "ms" : ""}`}>{sched.isMilestone ? "◆" : ""}</span>
                )}
                <EditableCell
                  value={task.name}
                  row={i}
                  col="name"
                  ariaLabel={t("grid.aria.name", { row })}
                  title={task.name}
                  onCommit={(v) => props.onName(task.id, v)}
                />
              </div>
              <div className="gc">
                <EditableCell
                  value={`${formatNumber(sched.isSummary ? sched.duration : task.duration)} ${dayLetter}`}
                  readOnly={sched.isSummary}
                  row={i}
                  col="duration"
                  className="num"
                  ariaLabel={t("grid.aria.duration", { row })}
                  title={sched.isSummary ? t("grid.summaryDuration") : t("grid.durationHint")}
                  onCommit={(v) => props.onDuration(task.id, v)}
                />
              </div>
              <div className="gc">
                <DateCell
                  iso={sched.startDate}
                  readOnly={sched.isSummary}
                  row={i}
                  constrained={!!task.constraint}
                  ariaLabel={t("grid.aria.start", { row })}
                  title={
                    task.constraint
                      ? `${t(`constraint.${task.constraint.type}`)}${task.constraint.date ? `: ${formatShort(task.constraint.date)}` : ""}\n${t("grid.constraintHint")}`
                      : t("grid.startHint", { pattern: datePattern() })
                  }
                  onCommit={(v) => props.onStart(task.id, v)}
                />
              </div>
              <div className="gc gc-finish" title={formatShort(sched.finishDate)}>
                {formatShort(sched.finishDate)}
              </div>
              <div className="gc">
                <EditableCell
                  value={r.predText}
                  row={i}
                  col="preds"
                  ariaLabel={t("grid.aria.predecessors", { row })}
                  title={t("grid.predHint")}
                  onCommit={(v) => props.onPredecessors(task.id, v)}
                />
              </div>
              <div className={`gc gc-res ${r.overallocated ? "over" : ""}`}>
                {r.noCost && !r.overallocated && (
                  <span className="info-flag" title={t("warn.taskNoCost")} aria-label={t("warn.taskNoCost")}>
                    i
                  </span>
                )}
                {r.overallocated && (
                  <span className="over-flag" title={t("grid.overallocated")}>
                    !
                  </span>
                )}
                <EditableCell
                  value={r.resText ?? ""}
                  placeholder={t("common.empty")}
                  readOnly={sched.isSummary}
                  row={i}
                  col="resources"
                  ariaLabel={t("grid.aria.resources", { row })}
                  title={sched.isSummary ? t("grid.summaryNoResource") : r.resText ? `${r.resText}\n${t("grid.resourceHint")}` : t("grid.resourceHint")}
                  onCommit={(v) => props.onResources(task.id, v)}
                />
              </div>
              <div className="gc">
                <EditableCell
                  value={`${task.percent}%`}
                  readOnly={sched.isSummary}
                  row={i}
                  col="percent"
                  className="num"
                  ariaLabel={t("grid.aria.percent", { row })}
                  onCommit={(v) => props.onPercent(task.id, v)}
                />
              </div>
              <div className={`gc gc-slack num ${sched.slack <= 0 ? "zero" : ""}`}>
                {formatNumber(sched.slack)} {dayLetter}
              </div>
            </div>
          );
        })}
        <div style={{ height: (rows.length - last) * ROW_H }} aria-hidden />
        <div className="grid-row add-row" style={{ gridTemplateColumns: template, height: ROW_H }}>
          <div className="gc" />
          <div className="gc" />
          <button className="add-task" onClick={props.onAddAtEnd}>
            {t("grid.addTask")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tarih hücresi: seçili biçimde (TR 13.11.2026, EN 11/13/2026, ISO) yazılır; yanındaki düğme tarayıcının takvimini açar.
 * Boş bırakmak kısıtı kaldırır.
 */
function DateCell(props: {
  iso: string;
  readOnly?: boolean;
  row: number;
  constrained: boolean;
  ariaLabel: string;
  title: string;
  onCommit: (iso: string) => boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="date-cell">
      <EditableCell
        value={formatDateLocal(props.iso)}
        readOnly={props.readOnly}
        row={props.row}
        col="start"
        className={props.constrained ? "constrained" : ""}
        ariaLabel={props.ariaLabel}
        title={props.title}
        placeholder={datePattern()}
        onCommit={(text) => {
          if (!text.trim()) return props.onCommit("");
          const iso = parseDateLocal(text);
          return iso ? props.onCommit(iso) : false;
        }}
      />
      {!props.readOnly && (
        <>
          <button
            className="date-pick"
            tabIndex={-1}
            title={t("grid.pickDate")}
            aria-label={t("grid.pickDate")}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              const el = picker.current;
              if (!el) return;
              el.value = props.iso;
              try {
                el.showPicker();
              } catch {
                el.click();
              }
            }}
          >
            <Icon name="calendar" size={13} />
          </button>
          <input
            ref={picker}
            type="date"
            className="date-picker-hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              if (e.target.value) props.onCommit(e.target.value);
            }}
          />
        </>
      )}
    </div>
  );
}
