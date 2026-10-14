import { formatDateLocal, t } from "../i18n";
import { formatShort } from "../model/calendar";
import { timelineFraction, type TimelineData } from "../model/timeline";

interface Props {
  data: TimelineData;
  today: string;
  selection: Set<string>;
  onReveal: (id: string) => void;
}

const LANE_H = 24;

/** Gantt'ın üstündeki zaman çizelgesi şeridi: işaretli görevler projenin tüm süresine yayılmış hâlde */
export function TimelineStrip({ data, today, selection, onReveal }: Props) {
  const pct = (iso: string, end = false) => `${(timelineFraction(data, iso, end) * 100).toFixed(3)}%`;
  const showToday = today >= data.from && today <= data.to;
  return (
    <section className="timeline-strip" aria-label={t("timeline.title")}>
      <div className="timeline-head">
        <span className="timeline-title">{t("timeline.title")}</span>
        <span className="timeline-range">
          {formatDateLocal(data.from)} – {formatDateLocal(data.to)}
        </span>
      </div>
      <div className="timeline-body" style={{ height: data.lanes * LANE_H + 6 }}>
        {showToday && <i className="timeline-today" style={{ left: pct(today) }} title={t("gantt.today")} />}
        {data.items.map((it) => {
          const top = 3 + it.lane * LANE_H;
          const title = `${it.name || t("common.unnamed")} · ${formatShort(it.start)}${it.milestone ? "" : ` – ${formatShort(it.finish)}`}`;
          const sel = selection.has(it.id) ? "selected" : "";
          return it.milestone ? (
            <button key={it.id} className={`timeline-ms ${sel}`} style={{ left: pct(it.start), top }} title={title} onClick={() => onReveal(it.id)}>
              <i aria-hidden="true" />
              <span>{it.name || t("common.unnamed")}</span>
            </button>
          ) : (
            <button
              key={it.id}
              className={`timeline-item ${it.summary ? "summary" : ""} ${sel}`}
              style={{ left: pct(it.start), width: `calc(${pct(it.finish, true)} - ${pct(it.start)})`, top }}
              title={title}
              onClick={() => onReveal(it.id)}
            >
              <span>{it.name || t("common.unnamed")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
