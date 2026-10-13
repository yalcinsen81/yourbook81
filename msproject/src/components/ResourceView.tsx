import { useMemo } from "react";
import { formatMoney, formatNumber, formatPercent, parseNumberLocal, t } from "../i18n";
import { formatShort } from "../model/calendar";
import { newResourceId, removeResource, type ResourceUsage } from "../model/resources";
import type { Project, Resource, Schedule } from "../model/types";
import { LoadHistogram } from "./charts";
import { EditableCell } from "./EditableCell";
import { Icon } from "./icons";

interface Props {
  project: Project;
  schedule: Schedule;
  usage: ResourceUsage[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  update: (fn: (p: Project) => Project) => void;
  flash: (text: string) => void;
}

/** Kaynak sayfası: kaynak listesi (ad, kapasite, ücret) ve seçili kaynağın yük histogramı */
export function ResourceView({ project, schedule, usage, selected, onSelect, update, flash }: Props) {
  const current = usage.find((u) => u.resource.id === selected) ?? usage[0];

  const patch = (id: string, p: Partial<Resource>) =>
    update((pr) => ({ ...pr, resources: pr.resources.map((r) => (r.id === id ? { ...r, ...p } : r)) }));

  const add = () => {
    const id = newResourceId();
    update((p) => ({ ...p, resources: [...p.resources, { id, name: t("default.resource", { n: String(p.resources.length + 1) }), maxUnits: 100, rate: 0 }] }));
    onSelect(id);
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`[data-col="rname"][data-row="${project.resources.length}"]`)?.focus(),
    );
  };

  const remove = (r: Resource) => {
    const used = project.tasks.filter((task) => task.assignments?.some((a) => a.resourceId === r.id)).length;
    if (used && !window.confirm(t("res.confirmDelete", { name: r.name, n: used }))) return;
    update((p) => removeResource(p, r.id));
    if (selected === r.id) onSelect(null);
  };

  // Sayı: seçili dilin binlik/ondalık ayırıcısı; para simgesi, kod ve % yok sayılır
  const num = (text: string, min: number) => {
    const n = parseNumberLocal(text);
    return n !== null && n >= min ? n : null;
  };

  const tasksOf = useMemo(() => {
    if (!current) return [];
    return project.tasks.flatMap((task, i) => {
      const a = task.assignments?.find((x) => x.resourceId === current.resource.id);
      const r = schedule.rows[i];
      if (!a || r.isSummary) return [];
      const over = current.overTasks.includes(task.id);
      return [{ id: task.id, row: i + 1, name: task.name, units: a.units, start: r.startDate, finish: r.finishDate, over }];
    });
  }, [current, project.tasks, schedule.rows]);

  const template = "minmax(160px, 1.6fr) 96px 120px 90px 120px 92px minmax(120px, 1fr) 40px";

  return (
    <div className="page">
      <section className="card">
        <header className="card-head">
          <div>
            <h2>{t("res.title")}</h2>
            <p className="card-sub">{t("res.sub")}</p>
          </div>
          <button className="tbtn primary" onClick={add}>
            <Icon name="plus" size={17} />
            <span>{t("res.add")}</span>
          </button>
        </header>
        <div className="rtable" role="table" aria-label={t("res.tableAria")}>
          <div className="rrow rhead" role="row" style={{ gridTemplateColumns: template }}>
            <span>{t("res.col.name")}</span>
            <span className="r">{t("res.col.capacity")}</span>
            <span className="r">{t("res.col.rate")}</span>
            <span className="r">{t("res.col.work")}</span>
            <span className="r">{t("res.col.cost")}</span>
            <span className="r">{t("res.col.peak")}</span>
            <span>{t("res.col.status")}</span>
            <span />
          </div>
          {usage.map((u, i) => {
            const r = u.resource;
            const over = u.overDays.length > 0;
            return (
              <div
                key={r.id}
                role="row"
                className={`rrow ${current?.resource.id === r.id ? "selected" : ""}`}
                style={{ gridTemplateColumns: template }}
                onMouseDown={() => onSelect(r.id)}
              >
                <EditableCell
                  value={r.name}
                  row={i}
                  col="rname"
                  ariaLabel={t("res.aria.name", { row: String(i + 1) })}
                  onCommit={(v) => {
                    const name = v.trim();
                    if (!name || /[;,[\]]/.test(name)) {
                      flash(t("err.resourceName"));
                      return false;
                    }
                    if (project.resources.some((x) => x.id !== r.id && x.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
                      flash(t("err.resourceExists", { name }));
                      return false;
                    }
                    patch(r.id, { name });
                    return true;
                  }}
                />
                <EditableCell
                  value={formatPercent(r.maxUnits)}
                  row={i}
                  col="rmax"
                  className="num"
                  ariaLabel={t("res.aria.capacity", { name: r.name })}
                  onCommit={(v) => {
                    const n = num(v, 1);
                    if (n === null) return false;
                    patch(r.id, { maxUnits: Math.round(n) });
                    return true;
                  }}
                />
                <EditableCell
                  value={formatMoney(r.rate)}
                  row={i}
                  col="rrate"
                  className="num"
                  ariaLabel={t("res.aria.rate", { name: r.name })}
                  onCommit={(v) => {
                    const n = num(v, 0);
                    if (n === null) return false;
                    patch(r.id, { rate: n });
                    return true;
                  }}
                />
                <span className="r num">{fmtDays(u.work)}</span>
                <span className="r num">{formatMoney(u.cost)}</span>
                <span className={`r num ${over ? "over-text" : ""}`}>{formatPercent(u.peak)}</span>
                <span>
                  {u.work === 0 ? (
                    <span className="pill idle">{t("res.idle")}</span>
                  ) : over ? (
                    <span className="pill over">{t("res.over", { n: u.overDays.length })}</span>
                  ) : (
                    <span className="pill ok">{t("res.ok")}</span>
                  )}
                </span>
                <button className="icon-btn small" onClick={() => remove(r)} aria-label={t("res.delete", { name: r.name })} title={t("res.deleteTitle")}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
            );
          })}
          {!usage.length && (
            <p className="empty">{t("res.empty")}</p>
          )}
        </div>
      </section>

      {current && (
        <section className="card">
          <header className="card-head">
            <div>
              <h2>{t("res.histTitle", { name: current.resource.name })}</h2>
              <p className="card-sub">
                {t("res.histSub")}
                {current.overDays.length > 0 && ` ${t("res.firstOver", { date: formatShort(schedule.calendar.toDate(current.overDays[0])) })}`}
              </p>
            </div>
          </header>
          {schedule.finish > 0 ? (
            <LoadHistogram usage={current} calendar={schedule.calendar} />
          ) : (
            <p className="empty">{t("res.noDuration")}</p>
          )}
          {tasksOf.length > 0 && (
            <div className="assign-list">
              {tasksOf.map((a) => (
                <div key={a.id} className={`assign ${a.over ? "over" : ""}`}>
                  <span className="assign-row">{a.row}</span>
                  <span className="assign-name" title={a.name}>
                    {a.name}
                  </span>
                  <span className="assign-dates">
                    {formatShort(a.start)} – {formatShort(a.finish)}
                  </span>
                  <span className="assign-units">{formatPercent(a.units)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function fmtDays(n: number): string {
  return t("unit.personDays", { n: formatNumber(n, 1) });
}
