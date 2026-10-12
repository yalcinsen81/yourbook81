import { isValidDate, WorkCalendar } from "./calendar";
import { ancestorsOf, isSummaryAt, subtreeEnd } from "./outline";
import type { LinkType, Project, Schedule, ScheduledTask, Task } from "./types";

// Zamanlama motoru: kritik yol yöntemi (CPM).
// Hesap yalnızca yaprak (özet olmayan) görevler üzerinde yapılır. Özet görevin öncülleri tüm alt görevlerine,
// özet görevin kendisi öncül olduğunda ise tüm yaprak alt görevleri öncül sayılır. Özet görevin tarihleri
// alt görevlerinin en erken başlangıcı ve en geç bitişidir.

interface Edge {
  from: string;
  to: string;
  type: LinkType;
  lag: number;
}

export function schedule(project: Project): Schedule {
  const { tasks } = project;
  const cal = new WorkCalendar(
    isValidDate(project.start) ? project.start : "2026-01-05",
    (project.holidays ?? []).map((h) => h.date),
  );

  const summary = new Set<string>();
  const leavesOf = new Map<string, string[]>();
  tasks.forEach((t, i) => {
    if (isSummaryAt(tasks, i)) {
      summary.add(t.id);
      const end = subtreeEnd(tasks, i);
      const leaves: string[] = [];
      for (let j = i + 1; j < end; j++) if (!isSummaryAt(tasks, j)) leaves.push(tasks[j].id);
      leavesOf.set(t.id, leaves);
    }
  });
  const expand = (id: string) => (summary.has(id) ? leavesOf.get(id)! : [id]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const leaves = tasks.filter((t) => !summary.has(t.id));
  const dur = (id: string) => Math.max(0, Math.round(taskById.get(id)!.duration || 0));

  // Kenarları yapraklara aç; kendine dönen kenar doğrudan döngüdür
  const edges: Edge[] = [];
  const selfLoops = new Set<string>();
  for (const t of tasks) {
    for (const p of t.predecessors) {
      if (!taskById.has(p.taskId)) continue;
      for (const from of expand(p.taskId)) {
        for (const to of expand(t.id)) {
          if (from === to) selfLoops.add(from);
          else edges.push({ from, to, type: p.type, lag: Math.round(p.lag) || 0 });
        }
      }
    }
  }
  const incoming = new Map<string, Edge[]>(leaves.map((t) => [t.id, []]));
  const outgoing = new Map<string, Edge[]>(leaves.map((t) => [t.id, []]));
  for (const e of edges) {
    incoming.get(e.to)!.push(e);
    outgoing.get(e.from)!.push(e);
  }

  // Kahn ile topolojik sıra; sıraya giremeyenler döngüdedir
  const indeg = new Map(leaves.map((t) => [t.id, incoming.get(t.id)!.length]));
  const queue = leaves.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of outgoing.get(id)!) {
      const n = indeg.get(e.to)! - 1;
      indeg.set(e.to, n);
      if (n === 0) queue.push(e.to);
    }
  }
  const inOrder = new Set(order);
  const cycle = leaves.filter((t) => !inOrder.has(t.id)).map((t) => t.id);
  for (const id of selfLoops) if (!cycle.includes(id)) cycle.push(id);
  // Döngüdeki görevler yine de çizilsin diye sona eklenir
  for (const t of leaves) if (!inOrder.has(t.id)) order.push(t.id);

  // İleri geçiş: en erken başlangıç/bitiş
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const d = dur(id);
    const snet = taskById.get(id)!.startNoEarlierThan;
    let start = snet && isValidDate(snet) ? Math.max(0, cal.toOffset(snet)) : 0;
    for (const e of incoming.get(id)!) {
      const pes = es.get(e.from);
      const pef = ef.get(e.from);
      if (pes === undefined || pef === undefined) continue; // döngü
      switch (e.type) {
        case "FS": start = Math.max(start, pef + e.lag); break;
        case "SS": start = Math.max(start, pes + e.lag); break;
        case "FF": start = Math.max(start, pef + e.lag - d); break;
        case "SF": start = Math.max(start, pes + e.lag - d); break;
      }
    }
    es.set(id, start);
    ef.set(id, start + d);
  }

  let finish = 0;
  for (const id of order) finish = Math.max(finish, ef.get(id)!);

  // Geri geçiş: en geç başlangıç/bitiş
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const d = dur(id);
    let late = finish;
    for (const e of outgoing.get(id)!) {
      const sls = ls.get(e.to);
      const slf = lf.get(e.to);
      if (sls === undefined || slf === undefined) continue;
      switch (e.type) {
        case "FS": late = Math.min(late, sls - e.lag); break;
        case "SS": late = Math.min(late, sls - e.lag + d); break;
        case "FF": late = Math.min(late, slf - e.lag); break;
        case "SF": late = Math.min(late, slf - e.lag + d); break;
      }
    }
    lf.set(id, late);
    ls.set(id, late - d);
  }

  const toDates = (start: number, end: number) => {
    const startDate = cal.toDate(start);
    const finishDate = end > start ? cal.toDate(end - 1) : startDate;
    return { startDate, finishDate };
  };

  const rows: ScheduledTask[] = tasks.map((t, i) => {
    if (summary.has(t.id)) {
      const ids = leavesOf.get(t.id)!;
      const s = Math.min(...ids.map((id) => es.get(id)!));
      const f = Math.max(...ids.map((id) => ef.get(id)!));
      const slack = Math.min(...ids.map((id) => ls.get(id)! - es.get(id)!));
      return {
        id: t.id,
        row: i + 1,
        isSummary: true,
        isMilestone: false,
        es: s,
        ef: f,
        ls: Math.min(...ids.map((id) => ls.get(id)!)),
        lf: Math.max(...ids.map((id) => lf.get(id)!)),
        slack,
        critical: slack <= 0,
        duration: f - s,
        ...toDates(s, f),
      };
    }
    const s = es.get(t.id)!;
    const f = ef.get(t.id)!;
    const slack = ls.get(t.id)! - s;
    return {
      id: t.id,
      row: i + 1,
      isSummary: false,
      isMilestone: dur(t.id) === 0,
      es: s,
      ef: f,
      ls: ls.get(t.id)!,
      lf: lf.get(t.id)!,
      slack,
      critical: slack <= 0,
      duration: f - s,
      ...toDates(s, f),
    };
  });

  return {
    rows,
    byId: new Map(rows.map((r) => [r.id, r])),
    finish,
    finishDate: finish > 0 ? cal.toDate(finish - 1) : cal.base,
    calendar: cal,
    cycle,
  };
}

/** `predId` görevi `taskId`'nin öncülü yapılırsa döngü (ya da özet-alt görev bağı) oluşur mu? */
export function wouldCreateCycle(project: Project, taskId: string, predId: string): boolean {
  const anc = ancestorsOf(project.tasks);
  if ((anc.get(taskId) ?? []).includes(predId) || (anc.get(predId) ?? []).includes(taskId)) return true;
  const trial: Project = {
    ...project,
    tasks: project.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, predecessors: [...t.predecessors, { taskId: predId, type: "FS", lag: 0 }] } : t,
    ),
  };
  return schedule(trial).cycle.length > 0;
}
