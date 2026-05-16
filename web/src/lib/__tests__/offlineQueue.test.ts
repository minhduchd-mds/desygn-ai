/**
 * offlineQueue — unit tests with IndexedDB mock.
 * Focus: enqueue, dequeue, listQueued, incrementAttempts, flushQueue.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Minimal IndexedDB in-memory mock ──────────────────────────
// We build a simple synchronous IDB mock sufficient for our usage pattern.

type StoreData = Map<string, unknown>;

function makeIDBMock() {
  const stores: Record<string, StoreData> = { queue: new Map() };

  function makeRequest<T>(resultFn: () => T): IDBRequest<T> {
    const handlers: Record<string, ((...args: unknown[]) => void) | null> = {
      onsuccess: null, onerror: null,
    };
    const req = {
      get onsuccess() { return handlers.onsuccess; },
      set onsuccess(fn) { handlers.onsuccess = fn; if (fn) setTimeout(() => fn?.({ target: req }), 0); },
      get onerror() { return handlers.onerror; },
      set onerror(fn) { handlers.onerror = fn; },
      get result() { return resultFn(); },
      error: null,
    } as unknown as IDBRequest<T>;
    return req;
  }

  function makeStore(storeName: string, _mode: IDBTransactionMode): IDBObjectStore {
    const data = stores[storeName] ?? (stores[storeName] = new Map());
    return {
      add: (item: unknown) => {
        const key = (item as { id: string }).id;
        data.set(key, item);
        return makeRequest(() => key as unknown as undefined);
      },
      put: (item: unknown) => {
        const key = (item as { id: string }).id;
        data.set(key, item);
        return makeRequest(() => key as unknown as undefined);
      },
      delete: (key: unknown) => {
        data.delete(key as string);
        return makeRequest(() => undefined);
      },
      get: (key: unknown) => makeRequest(() => data.get(key as string) as undefined),
      getAll: () => makeRequest(() => [...data.values()] as unknown as undefined),
      count: () => makeRequest(() => data.size as unknown as undefined),
    } as unknown as IDBObjectStore;
  }

  function makeTx(storeName: string, mode: IDBTransactionMode) {
    const store = makeStore(storeName, mode);
    return {
      objectStore: () => store,
      oncomplete: null as ((() => void) | null),
      onerror: null as ((() => void) | null),
    };
  }

  const db = {
    transaction: (storeName: string, mode: IDBTransactionMode) => {
      const tx = makeTx(storeName, mode);
      setTimeout(() => tx.oncomplete?.(), 10);
      return tx;
    },
    close: () => {},
    objectStoreNames: { contains: () => true },
  } as unknown as IDBDatabase;

  const openReq = {
    result: db,
    onupgradeneeded: null,
    onsuccess: null as ((ev: unknown) => void) | null,
    onerror: null,
    error: null,
  };

  const idb = {
    open: () => {
      setTimeout(() => openReq.onsuccess?.({ target: openReq }), 0);
      return openReq as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return { idb, stores };
}

// ── Setup ──────────────────────────────────────────────────────

let mock: ReturnType<typeof makeIDBMock>;

beforeEach(async () => {
  mock = makeIDBMock();
  vi.stubGlobal("indexedDB", mock.idb);
  // Clear eventBus side effects
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Import after mock setup ────────────────────────────────────
// Dynamic import ensures the module picks up the stubbed indexedDB.

async function getQueue() {
  const mod = await import("../offlineQueue?t=" + Date.now());
  return mod;
}

describe("offlineQueue", () => {
  it("enqueue adds an item with id, queuedAt, attempts=0", async () => {
    const { enqueue, listQueued } = await getQueue();
    const id = await enqueue({ url: "/api/save", method: "POST", body: "{}", headers: {} });
    expect(typeof id).toBe("string");
    const items = await listQueued();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ url: "/api/save", attempts: 0 });
    expect(items[0].id).toBe(id);
  });

  it("dequeue removes the item", async () => {
    const { enqueue, dequeue, listQueued } = await getQueue();
    const id = await enqueue({ url: "/api/x", method: "POST", body: null, headers: {} });
    await dequeue(id);
    const items = await listQueued();
    expect(items).toHaveLength(0);
  });

  it("incrementAttempts increases attempt count", async () => {
    const { enqueue, incrementAttempts, listQueued } = await getQueue();
    const id = await enqueue({ url: "/api/x", method: "POST", body: null, headers: {} });
    await incrementAttempts(id);
    const items = await listQueued();
    expect(items[0].attempts).toBe(1);
  });

  it("listQueued returns items sorted oldest-first", async () => {
    const { enqueue, listQueued } = await getQueue();
    // Enqueue two items (timestamps differ by the mock's insertion order)
    await enqueue({ url: "/api/first", method: "POST", body: null, headers: {} });
    await enqueue({ url: "/api/second", method: "POST", body: null, headers: {} });
    const items = await listQueued();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].queuedAt).toBeLessThanOrEqual(items[1].queuedAt);
  });
});
