import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode, type RefObject, type UIEvent } from "react";
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
  /** Satır anahtarı: görev kimliği; gruplu görünümde grup + görev (aynı görev birden çok grupta olabilir) */
  key: string;
  /** Gruplu görünümde grup başlığı satırı (görev değildir) */
  group?: { label: string; count: number };
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
  /** Etkisiz görev (ya da etkisiz özetin altında): soluk gösterilir, hesaba girmez */
  inactive?: boolean;
  /** Bölünmüş görevin aralıkları (göreve uygulanan çalışılamayan dönemler) */
  gaps?: { from: string; to: string; name: string }[];
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
  /**
   * Sürükle-bırak: görevleri (alt ağaçlarıyla) `beforeId` satırının önüne, null ise sona taşır; `level` bırakılan
   * girinti düzeyidir (sağa/sola sürükleyerek değişir)
   */
  onMoveRows: (ids: string[], beforeId: string | null, level: number) => void;
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
  /** Sağ tık menüsü */
  onContextMenu: (id: string, e: MouseEvent) => void;
  /** Not simgesine tıklanınca görev bilgisinin Notlar bölümünü açar */
  onOpenNotes?: (id: string) => void;
  /** Dolgu tutamacı: kaynak satırın `col` değeri hedef satırlara kopyalanır */
  onFill: (col: string, sourceId: string, targetIds: string[]) => void;
  /** Sütun başlığına tıklayınca sıralama (artan → azalan → kapalı); geçerli sıralama sütunu ve yönü */
  onSortColumn: (key: string) => void;
  sortColumn?: { key: string; desc: boolean };
}

/** Başlığına tıklanarak sıralanabilen sütunlar */
export const SORTABLE = new Set(["name", "duration", "start", "finish", "slack", "cost", "percent"]);

export const COLUMNS: { key: string; label: MessageKey | ""; width: number }[] = [
  { key: "row", label: "", width: 40 },
  { key: "ind", label: "", width: 26 },
  { key: "wbs", label: "col.wbs", width: 52 },
  { key: "name", label: "col.name", width: 250 },
  { key: "duration", label: "col.duration", width: 88 },
  { key: "start", label: "col.start", width: 150 },
  { key: "finish", label: "col.finish", width: 136 },
  { key: "preds", label: "col.predecessors", width: 116 },
  { key: "resources", label: "col.resources", width: 150 },
  { key: "percent", label: "col.percent", width: 78 },
  { key: "slack", label: "col.slack", width: 64 },
  { key: "cost", label: "col.cost", width: 104 },
  { key: "estimate", label: "col.estimate", width: 156 },
  { key: "variance", label: "col.variance", width: 84 },
];

/** Gizlenemeyen sütunlar */
export const FIXED_COLUMNS = new Set(["row", "ind", "name"]);
/** İlk açılışta gizli sütunlar */
export const DEFAULT_HIDDEN = ["wbs", "cost", "estimate"];
/** Ad sütununun en dar hali */
const NAME_MIN = 150;
/** Bir girinti düzeyinin genişliği (px) */
const INDENT = 16;

/** Görünen sütunların toplam genişliği */
export function gridWidthFor(hidden: Set<string>, showVariance: boolean): number {
  return COLUMNS.filter((c) => !hidden.has(c.key) && (c.key !== "variance" || showVariance)).reduce((s, c) => s + c.width, 0);
}

export const GRID_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

export function TaskGrid(props: Props) {
  const { rows, selection, cycle, scrollRef, onScroll } = props;
  const columns = COLUMNS.filter((c) => !props.hidden.has(c.key) && (c.key !== "variance" || props.showVariance));
  const show = (key: string) => columns.some((c) => c.key === key);
  // Ad sütunu esner: dar alanda önce o küçülür (en az NAME_MIN), sonra tablo yatay kayar
  const template = columns.map((c) => (c.key === "name" ? `minmax(${NAME_MIN}px, 1fr)` : `${c.width}px`)).join(" ");
  const minWidth = columns.reduce((sum, c) => sum + (c.key === "name" ? NAME_MIN : c.width), 0);
  // Sürükle-bırak: sürüklenen satırlar (seçiliyse seçimin tamamı) ve bırakma yeri (satırın önü + girinti düzeyi).
  // Sağa/sola sürüklemek düzeyi değiştirir; bırakma yerinde düzeye göre girintili çizgi gösterilir.
  const [drag, setDrag] = useState<{ ids: string[]; startX: number; outline: number } | null>(null);
  const [drop, setDrop] = useState<{ beforeId: string | null; level: number } | null>(null);
  const nameLeft = columns.slice(0, columns.findIndex((c) => c.key === "name")).reduce((sum, c) => sum + c.width, 0);
  const dropProps = (beforeId: string | null, index: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Varsayılan düzey: hedef satırınki (sonda son satırınki); en çok üstteki satırın bir altı
      const prev = index > 0 ? rows[index - 1].task.outline : -1;
      const base = beforeId === null ? Math.max(0, prev) : rows[index].task.outline;
      const delta = Math.round((e.clientX - drag.startX) / INDENT);
      const level = Math.max(0, Math.min(base + delta, prev + 1));
      if (drop?.beforeId !== beforeId || drop.level !== level) setDrop({ beforeId, level });
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (drag && drop) props.onMoveRows(drag.ids, drop.beforeId, drop.level);
      setDrag(null);
      setDrop(null);
    },
  });
  const dropLine = (beforeId: string | null) =>
    drop && drop.beforeId === beforeId ? <i className="drop-line" style={{ left: nameLeft + 4 + drop.level * INDENT }} aria-hidden /> : null;
  // Dolgu tutamacı (Excel gibi): odaktaki hücrenin sağ alt köşesinden aşağı sürükleyerek değeri kopyala
  const [fill, setFill] = useState<{ col: string; from: number; to: number } | null>(null);
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const onFillRef = useRef(props.onFill);
  onFillRef.current = props.onFill;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const fillActive = !!fill;
  useEffect(() => {
    if (!fillActive) return;
    const onMove = (e: globalThis.MouseEvent) => {
      const el = scrollRef.current;
      const f = fillRef.current;
      if (!el || !f) return;
      const box = el.getBoundingClientRect();
      const index = Math.floor((e.clientY - box.top + el.scrollTop - HEADER_H) / ROW_H);
      const to = Math.max(f.from, Math.min(rowsRef.current.length - 1, index));
      if (to !== f.to) setFill({ ...f, to });
    };
    const onUp = () => {
      const f = fillRef.current;
      if (f && f.to > f.from) {
        const list = rowsRef.current;
        onFillRef.current(f.col, list[f.from].task.id, list.slice(f.from + 1, f.to + 1).map((r) => r.task.id));
      }
      setFill(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [fillActive, scrollRef]);
  const fillHandle = (col: string, i: number) => (
    <span
      className="fill-handle"
      title={t("grid.fillHint")}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        // Yazılmakta olan değer önce kaydedilir
        (document.activeElement as HTMLElement | null)?.blur();
        setFill({ col, from: i, to: i });
      }}
    />
  );
  const vp = useViewport(scrollRef);
  // Yalnızca görünen satırlar çizilir (1000+ görevde akıcı kaydırma); üst ve alt boşluk yüksekliği korur
  const { first, last } = visibleRange(vp.top, vp.height - HEADER_H, ROW_H, rows.length);
  const dayLetter = t("unit.dayLetter");

  return (
    <div className="pane grid-pane" ref={scrollRef} onScroll={onScroll}>
      <div style={{ width: "100%", minWidth }}>
        <div className="grid-header" style={{ gridTemplateColumns: template, height: HEADER_H }}>
          {columns.map((c) => {
            const label = c.label ? t(c.label) : "";
            if (!SORTABLE.has(c.key)) {
              return (
                <div key={c.key} className={`gh gh-${c.key}`} title={label}>
                  {label}
                </div>
              );
            }
            const on = props.sortColumn?.key === c.key;
            return (
              <button
                key={c.key}
                className={`gh gh-${c.key} gh-sort ${on ? "on" : ""}`}
                title={`${label} · ${t("grid.sortHint")}`}
                aria-sort={on ? (props.sortColumn!.desc ? "descending" : "ascending") : "none"}
                onClick={() => props.onSortColumn(c.key)}
              >
                <span>{label}</span>
                {on && <Icon name={props.sortColumn!.desc ? "down" : "up"} size={12} />}
              </button>
            );
          })}
        </div>
        <div style={{ height: first * ROW_H }} aria-hidden />
        {rows.slice(first, last).map((r, k) => {
          const i = first + k;
          const { task, sched } = r;
          if (r.group) {
            // Gruplu görünümde grup başlığı: adı ve görev sayısı, tüm genişlikte
            return (
              <div key={r.key} className="grid-row group-row" style={{ height: ROW_H }} role="row">
                <span className="group-label">{r.group.label}</span>
                <span className="group-count">{t("unit.tasks", { n: r.group.count })}</span>
              </div>
            );
          }
          const selected = selection.has(task.id);
          const cls = [
            "grid-row",
            selected && "selected",
            sched.isSummary && "summary",
            sched.critical && "critical",
            r.inactive && "inactive",
            cycle.has(task.id) && "cyclic",
            r.issues.length > 0 && "has-issue",
            drop?.beforeId === task.id && "drop-target",
            fill && i > fill.from && i <= fill.to && "fill-range",
            drag?.ids.includes(task.id) && "dragging",
            r.warnings.some((w) => w.kind === "late") && "late",
            task.color && `tc-${task.color}`,
          ]
            .filter(Boolean)
            .join(" ");
          const row = String(sched.row);
          return (
            <div
              key={r.key}
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
              onContextMenu={(e) => {
                // Düzenlenen hücrede tarayıcının kendi menüsü (metin kopyala/yapıştır) açılır
                if ((e.target as HTMLElement).tagName === "INPUT" && document.activeElement === e.target && (e.target as HTMLInputElement).selectionStart !== (e.target as HTMLInputElement).selectionEnd) return;
                props.onContextMenu(task.id, e);
              }}
              {...dropProps(task.id, i)}
            >
              {dropLine(task.id)}
              <div
                className="gc gc-row"
                title={props.dragDisabled ? t("grid.row", { row }) : `${t("grid.row", { row })}\n${t("grid.dragHint")}`}
                draggable={!props.dragDisabled}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", task.name);
                  // Seçili satır sürüklenirse seçimin tamamı (satır sırasıyla) taşınır
                  const ids = selected ? rows.filter((x) => selection.has(x.task.id)).map((x) => x.task.id) : [task.id];
                  setDrag({ ids, startX: e.clientX, outline: task.outline });
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setDrop(null);
                }}
              >
                {sched.row}
              </div>
              <Indicators row={r} onOpenNotes={props.onOpenNotes} />
              {show("wbs") && (
                <div className="gc gc-wbs" title={r.wbs}>
                  {r.wbs}
                </div>
              )}
              <div className="gc gc-name" style={{ paddingInlineStart: 4 + task.outline * INDENT }}>
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
                {fillHandle("name", i)}
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
                  {!sched.isSummary && fillHandle("duration", i)}
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
                  {!sched.isSummary && fillHandle("start", i)}
                </div>
              )}
              {show("finish") && (
                <div className="gc gc-finish" title={formatShort(sched.finishDate)}>
                  <span>
                    <span className="dow">{dayName(parseDate(sched.finishDate).getUTCDay())}</span> {formatDateLocal(sched.finishDate)}
                  </span>
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
                  {fillHandle("preds", i)}
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
                  {!sched.isSummary && fillHandle("resources", i)}
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
                  {!sched.isSummary && fillHandle("percent", i)}
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
                  {!sched.isSummary && task.duration > 0 && fillHandle("estimate", i)}
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
        <div className={`grid-row add-row ${drop?.beforeId === null ? "drop-target" : ""}`} style={{ gridTemplateColumns: template, height: ROW_H }} {...dropProps(null, rows.length)}>
          {dropLine(null)}
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
/** Not simgesinin üzerine gelince çok satırlı notu ve bağlantıları gösteren küçük kart; tıklayınca notu açar */
function NotePeek({ task, onOpen, children }: { task: Task; onOpen?: (id: string) => void; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    window.clearTimeout(timer.current);
    const up = r.bottom + 220 > window.innerHeight;
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 340)), y: up ? r.top - 6 : r.bottom + 6, up });
  };
  const hide = () => {
    timer.current = window.setTimeout(() => setPos(null), 120);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span
      className="note-peek-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(task.id);
      }}
    >
      {children}
      {pos && (
        <div className={`note-peek ${pos.up ? "up" : ""}`} role="tooltip" style={{ left: pos.x, top: pos.y }} onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={hide}>
          {task.notes && <div className="note-peek-text">{task.notes.length > 600 ? `${task.notes.slice(0, 600)}…` : task.notes}</div>}
          {task.links?.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
              🔗 {l.title || l.url}
            </a>
          ))}
          {onOpen && <small className="note-peek-hint">{t("grid.notePeekHint")}</small>}
        </div>
      )}
    </span>
  );
}

function Indicators({ row, onOpenNotes }: { row: GridRow; onOpenNotes?: (id: string) => void }) {
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
        <NotePeek task={task} onOpen={onOpenNotes}>
          <span className={`ind-mini ${task.links?.length ? "link" : "note"}`} aria-label={task.links?.length ? t("help.i.link") : t("help.i.note")}>
            {task.links?.length ? "🔗" : "✎"}
          </span>
        </NotePeek>
      )}
    </div>
  );
}
