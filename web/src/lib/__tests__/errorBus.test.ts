/**
 * errorBus — unit tests
 * Focus: subscribe/emit lifecycle, handler isolation, severity helpers.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { errorBus, type AppError } from "../errorBus";

afterEach(() => {
  errorBus.clear();
});

describe("errorBus", () => {

  describe("subscribe / emit", () => {
    it("calls subscriber when an error is emitted", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.emit({ code: "TEST", message: "test msg", severity: "error", retryable: false });
      expect(handler).toHaveBeenCalledOnce();
    });

    it("adds a timestamp automatically", () => {
      let received: AppError | null = null;
      errorBus.subscribe((e) => { received = e; });
      errorBus.emit({ code: "X", message: "m", severity: "info", retryable: false });
      expect(received).not.toBeNull();
      expect((received as unknown as AppError).timestamp).toBeGreaterThan(0);
    });

    it("returns an unsubscribe function", () => {
      const handler = vi.fn();
      const off = errorBus.subscribe(handler);
      off();
      errorBus.emit({ code: "X", message: "m", severity: "warn", retryable: false });
      expect(handler).not.toHaveBeenCalled();
    });

    it("supports multiple subscribers", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      errorBus.subscribe(h1);
      errorBus.subscribe(h2);
      errorBus.emit({ code: "X", message: "m", severity: "error", retryable: true });
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("isolates a throwing handler — others still called", () => {
      const bad = vi.fn().mockImplementation(() => { throw new Error("handler boom"); });
      const good = vi.fn();
      errorBus.subscribe(bad);
      errorBus.subscribe(good);
      expect(() =>
        errorBus.emit({ code: "X", message: "m", severity: "error", retryable: false }),
      ).not.toThrow();
      expect(good).toHaveBeenCalledOnce();
    });

    it("emits context when provided", () => {
      let received: AppError | null = null;
      errorBus.subscribe((e) => { received = e; });
      errorBus.emit({ code: "X", message: "m", severity: "warn", retryable: false, context: { userId: "123" } });
      expect((received as unknown as AppError).context).toEqual({ userId: "123" });
    });
  });

  describe("convenience emitters", () => {
    it("network() emits code NETWORK_ERROR", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.network("Connection refused");
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ code: "NETWORK_ERROR", retryable: true }),
      );
    });

    it("network(msg, false) sets retryable=false", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.network("Not found", false);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ retryable: false }));
    });

    it("auth() emits code AUTH_ERROR with retryable=false", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.auth("Invalid credentials");
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ code: "AUTH_ERROR", severity: "error", retryable: false }),
      );
    });

    it("warn() emits severity warn", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.warn("PROJECT_ERROR", "save failed");
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ severity: "warn" }));
    });

    it("fatal() emits severity fatal", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.fatal("CRASH", "something exploded");
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ severity: "fatal" }));
    });
  });

  describe("clear", () => {
    it("removes all subscribers so no handler is called after clear()", () => {
      const handler = vi.fn();
      errorBus.subscribe(handler);
      errorBus.clear();
      errorBus.emit({ code: "X", message: "m", severity: "info", retryable: false });
      expect(handler).not.toHaveBeenCalled();
    });

    it("subscriberCount reflects registration", () => {
      expect(errorBus.subscriberCount).toBe(0);
      const off1 = errorBus.subscribe(vi.fn());
      const off2 = errorBus.subscribe(vi.fn());
      expect(errorBus.subscriberCount).toBe(2);
      off1();
      expect(errorBus.subscriberCount).toBe(1);
      off2();
      expect(errorBus.subscriberCount).toBe(0);
    });
  });
});
