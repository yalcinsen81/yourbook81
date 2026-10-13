// Bağlı dosyanın tutamacı (FileSystemFileHandle) IndexedDB'de saklanır; uygulama yeniden açılınca aynı dosyaya bağlanılır.
// localStorage tutamacı saklayamaz, IndexedDB yapılandırılmış kopyalama ile saklar.

const DB = "msproject";
const STORE = "kv";
const KEY = "linkedFile";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadHandle<T>(): Promise<T | undefined> {
  try {
    return await run<T>("readonly", (s) => s.get(KEY));
  } catch {
    return undefined;
  }
}

export async function saveHandle(handle: unknown): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(handle, KEY));
  } catch {
    // Saklanamazsa yalnızca bu oturum için bağlı kalır
  }
}

// --- Son kullanılan dosyalar ---
// Her kayıtta dosyanın tutamacı (destekleyen tarayıcıda) ve son içeriğin kopyası tutulur: izin yoksa ya da dosya
// silinmişse kopya açılır.

const RECENTS = "recentFiles";
export const MAX_RECENTS = 10;

export interface RecentFile {
  name: string;
  /** Son açılış / kayıt (ISO) */
  at: string;
  projectName: string;
  /** Proje metni (son bilinen hali) */
  text: string;
  handle?: unknown;
}

export async function loadRecents(): Promise<RecentFile[]> {
  try {
    const list = await run<RecentFile[] | undefined>("readonly", (s) => s.get(RECENTS));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

type Comparable = { isSameEntry?: (other: unknown) => Promise<boolean> };

async function same(a: RecentFile, b: RecentFile): Promise<boolean> {
  const h = a.handle as Comparable | undefined;
  if (h?.isSameEntry && b.handle) {
    try {
      return await h.isSameEntry(b.handle);
    } catch {
      // karşılaştırılamadı: ada göre
    }
  }
  return !a.handle && !b.handle && a.name === b.name;
}

/** Listenin başına ekler (aynı dosya varsa yerini alır); en çok 10 kayıt */
export async function addRecent(entry: RecentFile): Promise<RecentFile[]> {
  try {
    const list = await loadRecents();
    const kept: RecentFile[] = [];
    for (const x of list) if (!(await same(x, entry))) kept.push(x);
    const next = [entry, ...kept].slice(0, MAX_RECENTS);
    await run("readwrite", (s) => s.put(next, RECENTS));
    return next;
  } catch {
    return [];
  }
}

export async function removeRecent(index: number): Promise<RecentFile[]> {
  try {
    const list = (await loadRecents()).filter((_, i) => i !== index);
    await run("readwrite", (s) => s.put(list, RECENTS));
    return list;
  } catch {
    return [];
  }
}

export async function clearHandle(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // yok say
  }
}
