import { useMemo } from "react";
import { formatMoney, formatNumber, formatPercent, parseNumberLocal, t, type Msg } from "../i18n";
import { formatShort, isValidDate, normalizeWorkdays } from "../model/calendar";
import { newResourceId, removeResource, type ResourceUsage } from "../model/resources";
import type { Project, RateType, Resource, ResourceType, Schedule } from "../model/types";
import { WorkdayPicker } from "./CalendarSettings";
import { LoadHistogram } from "./charts";
import { DateInput } from "./DateInput";
import { EditableCell } from "./EditableCell";
import { Icon } from "./icons";
import { useState } from "react";

interface Props {
  project: Project;
  schedule: Schedule;
  usage: ResourceUsage[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  update: (fn: (p: Project) => Project) => void;
  flash: (text: Msg) => void;
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

  const template = "minmax(150px, 1.6fr) 112px 96px 112px 120px 90px 120px 82px minmax(110px, 1fr) 40px";
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveName, setLeaveName] = useState("");
  const addLeave = (r: Resource) => {
    if (!isValidDate(leaveFrom)) return;
    const to = isValidDate(leaveTo) ? leaveTo : leaveFrom;
    const [from, until] = leaveFrom <= to ? [leaveFrom, to] : [to, leaveFrom];
    patch(r.id, { leaves: [...(r.leaves ?? []), { from, to: until, ...(leaveName.trim() ? { name: leaveName.trim() } : {}) }] });
    setLeaveFrom("");
    setLeaveTo("");
    setLeaveName("");
  };
  const rateLabel = (r: Resource) =>
    r.type === "material" ? t("res.rate.unitPrice", { unit: r.unitLabel || t("res.unitDefault") }) : t(`res.rate.${r.rateType ?? "day"}`);

  return (
    <div className="page">
      <section className="card">
        <header className="card-head">
          <div>
            <h2>{t("res.title")}</h2>
            <p className="card-sub">{t("res.sub")}</p>
          </div>
          <div className="cost-settings">
            <label className="field inline" title={t("res.overheadHint")}>
              <span>{t("res.overhead")}</span>
              <EditableCell
                value={formatPercent(project.overheadPercent ?? 0)}
                row={0}
                col="overhead"
                className="num"
                ariaLabel={t("res.overhead")}
                onCommit={(v) => {
                  const n = num(v, 0);
                  if (n === null || n > 1000) return false;
                  update((p) => {
                    const next: Project = { ...p, overheadPercent: n };
                    if (!n) delete next.overheadPercent;
                    return next;
                  });
                  return true;
                }}
              />
            </label>
            <label className="field inline" title={t("res.hoursPerDayHint")}>
              <span>{t("res.hoursPerDay")}</span>
              <EditableCell
                value={formatNumber(project.hoursPerDay ?? 8, 2)}
                row={0}
                col="hpd"
                className="num"
                ariaLabel={t("res.hoursPerDay")}
                onCommit={(v) => {
                  const n = num(v, 0.5);
                  if (n === null || n > 24) return false;
                  update((p) => {
                    const next: Project = { ...p, hoursPerDay: n };
                    if (n === 8) delete next.hoursPerDay;
                    return next;
                  });
                  return true;
                }}
              />
            </label>
          </div>
          <button className="tbtn primary" onClick={add}>
            <Icon name="plus" size={17} />
            <span>{t("res.add")}</span>
          </button>
        </header>
        <div className="rtable" role="table" aria-label={t("res.tableAria")}>
          <div className="rrow rhead" role="row" style={{ gridTemplateColumns: template }}>
            <span>{t("res.col.name")}</span>
            <span>{t("res.col.type")}</span>
            <span className="r">{t("res.col.capacity")}</span>
            <span>{t("res.col.rateType")}</span>
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
                      flash(() => t("err.resourceName"));
                      return false;
                    }
                    if (project.resources.some((x) => x.id !== r.id && x.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
                      flash(() => t("err.resourceExists", { name }));
                      return false;
                    }
                    patch(r.id, { name });
                    return true;
                  }}
                />
                <select
                  className="cell-select"
                  value={r.type ?? "work"}
                  aria-label={t("res.aria.type", { name: r.name })}
                  onChange={(e) => {
                    const type = e.target.value as ResourceType;
                    patch(r.id, { type: type === "work" ? undefined : type });
                  }}
                >
                  {(["work", "equipment", "material"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`res.type.${k}`)}
                    </option>
                  ))}
                </select>
                {r.type === "material" ? (
                  <span className="r muted" title={t("res.materialNoCapacity")}>—</span>
                ) : (
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
                )}
                {r.type === "material" ? (
                  <EditableCell
                    value={r.unitLabel ?? ""}
                    placeholder={t("res.unitPlaceholder")}
                    row={i}
                    col="runit"
                    ariaLabel={t("res.aria.unit", { name: r.name })}
                    title={t("res.unitHint")}
                    onCommit={(v) => {
                      patch(r.id, { unitLabel: v.trim().slice(0, 12) || undefined });
                      return true;
                    }}
                  />
                ) : (
                  <select
                    className="cell-select"
                    value={r.rateType ?? "day"}
                    aria-label={t("res.aria.rateType", { name: r.name })}
                    onChange={(e) => {
                      const rateType = e.target.value as RateType;
                      patch(r.id, { rateType: rateType === "day" ? undefined : rateType });
                    }}
                  >
                    {(["day", "hour", "use"] as const).map((k) => (
                      <option key={k} value={k}>
                        {t(`res.rate.${k}`)}
                      </option>
                    ))}
                  </select>
                )}
                <EditableCell
                  title={rateLabel(r)}
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
                <span className="r num">{r.type === "material" ? `${formatNumber(u.work, 2)} ${r.unitLabel ?? ""}`.trim() : fmtDays(u.work)}</span>
                <span className="r num">{formatMoney(u.cost)}</span>
                <span className={`r num ${over ? "over-text" : ""}`}>{r.type === "material" ? "—" : formatPercent(u.peak)}</span>
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
          {current.resource.type !== "material" && (
            <div className="res-calendar">
              <h3>{t("res.calTitle")}</h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!current.resource.workdays}
                  onChange={(e) =>
                    patch(current.resource.id, { workdays: e.target.checked ? normalizeWorkdays(project.workdays) : undefined })
                  }
                />
                <span>
                  {t("res.ownWeek")}
                  <small>{t("res.ownWeekHint")}</small>
                </span>
              </label>
              {current.resource.workdays && (
                <WorkdayPicker value={current.resource.workdays} onChange={(days) => patch(current.resource.id, { workdays: days })} />
              )}
              <h4>{t("res.leaves")}</h4>
              <ul className="holiday-list compact">
                {(current.resource.leaves ?? []).map((l, k) => (
                  <li key={`${l.from}-${k}`}>
                    <span className="date">
                      {formatShort(l.from)}
                      {l.to !== l.from && ` – ${formatShort(l.to)}`}
                    </span>
                    <span className="name">{l.name ?? ""}</span>
                    <button
                      aria-label={t("res.removeLeave")}
                      onClick={() => {
                        const leaves = (current.resource.leaves ?? []).filter((_, j) => j !== k);
                        patch(current.resource.id, { leaves: leaves.length ? leaves : undefined });
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {!current.resource.leaves?.length && <li className="name">{t("res.noLeaves")}</li>}
              </ul>
              <div className="holiday-add">
                <DateInput value={leaveFrom} ariaLabel={t("res.leaveFrom")} onChange={setLeaveFrom} />
                <DateInput value={leaveTo} ariaLabel={t("res.leaveTo")} onChange={setLeaveTo} />
                <input
                  type="text"
                  value={leaveName}
                  placeholder={t("res.leaveNamePlaceholder")}
                  aria-label={t("res.leaveName")}
                  onChange={(e) => setLeaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLeave(current.resource)}
                />
                <button onClick={() => addLeave(current.resource)} disabled={!isValidDate(leaveFrom)}>
                  {t("common.add")}
                </button>
              </div>
            </div>
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
                  <span className="assign-units">
                    {current.resource.type === "material" ? `${formatNumber(a.units, 2)} ${current.resource.unitLabel ?? ""}`.trim() : formatPercent(a.units)}
                  </span>
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
