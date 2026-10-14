import { addDays, parseDate } from "./calendar";
import type { Task } from "./types";

/** Yinelenen görev kuralı: haftalık (haftanın günü, 0 = Pazar) ya da aylık (ayın günü) */
export type Recurrence = { kind: "weekly"; weekday: number; every: number } | { kind: "monthly"; day: number; every: number };

export const MAX_OCCURRENCES = 200;

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Kuralın [from, to] aralığına düşen tarihleri (ilk ve son gün dahil), en çok `max` tane.
 * Aylık kuralda ay o günü içermiyorsa ayın son günü alınır (31 → 30 Nisan, 28/29 Şubat).
 */
export function recurrenceDates(rule: Recurrence, from: string, to: string, max = MAX_OCCURRENCES): string[] {
  const out: string[] = [];
  if (from > to) return out;
  const every = Math.max(1, Math.floor(rule.every));
  if (rule.kind === "weekly") {
    const start = parseDate(from).getUTCDay();
    let d = addDays(from, (rule.weekday - start + 7) % 7);
    while (d <= to && out.length < max) {
      out.push(d);
      d = addDays(d, 7 * every);
    }
    return out;
  }
  const f = parseDate(from);
  let y = f.getUTCFullYear();
  let m = f.getUTCMonth();
  for (let guard = 0; guard < 2400 && out.length < max; guard++) {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const d = iso(y, m, Math.min(rule.day, last));
    if (d > to) break;
    if (d >= from) out.push(d);
    m += every;
    y += Math.floor(m / 12);
    m %= 12;
  }
  return out;
}

/**
 * Yinelenen görevi MS Project'teki gibi kurar: bir özet ve altında her tekrar için bir görev.
 * Her tekrar o tarihten önce başlamasın diye SNET kısıtı alır (motor değişmez, kısıtı zaten bilir).
 */
export function buildRecurringTasks(name: string, duration: number, dates: string[], outline: number, newId: () => string): Task[] {
  const summary: Task = { id: newId(), name, duration: 0, outline, percent: 0, predecessors: [] };
  const children: Task[] = dates.map((date, i) => ({
    id: newId(),
    name: `${name} ${i + 1}`,
    duration,
    outline: outline + 1,
    percent: 0,
    predecessors: [],
    constraint: { type: "SNET", date },
  }));
  return [summary, ...children];
}
