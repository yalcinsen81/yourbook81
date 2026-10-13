import { t, type MessageKey } from "../i18n";
import { formatShort } from "../model/calendar";
import { formatMoney, plannedAt, projectWeight, type Curves, type ResourceUsage } from "../model/resources";
import type { ProgressWeight, Project, Schedule } from "../model/types";
import { BarList, CurveChart, LoadHeatmap } from "./charts";
import { Icon } from "./icons";

interface Props {
  project: Project;
  schedule: Schedule;
  usage: ResourceUsage[];
  today: string;
  /** App'te hesaplanan eğriler: başlıktaki ilerleme ile aynı ağırlık */
  curves: Curves;
  /** Bilgilendirme notları (ör. maliyeti olmayan görevler) */
  warnings: string[];
  onWeight: (w: ProgressWeight) => void;
  onPickResource: (id: string) => void;
}

const WEIGHTS: ProgressWeight[] = ["cost", "work", "duration"];

/** İş programından grafikler: S eğrisi, maliyet eğrisi, kaynak yük haritası, kaynak başına maliyet */
export function ChartsView({ project, schedule, usage, today, curves, warnings, onWeight, onPickResource }: Props) {
  const weightLabel = t(`weight.${curves.weight}`);
  const days = schedule.finish;
  const started = curves.todayDay >= 0;
  const todayDay = Math.min(curves.todayDay, days - 1);
  const plannedToday = started ? plannedAt(curves, todayDay) : 0;
  const diff = curves.earnedPercent - plannedToday;
  const good = diff >= -0.5;
  const overRes = usage.filter((u) => u.overDays.length);
  const plannedCostToday = started ? curves.points[Math.min(todayDay + 1, curves.points.length - 1)]?.cost ?? 0 : 0;

  if (days <= 0) {
    return (
      <div className="page">
        <section className="card">
          <p className="empty">Grafikler için süresi olan en az bir görev gerekir.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="charts-bar">
        <div className="segmented" role="radiogroup" aria-label={t("charts.weight")}>
          <span className="seg-label">{t("charts.weight")}</span>
          {WEIGHTS.map((w) => (
            <button
              key={w}
              role="radio"
              aria-checked={projectWeight(project) === w}
              className={projectWeight(project) === w ? "on" : ""}
              onClick={() => onWeight(w)}
              title={t(`weight.hint.${w}` as MessageKey)}
            >
              {t(`weight.option.${w}` as MessageKey)}
            </button>
          ))}
        </div>
        {warnings.map((w) => (
          <p key={w} className="info-note" role="note">
            <Icon name="info" size={15} />
            {w}
          </p>
        ))}
      </div>
      <div className="kpis">
        <Kpi label="Toplam maliyet" value={formatMoney(curves.totalCost)} sub={curves.totalCost ? `Bugüne planlanan ${formatMoney(plannedCostToday)}` : "Kaynaklara ücret girin"} />
        <Kpi label="Planlanan ilerleme" value={`%${Math.round(plannedToday)}`} sub={t("charts.asOf", { date: formatShort(today), weight: weightLabel })} />
        <Kpi label="Gerçekleşen" value={`%${Math.round(curves.earnedPercent)}`} sub={`Kazanılan değer ${formatMoney(curves.earnedCost)}`} />
        <Kpi
          label="Fark"
          value={`${diff >= 0 ? "+" : "−"}%${Math.abs(Math.round(diff))}`}
          sub={good ? "Plana göre önde veya planda" : "Plana göre geride"}
          tone={good ? "good" : "bad"}
        />
        <Kpi
          label="Aşırı yüklü kaynak"
          value={String(overRes.length)}
          sub={overRes.length ? overRes.map((u) => u.resource.name).join(", ") : "Kapasite aşımı yok"}
          tone={overRes.length ? "bad" : "good"}
        />
      </div>

      <div className="chart-grid">
        <section className="card">
          <header className="card-head">
            <div>
              <h2>S eğrisi</h2>
              <p className="card-sub">{t("charts.sCurveSub", { weight: weightLabel })}</p>
            </div>
          </header>
          <CurveChart
            points={curves.points.map((p) => ({ day: p.day, value: p.planned }))}
            days={days}
            calendar={schedule.calendar}
            yMax={100}
            yFormat={(v) => `%${Math.round(v)}`}
            label="S eğrisi"
            today={started ? todayDay : undefined}
            plannedToday={plannedToday}
            actual={{ value: curves.earnedPercent, good, label: `Gerçekleşen %${Math.round(curves.earnedPercent)}` }}
          />
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2>Maliyet eğrisi</h2>
              <p className="card-sub">Kaynak ücretlerinden hesaplanan kümülatif planlanan maliyet; nokta kazanılan değer.</p>
            </div>
          </header>
          {curves.totalCost > 0 ? (
            <CurveChart
              points={curves.points.map((p) => ({ day: p.day, value: p.cost }))}
              days={days}
              calendar={schedule.calendar}
              yMax={niceMoney(curves.totalCost)}
              yFormat={shortMoney}
              label="Maliyet eğrisi"
              today={started ? todayDay : undefined}
              plannedToday={plannedCostToday}
              actual={{ value: curves.earnedCost, good: curves.earnedCost >= plannedCostToday - 0.5, label: shortMoney(curves.earnedCost) }}
            />
          ) : (
            <p className="empty">Maliyet için Kaynaklar sayfasında günlük ücret girin ve görevlere kaynak atayın.</p>
          )}
        </section>

        <section className="card wide">
          <header className="card-head">
            <div>
              <h2>Kaynak yük haritası</h2>
              <p className="card-sub">Her hücre bir hafta; koyuluk haftanın en yüksek yükünün kapasiteye oranı, kırmızı aşırı yük. Ada tıklayınca histogram açılır.</p>
            </div>
            <span className="heat-legend">
              <i className="heat-cell l1" /> Az <i className="heat-cell l2" /> Orta <i className="heat-cell l3" /> Dolu <i className="heat-cell over" /> Aşım
            </span>
          </header>
          {usage.length ? (
            <LoadHeatmap usage={usage} calendar={schedule.calendar} onPick={onPickResource} />
          ) : (
            <p className="empty">Henüz kaynak yok.</p>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2>Kaynak başına maliyet</h2>
            </div>
          </header>
          {usage.some((u) => u.cost > 0) ? (
            <BarList
              items={[...usage].sort((a, b) => b.cost - a.cost).map((u) => ({ label: u.resource.name, value: u.cost, over: u.overDays.length > 0 }))}
              format={formatMoney}
            />
          ) : (
            <p className="empty">Ücret girilmiş kaynak yok.</p>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <div>
              <h2>Kaynak başına iş</h2>
            </div>
          </header>
          {usage.some((u) => u.work > 0) ? (
            <BarList
              items={[...usage].sort((a, b) => b.work - a.work).map((u) => ({ label: u.resource.name, value: u.work, over: u.overDays.length > 0 }))}
              format={(v) => `${Math.round(v * 10) / 10} adam-gün`}
            />
          ) : (
            <p className="empty">Görevlere kaynak atanmamış.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub" title={sub}>
        {sub}
      </span>
    </div>
  );
}

function shortMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mn ₺`;
  if (v >= 1000) return `${Math.round(v / 1000).toLocaleString("tr-TR")} bin ₺`;
  return `${Math.round(v)} ₺`;
}

function niceMoney(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
