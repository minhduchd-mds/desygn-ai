/**
 * queryStore — unit tests (cache helpers, invalidate, non-hook paths)
 * Note: Hook tests (useQuery, useMutation) require a React test environment.
 * These tests cover the pure cache logic that underpins the hooks.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  getCacheEntry,
  setCacheEntry,
  invalidate,
  invalidatePrefix,
  clearQueryCache,
} from "../queryStore";

afterEach(() => {
  clearQueryCache();
});

describe("queryStore — cache helpers", () => {

  describe("setCacheEntry / getCacheEntry", () => {
    it("stores and retrieves a value", () => {
      setCacheEntry("user:1", { name: "Alice" });
      const entry = getCacheEntry<{ name: string }>("user:1");
      expect(entry?.data).toEqual({ name: "Alice" });
    });

    it("adds a timestamp", () => {
      const before = Date.now();
      setCacheEntry("ts-test", "value");
      const after = Date.now();
      const entry = getCacheEntry("ts-test");
      expect(entry?.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry?.timestamp).toBeLessThanOrEqual(after);
    });

    it("returns undefined for unknown key", () => {
      expect(getCacheEntry("missing")).toBeUndefined();
    });

    it("overwrites existing entry", () => {
      setCacheEntry("key", "first");
      setCacheEntry("key", "second");
      expect(getCacheEntry<string>("key")?.data).toBe("second");
    });

    it("stores complex objects", () => {
      const data = { list: [1, 2, 3], nested: { ok: true } };
      setCacheEntry("complex", data);
      expect(getCacheEntry("complex")?.data).toEqual(data);
    });

    it("stores null / undefined values", () => {
      setCacheEntry("null-key", null);
      expect(getCacheEntry("null-key")?.data).toBeNull();
    });
  });

  describe("invalidate()", () => {
    it("removes the entry from cache", () => {
      setCacheEntry("to-remove", "bye");
      invalidate("to-remove");
      expect(getCacheEntry("to-remove")).toBeUndefined();
    });

    it("does not throw when key does not exist", () => {
      expect(() => invalidate("nonexistent")).not.toThrow();
    });

    it("only removes the targeted key", () => {
      setCacheEntry("keep", "yes");
      setCacheEntry("remove", "no");
      invalidate("remove");
      expect(getCacheEntry<string>("keep")?.data).toBe("yes");
      expect(getCacheEntry("remove")).toBeUndefined();
    });
  });

  describe("invalidatePrefix()", () => {
    it("removes all keys with matching prefix", () => {
      setCacheEntry("user:1", "a");
      setCacheEntry("user:2", "b");
      setCacheEntry("project:1", "c");
      invalidatePrefix("user:");
      expect(getCacheEntry("user:1")).toBeUndefined();
      expect(getCacheEntry("user:2")).toBeUndefined();
      expect(getCacheEntry<string>("project:1")?.data).toBe("c");
    });

    it("does nothing when no keys match", () => {
      setCacheEntry("alpha", "x");
      expect(() => invalidatePrefix("beta")).not.toThrow();
      expect(getCacheEntry<string>("alpha")?.data).toBe("x");
    });

    it("empty prefix matches all keys", () => {
      setCacheEntry("a", 1);
      setCacheEntry("b", 2);
      invalidatePrefix("");
      expect(getCacheEntry("a")).toBeUndefined();
      expect(getCacheEntry("b")).toBeUndefined();
    });
  });

  describe("clearQueryCache()", () => {
    it("removes all entries", () => {
      setCacheEntry("x", 1);
      setCacheEntry("y", 2);
      clearQueryCache();
      expect(getCacheEntry("x")).toBeUndefined();
      expect(getCacheEntry("y")).toBeUndefined();
    });

    it("does not throw on empty cache", () => {
      expect(() => clearQueryCache()).not.toThrow();
    });
  });
});
