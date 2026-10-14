import { addDays, isValidDate, normalizeWorkdays, WorkCalendar } from "./calendar";
import { nonWorkingDates } from "./holidays";
import { ancestorsOf, isSummaryAt, subtreeEnd } from "./outline";
import type { LinkType, Project, Schedule, ScheduledTask, ScheduleIssue, Task } from "./types";

// Zamanlama motoru: kritik yol yöntemi (CPM).
// Hesap yalnızca yaprak (özet olmayan) görevler üzerinde yapılır. Özet görevin öncülleri tüm alt görevlerine,
// özet görevin kendisi öncül olduğunda ise tüm yaprak alt görevleri öncül sayılır. Özet görevin tarihleri
// alt görevlerinin en erken başlangıcı ve en geç bitişidir.
//
// Zaman ekseni tam sayı ofsetlerdir: proje takviminin ve kaynak takvimlerinin çalışılan günlerinin birleşimi
// (resmî tatiller herkes için kapalıdır). Her görevin her ofsette bir kapasitesi vardır: 1 tam gün, 0,5 arife
// (proje "yarım gün" seçeneğindeyse), 0 çalışmadığı gün (kaynağının çalışmadığı hafta günü, kaynak izni, göreve
// uygulanan çalışılamayan dönem). Görev, kapasiteleri toplamı süresine ulaşana kadar sürer. Kaynak takvimi ve
// yarım gün yoksa tüm kapasiteler 1'dir ve hesap klasik CPM ile birebir aynıdır.

interface Edge {
  from: string;
  to: string;
  type: LinkType;
  lag: number;
}

/** Bir takvimin ofset → kapasite işlevi */
type Cap = (offset: number) => number;

// Hiç çalışma günü olmayan takvimde sonsuz döngüye karşı sınır (≈ 55 yıl)
const LIMIT = 20_000;

/** `es`'ten başlayan, `dur` iş günü süren görevin bitiş ofseti (hariç) */
function finishFrom(cap: Cap, es: number, dur: number): number {
  if (dur <= 0) return es;
  let sum = 0;
  let o = es;
  while (sum < dur - 1e-9) {
    sum += cap(o++);
    if (o - es > LIMIT) return es + Math.ceil(dur);
  }
  return o;
}

/** `ef`'te (hariç) bitmesi için en geç başlangıç ofseti */
function startFor(cap: Cap, ef: number, dur: number): number {
  if (dur <= 0) return ef;
  let sum = 0;
  let o = ef;
  while (sum < dur - 1e-9) {
    sum += cap(--o);
    if (ef - o > LIMIT) return ef - Math.ceil(dur);
  }
  return o;
}

function nextWork(cap: Cap, o: number): number {
  for (let n = 0; n < LIMIT && cap(o) <= 0; n++) o++;
  return o;
}

function prevWork(cap: Cap, o: number): number {
  for (let n = 0; n < LIMIT && cap(o) <= 0; n++) o--;
  return o;
}

/** `[from, to)` aralığındaki kapasite toplamı */
function capSum(cap: Cap, from: number, to: number): number {
  let sum = 0;
  for (let o = from; o < to; o++) sum += cap(o);
  return sum;
}

const inRanges = (date: string, ranges: { from: string; to: string }[]) => ranges.some((r) => r.from <= date && date <= r.to);

export function schedule(project: Project): Schedule {
  const { tasks } = project;
  const projWeek = normalizeWorkdays(project.workdays);
  const resources = project.resources ?? [];
  const resById = new Map(resources.map((r) => [r.id, r]));
  // Zaman ekseni: proje ve kaynak takvimlerinin çalışılan hafta günlerinin birleşimi
  const union = new Set(projWeek);
  for (const r of resources) if (r.workdays && r.type !== "material") for (const d of normalizeWorkdays(r.workdays)) union.add(d);
  const cal = new WorkCalendar(
    isValidDate(project.start) ? project.start : "2026-01-05",
    nonWorkingDates(project.holidays ?? []),
    [...union],
  );
  const halfDays = new Set(project.halfDayMode === "half" ? (project.holidays ?? []).filter((h) => h.halfDay).map((h) => h.date) : []);
  const blackoutById = new Map((project.blackouts ?? []).map((b) => [b.id, b]));
  const issues: ScheduleIssue[] = [];

  // Görev takvimleri: aynı hafta + izin + dönem birleşimine sahip görevler aynı önbelleği paylaşır
  const caps = new Map<string, Cap>();
  const capOfTask = new Map<string, Cap>();
  const makeCap = (week: Set<number>, ranges: { from: string; to: string }[]): Cap => {
    const memo = new Map<number, number>();
    return (o) => {
      let v = memo.get(o);
      if (v === undefined) {
        const date = cal.toDate(o);
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        v = !week.has(dow) || (ranges.length && inRanges(date, ranges)) ? 0 : halfDays.has(date) ? 0.5 : 1;
        memo.set(o, v);
      }
      return v;
    };
  };
  const projectCap = makeCap(new Set(projWeek), []);
  const capFor = (t: Task): Cap => {
    // Görev, atanan tüm (malzeme dışı) kaynakların çalıştığı hafta günlerinde ilerler
    let week = projWeek;
    let first = true;
    const ranges: { from: string; to: string }[] = [];
    const keyParts: string[] = [];
    for (const a of t.assignments ?? []) {
      const r = resById.get(a.resourceId);
      if (!r || r.type === "material") continue;
      const own = new Set(r.workdays ? normalizeWorkdays(r.workdays) : projWeek);
      week = first ? [...own] : week.filter((d) => own.has(d));
      first = false;
      if (r.workdays) keyParts.push(`w${r.id}`);
      if (r.leaves?.length) {
        ranges.push(...r.leaves);
        keyParts.push(`l${r.id}`);
      }
    }
    for (const id of t.blackouts ?? []) {
      const b = blackoutById.get(id);
      if (b) {
        ranges.push(b);
        keyParts.push(`b${id}`);
      }
    }
    if (!keyParts.length) return projectCap;
    if (!week.length) {
      issues.push({ taskId: t.id, kind: "noWorkingTime" });
      week = projWeek;
    }
    const key = `${[...week].sort().join("")}|${keyParts.sort().join(",")}`;
    let cap = caps.get(key);
    if (!cap) caps.set(key, (cap = makeCap(new Set(week), ranges)));
    return cap;
  };

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
  for (const t of leaves) capOfTask.set(t.id, capFor(t));
  const capOf = (id: string) => capOfTask.get(id) ?? projectCap;

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
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
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
  const cyclePath = findCyclePath(cycle, selfLoops, outgoing);
  // Döngüdeki görevler yine de çizilsin diye sona eklenir
  for (const t of leaves) if (!inOrder.has(t.id)) order.push(t.id);

  const off = (date: string) => Math.max(0, cal.toOffset(date));
  /** Bitiş tarihinin (gün sonu) hariç ofseti */
  const offEnd = (date: string) => Math.max(0, cal.toOffset(addDays(date, 1)));
  const validDate = (d: string | undefined): d is string => !!d && isValidDate(d);

  // İleri geçiş: en erken başlangıç/bitiş
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const pinned = new Set<string>();
  // Kilometre taşı bir öncülün bitişine bağlıysa MS Project'teki gibi o günün sonunda gösterilir
  const endOfDay = new Set<string>();
  for (const id of order) {
    const task = taskById.get(id)!;
    const d = dur(id);
    const cap = capOf(id);
    let linkStart = 0;
    for (const e of incoming.get(id)!) {
      const pes = es.get(e.from);
      const pef = ef.get(e.from);
      if (pes === undefined || pef === undefined) continue; // döngü
      let s = 0;
      switch (e.type) {
        case "FS": s = pef + e.lag; break;
        case "SS": s = pes + e.lag; break;
        case "FF": s = startFor(cap, pef + e.lag, d); break;
        case "SF": s = startFor(cap, pes + e.lag, d); break;
      }
      linkStart = Math.max(linkStart, s);
    }
    let start = linkStart;
    const c = task.constraint;
    if (validDate(task.actualStart)) {
      // Başlamış görev gerçekleşen tarihine sabitlenir (bağımlılıklar artık onu itmez)
      start = cal.toOffset(task.actualStart);
      pinned.add(id);
    } else if (c && validDate(c.date)) {
      switch (c.type) {
        case "SNET": start = Math.max(start, off(c.date)); break;
        case "FNET": start = Math.max(start, startFor(cap, offEnd(c.date), d)); break;
        case "MSO":
        case "MFO": {
          const fixed = c.type === "MSO" ? off(c.date) : Math.max(0, startFor(cap, offEnd(c.date), d));
          if (linkStart > (d > 0 ? nextWork(cap, fixed) : fixed)) issues.push({ taskId: id, kind: "constraintLink" });
          start = fixed;
          pinned.add(id);
          break;
        }
      }
    }
    start = Math.max(start, pinned.has(id) ? -Infinity : 0);
    if (d > 0) {
      start = nextWork(cap, start);
      const delay = pinned.has(id) ? 0 : Math.max(0, Math.round(task.levelingDelay ?? 0));
      for (let k = 0; k < delay; k++) start = nextWork(cap, start + 1);
    }
    let finish = finishFrom(cap, start, d);
    if (validDate(task.actualStart) && validDate(task.actualFinish)) finish = Math.max(start + (d > 0 ? 1 : 0), offEnd(task.actualFinish));
    if (d === 0 && start > 0 && !pinned.has(id)) {
      const fromEnd = incoming.get(id)!.some((e) => {
        const pef = ef.get(e.from);
        return pef !== undefined && (e.type === "FS" || e.type === "FF") && pef + e.lag === start;
      });
      if (fromEnd) endOfDay.add(id);
    }
    es.set(id, start);
    ef.set(id, finish);
  }

  let finish = 0;
  for (const id of order) finish = Math.max(finish, ef.get(id)!);

  // ALAP: ardılları ve proje bitişini geciktirmeden olabildiğince geç (serbest bolluk kadar ileri)
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = taskById.get(id)!;
    if (task.constraint?.type !== "ALAP" || pinned.has(id) || cycle.includes(id)) continue;
    const d = dur(id);
    const cap = capOf(id);
    let bound = finish;
    for (const e of outgoing.get(id)!) {
      const ses = es.get(e.to)!;
      const sef = ef.get(e.to)!;
      switch (e.type) {
        case "FS": bound = Math.min(bound, ses - e.lag); break;
        case "FF": bound = Math.min(bound, sef - e.lag); break;
        case "SS": bound = Math.min(bound, d > 0 ? finishFrom(cap, prevWork(cap, ses - e.lag), d) : ses - e.lag); break;
        case "SF": bound = Math.min(bound, d > 0 ? finishFrom(cap, prevWork(cap, sef - e.lag), d) : sef - e.lag); break;
      }
    }
    if (validDate(task.deadline)) bound = Math.min(bound, offEnd(task.deadline));
    const newStart = d > 0 ? startFor(cap, snapFinish(cap, bound), d) : bound;
    if (newStart > es.get(id)!) {
      es.set(id, newStart);
      ef.set(id, finishFrom(cap, newStart, d));
      endOfDay.delete(id);
    }
  }

  // Geri geçiş: en geç başlangıç/bitiş
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = taskById.get(id)!;
    const d = dur(id);
    const cap = capOf(id);
    const finishForStart = (s: number) => (d > 0 ? finishFrom(cap, prevWork(cap, s), d) : s);
    let late = finish;
    for (const e of outgoing.get(id)!) {
      const sls = ls.get(e.to);
      const slf = lf.get(e.to);
      if (sls === undefined || slf === undefined) continue;
      switch (e.type) {
        case "FS": late = Math.min(late, sls - e.lag); break;
        case "SS": late = Math.min(late, finishForStart(sls - e.lag)); break;
        case "FF": late = Math.min(late, slf - e.lag); break;
        case "SF": late = Math.min(late, finishForStart(slf - e.lag)); break;
      }
    }
    const c = task.constraint;
    if (c && validDate(c.date)) {
      if (c.type === "FNLT") late = Math.min(late, offEnd(c.date));
      if (c.type === "SNLT") late = Math.min(late, finishForStart(off(c.date)));
    }
    if (validDate(task.deadline)) late = Math.min(late, offEnd(task.deadline));
    if (pinned.has(id)) late = Math.min(late, ef.get(id)!);
    const lateFinish = d > 0 ? snapFinish(cap, late) : late;
    lf.set(id, lateFinish);
    ls.set(id, d > 0 ? startFor(cap, lateFinish, d) : lateFinish);
  }

  const toDates = (start: number, end: number) => {
    const startDate = cal.toDate(start);
    const finishDate = end > start ? cal.toDate(end - 1) : startDate;
    return { startDate, finishDate };
  };
  /** Bolluk, görevin kendi takviminde iş günü olarak */
  const slackDays = (cap: Cap, a: number, b: number) => (b >= a ? capSum(cap, a, b) : -capSum(cap, b, a));

  const rows: ScheduledTask[] = tasks.map((t, i) => {
    if (summary.has(t.id)) {
      const ids = leavesOf.get(t.id)!;
      const s = Math.min(...ids.map((id) => es.get(id)!));
      const f = Math.max(...ids.map((id) => ef.get(id)!));
      const slack = Math.min(...ids.map((id) => slackDays(capOf(id), es.get(id)!, ls.get(id)!)));
      const weights = ids.map((id) => Math.max(dur(id), 0));
      const total = weights.reduce((a, b) => a + b, 0);
      const percent = total
        ? ids.reduce((sum, id, k) => sum + weights[k] * taskById.get(id)!.percent, 0) / total
        : ids.reduce((sum, id) => sum + taskById.get(id)!.percent, 0) / ids.length;
      return {
        id: t.id,
        row: i + 1,
        isSummary: true,
        isMilestone: false,
        atDayEnd: false,
        es: s,
        ef: f,
        ls: Math.min(...ids.map((id) => ls.get(id)!)),
        lf: Math.max(...ids.map((id) => lf.get(id)!)),
        slack,
        critical: ids.some((id) => ls.get(id)! - es.get(id)! <= 0),
        duration: capSum(projectCap, s, f),
        percent: Math.round(percent),
        ...toDates(s, f),
      };
    }
    const s = es.get(t.id)!;
    const f = ef.get(t.id)!;
    const atDayEnd = endOfDay.has(t.id);
    const dates = atDayEnd ? { startDate: cal.toDate(s - 1), finishDate: cal.toDate(s - 1) } : toDates(s, f);
    return {
      id: t.id,
      row: i + 1,
      isSummary: false,
      isMilestone: dur(t.id) === 0,
      atDayEnd,
      es: s,
      ef: f,
      ls: ls.get(t.id)!,
      lf: lf.get(t.id)!,
      slack: slackDays(capOf(t.id), s, ls.get(t.id)!),
      critical: ls.get(t.id)! - s <= 0,
      duration: dur(t.id),
      percent: t.percent,
      ...dates,
    };
  });

  // Tarih kısıtı ve son tarih uyarıları
  tasks.forEach((t, i) => {
    const r = rows[i];
    if (r.isSummary) return;
    const c = t.constraint;
    if (c?.type === "SNLT" && validDate(c.date) && r.startDate > c.date) issues.push({ taskId: t.id, kind: "startLate" });
    if (c?.type === "FNLT" && validDate(c.date) && r.finishDate > c.date) issues.push({ taskId: t.id, kind: "finishLate" });
    if (validDate(t.deadline) && r.finishDate > t.deadline) issues.push({ taskId: t.id, kind: "deadline" });
  });
  // Özet görevin son tarihi: alt görevlerinin en geç bitişiyle karşılaştırılır
  tasks.forEach((t, i) => {
    if (rows[i].isSummary && validDate(t.deadline) && rows[i].finishDate > t.deadline) issues.push({ taskId: t.id, kind: "deadline" });
  });

  return {
    rows,
    byId: new Map(rows.map((r) => [r.id, r])),
    finish,
    finishDate: finish > 0 ? cal.toDate(finish - 1) : cal.base,
    calendar: cal,
    cycle,
    cyclePath,
    issues,
    capacity: (id, from, to) => capSum(capOf(id), from, to),
    dayCapacity: (id, o) => capOf(id)(o),
  };
}

/** `late` (hariç) veya öncesinde, görevin çalıştığı bir günün sonunda biten en geç bitiş */
function snapFinish(cap: Cap, late: number): number {
  return prevWork(cap, late - 1) + 1;
}

/** Döngüdeki düğümlerden birinden başlayarak kapanan zinciri bulur: [a, b, c, a] */
function findCyclePath(cycle: string[], selfLoops: Set<string>, outgoing: Map<string, Edge[]>): string[] {
  if (!cycle.length) return [];
  const inCycle = new Set(cycle);
  const state = new Map<string, 1 | 2>(); // 1 = yığında, 2 = bitti
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const e of outgoing.get(id) ?? []) {
      if (!inCycle.has(e.to)) continue;
      const st = state.get(e.to);
      if (st === 1) return [...stack.slice(stack.indexOf(e.to)), e.to];
      if (st === undefined) {
        const found = visit(e.to);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of cycle) {
    if (state.has(id) || selfLoops.has(id)) continue;
    const found = visit(id);
    if (found) return found;
  }
  const self = [...selfLoops][0];
  return self ? [self, self] : [];
}

/** `predId` görevi `taskId`'nin öncülü yapılırsa döngü (ya da özet-alt görev bağı) oluşur mu? */
export function wouldCreateCycle(project: Project, taskId: string, predId: string): boolean {
  return cycleWith(project, taskId, predId) !== null;
}

/**
 * `predId` → `taskId` bağı eklenirse oluşan döngünün satır zinciri (ör. [3, 5, 7, 3]); döngü yoksa null.
 * Özet görev ile kendi alt görevi arasındaki bağ da döngüdür: [özet, alt] döner.
 */
export function cycleWith(project: Project, taskId: string, predId: string): number[] | null {
  const rowOf = (id: string) => project.tasks.findIndex((t) => t.id === id) + 1;
  const anc = ancestorsOf(project.tasks);
  if ((anc.get(taskId) ?? []).includes(predId)) return [rowOf(predId), rowOf(taskId)];
  if ((anc.get(predId) ?? []).includes(taskId)) return [rowOf(taskId), rowOf(predId)];
  if (predId === taskId) return [rowOf(taskId), rowOf(taskId)];
  const trial: Project = {
    ...project,
    tasks: project.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, predecessors: [...t.predecessors, { taskId: predId, type: "FS", lag: 0 }] } : t,
    ),
  };
  const s = schedule(trial);
  if (!s.cycle.length) return null;
  return s.cyclePath.map(rowOf);
}
