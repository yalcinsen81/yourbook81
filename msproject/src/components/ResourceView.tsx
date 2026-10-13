import { useMemo } from "react";
import { formatShort } from "../model/calendar";
import { formatMoney, newResourceId, removeResource, type ResourceUsage } from "../model/resources";
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
    update((p) => ({ ...p, resources: [...p.resources, { id, name: `Kaynak ${p.resources.length + 1}`, maxUnits: 100, rate: 0 }] }));
    onSelect(id);
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`[data-col="rname"][data-row="${project.resources.length}"]`)?.focus(),
    );
  };

  const remove = (r: Resource) => {
    const used = project.tasks.filter((t) => t.assignments?.some((a) => a.resourceId === r.id)).length;
    if (used && !window.confirm(`"${r.name}" ${used} göreve atanmış. Silinirse atamalar da kalkar. Silinsin mi?`)) return;
    update((p) => removeResource(p, r.id));
    if (selected === r.id) onSelect(null);
  };

  const num = (text: string, min: number) => {
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*(%|₺|tl)?\s*$/i.exec(text);
    if (!m) return null;
    const n = Number(m[1].replace(",", "."));
    return n >= min ? n : null;
  };

  const tasksOf = useMemo(() => {
    if (!current) return [];
    return project.tasks.flatMap((t, i) => {
      const a = t.assignments?.find((x) => x.resourceId === current.resource.id);
      const r = schedule.rows[i];
      if (!a || r.isSummary) return [];
      const over = current.overTasks.includes(t.id);
      return [{ id: t.id, row: i + 1, name: t.name, units: a.units, start: r.startDate, finish: r.finishDate, over }];
    });
  }, [current, project.tasks, schedule.rows]);

  const template = "minmax(160px, 1.6fr) 96px 120px 90px 120px 92px minmax(120px, 1fr) 40px";

  return (
    <div className="page">
      <section className="card">
        <header className="card-head">
          <div>
            <h2>Kaynaklar</h2>
            <p className="card-sub">Kapasite %100 bir kişinin tam günüdür; 3 kişilik ekip için %300 yazın. Ücret %100 birimde günlüktür.</p>
          </div>
          <button className="tbtn primary" onClick={add}>
            <Icon name="plus" size={17} />
            <span>Kaynak</span>
          </button>
        </header>
        <div className="rtable" role="table" aria-label="Kaynak listesi">
          <div className="rrow rhead" role="row" style={{ gridTemplateColumns: template }}>
            <span>Ad</span>
            <span className="r">Kapasite</span>
            <span className="r">Günlük ücret</span>
            <span className="r">İş</span>
            <span className="r">Maliyet</span>
            <span className="r">En yüksek</span>
            <span>Durum</span>
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
                  ariaLabel={`${i + 1}. kaynak adı`}
                  onCommit={(v) => {
                    const name = v.trim();
                    if (!name || /[;,[\]]/.test(name)) {
                      flash("Kaynak adı boş olamaz ve ; , [ ] içeremez.");
                      return false;
                    }
                    if (project.resources.some((x) => x.id !== r.id && x.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
                      flash(`"${name}" adında bir kaynak zaten var.`);
                      return false;
                    }
                    patch(r.id, { name });
                    return true;
                  }}
                />
                <EditableCell
                  value={`%${r.maxUnits}`}
                  row={i}
                  col="rmax"
                  className="num"
                  ariaLabel={`${r.name} kapasite`}
                  onCommit={(v) => {
                    const n = num(v.replace("%", ""), 1);
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
                  ariaLabel={`${r.name} günlük ücret`}
                  onCommit={(v) => {
                    const n = num(v.replace(/\./g, "").replace(/\s/g, ""), 0);
                    if (n === null) return false;
                    patch(r.id, { rate: n });
                    return true;
                  }}
                />
                <span className="r num">{fmtDays(u.work)}</span>
                <span className="r num">{formatMoney(u.cost)}</span>
                <span className={`r num ${over ? "over-text" : ""}`}>%{u.peak}</span>
                <span>
                  {u.work === 0 ? (
                    <span className="pill idle">Atanmamış</span>
                  ) : over ? (
                    <span className="pill over">Aşırı yüklü · {u.overDays.length} gün</span>
                  ) : (
                    <span className="pill ok">Uygun</span>
                  )}
                </span>
                <button className="icon-btn small" onClick={() => remove(r)} aria-label={`${r.name} kaynağını sil`} title="Kaynağı sil">
                  <Icon name="trash" size={15} />
                </button>
              </div>
            );
          })}
          {!usage.length && (
            <p className="empty">
              Henüz kaynak yok. "+ Kaynak" ile ekleyin ya da Gantt tablosundaki <b>Kaynaklar</b> sütununa bir ad yazın.
            </p>
          )}
        </div>
      </section>

      {current && (
        <section className="card">
          <header className="card-head">
            <div>
              <h2>{current.resource.name} · yük histogramı</h2>
              <p className="card-sub">
                Her çubuk bir iş günüdür. Kesik çizgi kapasite; kırmızı kısım kapasitenin aşıldığı yük.
                {current.overDays.length > 0 &&
                  ` İlk aşım: ${formatShort(schedule.calendar.toDate(current.overDays[0]))}.`}
              </p>
            </div>
          </header>
          {schedule.finish > 0 ? (
            <LoadHistogram usage={current} calendar={schedule.calendar} />
          ) : (
            <p className="empty">Projede süresi olan görev yok.</p>
          )}
          {tasksOf.length > 0 && (
            <div className="assign-list">
              {tasksOf.map((t) => (
                <div key={t.id} className={`assign ${t.over ? "over" : ""}`}>
                  <span className="assign-row">{t.row}</span>
                  <span className="assign-name">{t.name}</span>
                  <span className="assign-dates">
                    {formatShort(t.start)} – {formatShort(t.finish)}
                  </span>
                  <span className="assign-units">%{t.units}</span>
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
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} a-g`;
}
