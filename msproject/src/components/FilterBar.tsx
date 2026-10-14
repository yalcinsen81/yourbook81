import { useEffect, useRef, useState, type RefObject } from "react";
import { t, type MessageKey } from "../i18n";
import { GROUP_KEYS, isViewActive, projectTags, SORT_KEYS, type GroupBy, type SortKey, type TaskFilter, type ViewOptions } from "../model/view";
import { TASK_COLORS, type Project } from "../model/types";
import { COLUMNS, FIXED_COLUMNS } from "./TaskGrid";
import { Icon } from "./icons";

type Opts = Omit<ViewOptions, "today">;

interface Props {
  project: Project;
  opts: Opts;
  onChange: (o: Opts) => void;
  shown: number;
  total: number;
  lateCount: number;
  hidden: Set<string>;
  onHidden: (h: Set<string>) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

/** Araç çubuğunun sağı (Gantt görünümü): arama, süzgeç, sıralama ve sütun seçici */
export function FilterBar({ project, opts, onChange, shown, total, lateCount, hidden, onHidden, searchRef }: Props) {
  const tags = projectTags(project);
  const colors = TASK_COLORS.filter((c) => project.tasks.some((x) => x.color === c));
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  const active = isViewActive(opts);

  useEffect(() => {
    if (!colsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!colsRef.current?.contains(e.target as Node)) setColsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setColsOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [colsOpen]);

  const filterOn = opts.filter !== "all";
  const sortOn = opts.sort !== "none";
  const group = opts.group ?? "none";
  const groupOn = group !== "none";
  // Etkin süzgecin görünen adı (rozet)
  const filterLabel = (() => {
    const f = opts.filter;
    if (f.startsWith("res:")) return `${t("view.f.byResource")}: ${project.resources.find((r) => r.id === f.slice(4))?.name ?? ""}`;
    if (f.startsWith("tag:")) return `${t("view.f.byTag")}: ${f.slice(4)}`;
    if (f.startsWith("color:")) return `${t("view.f.byColor")}: ${t(`color.${f.slice(6)}` as MessageKey)}`;
    if (f === "late") return t("view.f.late", { n: lateCount });
    return t(`view.f.${f}` as MessageKey);
  })();
  return (
    <>
      <label className="search" title={t("view.search")}>
        <Icon name="search" size={16} />
        <input
          ref={searchRef}
          type="search"
          value={opts.query}
          placeholder={t("view.searchShort")}
          aria-label={t("view.search")}
          onChange={(e) => onChange({ ...opts, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange({ ...opts, query: "" });
              e.currentTarget.blur();
            }
          }}
        />
        {!opts.query && <kbd aria-hidden>Ctrl F</kbd>}
      </label>
      {/* Süzgeç ve sıralama: simge düğmesinin üstünde görünmez yerli seçim kutusu (klavye ve ekran okuyucuyla çalışır) */}
      <label className={`tbtn icon-only icon-select ${filterOn ? "on" : ""}`} title={t("view.filter")}>
        <Icon name="filter" size={16} />
        {filterOn && <i className="dot-alert" aria-hidden />}
        <select aria-label={t("view.filter")} value={opts.filter} onChange={(e) => onChange({ ...opts, filter: e.target.value as TaskFilter })}>
          <option value="all">{t("view.f.all")}</option>
          <option value="critical">{t("view.f.critical")}</option>
          <option value="late">{t("view.f.late", { n: lateCount })}</option>
          <option value="milestones">{t("view.f.milestones")}</option>
          <option value="incomplete">{t("view.f.incomplete")}</option>
          <option value="notes">{t("view.f.notes")}</option>
          <option value="thisWeek">{t("view.f.thisWeek")}</option>
          {project.resources.length > 0 && (
            <optgroup label={t("view.f.byResource")}>
              {project.resources.map((r) => (
                <option key={r.id} value={`res:${r.id}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          )}
          {tags.length > 0 && (
            <optgroup label={t("view.f.byTag")}>
              {tags.map((x) => (
                <option key={x} value={`tag:${x}`}>
                  {x}
                </option>
              ))}
            </optgroup>
          )}
          {colors.length > 0 && (
            <optgroup label={t("view.f.byColor")}>
              {colors.map((c) => (
                <option key={c} value={`color:${c}`}>
                  {t(`color.${c}`)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className={`tbtn icon-only icon-select ${sortOn ? "on" : ""}`} title={t("view.sort")}>
        <Icon name="sort" size={16} />
        <select aria-label={t("view.sort")} value={opts.sort} onChange={(e) => onChange({ ...opts, sort: e.target.value as SortKey })}>
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`view.s.${k}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      {sortOn && (
        <button
          className="tbtn icon-only"
          onClick={() => onChange({ ...opts, desc: !opts.desc })}
          title={`${t("view.sortDir")}: ${opts.desc ? t("view.desc") : t("view.asc")}`}
          aria-label={opts.desc ? t("view.desc") : t("view.asc")}
          aria-pressed={opts.desc}
        >
          <Icon name={opts.desc ? "down" : "up"} size={16} />
        </button>
      )}
      <label className={`tbtn icon-only icon-select ${groupOn ? "on" : ""}`} title={t("view.group")}>
        <Icon name="group" size={16} />
        <select aria-label={t("view.group")} value={group} onChange={(e) => onChange({ ...opts, group: e.target.value as GroupBy })}>
          {GROUP_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`view.g.${k}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      {/* Etkin süzgeç ve gruplama rozet olarak; × tek tıkla kaldırır */}
      {filterOn && (
        <span className="view-chip" title={t("view.filter")}>
          <span>{filterLabel}</span>
          <button aria-label={t("view.clearFilter")} title={t("view.clearFilter")} onClick={() => onChange({ ...opts, filter: "all" })}>
            <Icon name="close" size={12} />
          </button>
        </span>
      )}
      {groupOn && (
        <span className="view-chip" title={t("view.group")}>
          <span>{t(`view.g.${group}` as MessageKey)}</span>
          <button aria-label={t("view.clearGroup")} title={t("view.clearGroup")} onClick={() => onChange({ ...opts, group: "none" })}>
            <Icon name="close" size={12} />
          </button>
        </span>
      )}
      {active && (
        <span className="view-count" role="status">
          {t("view.count", { shown, total })}
          <button className="link-btn" onClick={() => onChange({ query: "", filter: "all", sort: "none", desc: false, group: "none" })}>
            {t("view.clear")}
          </button>
        </span>
      )}
      <div className="cols-menu" ref={colsRef}>
        <button
          className="tbtn icon-only"
          aria-expanded={colsOpen}
          aria-haspopup="true"
          aria-label={t("view.columns")}
          onClick={() => setColsOpen((v) => !v)}
          title={t("view.columnsTitle")}
        >
          <Icon name="columns" size={16} />
        </button>
        {colsOpen && (
          <div className="menu cols-pop" role="group" aria-label={t("view.columns")}>
            {COLUMNS.filter((c) => !FIXED_COLUMNS.has(c.key) && c.label).map((c) => (
              <label key={c.key} className="check">
                <input
                  type="checkbox"
                  checked={!hidden.has(c.key)}
                  onChange={(e) => {
                    const n = new Set(hidden);
                    if (e.target.checked) n.delete(c.key);
                    else n.add(c.key);
                    onHidden(n);
                  }}
                />
                <span>{t(c.label as MessageKey)}</span>
              </label>
            ))}
            <small className="hint">{t("view.varianceNote")}</small>
          </div>
        )}
      </div>
    </>
  );
}
