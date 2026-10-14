import type { Task } from "./types";

// Görev ağacı düz bir dizi + girinti düzeyiyle tutulur (MS Project'teki gibi).

export function isSummaryAt(tasks: Task[], index: number): boolean {
  const next = tasks[index + 1];
  return !!next && next.outline > tasks[index].outline;
}

/** `index`'teki görevin alt ağacının bittiği yer (hariç). */
export function subtreeEnd(tasks: Task[], index: number): number {
  const level = tasks[index].outline;
  let end = index + 1;
  while (end < tasks.length && tasks[end].outline > level) end++;
  return end;
}

/** Her görevin üst (özet) görevlerinin kimlikleri, en yakından en uzağa. */
export function ancestorsOf(tasks: Task[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const stack: Task[] = [];
  for (const task of tasks) {
    while (stack.length && stack[stack.length - 1].outline >= task.outline) stack.pop();
    result.set(task.id, stack.map((t) => t.id).reverse());
    stack.push(task);
  }
  return result;
}

/** Girintiler tutarlı olsun: ilk satır 0, her satır öncekinden en çok bir düzey derin. */
export function normalizeOutline(tasks: Task[]): Task[] {
  let prev = -1;
  return tasks.map((t) => {
    const outline = Math.max(0, Math.min(t.outline, prev + 1));
    prev = outline;
    return outline === t.outline ? t : { ...t, outline };
  });
}

/** Seçili görevi (alt ağacıyla birlikte) bir düzey içeri alır. */
export function indent(tasks: Task[], index: number): Task[] {
  if (index <= 0) return tasks;
  if (tasks[index].outline > tasks[index - 1].outline) return tasks;
  const end = subtreeEnd(tasks, index);
  return tasks.map((t, i) => (i >= index && i < end ? { ...t, outline: t.outline + 1 } : t));
}

/** Seçili görevi (alt ağacıyla birlikte) bir düzey dışarı alır. */
export function outdent(tasks: Task[], index: number): Task[] {
  if (tasks[index].outline === 0) return tasks;
  const end = subtreeEnd(tasks, index);
  return tasks.map((t, i) => (i >= index && i < end ? { ...t, outline: t.outline - 1 } : t));
}

/** Görevi alt ağacıyla birlikte aynı düzeydeki komşusunun önüne/arkasına taşır. */
export function move(tasks: Task[], index: number, dir: -1 | 1): Task[] {
  const level = tasks[index].outline;
  const end = subtreeEnd(tasks, index);
  const block = tasks.slice(index, end);
  if (dir === -1) {
    // Önceki kardeşi bul
    let prev = index - 1;
    while (prev >= 0 && tasks[prev].outline > level) prev--;
    if (prev < 0 || tasks[prev].outline < level) return tasks;
    return [...tasks.slice(0, prev), ...block, ...tasks.slice(prev, index), ...tasks.slice(end)];
  }
  if (end >= tasks.length || tasks[end].outline < level) return tasks;
  const nextEnd = subtreeEnd(tasks, end);
  return [...tasks.slice(0, index), ...tasks.slice(end, nextEnd), ...block, ...tasks.slice(nextEnd)];
}

/** WBS numaraları: 1, 1.1, 1.2, 2 ... */
export function wbsCodes(tasks: Task[]): string[] {
  const counters: number[] = [];
  return tasks.map((t) => {
    counters.length = t.outline + 1;
    counters[t.outline] = (counters[t.outline] ?? 0) + 1;
    for (let i = 0; i < t.outline; i++) counters[i] = counters[i] ?? 1;
    return counters.join(".");
  });
}

/** Görev kendi özetine (ya da özet kendi alt görevine) bağlı kaldıysa o bağ kopar (girinti/taşıma sonrası) */
export function dropAncestorLinks(tasks: Task[]): Task[] {
  const anc = ancestorsOf(tasks);
  return tasks.map((t) => {
    const mine = new Set(anc.get(t.id));
    const kept = t.predecessors.filter((pr) => !mine.has(pr.taskId) && !(anc.get(pr.taskId) ?? []).includes(t.id));
    return kept.length === t.predecessors.length ? t : { ...t, predecessors: kept };
  });
}

/** Seçili satırları alt ağaçlarıyla birlikte topla (sıralı, tekrarsız indeksler) */
export function blockIndexes(tasks: Task[], indexes: number[]): number[] {
  const out = new Set<number>();
  for (const i of [...indexes].sort((a, b) => a - b)) {
    if (i < 0 || i >= tasks.length || out.has(i)) continue;
    for (let j = i; j < subtreeEnd(tasks, i); j++) out.add(j);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Satırların kopyası (alt ağaçlarıyla): yeni kimlik alır; kopyalanan satırlar arasındaki bağlar yeni kimliklere
 * taşınır, dışarıdaki görevlere olan bağlar korunur. Girintiler en üstteki kopya 0 olacak şekilde göreli tutulur.
 */
export function cloneRows(tasks: Task[], indexes: number[], newId: () => string): Task[] {
  const rows = blockIndexes(tasks, indexes).map((i) => tasks[i]);
  if (!rows.length) return [];
  const map = new Map(rows.map((t) => [t.id, newId()]));
  const base = Math.min(...rows.map((t) => t.outline));
  return rows.map((t) => ({
    ...structuredClone(t),
    id: map.get(t.id)!,
    outline: t.outline - base,
    predecessors: t.predecessors.map((p) => ({ ...p, taskId: map.get(p.taskId) ?? p.taskId })),
  }));
}

/**
 * Kopyalanmış satırları `at` konumuna, `level` girintisinde ekler. Var olmayan görevlere giden bağlar atılır;
 * girintiler tutarlı hâle getirilir.
 */
export function insertRows(tasks: Task[], at: number, rows: Task[], level: number): Task[] {
  const placed = rows.map((t) => ({ ...t, outline: t.outline + level }));
  const next = [...tasks.slice(0, at), ...placed, ...tasks.slice(at)];
  const ids = new Set(next.map((t) => t.id));
  const cleaned = next.map((t) =>
    t.predecessors.every((p) => ids.has(p.taskId)) ? t : { ...t, predecessors: t.predecessors.filter((p) => ids.has(p.taskId)) },
  );
  return dropAncestorLinks(normalizeOutline(cleaned));
}

/**
 * Sürükle-bırak: `from` satırını alt ağacıyla birlikte `to` satırının önüne taşır ve hedefin girintisini alır
 * (`to` = tasks.length sona taşır, son satırın girintisini alır). Kendi alt ağacının içine bırakılamaz.
 */
export function moveBlockTo(tasks: Task[], from: number, to: number): Task[] {
  if (from < 0 || from >= tasks.length || to < 0 || to > tasks.length) return tasks;
  const end = subtreeEnd(tasks, from);
  if (to >= from && to <= end) return tasks;
  const block = tasks.slice(from, end);
  const rest = [...tasks.slice(0, from), ...tasks.slice(end)];
  const target = to > from ? to - block.length : to;
  const level = target < rest.length ? rest[target].outline : rest.length ? rest[rest.length - 1].outline : 0;
  const delta = level - block[0].outline;
  const moved = block.map((t) => ({ ...t, outline: Math.max(0, t.outline + delta) }));
  return dropAncestorLinks(normalizeOutline([...rest.slice(0, target), ...moved, ...rest.slice(target)]));
}

/** Seçimdeki en üst satırlar: başka bir seçili satırın alt ağacında olmayanlar (sıralı) */
export function rootIndexes(tasks: Task[], indexes: number[]): number[] {
  const sorted = [...new Set(indexes)].filter((i) => i >= 0 && i < tasks.length).sort((a, b) => a - b);
  const roots: number[] = [];
  for (const i of sorted) {
    const last = roots[roots.length - 1];
    if (last !== undefined && i < subtreeEnd(tasks, last)) continue;
    roots.push(i);
  }
  return roots;
}

/**
 * Seçili satırları (alt ağaçlarıyla) yeni bir özet görevin altına alır: özet ilk seçili satırın yerine ve düzeyine
 * girer, seçilenler sırasıyla onun alt görevleri olur. Kendi özetine bağlı kalan bağlar kopar.
 */
export function groupUnderSummary(tasks: Task[], indexes: number[], summary: Task): Task[] {
  const roots = rootIndexes(tasks, indexes);
  if (!roots.length) return tasks;
  const level = tasks[roots[0]].outline;
  const moving = new Set<number>();
  const blocks: Task[] = [];
  for (const r of roots) {
    const end = subtreeEnd(tasks, r);
    const delta = level + 1 - tasks[r].outline;
    for (let j = r; j < end; j++) {
      moving.add(j);
      blocks.push({ ...tasks[j], outline: Math.max(0, tasks[j].outline + delta) });
    }
  }
  const at = roots[0];
  const before = tasks.slice(0, at).filter((_, j) => !moving.has(j));
  const after = tasks.slice(at).filter((_, j) => !moving.has(j + at));
  return dropAncestorLinks(normalizeOutline([...before, { ...summary, outline: level }, ...blocks, ...after]));
}

/**
 * Özeti çözer: özet satırı silinir, alt görevleri bir düzey dışarı çıkar. Özete giden ya da özetten çıkan bağlar
 * kalkar (kaç bağ kalktığı döner).
 */
export function ungroupSummary(tasks: Task[], index: number): { tasks: Task[]; droppedLinks: number } {
  if (index < 0 || index >= tasks.length || !isSummaryAt(tasks, index)) return { tasks, droppedLinks: 0 };
  const id = tasks[index].id;
  const end = subtreeEnd(tasks, index);
  let dropped = tasks[index].predecessors.length;
  const next = tasks
    .filter((_, j) => j !== index)
    .map((t, j) => {
      const orig = j < index ? j : j + 1;
      const outline = orig > index && orig < end ? Math.max(0, t.outline - 1) : t.outline;
      const preds = t.predecessors.filter((p) => p.taskId !== id);
      dropped += t.predecessors.length - preds.length;
      return outline === t.outline && preds.length === t.predecessors.length ? t : { ...t, outline, predecessors: preds };
    });
  return { tasks: normalizeOutline(next), droppedLinks: dropped };
}

/** "Seviye n'e kadar göster": n. düzeyden derin satırları gizlemek için kapatılacak özetler (n ≥ 1) */
export function summariesToCollapse(tasks: Task[], level: number): string[] {
  return tasks.filter((t, i) => isSummaryAt(tasks, i) && t.outline >= level - 1).map((t) => t.id);
}

/** Proje anahattının en derin düzeyi (1'den başlar) */
export function outlineDepth(tasks: Task[]): number {
  return tasks.reduce((m, t) => Math.max(m, t.outline + 1), 0);
}

/**
 * Sürükle-bırak (çoklu): seçili satırlar alt ağaçlarıyla birlikte `to` satırının önüne (`to` = tasks.length: sona)
 * taşınır. `level` verilmezse hedef satırın girintisi alınır; verilirse 0 ile üstteki satırın bir altı arasında
 * sınırlanır (sağa sürükleyince alt görev olur). Taşınan bloklar kendi içlerindeki göreli girintiyi korur.
 * Bir bloğun kendi içine bırakılamaz (dizi aynen döner).
 */
export function moveRowsTo(tasks: Task[], indexes: number[], to: number, level?: number): Task[] {
  const roots = rootIndexes(tasks, indexes);
  if (!roots.length || to < 0 || to > tasks.length) return tasks;
  const moving = new Set<number>();
  for (const r of roots) for (let j = r; j < subtreeEnd(tasks, r); j++) moving.add(j);
  // Hedef taşınan bir bloğun içindeyse (ilk satırı hariç: kendi yerine bırakmak girinti değişikliği olabilir)
  if (moving.has(to) && !roots.includes(to)) return tasks;
  const rest = tasks.filter((_, j) => !moving.has(j));
  // Hedef: `to`dan sonraki ilk taşınmayan satır
  let target = 0;
  for (let j = 0; j < to; j++) if (!moving.has(j)) target++;
  const prev = target > 0 ? rest[target - 1].outline : -1;
  const def = target < rest.length ? rest[target].outline : Math.max(0, prev);
  const lvl = Math.max(0, Math.min(level ?? def, prev + 1));
  const blocks: Task[] = [];
  for (const r of roots) {
    const delta = lvl - tasks[r].outline;
    for (let j = r; j < subtreeEnd(tasks, r); j++) blocks.push({ ...tasks[j], outline: Math.max(0, tasks[j].outline + delta) });
  }
  const next = [...rest.slice(0, target), ...blocks, ...rest.slice(target)];
  const same = next.every((t, i) => t.id === tasks[i].id && t.outline === tasks[i].outline);
  return same ? tasks : dropAncestorLinks(normalizeOutline(next));
}
