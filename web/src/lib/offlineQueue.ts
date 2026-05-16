/**
 * offlineQueue — IndexedDB-backed request queue for offline support.
 *
 * When a POST fails due to network loss the caller can enqueue it here.
 * When connectivity is restored (navigator "online" event) the queue is
 * flushed automatically and results are reported via the eventBus.
 *
 * Design goals:
 *  - Works in all modern browsers (IndexedDB Level 2)
 *  - Survives page reload (persisted in IDB)
 *  - Dead-letter protection: items with attempts >= MAX_ATTEMPTS are kept
 *    but never retried (caller must inspect and clean up)
 */

import { eventBus } from "./eventBus";

const DB_NAME = "designready-offline-v1";
const DB_VERSION = 1;
const STORE = "queue";
const MAX_ATTEMPTS = 5;

// ── Types ─────────────────────────────────────────────────────

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  queuedAt: number;
  attempts: number;
}

// ── IDB helpers ───────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API ────────────────────────────────────────────────

/**
 * Add a request to the offline queue.
 * Returns the generated queue item ID.
 */
export async function enqueue(
  item: Omit<QueuedRequest, "id" | "queuedAt" | "attempts">,
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: QueuedRequest = { ...item, id, queuedAt: Date.now(), attempts: 0 };
  await idbRun("readwrite", (s) => s.add(record));
  eventBus.emit("offline:queued", { requestId: id, url: item.url });
  return id;
}

/** Remove a specific item (called after successful replay). */
export async function dequeue(id: string): Promise<void> {
  await idbRun("readwrite", (s) => s.delete(id));
}

/** All queued items, sorted oldest-first. */
export async function listQueued(): Promise<QueuedRequest[]> {
  const db = await openDB();
  return new Promise<QueuedRequest[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as QueuedRequest[]).sort((a, b) => a.queuedAt - b.queuedAt),
      );
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Count of queued items (badge display etc.). */
export async function queueSize(): Promise<number> {
  return idbRun<number>("readonly", (s) => s.count());
}

/** Increment the attempt counter for a given item. */
export async function incrementAttempts(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      const item = get.result as QueuedRequest | undefined;
      if (!item) { resolve(); return; }
      store.put({ ...item, attempts: item.attempts + 1 });
      resolve();
    };
    get.onerror = () => reject(get.error);
    tx.oncomplete = () => db.close();
  });
}

/** Remove all dead-letter items (attempts >= MAX_ATTEMPTS). */
export async function clearDeadLetters(): Promise<number> {
  const items = await listQueued();
  const dead = items.filter((i) => i.attempts >= MAX_ATTEMPTS);
  await Promise.all(dead.map((i) => dequeue(i.id)));
  return dead.length;
}

/**
 * Replay all eligible queued requests.
 * Skips dead-letter items (>= MAX_ATTEMPTS).
 * Returns counts of successes and failures.
 */
export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const items = await listQueued();
  const eligible = items.filter((i) => i.attempts < MAX_ATTEMPTS);
  let success = 0;
  let failed = 0;

  for (const item of eligible) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (res.ok) {
        await dequeue(item.id);
        success++;
      } else {
        await incrementAttempts(item.id);
        failed++;
      }
    } catch {
      await incrementAttempts(item.id);
      failed++;
    }
  }

  eventBus.emit("offline:flushed", { success, failed });
  return { success, failed };
}

/**
 * Watch the browser "online" event and auto-flush the queue.
 * Returns a cleanup function to remove the listener.
 */
export function watchOnline(): () => void {
  const handler = () => {
    void flushQueue();
    eventBus.emit("online:restored");
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
