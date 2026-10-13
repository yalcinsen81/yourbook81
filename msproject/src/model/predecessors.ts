import { t } from "../i18n";
import type { LinkType, Predecessor, Task } from "./types";

// Öncül sütunu metni MS Project'teki gibi satır numarasıyla yazılır: "2", "3SS", "4FS+2g" (EN: "4FS+2d"), "5FF-1g". Gecikme birimi g/d/gün/days kabul edilir.
// Türkçe kısaltmalar da kabul edilir: BB (Bitiş-Başlangıç), BşBş (Başlangıç-Başlangıç), BtBt, BşBt.

const TYPE_ALIASES: Record<string, LinkType> = {
  FS: "FS",
  SS: "SS",
  FF: "FF",
  SF: "SF",
  BB: "FS",
  BŞBŞ: "SS",
  BTBT: "FF",
  BŞBT: "SF",
};

export interface ParseResult {
  predecessors: Predecessor[];
  /** Anlaşılamayan parçalar; boşsa metin geçerlidir. */
  errors: string[];
}

export function parsePredecessors(text: string, tasks: Task[], selfId: string): ParseResult {
  const predecessors: Predecessor[] = [];
  const errors: string[] = [];
  const parts = text
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const m = /^(\d+)\s*([A-Za-zÇçĞğİıÖöŞşÜü]{2,4})?\s*(?:([+-])\s*(\d+)\s*(?:gün|gun|days?|g|d)?)?$/i.exec(part);
    if (!m) {
      errors.push(part);
      continue;
    }
    const row = Number(m[1]);
    const task = tasks[row - 1];
    if (!task || task.id === selfId) {
      errors.push(part);
      continue;
    }
    let type: LinkType = "FS";
    if (m[2]) {
      const key = m[2].toLocaleUpperCase("tr-TR");
      const lt = TYPE_ALIASES[key];
      if (!lt) {
        errors.push(part);
        continue;
      }
      type = lt;
    }
    const lag = m[3] ? (m[3] === "-" ? -1 : 1) * Number(m[4]) : 0;
    // Aynı öncül iki kez yazılırsa sonuncusu geçerli
    const existing = predecessors.findIndex((p) => p.taskId === task.id);
    if (existing >= 0) predecessors.splice(existing, 1);
    predecessors.push({ taskId: task.id, type, lag });
  }
  return { predecessors, errors };
}

export function formatPredecessors(preds: Predecessor[], tasks: Task[]): string {
  const rowOf = new Map(tasks.map((t, i) => [t.id, i + 1]));
  return preds
    .filter((p) => rowOf.has(p.taskId))
    .map((p) => {
      const row = rowOf.get(p.taskId)!;
      if (p.type === "FS" && p.lag === 0) return String(row);
      const lag = p.lag === 0 ? "" : `${p.lag > 0 ? "+" : "-"}${Math.abs(p.lag)}${t("unit.dayLetter")}`;
      return `${row}${p.type}${lag}`;
    })
    .join(";");
}
