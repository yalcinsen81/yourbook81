import { useRef, useState, type DragEvent, type MouseEvent, type RefObject, type UIEvent } from "react";
import { datePattern, dayName, formatDateLocal, formatMoney, formatNumber, formatPercent, t, type MessageKey } from "../i18n";
import { formatShort, isValidDate, parseDate } from "../model/calendar";
import { formatEstimate } from "../model/risks";
import { visibleRange } from "../model/timescale";
import type { ScheduledTask, Task } from "../model/types";
import type { TaskWarning } from "../model/validation";
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
  /** Zamanlama uyarıları (seçili dilde) */
  issues: string[];
  /** Gösterilen referans plana göre bitiş sapması (iş günü); referans planda yoksa undefined */
  variance?: number;
  /** Doğrulama uyarıları (gecikme, tarih aralığı) */
  warnings: TaskWarning[];
  /** Bağlı kapanmamış riskler ("R1 Zemin suyu") ve en yüksek maruziyet düzeyi */
  risks?: { text: string[]; level: string };
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
  /** Yazılan metin ya da takvimden seçilen ISO tarih; boş metin kısıtı kaldırır */
  onStart: (id: string, text: string) => boolean;
  onPredecessors: (id: string, text: string) => boolean;
  onPercent: (id: string, text: string) => boolean;
  onResources: (id: string, text: string) => boolean;
  onEstimate: (id: string, text: string) => boolean;
  onAddAtEnd: () => void;
  /** Görev bilgisi penceresi (çift tık) */
  onInfo: (id: string) => void;
  /** Sürükle-bırak: görevi (alt ağacıyla) `beforeId` satırının önüne, null ise sona taşır */
  onMoveRow: (id: string, beforeId: string | null) => void;
  /** Sapma sütunu (referans plan gösteriliyorsa) */
  showVariance: boolean;
  /** Gizlenen sütunlar (sütun seçici) */
  hidden: Set<string>;
  /** Sıralı / süzülmüş görünümde satır sürükleme kapalı */
  dragDisabled?: boolean;
  /** Klavyeyle bir hücreye gelinince satır seçilir */
  onFocusRow: (id: string) => void;
  /** Shift+↑/↓: seçimi bir satır genişlet */
  onExtend: (id: string, dir: 1 | -1) => void;
}

export const COLUMNS: { key: string; label: MessageKey | ""; width: number }[] = [
  { key: "row", label: "", width: 40 },
  { key: "ind", label: "", width: 26 },
  { key: "wbs", label: "col.wbs", width: 52 },
  { key: "name", label: "col.name", width: 250 },
  { key: "duration", label: "col.duration", width: 72 },
  { key: "start", label: "col.start", width: 150 },
  { key: "finish", label: "col.finish", width: 136 },
  { key: "preds", label: "col.predecessors", width: 92 },
  { key: "resources", label: "col.resources", width: 150 },
  { key: "percent", label: "col.percent", width: 64 },
  { key: "slack", label: "col.slack", width: 64 },
  { key: "cost", label: "col.cost", width: 104 },
  { key: "estimate", label: "col.estimate", width: 112 },
  { key: "variance", label: "col.variance", width: 64 },
];

/** Gizlenemeyen sütunlar */
export const FIXED_COLUMNS = new Set(["row", "ind", "name"]);
/** İlk açılışta gizli sütunlar */
export const DEFAULT_HIDDEN = ["cost", "estimate"];

/** Görünen sütunların toplam genişliği */
export function gridWidthFor(hidden: Set<string>, showVariance: boolean): number {
  return COLUMNS.filter((c) => !hidden.has(c.key) && (c.key !== "variance" || showVariance)).reduce((s, c) => s + c.width, 0);
}

export const GRID_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

export function TaskGrid(props: Props) {
  const { rows, selection, cycle, scrollRef, onScroll } = props;
  const columns = COLUMNS.filter((c) => !props.hidden.has(c.key) && (c.key !== "variance" || props.showVariance));
  const show = (key: string) => columns.some((c) => c.key === key);
  const template = columns.map((c) => `${c.width}px`).join(" ");
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  // Sürükle-bırak: sürüklenen satır ve üzerine gelinen satır (bırakılınca önüne girer)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null | undefined>(undefined);
  const dropProps = (beforeId: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropId !== beforeId) setDropId(beforeId);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragId && dragId !== beforeId) props.onMoveRow(dragId, beforeId);
      setDragId(null);
      setDropId(undefined);
    },
  });
  const vp = useViewport(scrollRef);
  // Yalnızca görünen satırlar çizilir (1000+ görevde akıcı kaydırma); üst ve alt boşluk yüksekliği korur
  const { first, last } = visibleRange(vp.top, vp.height - HEADER_H, ROW_H, rows.length);
  const dayLetter = t("unit.dayLetter");

  return (
    <div className="pane grid-pane" ref={scrollRef} onScroll={onScroll}>
      <div style={{ width }}>
        <div className="grid-header" style={{ gridTemplateColumns: template, height: HEADER_H }}>
          {columns.map((c) => {
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
            r.issues.length > 0 && "has-issue",
            dropId === task.id && dragId !== task.id && "drop-before",
            dragId === task.id && "dragging",
            r.warnings.some((w) => w.kind === "late") && "late",
            task.color && `tc-${task.color}`,
          ]
            .filter(Boolean)
            .join(" ");
          const row = String(sched.row);
          return (
            <div
              key={task.id}
              className={cls}
              style={{ gridTemplateColumns: template, height: ROW_H }}
              onMouseDown={(e) => {
                // Shift ile aralık seçerken tarayıcı metin seçmesin (yoksa Ctrl+C metni kopyalar)
                if (e.shiftKey && (e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
                props.onSelect(task.id, e);
              }}
              onFocus={() => props.onFocusRow(task.id)}
              onKeyDownCapture={(e) => {
                // Shift+↑/↓ hücreden çıkmadan seçimi genişletir; odak aynı sütunda bir satır kayar
                if (e.shiftKey && !e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  e.preventDefault();
                  e.stopPropagation();
                  const dir = e.key === "ArrowDown" ? 1 : -1;
                  const col = (e.target as HTMLElement).dataset.col;
                  props.onExtend(task.id, dir);
                  if (col) requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[data-row="${i + dir}"][data-col="${col}"]`)?.focus());
                }
              }}
              onDoubleClick={(e) => {
                // Hücre düzenlemesi değilse görev bilgisini aç
                if ((e.target as HTMLElement).tagName !== "INPUT") props.onInfo(task.id);
              }}
              {...dropProps(task.id)}
            >
              <div
                className="gc gc-row"
                title={props.dragDisabled ? t("grid.row", { row }) : `${t("grid.row", { row })}\n${t("grid.dragHint")}`}
                draggable={!props.dragDisabled}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", task.name);
                  setDragId(task.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropId(undefined);
                }}
              >
                {sched.row}
              </div>
              <Indicators row={r} />
              {show("wbs") && (
                <div className="gc gc-wbs" title={r.wbs}>
                  {r.wbs}
                </div>
              )}
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
              {show("duration") && (
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
              )}
              {show("start") && (
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
              )}
              {show("finish") && (
                <div className="gc gc-finish" title={formatShort(sched.finishDate)}>
                  {formatShort(sched.finishDate)}
                </div>
              )}
              {show("preds") && (
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
              )}
              {show("resources") && (
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
              )}
              {show("percent") && (
                <div className="gc">
                  <EditableCell
                    value={formatPercent(sched.percent)}
                    readOnly={sched.isSummary}
                    title={sched.isSummary ? t("grid.summaryPercent") : undefined}
                    row={i}
                    col="percent"
                    className="num"
                    ariaLabel={t("grid.aria.percent", { row })}
                    onCommit={(v) => props.onPercent(task.id, v)}
                  />
                </div>
              )}
              {show("slack") && (
                <div className={`gc gc-slack num ${sched.slack <= 0 ? "zero" : ""}`}>
                  {formatNumber(sched.slack, 1)} {dayLetter}
                </div>
              )}
              {show("cost") && (
                <div className="gc gc-cost num" title={formatMoney(r.cost)}>
                  {r.cost ? formatMoney(r.cost) : "—"}
                </div>
              )}
              {show("estimate") && (
                <div className="gc">
                  <EditableCell
                    value={formatEstimate(task.estimate)}
                    placeholder={sched.isSummary || task.duration <= 0 ? "" : t("common.empty")}
                    readOnly={sched.isSummary || task.duration <= 0}
                    row={i}
                    col="estimate"
                    className="num"
                    ariaLabel={t("grid.aria.estimate", { row })}
                    title={t("grid.estimateHint")}
                    onCommit={(v) => props.onEstimate(task.id, v)}
                  />
                </div>
              )}
              {show("variance") && (
                <div
                  className={`gc num gc-var ${r.variance && r.variance > 0 ? "late" : r.variance && r.variance < 0 ? "early" : ""}`}
                  title={r.variance === undefined ? t("grid.varianceNone") : t("grid.varianceHint")}
                >
                  {r.variance === undefined ? "—" : `${r.variance > 0 ? "+" : ""}${formatNumber(r.variance)} ${dayLetter}`}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ height: (rows.length - last) * ROW_H }} aria-hidden />
        <div className={`grid-row add-row ${dropId === null ? "drop-before" : ""}`} style={{ gridTemplateColumns: template, height: ROW_H }} {...dropProps(null)}>
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
 * Tarih hücresi: gün kısaltması + seçili biçim (Pzt 02.11.2026, Mon 11/2/2026, ISO); gün kısaltması salt okunur; yanındaki düğme tarayıcının takvimini açar.
 * Boş bırakmak kısıtı kaldırır.
 */
function DateCell(props: {
  iso: string;
  readOnly?: boolean;
  row: number;
  constrained: boolean;
  ariaLabel: string;
  title: string;
  onCommit: (text: string) => boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="date-cell">
      {/* Gün kısaltması bitiş sütunuyla aynı görünüm için; düzenlenmez */}
      <span className="dow" aria-hidden>
        {isValidDate(props.iso) ? dayName(parseDate(props.iso).getUTCDay()) : ""}
      </span>
      <EditableCell
        value={formatDateLocal(props.iso)}
        readOnly={props.readOnly}
        row={props.row}
        col="start"
        className={props.constrained ? "constrained" : ""}
        ariaLabel={props.ariaLabel}
        title={props.title}
        placeholder={datePattern()}
        onCommit={props.onCommit}
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

/** Gösterge sütunu (MS Project'teki gibi): uyarı, gecikme, kısıt, tamamlandı, son tarih; not ve bağlantı küçük işaretle */
function Indicators({ row }: { row: GridRow }) {
  const { task, sched } = row;
  const notes: string[] = [...row.issues, ...row.warnings.map((w) => w.text)];
  const c = task.constraint;
  if (c && !sched.isSummary) notes.push(`${t(`constraint.${c.type}`)}${c.date ? `: ${formatShort(c.date)}` : ""}`);
  if (task.deadline) notes.push(`${t("info.deadline")}: ${formatShort(task.deadline)}`);
  if (task.levelingDelay) notes.push(t("grid.levelingDelay", { n: String(task.levelingDelay) }));
  if (!sched.isSummary && task.percent === 100) notes.push(t("grid.complete"));
  if (task.tags?.length) notes.push(`${t("info.tags")}: ${task.tags.join(", ")}`);
  if (task.links?.length) notes.push(...task.links.map((l) => `🔗 ${l.title ?? l.url}`));
  if (row.risks) notes.push(...row.risks.text.map((x) => `⚠ ${x}`));
  if (task.notes) notes.push(`✎ ${task.notes.length > 200 ? `${task.notes.slice(0, 200)}…` : task.notes}`);
  const late = row.warnings.some((w) => w.kind === "late");
  const warn = row.warnings.length > 0 && !late;
  const main =
    row.issues.length > 0 || warn ? (
      <span className="ind issue" aria-label={[...row.issues, ...row.warnings.map((w) => w.text)].join(" ")}>
        !
      </span>
    ) : late ? (
      <span className="ind late" aria-label={row.warnings[0].text}>
        ⏰
      </span>
    ) : c && !sched.isSummary ? (
      <span className={`ind constraint ${c.type === "MSO" || c.type === "MFO" ? "hard" : ""}`} aria-label={notes[0]}>
        <Icon name="calendar" size={12} />
      </span>
    ) : !sched.isSummary && task.percent === 100 ? (
      <span className="ind done" aria-label={t("grid.complete")}>
        ✓
      </span>
    ) : task.deadline ? (
      <span className="ind deadline" aria-label={notes[0]}>
        ⇩
      </span>
    ) : null;
  return (
    <div className="gc gc-ind" title={notes.join("\n") || undefined}>
      {main}
      {row.risks && (
        <span className={`ind-mini risk lvl-${row.risks.level}`} aria-label={row.risks.text.join(", ")}>
          ⚠
        </span>
      )}
      {(task.notes || task.links?.length) && (
        <span className={`ind-mini ${task.links?.length ? "link" : "note"}`} aria-label={task.links?.length ? t("help.i.link") : t("help.i.note")}>
          {task.links?.length ? "🔗" : "✎"}
        </span>
      )}
    </div>
  );
}
