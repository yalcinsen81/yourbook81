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
