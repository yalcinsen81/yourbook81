import type { MouseEvent, RefObject, UIEvent } from "react";
import { formatShort } from "../model/calendar";
import type { ScheduledTask, Task } from "../model/types";
import { EditableCell } from "./EditableCell";
import { HEADER_H, ROW_H } from "./layout";

export interface GridRow {
  task: Task;
  sched: ScheduledTask;
  wbs: string;
  predText: string;
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
  onAddAtEnd: () => void;
}

export const COLUMNS = [
  { key: "row", label: "", width: 40 },
  { key: "wbs", label: "WBS", width: 52 },
  { key: "name", label: "Görev Adı", width: 250 },
  { key: "duration", label: "Süre", width: 64 },
  { key: "start", label: "Başlangıç", width: 128 },
  { key: "finish", label: "Bitiş", width: 104 },
  { key: "preds", label: "Öncüller", width: 92 },
  { key: "percent", label: "% Tam.", width: 58 },
  { key: "slack", label: "Bolluk", width: 58 },
] as const;

export const GRID_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

export function TaskGrid(props: Props) {
  const { rows, selection, cycle, scrollRef, onScroll } = props;
  const template = COLUMNS.map((c) => `${c.width}px`).join(" ");

  return (
    <div className="pane grid-pane" ref={scrollRef} onScroll={onScroll}>
      <div style={{ width: GRID_WIDTH }}>
        <div className="grid-header" style={{ gridTemplateColumns: template, height: HEADER_H }}>
          {COLUMNS.map((c) => (
            <div key={c.key} className={`gh gh-${c.key}`}>
              {c.label}
            </div>
          ))}
        </div>
        {rows.map((r, i) => {
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
          return (
            <div
              key={task.id}
              className={cls}
              style={{ gridTemplateColumns: template, height: ROW_H }}
              onMouseDown={(e) => props.onSelect(task.id, e)}
            >
              <div className="gc gc-row" title={`Satır ${sched.row}`}>
                {sched.row}
              </div>
              <div className="gc gc-wbs">{r.wbs}</div>
              <div className="gc gc-name" style={{ paddingInlineStart: 4 + task.outline * 16 }}>
                {sched.isSummary ? (
                  <button
                    className="twisty"
                    aria-label={r.collapsed ? "Alt görevleri göster" : "Alt görevleri gizle"}
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
                  ariaLabel={`Satır ${sched.row} görev adı`}
                  onCommit={(v) => props.onName(task.id, v)}
                />
              </div>
              <div className="gc">
                <EditableCell
                  value={`${sched.isSummary ? sched.duration : task.duration} g`}
                  readOnly={sched.isSummary}
                  row={i}
                  col="duration"
                  className="num"
                  ariaLabel={`Satır ${sched.row} süre`}
                  title={sched.isSummary ? "Özet görevin süresi alt görevlerinden hesaplanır" : "İş günü; 0 = kilometre taşı"}
                  onCommit={(v) => props.onDuration(task.id, v)}
                />
              </div>
              <div className="gc">
                <EditableCell
                  type="date"
                  value={sched.startDate}
                  readOnly={sched.isSummary}
                  row={i}
                  col="start"
                  className={task.startNoEarlierThan ? "constrained" : ""}
                  ariaLabel={`Satır ${sched.row} başlangıç`}
                  title={
                    task.startNoEarlierThan
                      ? `Kısıt: ${formatShort(task.startNoEarlierThan)} tarihinden önce başlamaz. Kaldırmak için tarihi silin.`
                      : "Tarih girmek 'şundan önce başlamasın' kısıtı koyar"
                  }
                  onCommit={(v) => props.onStart(task.id, v)}
                />
              </div>
              <div className="gc gc-finish">{formatShort(sched.finishDate)}</div>
              <div className="gc">
                <EditableCell
                  value={r.predText}
                  row={i}
                  col="preds"
                  ariaLabel={`Satır ${sched.row} öncüller`}
                  title="Örnek: 2 · 3SS · 4FS+2g · 5FF-1g (birden çoksa ; ile ayırın)"
                  onCommit={(v) => props.onPredecessors(task.id, v)}
                />
              </div>
              <div className="gc">
                <EditableCell
                  value={`${task.percent}%`}
                  readOnly={sched.isSummary}
                  row={i}
                  col="percent"
                  className="num"
                  ariaLabel={`Satır ${sched.row} tamamlanma yüzdesi`}
                  onCommit={(v) => props.onPercent(task.id, v)}
                />
              </div>
              <div className={`gc gc-slack num ${sched.slack <= 0 ? "zero" : ""}`}>{sched.slack} g</div>
            </div>
          );
        })}
        <div className="grid-row add-row" style={{ gridTemplateColumns: template, height: ROW_H }}>
          <div className="gc" />
          <div className="gc" />
          <button className="add-task" onClick={props.onAddAtEnd}>
            + Yeni görev
          </button>
        </div>
      </div>
    </div>
  );
}
