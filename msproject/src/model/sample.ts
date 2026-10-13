import { turkishHolidays } from "./holidays";
import { parseAssignments } from "./resources";
import type { LinkType, Project, Resource, Task } from "./types";

// İlk açılışta gösterilen örnek proje: küçük bir konut inşaatı.

type Row = [name: string, duration: number, outline: number, preds?: string, percent?: number, resources?: string];

const RESOURCES: Resource[] = [
  { id: "kaynak-sef", name: "Şantiye şefi", maxUnits: 100, rate: 4500 },
  { id: "kaynak-makine", name: "İş makinesi", maxUnits: 100, rate: 12000 },
  { id: "kaynak-kaba", name: "Kaba inşaat ekibi", maxUnits: 300, rate: 7000 },
  { id: "kaynak-tesisat", name: "Tesisat ekibi", maxUnits: 100, rate: 6000 },
  { id: "kaynak-ince", name: "İnce iş ekibi", maxUnits: 300, rate: 5500 },
];

const ROWS: Row[] = [
  ["Proje başlangıcı", 0, 0, "", 100],
  ["Hazırlık", 0, 0],
  ["Ruhsat ve izinler", 10, 1, "1", 100, "Şantiye şefi[50%]"],
  ["Şantiye kurulumu", 5, 1, "3", 40, "Şantiye şefi; İş makinesi"],
  ["Kaba inşaat", 0, 0, "2"],
  ["Hafriyat", 6, 1, "", 0, "İş makinesi; Şantiye şefi[50%]"],
  ["Temel", 10, 1, "6", 0, "Kaba inşaat ekibi[200%]; Şantiye şefi[50%]"],
  ["Bodrum perdeleri", 8, 1, "7", 0, "Kaba inşaat ekibi[200%]"],
  ["Kat betonları", 20, 1, "8", 0, "Kaba inşaat ekibi[300%]; Şantiye şefi[50%]"],
  ["Çatı", 8, 1, "9", 0, "Kaba inşaat ekibi[200%]"],
  ["Kaba inşaat tamamlandı", 0, 1, "10"],
  ["İnce işler", 0, 0],
  ["Elektrik tesisatı", 15, 1, "9SS+5", 0, "Tesisat ekibi"],
  ["Mekanik tesisat", 15, 1, "9SS+5", 0, "Tesisat ekibi"],
  ["Sıva", 12, 1, "13;14", 0, "İnce iş ekibi[200%]"],
  ["Boya", 8, 1, "15", 0, "İnce iş ekibi"],
  ["Doğrama", 6, 1, "10", 0, "İnce iş ekibi"],
  ["Teslim", 0, 0, "16;17"],
];

export function sampleProject(start: string): Project {
  const ids = ROWS.map((_, i) => `ornek-${i + 1}`);
  const tasks: Task[] = ROWS.map(([name, duration, outline, preds = "", percent = 0, res = ""], i) => ({
    id: ids[i],
    name,
    duration,
    outline,
    percent,
    predecessors: preds
      .split(";")
      .filter(Boolean)
      .map((p) => {
        const m = /^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/.exec(p)!;
        return { taskId: ids[Number(m[1]) - 1], type: (m[2] ?? "FS") as LinkType, lag: Number(m[3] ?? 0) };
      }),
    ...(res ? { assignments: parseAssignments(res, RESOURCES).assignments } : {}),
  }));
  return { name: "Örnek: Konut İnşaatı", start, tasks, holidays: defaultHolidays(start), resources: RESOURCES.map((r) => ({ ...r })) };
}

export function emptyProject(start: string): Project {
  return { name: "Yeni Proje", start, tasks: [], holidays: defaultHolidays(start), resources: [] };
}

/** Proje başlangıç yılından itibaren 4 yılın Türkiye resmî tatilleri */
export function defaultHolidays(start: string) {
  const y = Number(start.slice(0, 4));
  return turkishHolidays(y, y + 3);
}
