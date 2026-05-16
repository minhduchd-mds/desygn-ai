/**
 * eventBus — unit tests
 * Focus: typed emit/on, once(), off(), handler isolation, clear().
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { eventBus } from "../eventBus";

afterEach(() => {
  eventBus.clear();
});

describe("eventBus", () => {

  describe("on / emit", () => {
    it("calls subscriber with correct payload", () => {
      const handler = vi.fn();
      eventBus.on("toast:show", handler);
      eventBus.emit("toast:show", { message: "Hello", type: "success" });
      expect(handler).toHaveBeenCalledWith({ message: "Hello", type: "success" });
    });

    it("supports multiple subscribers for same event", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      eventBus.on("chat:cleared", h1);
      eventBus.on("chat:cleared", h2);
      eventBus.emit("chat:cleared");
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it("does not call handlers for different events", () => {
      const handler = vi.fn();
      eventBus.on("session:expired", handler);
      eventBus.emit("chat:cleared");
      expect(handler).not.toHaveBeenCalled();
    });

    it("void events emit without payload", () => {
      const handler = vi.fn();
      eventBus.on("figma:disconnected", handler);
      eventBus.emit("figma:disconnected");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("emitting to an event with no listeners does not throw", () => {
      expect(() => eventBus.emit("online:restored")).not.toThrow();
    });

    it("isolates throwing handler — other handlers still receive event", () => {
      const bad = vi.fn().mockImplementation(() => { throw new Error("boom"); });
      const good = vi.fn();
      eventBus.on("toast:show", bad);
      eventBus.on("toast:show", good);
      expect(() =>
        eventBus.emit("toast:show", { message: "x", type: "info" }),
      ).not.toThrow();
      expect(good).toHaveBeenCalledOnce();
    });
  });

  describe("off / unsubscribe", () => {
    it("on() returns an unsubscribe function", () => {
      const handler = vi.fn();
      const off = eventBus.on("session:expired", handler);
      off();
      eventBus.emit("session:expired");
      expect(handler).not.toHaveBeenCalled();
    });

    it("off() removes a specific handler", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      eventBus.on("chat:cleared", h1);
      eventBus.on("chat:cleared", h2);
      eventBus.off("chat:cleared", h1);
      eventBus.emit("chat:cleared");
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  describe("once()", () => {
    it("fires exactly once then unsubscribes", () => {
      const handler = vi.fn();
      eventBus.once("toast:show", handler);
      eventBus.emit("toast:show", { message: "a", type: "success" });
      eventBus.emit("toast:show", { message: "b", type: "error" });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ message: "a", type: "success" });
    });

    it("once() returns an unsubscribe fn that prevents the single fire", () => {
      const handler = vi.fn();
      const off = eventBus.once("session:expired", handler);
      off();
      eventBus.emit("session:expired");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("returns 0 when no listeners registered", () => {
      expect(eventBus.listenerCount("tab:changed")).toBe(0);
    });

    it("increments and decrements correctly", () => {
      const off1 = eventBus.on("tab:changed", vi.fn());
      const off2 = eventBus.on("tab:changed", vi.fn());
      expect(eventBus.listenerCount("tab:changed")).toBe(2);
      off1();
      expect(eventBus.listenerCount("tab:changed")).toBe(1);
      off2();
      expect(eventBus.listenerCount("tab:changed")).toBe(0);
    });
  });

  describe("clear()", () => {
    it("removes all listeners across all events", () => {
      eventBus.on("toast:show", vi.fn());
      eventBus.on("session:expired", vi.fn());
      eventBus.clear();
      expect(eventBus.listenerCount("toast:show")).toBe(0);
      expect(eventBus.listenerCount("session:expired")).toBe(0);
    });
  });

  describe("payload types", () => {
    it("project:created payload is passed verbatim", () => {
      const handler = vi.fn();
      eventBus.on("project:created", handler);
      eventBus.emit("project:created", { name: "My App", category: "SaaS", template: "linear" });
      expect(handler).toHaveBeenCalledWith({ name: "My App", category: "SaaS", template: "linear" });
    });

    it("figma:connected carries endpoint string", () => {
      const handler = vi.fn();
      eventBus.on("figma:connected", handler);
      eventBus.emit("figma:connected", { endpoint: "ws://localhost:3333" });
      expect(handler).toHaveBeenCalledWith({ endpoint: "ws://localhost:3333" });
    });

    it("offline:flushed carries success/failed counts", () => {
      const handler = vi.fn();
      eventBus.on("offline:flushed", handler);
      eventBus.emit("offline:flushed", { success: 3, failed: 1 });
      expect(handler).toHaveBeenCalledWith({ success: 3, failed: 1 });
    });
  });
});
