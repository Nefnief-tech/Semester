"use client";

/**
 * EPUB file blobs live in IndexedDB — they are far too big for localStorage
 * and, like everything in Semester, they stay on this device (the cloud sync
 * carries the small stuff: metadata, position, highlights).
 */

const DB_NAME = "semester-books";
const STORE = "files";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function putBookFile(id: string, blob: Blob): Promise<void> {
  await withStore("readwrite", (store) => store.put(blob, id));
}

export async function getBookFile(id: string): Promise<Blob | undefined> {
  return withStore<Blob | undefined>("readonly", (store) => store.get(id) as IDBRequest<Blob | undefined>);
}

export async function deleteBookFile(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
