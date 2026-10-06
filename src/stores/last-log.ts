// Dev-only: keeps the last loaded log in IndexedDB so Vite reloads reopen it.
const DB_NAME = "guacalyzer-dev";
const STORE = "logs";
const KEY = "last";

export interface StoredLog {
  name: string;
  text: string;
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = op(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveLastLog(log: StoredLog) {
  try {
    await run("readwrite", (store) => store.put(log, KEY));
  } catch (err) {
    console.warn("could not store last log", err);
  }
}

export async function readLastLog() {
  try {
    return await run<StoredLog | undefined>("readonly", (store) =>
      store.get(KEY),
    );
  } catch (err) {
    console.warn("could not read last log", err);
    return undefined;
  }
}
