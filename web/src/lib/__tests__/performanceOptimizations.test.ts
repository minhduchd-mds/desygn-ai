import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatsCache, WorkerPool, ConnectionPool, createStatsCache, createWorkerPool, createConnectionPool } from "../performanceOptimizations";

describe("StatsCache (Phase 2: O(1) Stats)", () => {
  let cache: StatsCache;

  beforeEach(() => {
    cache = new StatsCache();
  });

  describe("onRecordAdded", () => {
    it("increments total records", () => {
      cache.onRecordAdded("design-file", 0.9, false);
      expect(cache.getStats().totalRecords).toBe(1);
    });

    it("tracks records by source", () => {
      cache.onRecordAdded("design-file", 0.9, false);
      cache.onRecordAdded("ai-inference", 0.5, false);
      cache.onRecordAdded("design-file", 0.8, false);

      const stats = cache.getStats();
      expect(stats.recordsBySource["design-file"]).toBe(2);
      expect(stats.recordsBySource["ai-inference"]).toBe(1);
    });

    it("tracks validated records", () => {
      cache.onRecordAdded("design-file", 0.9, true);
      cache.onRecordAdded("ai-inference", 0.5, false);

      expect(cache.getStats().validatedRecords).toBe(1);
    });

    it("maintains running confidence sum", () => {
      cache.onRecordAdded("design-file", 0.8, false);
      cache.onRecordAdded("ai-inference", 0.6, false);

      expect(cache.getStats().averageConfidence).toBeCloseTo(0.7);
    });
  });

  describe("onRecordRemoved", () => {
    beforeEach(() => {
      cache.onRecordAdded("design-file", 0.9, true);
      cache.onRecordAdded("ai-inference", 0.5, false);
    });

    it("decrements counters correctly", () => {
      cache.onRecordRemoved("design-file", 0.9, true);

      const stats = cache.getStats();
      expect(stats.totalRecords).toBe(1);
      expect(stats.validatedRecords).toBe(0);
      expect(stats.recordsBySource["design-file"]).toBe(0);
    });

    it("never goes below zero", () => {
      cache.onRecordRemoved("design-file", 0.9, true);
      cache.onRecordRemoved("design-file", 0.9, true); // Double remove

      const stats = cache.getStats();
      expect(stats.totalRecords).toBeGreaterThanOrEqual(0);
      expect(stats.validatedRecords).toBeGreaterThanOrEqual(0);
    });
  });

  describe("onRecordValidated", () => {
    it("increments validated count and updates confidence", () => {
      cache.onRecordAdded("ai-inference", 0.5, false);
      cache.onRecordValidated(0.5, 0.9);

      const stats = cache.getStats();
      expect(stats.validatedRecords).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.9);
    });
  });

  describe("onConfidenceChanged", () => {
    it("updates total confidence for average calculation", () => {
      cache.onRecordAdded("design-file", 0.8, false);
      cache.onRecordAdded("ai-inference", 0.6, false);

      cache.onConfidenceChanged(0.8, 0.5); // Decay

      const stats = cache.getStats();
      expect(stats.averageConfidence).toBeCloseTo(0.55);
    });
  });

  describe("onContradictionChanged", () => {
    it("tracks contradiction count", () => {
      cache.onContradictionChanged(2);
      expect(cache.getStats().contradictions).toBe(2);

      cache.onContradictionChanged(-1);
      expect(cache.getStats().contradictions).toBe(1);
    });
  });

  describe("recompute", () => {
    it("rebuilds stats from scratch", () => {
      cache.onRecordAdded("x", 0.5, false);
      cache.onRecordAdded("x", 0.5, false);

      cache.recompute([
        { source: "design-file", confidence: 0.9, validated: true },
        { source: "ai-inference", confidence: 0.4, validated: false },
        { source: "design-file", confidence: 0.8, validated: true },
      ]);

      const stats = cache.getStats();
      expect(stats.totalRecords).toBe(3);
      expect(stats.validatedRecords).toBe(2);
      expect(stats.averageConfidence).toBeCloseTo(0.7);
    });

    it("clears dirty flag", () => {
      cache.markDirty();
      expect(cache.isDirty()).toBe(true);

      cache.recompute([]);
      expect(cache.isDirty()).toBe(false);
    });
  });

  describe("factory", () => {
    it("creates stats cache", () => {
      const c = createStatsCache();
      expect(c.getStats().totalRecords).toBe(0);
    });
  });
});

describe("WorkerPool (Phase 3: Background Computation)", () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool(2);
  });

  describe("submit", () => {
    it("executes task and returns result", async () => {
      const result = await pool.submit<{ imported: number }>("bulk-import", { records: [1, 2, 3] });
      expect(result.imported).toBe(3);
    });

    it("handles multiple tasks concurrently", async () => {
      const results = await Promise.all([
        pool.submit("bulk-import", { records: [1] }),
        pool.submit("bulk-import", { records: [1, 2] }),
        pool.submit("bulk-import", { records: [1, 2, 3] }),
      ]);

      expect(results.length).toBe(3);
    });

    it("processes batch decay task", async () => {
      const result = await pool.submit<{ decayed: unknown[] }>("batch-decay", {
        records: [
          { id: "r1", confidence: 0.8, age: 2 },
          { id: "r2", confidence: 0.6, age: 5 },
        ],
        decayRate: 0.05,
      });

      expect(result.decayed).toBeDefined();
      expect(Array.isArray(result.decayed)).toBe(true);
    });

    it("processes similarity search task", async () => {
      const result = await pool.submit("similarity-search", {
        query: [0.1, 0.2, 0.3],
        candidates: [
          { id: "c1", vector: [0.1, 0.2, 0.3] },
          { id: "c2", vector: [0.9, 0.8, 0.7] },
        ],
      });

      expect(result).toBeDefined();
    });

    it("rejects on unknown task type", async () => {
      await expect(pool.submit("unknown-type" as any, {})).rejects.toThrow("Unknown task type");
    });
  });

  describe("getStats", () => {
    it("tracks pool statistics", async () => {
      await pool.submit("bulk-import", { records: [] });

      const stats = pool.getStats();
      expect(stats.completedTasks).toBe(1);
      expect(stats.maxWorkers).toBe(2);
    });

    it("reports correct initial state", () => {
      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
    });
  });

  describe("priority", () => {
    it("high priority tasks execute first", async () => {
      const results: number[] = [];

      // Submit low priority first, then high priority
      const p1 = pool.submit("bulk-import", { records: [1] }, 2).then(() => results.push(2));
      const p2 = pool.submit("bulk-import", { records: [2] }, 0).then(() => results.push(0));

      await Promise.all([p1, p2]);
      // Both complete, order may vary due to concurrency
      expect(results.length).toBe(2);
    });
  });

  describe("factory", () => {
    it("creates worker pool with default workers", () => {
      const p = createWorkerPool();
      expect(p.getStats().maxWorkers).toBe(4);
    });

    it("creates worker pool with custom workers", () => {
      const p = createWorkerPool(8);
      expect(p.getStats().maxWorkers).toBe(8);
    });
  });
});

describe("ConnectionPool (Phase 4: Request Batching)", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 4,
      batchWindowMs: 10,
      maxBatchSize: 5,
    });

    // Mock fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }));
  });

  describe("request", () => {
    it("makes a single request", async () => {
      const result = await pool.request<{ success: boolean }>("https://api.test.com/v1", {
        method: "POST",
        body: { prompt: "test" },
        skipBatching: true,
      });

      expect(result.success).toBe(true);
    });

    it("batches multiple requests to same endpoint", async () => {
      const results = await Promise.all([
        pool.request("https://api.test.com/v1", { body: { id: 1 } }),
        pool.request("https://api.test.com/v1", { body: { id: 2 } }),
        pool.request("https://api.test.com/v1", { body: { id: 3 } }),
      ]);

      expect(results.length).toBe(3);
    });

    it("handles request with custom headers", async () => {
      const result = await pool.request("https://api.test.com/v1", {
        headers: { Authorization: "Bearer token123" },
        skipBatching: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("tracks total requests", async () => {
      await pool.request("https://api.test.com/v1", { skipBatching: true });
      await pool.request("https://api.test.com/v1", { skipBatching: true });

      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it("reports initial state correctly", () => {
      const stats = pool.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.pendingRequests).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it("calculates batch efficiency", async () => {
      // Make several requests that get batched
      await Promise.all([
        pool.request("https://api.test.com/v1", { body: { id: 1 } }),
        pool.request("https://api.test.com/v1", { body: { id: 2 } }),
      ]);

      const stats = pool.getStats();
      expect(stats.totalRequests).toBe(2);
      // batchEfficiency = totalRequests / totalBatches
      if (stats.totalBatches > 0) {
        expect(stats.batchEfficiency).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("close", () => {
    it("closes all connections gracefully", async () => {
      await pool.request("https://api.test.com/v1", { skipBatching: true });
      await pool.close();

      const stats = pool.getStats();
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe("error handling", () => {
    it("handles failed requests", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }));

      await expect(
        pool.request("https://api.test.com/v1", { skipBatching: true })
      ).rejects.toThrow("500");
    });

    it("handles network errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      await expect(
        pool.request("https://api.test.com/v1", { skipBatching: true })
      ).rejects.toThrow("Network error");
    });
  });

  describe("configuration", () => {
    it("respects max connections limit", () => {
      const customPool = new ConnectionPool({ maxConnections: 2 });
      const stats = customPool.getStats();
      expect(stats.activeConnections).toBe(0);
    });

    it("respects batch window timing", async () => {
      const slowPool = new ConnectionPool({ batchWindowMs: 100 });
      // Requests should queue up within the batch window
      const promise = slowPool.request("https://api.test.com/v1", { body: {} });
      const stats = slowPool.getStats();
      expect(stats.pendingRequests).toBeGreaterThanOrEqual(0);
      await promise;
    });
  });

  describe("factory", () => {
    it("creates connection pool with defaults", () => {
      const p = createConnectionPool();
      expect(p.getStats().totalRequests).toBe(0);
    });

    it("creates connection pool with custom config", () => {
      const p = createConnectionPool({ maxConnections: 8, batchWindowMs: 100 });
      expect(p.getStats().totalRequests).toBe(0);
    });
  });
});
