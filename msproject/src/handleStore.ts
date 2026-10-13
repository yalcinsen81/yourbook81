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

export async function clearHandle(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // yok say
  }
}
