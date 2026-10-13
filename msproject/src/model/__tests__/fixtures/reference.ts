import { turkishHolidays } from "../../holidays";
import type { Project, Resource, Task } from "../../types";

// Referans proje: "Örnek Ev Yapım Projesi", 2026-11-02 başlangıç, Pzt–Cum, Türkiye tatilleri.
// Her görevin maliyeti kendi kaynağından gelir (günlük ücret × süre); "Snag list"in kaynağı yoktur.

const ROWS: [name: string, duration: number, cost: number][] = [
  ["Hafriyat ve temel", 10, 85_000],
  ["Kaba yapı", 25, 250_000],
  ["Çatı imalatı", 10, 60_000],
  ["Tesisat ve elektrik", 15, 96_000],
  ["Sıva, boya, son kat", 20, 144_000],
  ["Snag list", 5, 0],
];

export const REFERENCE_DATES: [start: string, finish: string][] = [
  ["2026-11-02", "2026-11-13"],
  ["2026-11-16", "2026-12-18"],
  ["2026-12-21", "2027-01-04"],
  ["2027-01-05", "2027-01-25"],
  ["2027-01-26", "2027-02-22"],
  ["2027-02-23", "2027-03-01"],
];

export function referenceProject(): Project {
  const resources: Resource[] = [];
  const tasks: Task[] = ROWS.map(([name, duration, cost], i) => {
    const id = `ref-${i + 1}`;
    const task: Task = {
      id,
      name,
      duration,
      outline: 0,
      percent: 0,
      predecessors: i ? [{ taskId: `ref-${i}`, type: "FS", lag: 0 }] : [],
    };
    if (cost > 0) {
      resources.push({ id: `res-${i + 1}`, name: `${name} ekibi`, maxUnits: 100, rate: cost / duration });
      task.assignments = [{ resourceId: `res-${i + 1}`, units: 100 }];
    }
    return task;
  });
  return { name: "Örnek Ev Yapım Projesi", start: "2026-11-02", tasks, holidays: turkishHolidays(2026, 2029), resources };
}
