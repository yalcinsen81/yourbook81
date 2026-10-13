// Geri al / yinele geçmişi (saf). Projeyi değiştiren her işlem `push` ile eklenir; sınırı aşan en eski adım düşer.

export const HISTORY_LIMIT = 100;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Yeni durum: aynı nesneyse geçmiş değişmez; yinele listesi temizlenir */
export function push<T>(h: History<T>, next: T, limit = HISTORY_LIMIT): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past.slice(-(limit - 1)), h.present], present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
