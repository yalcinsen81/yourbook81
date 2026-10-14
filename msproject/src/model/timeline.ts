import { diffDays } from "./calendar";
import type { Project, Schedule } from "./types";

/** Zaman çizelgesi şeridindeki öğe (MS Project "Zaman çizelgesine ekle") */
export interface TimelineItem {
  id: string;
  name: string;
  start: string;
  finish: string;
  milestone: boolean;
  summary: boolean;
  /** 0'dan başlayan kulvar (üst üste binenler alt alta) */
  lane: number;
}

export interface TimelineData {
  items: TimelineItem[];
  lanes: number;
  /** Şeridin kapsadığı aralık: proje başı ile en geç bitiş arası (dahil) */
  from: string;
  to: string;
}

/**
 * Zaman çizelgesine işaretli görevleri kulvarlara yerleştirir (açgözlü: başlangıca göre sıralı,
 * önceki öğesi bitmiş ilk kulvar). Kulvar sayısı `maxLanes` ile sınırlıdır; sığmayan öğe en erken
 * boşalan kulvara biner. Etkisiz görevler çizelgede yer almaz.
 */
export function timelineItems(p: Project, s: Schedule, maxLanes = 3): TimelineData {
  const raw = p.tasks
    .map((task, i) => ({ task, r: s.rows[i] }))
    .filter(({ task, r }) => task.timeline && !task.inactive && r)
    .map(({ task, r }) => ({
      id: task.id,
      name: task.name,
      start: r.startDate,
      finish: r.isMilestone ? r.startDate : r.finishDate,
      milestone: r.isMilestone,
      summary: r.isSummary,
      lane: 0,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.finish < b.finish ? -1 : a.finish > b.finish ? 1 : 0));
  const ends: string[] = [];
  for (const it of raw) {
    let lane = ends.findIndex((e) => e < it.start);
    if (lane < 0 && ends.length < maxLanes) lane = ends.length;
    if (lane < 0) lane = ends.reduce((best, e, i) => (e < ends[best] ? i : best), 0);
    it.lane = lane;
    ends[lane] = ends[lane] && ends[lane] > it.finish ? ends[lane] : it.finish;
  }
  const from = [p.start, ...raw.map((x) => x.start)].reduce((a, b) => (b < a ? b : a));
  const to = [s.finishDate, ...raw.map((x) => x.finish)].reduce((a, b) => (b > a ? b : a));
  return { items: raw, lanes: Math.max(1, ends.length), from, to };
}

/** Tarihin şerit içindeki konumu (0–1); gün sonu dahil `end` için bir gün eklenir */
export function timelineFraction(d: TimelineData, iso: string, end = false): number {
  const span = diffDays(d.from, d.to) + 1;
  return Math.max(0, Math.min(1, (diffDays(d.from, iso) + (end ? 1 : 0)) / span));
}
