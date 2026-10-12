import type { LinkType, Project, Task } from "./types";

// İlk açılışta gösterilen örnek proje: küçük bir konut inşaatı.

type Row = [name: string, duration: number, outline: number, preds?: string, percent?: number];

const ROWS: Row[] = [
  ["Proje başlangıcı", 0, 0, "", 100],
  ["Hazırlık", 0, 0],
  ["Ruhsat ve izinler", 10, 1, "1", 100],
  ["Şantiye kurulumu", 5, 1, "3", 40],
  ["Kaba inşaat", 0, 0, "2"],
  ["Hafriyat", 6, 1],
  ["Temel", 10, 1, "6"],
  ["Bodrum perdeleri", 8, 1, "7"],
  ["Kat betonları", 20, 1, "8"],
  ["Çatı", 8, 1, "9"],
  ["Kaba inşaat tamamlandı", 0, 1, "10"],
  ["İnce işler", 0, 0],
  ["Elektrik tesisatı", 15, 1, "9SS+5"],
  ["Mekanik tesisat", 15, 1, "9SS+5"],
  ["Sıva", 12, 1, "13;14"],
  ["Boya", 8, 1, "15"],
  ["Doğrama", 6, 1, "10"],
  ["Teslim", 0, 0, "16;17"],
];

export function sampleProject(start: string): Project {
  const ids = ROWS.map((_, i) => `ornek-${i + 1}`);
  const tasks: Task[] = ROWS.map(([name, duration, outline, preds = "", percent = 0], i) => ({
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
  }));
  return { name: "Örnek: Konut İnşaatı", start, tasks };
}

export function emptyProject(start: string): Project {
  return { name: "Yeni Proje", start, tasks: [] };
}
