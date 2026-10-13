import { useEffect, useRef, useState, type RefObject } from "react";
import { t, type MessageKey } from "../i18n";
import { isViewActive, projectTags, SORT_KEYS, type SortKey, type TaskFilter, type ViewOptions } from "../model/view";
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

/** Görev tablosunun üstü: arama, süzgeç, sıralama ve sütun seçici */
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

  return (
    <div className="filter-bar" role="search">
      <label className="search">
        <Icon name="search" size={15} />
        <input
          ref={searchRef}
          type="search"
          value={opts.query}
          placeholder={t("view.search")}
          aria-label={t("view.search")}
          onChange={(e) => onChange({ ...opts, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange({ ...opts, query: "" });
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      <label className="inline-field">
        <span>{t("view.filter")}</span>
        <select value={opts.filter} onChange={(e) => onChange({ ...opts, filter: e.target.value as TaskFilter })}>
          <option value="all">{t("view.f.all")}</option>
          <option value="critical">{t("view.f.critical")}</option>
          <option value="late">{t("view.f.late", { n: lateCount })}</option>
          <option value="milestones">{t("view.f.milestones")}</option>
          <option value="incomplete">{t("view.f.incomplete")}</option>
          <option value="notes">{t("view.f.notes")}</option>
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
      <label className="inline-field">
        <span>{t("view.sort")}</span>
        <select value={opts.sort} onChange={(e) => onChange({ ...opts, sort: e.target.value as SortKey })}>
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`view.s.${k}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      {opts.sort !== "none" && (
        <button
          className="tbtn icon-only"
          onClick={() => onChange({ ...opts, desc: !opts.desc })}
          title={opts.desc ? t("view.desc") : t("view.asc")}
          aria-label={opts.desc ? t("view.desc") : t("view.asc")}
          aria-pressed={opts.desc}
        >
          <Icon name={opts.desc ? "down" : "up"} size={16} />
        </button>
      )}
      {active && (
        <>
          <span className="view-count" role="status">
            {t("view.count", { shown, total })}
          </span>
          <button className="link-btn" onClick={() => onChange({ query: "", filter: "all", sort: "none", desc: false })}>
            {t("view.clear")}
          </button>
        </>
      )}
      <span className="spacer" />
      <div className="cols-menu" ref={colsRef}>
        <button className="tbtn" aria-expanded={colsOpen} aria-haspopup="true" onClick={() => setColsOpen((v) => !v)} title={t("view.columnsTitle")}>
          <Icon name="columns" size={16} />
          <span>{t("view.columns")}</span>
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
    </div>
  );
}
