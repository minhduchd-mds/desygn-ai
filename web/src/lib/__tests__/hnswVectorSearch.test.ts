import { describe, it, expect, beforeEach } from "vitest";
import { HNSWIndex, SimpleEmbedding, createHNSWIndex } from "../hnswVectorSearch";

describe("HNSWIndex", () => {
  let index: HNSWIndex;

  beforeEach(() => {
    index = new HNSWIndex({
      dimensions: 4,
      maxElements: 1000,
      M: 4,
      efConstruction: 50,
      efSearch: 20,
    });
  });

  describe("insert", () => {
    it("inserts a single vector", () => {
      index.insert("v1", [1, 0, 0, 0]);
      expect(index.size).toBe(1);
      expect(index.has("v1")).toBe(true);
    });

    it("inserts multiple vectors", () => {
      index.insert("v1", [1, 0, 0, 0]);
      index.insert("v2", [0, 1, 0, 0]);
      index.insert("v3", [0, 0, 1, 0]);
      expect(index.size).toBe(3);
    });

    it("throws on dimension mismatch", () => {
      expect(() => index.insert("v1", [1, 0])).toThrow("dimension mismatch");
    });

    it("throws on full index", () => {
      const smallIndex = new HNSWIndex({ dimensions: 2, maxElements: 2, M: 4, efConstruction: 10, efSearch: 5 });
      smallIndex.insert("a", [1, 0]);
      smallIndex.insert("b", [0, 1]);
      expect(() => smallIndex.insert("c", [1, 1])).toThrow("full");
    });

    it("accepts Float32Array", () => {
      const vec = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      index.insert("f32", vec);
      expect(index.has("f32")).toBe(true);
    });
  });

  describe("search", () => {
    beforeEach(() => {
      // Insert 10 vectors in 4D space
      index.insert("north", [1, 0, 0, 0]);
      index.insert("east", [0, 1, 0, 0]);
      index.insert("up", [0, 0, 1, 0]);
      index.insert("time", [0, 0, 0, 1]);
      index.insert("ne", [0.7, 0.7, 0, 0]);
      index.insert("nw", [0.7, -0.7, 0, 0]);
      index.insert("se", [-0.7, 0.7, 0, 0]);
      index.insert("sw", [-0.7, -0.7, 0, 0]);
    });

    it("finds nearest neighbor", () => {
      const results = index.search([1, 0.1, 0, 0], 1);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("north");
    });

    it("returns k nearest neighbors", () => {
      const results = index.search([0.8, 0.6, 0, 0], 3);
      expect(results.length).toBe(3);
      // Should include north and ne (both close to query)
      const ids = results.map((r) => r.id);
      expect(ids).toContain("ne");
    });

    it("returns results sorted by distance", () => {
      const results = index.search([1, 0, 0, 0], 5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    it("returns similarity scores between 0 and 1", () => {
      const results = index.search([1, 0, 0, 0], 5);
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });

    it("returns empty array for empty index", () => {
      const emptyIndex = new HNSWIndex({ dimensions: 4, maxElements: 100, M: 4, efConstruction: 10, efSearch: 5 });
      const results = emptyIndex.search([1, 0, 0, 0]);
      expect(results.length).toBe(0);
    });

    it("handles identical vectors", () => {
      index.insert("north2", [1, 0, 0, 0]);
      const results = index.search([1, 0, 0, 0], 2);
      expect(results.length).toBe(2);
      expect(results[0].distance).toBeCloseTo(0, 1);
    });
  });

  describe("remove", () => {
    beforeEach(() => {
      index.insert("a", [1, 0, 0, 0]);
      index.insert("b", [0, 1, 0, 0]);
      index.insert("c", [0, 0, 1, 0]);
    });

    it("removes existing vector", () => {
      expect(index.remove("b")).toBe(true);
      expect(index.size).toBe(2);
      expect(index.has("b")).toBe(false);
    });

    it("returns false for non-existent ID", () => {
      expect(index.remove("nonexistent")).toBe(false);
    });

    it("search still works after removal", () => {
      index.remove("a");
      const results = index.search([1, 0, 0, 0], 2);
      // Should not find "a"
      expect(results.every((r) => r.id !== "a")).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns correct stats for empty index", () => {
      const stats = index.getStats();
      expect(stats.size).toBe(0);
      expect(stats.dimensions).toBe(4);
      expect(stats.memoryUsageBytes).toBe(0);
    });

    it("tracks size after insertions", () => {
      index.insert("a", [1, 0, 0, 0]);
      index.insert("b", [0, 1, 0, 0]);
      const stats = index.getStats();
      expect(stats.size).toBe(2);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
      expect(stats.avgConnections).toBeGreaterThanOrEqual(0);
    });
  });

  describe("distance functions", () => {
    it("cosine distance: identical vectors = 0", () => {
      const cosineIndex = new HNSWIndex({ dimensions: 3, maxElements: 10, M: 4, efConstruction: 10, efSearch: 5, distanceFunction: "cosine" });
      cosineIndex.insert("a", [1, 0, 0]);
      const results = cosineIndex.search([1, 0, 0], 1);
      expect(results[0].distance).toBeCloseTo(0, 5);
    });

    it("euclidean distance works", () => {
      const eucIndex = new HNSWIndex({ dimensions: 3, maxElements: 10, M: 4, efConstruction: 10, efSearch: 5, distanceFunction: "euclidean" });
      eucIndex.insert("origin", [0, 0, 0]);
      eucIndex.insert("far", [3, 4, 0]);
      const results = eucIndex.search([0, 0, 0], 2);
      expect(results[0].id).toBe("origin");
    });

    it("dot product distance works", () => {
      const dotIndex = new HNSWIndex({ dimensions: 3, maxElements: 10, M: 4, efConstruction: 10, efSearch: 5, distanceFunction: "dot" });
      dotIndex.insert("high", [1, 1, 1]);
      dotIndex.insert("low", [0.1, 0.1, 0.1]);
      const results = dotIndex.search([1, 1, 1], 2);
      expect(results[0].id).toBe("high");
    });
  });

  describe("scalability", () => {
    it("handles 100 vectors efficiently", () => {
      const largeIndex = new HNSWIndex({ dimensions: 8, maxElements: 200, M: 8, efConstruction: 50, efSearch: 20 });

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        const vec = Array.from({ length: 8 }, () => Math.random());
        largeIndex.insert(`v${i}`, vec);
      }
      const insertTime = Date.now() - start;

      const searchStart = Date.now();
      const results = largeIndex.search(Array.from({ length: 8 }, () => Math.random()), 10);
      const searchTime = Date.now() - searchStart;

      expect(largeIndex.size).toBe(100);
      expect(results.length).toBe(10);
      expect(insertTime).toBeLessThan(1000); // Under 1s for 100 inserts
      expect(searchTime).toBeLessThan(50); // Under 50ms for search
    });
  });

  describe("factory", () => {
    it("creates index with default config", () => {
      const idx = createHNSWIndex();
      expect(idx.size).toBe(0);
    });

    it("creates index with custom config", () => {
      const idx = createHNSWIndex({ dimensions: 64, maxElements: 50000 });
      expect(idx.size).toBe(0);
    });
  });
});

describe("SimpleEmbedding", () => {
  let embedder: SimpleEmbedding;

  beforeEach(() => {
    embedder = new SimpleEmbedding(64);
    embedder.buildVocabulary([
      "react component with hooks and state management",
      "vue component with composition api",
      "svelte component with reactive declarations",
      "button primary action submit form",
      "modal dialog overlay backdrop close",
    ]);
  });

  it("generates embeddings with correct dimensions", () => {
    const vec = embedder.embed("react component");
    expect(vec.length).toBe(64);
  });

  it("generates normalized vectors", () => {
    const vec = embedder.embed("react hooks state");
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    // Should be approximately 1.0 (L2 normalized)
    if (norm > 0) {
      expect(Math.abs(Math.sqrt(norm) - 1.0)).toBeLessThan(0.01);
    }
  });

  it("similar texts produce similar vectors", () => {
    const v1 = embedder.embed("react component hooks");
    const v2 = embedder.embed("react component state");
    const v3 = embedder.embed("modal dialog close");

    // Cosine similarity between similar texts should be higher
    const sim12 = cosineSim(v1, v2);
    const sim13 = cosineSim(v1, v3);
    expect(sim12).toBeGreaterThan(sim13);
  });

  it("builds vocabulary from corpus", () => {
    expect(embedder.getVocabularySize()).toBeGreaterThan(0);
    expect(embedder.getVocabularySize()).toBeLessThanOrEqual(64);
  });

  it("handles empty text", () => {
    const vec = embedder.embed("");
    expect(vec.length).toBe(64);
    // All zeros for empty text
    const sum = Array.from(vec).reduce((a, b) => a + Math.abs(b), 0);
    expect(sum).toBe(0);
  });
});

// Helper
function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const mag = Math.sqrt(normA) * Math.sqrt(normB);
  return mag === 0 ? 0 : dot / mag;
}
