/**
 * rateLimit — unit tests for TokenBucket
 * Focus: consume(), wait(), boundary conditions, reset.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { TokenBucket } from "../rateLimit";

afterEach(() => {
  vi.useRealTimers();
});

describe("TokenBucket", () => {

  describe("consume()", () => {
    it("allows consumption when tokens are available", () => {
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1 });
      expect(bucket.consume()).toBe(true);
    });

    it("returns false when no tokens remain", () => {
      const bucket = new TokenBucket({ maxTokens: 2, refillRate: 1, initialTokens: 0 });
      expect(bucket.consume()).toBe(false);
    });

    it("depletes token count correctly", () => {
      const bucket = new TokenBucket({ maxTokens: 3, refillRate: 0 });
      expect(bucket.consume()).toBe(true);
      expect(bucket.consume()).toBe(true);
      expect(bucket.consume()).toBe(true);
      expect(bucket.consume()).toBe(false);
    });

    it("respects cost parameter", () => {
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 0 });
      expect(bucket.consume(3)).toBe(true);
      expect(bucket.consume(3)).toBe(false); // only 2 tokens left
      expect(bucket.consume(2)).toBe(true);
    });

    it("never exceeds maxTokens after refill", () => {
      vi.useFakeTimers();
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 10 });
      vi.advanceTimersByTime(10_000); // would add 100 tokens without cap
      expect(bucket.available).toBe(5);
    });

    it("refills over time", () => {
      vi.useFakeTimers();
      const bucket = new TokenBucket({ maxTokens: 10, refillRate: 2, initialTokens: 0 });
      vi.advanceTimersByTime(3000); // +6 tokens
      expect(bucket.available).toBeGreaterThanOrEqual(6);
    });
  });

  describe("available / waitSeconds", () => {
    it("available returns floor of current tokens", () => {
      const bucket = new TokenBucket({ maxTokens: 10, refillRate: 0, initialTokens: 3 });
      expect(bucket.available).toBe(3);
    });

    it("waitSeconds is 0 when tokens available", () => {
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1 });
      expect(bucket.waitSeconds).toBe(0);
    });

    it("waitSeconds is positive when empty", () => {
      const bucket = new TokenBucket({ maxTokens: 1, refillRate: 1, initialTokens: 0 });
      expect(bucket.waitSeconds).toBeGreaterThan(0);
    });
  });

  describe("reset()", () => {
    it("restores bucket to maxTokens", () => {
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 0, initialTokens: 0 });
      expect(bucket.available).toBe(0);
      bucket.reset();
      expect(bucket.available).toBe(5);
    });
  });

  describe("wait()", () => {
    it("resolves immediately when tokens are available", async () => {
      const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1 });
      await expect(bucket.wait(1)).resolves.toBeUndefined();
    });

    it("rejects on aborted signal", async () => {
      const bucket = new TokenBucket({ maxTokens: 0, refillRate: 0.001, initialTokens: 0 });
      const controller = new AbortController();
      controller.abort();
      await expect(bucket.wait(1, controller.signal)).rejects.toThrow();
    });

    it("resolves after delay when tokens are scarce", async () => {
      vi.useFakeTimers();
      const bucket = new TokenBucket({ maxTokens: 2, refillRate: 2, initialTokens: 0 });
      const p = bucket.wait(1);
      vi.advanceTimersByTime(600);
      await expect(p).resolves.toBeUndefined();
    });
  });

  describe("initialTokens", () => {
    it("uses maxTokens as default initialTokens", () => {
      const bucket = new TokenBucket({ maxTokens: 7, refillRate: 1 });
      expect(bucket.available).toBe(7);
    });

    it("respects explicit initialTokens", () => {
      const bucket = new TokenBucket({ maxTokens: 7, refillRate: 1, initialTokens: 3 });
      expect(bucket.available).toBe(3);
    });
  });
});
