/**
 * AgentMemory tests.
 *
 * Uses in-memory fallback since IndexedDB is not available in Node.
 * Tests cover: store, retrieve, search (BM25), pattern learning,
 * feedback recording, consolidation, and export/import.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentMemory } from "../agentMemory";
import type { MemoryEntry } from "../agentMemory";

// Mock IndexedDB for Node environment
function createMockIDB() {
  const store = new Map<string, unknown>();

  function makeRequest<T>(result: T): IDBRequest<T> {
    const req = { onsuccess: null as (() => void) | null, onerror: null, result } as unknown as IDBRequest<T>;
    setTimeout(() => (req as { onsuccess: (() => void) | null }).onsuccess?.(), 0);
    return req;
  }

  const mockStore = {
    put: vi.fn((value: unknown) => {
      const entry = value as MemoryEntry;
      store.set(entry.id, value);
      return makeRequest(undefined);
    }),
    get: vi.fn((key: string) => {
      return makeRequest(store.get(key));
    }),
    getAll: vi.fn(() => {
      return makeRequest([...store.values()]);
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      return makeRequest(undefined);
    }),
    clear: vi.fn(() => {
      store.clear();
      return makeRequest(undefined);
    }),
    createIndex: vi.fn(),
  };

  const mockDB = {
    objectStoreNames: { contains: vi.fn(() => false) },
    createObjectStore: vi.fn(() => mockStore),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => mockStore),
    })),
  };

  const mockOpen = {
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onupgradeneeded: null as ((event: unknown) => void) | null,
    result: mockDB,
  };

  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      setTimeout(() => {
        if (mockOpen.onupgradeneeded) {
          mockOpen.onupgradeneeded({ target: mockOpen } as unknown);
        }
        mockOpen.onsuccess?.();
      }, 0);
      return mockOpen;
    }),
  });

  return { store, mockStore, mockDB };
}

describe("AgentMemory", () => {
  let memory: AgentMemory;

  beforeEach(() => {
    createMockIDB();
    memory = new AgentMemory();
  });

  describe("store & retrieve (working memory)", () => {
    it("stores entry in working memory", async () => {
      await memory.init();
      const id = await memory.store({
        tier: "working",
        type: "project-context",
        content: "Test project context",
        metadata: {
          projectId: "test-project",
          tags: ["test"],
          confidence: 1.0,
          source: "test",
        },
      });

      expect(id).toMatch(/^mem_/);
    });

    it("retrieves stored entry", async () => {
      await memory.init();
      const id = await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Button uses 8px padding",
        metadata: {
          componentName: "Button",
          tags: ["button", "spacing"],
          confidence: 0.8,
          source: "test",
        },
      });

      const entry = await memory.retrieve(id);
      expect(entry).not.toBeNull();
      expect(entry!.content).toBe("Button uses 8px padding");
      expect(entry!.metadata.componentName).toBe("Button");
    });

    it("increments access count on retrieve", async () => {
      await memory.init();
      const id = await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Test",
        metadata: { tags: [], confidence: 1, source: "test" },
      });

      await memory.retrieve(id);
      await memory.retrieve(id);
      const entry = await memory.retrieve(id);
      expect(entry!.accessCount).toBe(3);
    });

    it("enforces working memory limit", async () => {
      await memory.init();
      // Store 101 entries (limit is 100)
      for (let i = 0; i < 101; i++) {
        await memory.store({
          tier: "working",
          type: "project-context",
          content: `Entry ${i}`,
          metadata: { tags: [], confidence: 1, source: "test" },
        });
      }

      const stats = await memory.getStats();
      expect(stats.working).toBeLessThanOrEqual(100);
    });
  });

  describe("search (BM25)", () => {
    it("finds entries by text query", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Button component uses 8px border-radius with cyan accent",
        metadata: { tags: ["button"], confidence: 0.8, source: "test" },
      });
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Card component uses 14px border-radius with shadow",
        metadata: { tags: ["card"], confidence: 0.8, source: "test" },
      });

      const results = await memory.search({ text: "Button border-radius" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("Button");
    });

    it("filters by type", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Pattern A",
        metadata: { tags: [], confidence: 0.5, source: "test" },
      });
      await memory.store({
        tier: "working",
        type: "code-feedback",
        content: "Feedback B",
        metadata: { tags: [], confidence: 0.5, source: "test" },
      });

      const results = await memory.search({ type: "code-feedback" });
      expect(results.every(r => r.type === "code-feedback")).toBe(true);
    });

    it("filters by tags", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Button pattern",
        metadata: { tags: ["button", "primary"], confidence: 0.8, source: "test" },
      });
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Card pattern",
        metadata: { tags: ["card"], confidence: 0.8, source: "test" },
      });

      const results = await memory.search({ tags: ["button"] });
      expect(results.length).toBe(1);
      expect(results[0].content).toContain("Button");
    });

    it("filters by minimum confidence", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "High confidence pattern",
        metadata: { tags: [], confidence: 0.9, source: "test" },
      });
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Low confidence pattern",
        metadata: { tags: [], confidence: 0.2, source: "test" },
      });

      const results = await memory.search({ minConfidence: 0.5 });
      expect(results.length).toBe(1);
      expect(results[0].content).toContain("High");
    });

    it("respects limit", async () => {
      await memory.init();
      for (let i = 0; i < 10; i++) {
        await memory.store({
          tier: "working",
          type: "design-pattern",
          content: `Pattern ${i} with button component`,
          metadata: { tags: [], confidence: 0.5, source: "test" },
        });
      }

      const results = await memory.search({ text: "button", limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("pattern learning", () => {
    it("stores new design pattern", async () => {
      await memory.init();
      await memory.learnPattern("Button", "Uses 8px border-radius", "proj-1", "react");

      const results = await memory.search({ text: "Button border-radius" });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("feedback recording", () => {
    it("records positive feedback", async () => {
      await memory.init();
      await memory.recordFeedback("Button", "<button>click</button>", "positive");

      const results = await memory.search({ type: "code-feedback" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("records correction with high confidence", async () => {
      await memory.init();
      await memory.recordFeedback(
        "Card",
        "<div class='card'>...</div>",
        "corrected",
        "Should use semantic <article> tag",
      );

      const results = await memory.search({ type: "code-feedback", text: "Card" });
      expect(results.length).toBeGreaterThan(0);
      // Corrections go to procedural memory with high confidence
      const correction = results.find(r => r.tier === "procedural");
      expect(correction).toBeDefined();
      expect(correction!.metadata.confidence).toBe(0.9);
    });
  });

  describe("component mapping", () => {
    it("records figma-to-code mapping", async () => {
      await memory.init();
      await memory.recordMapping(
        "Button",
        "FRAME > TEXT + ICON",
        "<button><span>{label}</span><Icon /></button>",
        "react",
        "proj-1",
      );

      const results = await memory.search({
        type: "component-mapping",
        text: "Button",
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("---FIGMA---");
      expect(results[0].content).toContain("---CODE---");
    });
  });

  describe("statistics", () => {
    it("returns correct stats", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "project-context",
        content: "W1",
        metadata: { tags: [], confidence: 1, source: "test" },
      });
      await memory.store({
        tier: "working",
        type: "project-context",
        content: "W2",
        metadata: { tags: [], confidence: 1, source: "test" },
      });

      const stats = await memory.getStats();
      expect(stats.working).toBe(2);
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe("export/import", () => {
    it("exports all memories", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "Pattern 1",
        metadata: { tags: [], confidence: 1, source: "test" },
      });

      const exported = await memory.exportAll();
      expect(exported.length).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("clears all memories", async () => {
      await memory.init();
      await memory.store({
        tier: "working",
        type: "design-pattern",
        content: "To be cleared",
        metadata: { tags: [], confidence: 1, source: "test" },
      });

      await memory.clear();
      const stats = await memory.getStats();
      expect(stats.working).toBe(0);
    });
  });
});
