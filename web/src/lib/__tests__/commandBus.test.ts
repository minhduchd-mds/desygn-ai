/**
 * commandBus — unit tests
 * Focus: execute, undo, redo, stack limits, batch commands, makeSetCommand.
 */
import { describe, it, expect, vi } from "vitest";
import { CommandBus, makeSetCommand, makeBatchCommand } from "../commandBus";

// Use a fresh CommandBus instance per test (not the singleton)
function makeBus(maxHistory = 50) {
  return new CommandBus(maxHistory);
}

describe("commandBus", () => {

  describe("execute", () => {
    it("calls command.execute()", async () => {
      const bus = makeBus();
      const execute = vi.fn().mockResolvedValue("ok");
      const undo = vi.fn();
      await bus.execute({ description: "Test", execute, undo });
      expect(execute).toHaveBeenCalledOnce();
    });

    it("returns the result of execute()", async () => {
      const bus = makeBus();
      const result = await bus.execute({ description: "x", execute: () => 42, undo: vi.fn() });
      expect(result).toBe(42);
    });

    it("adds command to undo stack", async () => {
      const bus = makeBus();
      await bus.execute({ description: "A", execute: vi.fn(), undo: vi.fn() });
      expect(bus.canUndo).toBe(true);
      expect(bus.undoCount).toBe(1);
    });

    it("clears redo stack after new execute", async () => {
      const bus = makeBus();
      const cmd = { description: "X", execute: vi.fn(), undo: vi.fn() };
      await bus.execute(cmd);
      await bus.undo();
      expect(bus.canRedo).toBe(true);
      await bus.execute(cmd); // new action clears redo
      expect(bus.canRedo).toBe(false);
    });

    it("respects maxHistory limit", async () => {
      const bus = makeBus(3);
      for (let i = 0; i < 5; i++) {
        await bus.execute({ description: `cmd${i}`, execute: vi.fn(), undo: vi.fn() });
      }
      expect(bus.undoCount).toBe(3);
    });
  });

  describe("undo", () => {
    it("calls undo() on the last command", async () => {
      const bus = makeBus();
      const undo = vi.fn();
      await bus.execute({ description: "Test", execute: vi.fn(), undo });
      await bus.undo();
      expect(undo).toHaveBeenCalledOnce();
    });

    it("returns the description of what was undone", async () => {
      const bus = makeBus();
      await bus.execute({ description: "Edit Design.md", execute: vi.fn(), undo: vi.fn() });
      const desc = await bus.undo();
      expect(desc).toBe("Edit Design.md");
    });

    it("returns null when nothing to undo", async () => {
      const bus = makeBus();
      expect(await bus.undo()).toBeNull();
    });

    it("moves command to redo stack", async () => {
      const bus = makeBus();
      await bus.execute({ description: "A", execute: vi.fn(), undo: vi.fn() });
      await bus.undo();
      expect(bus.canRedo).toBe(true);
      expect(bus.undoCount).toBe(0);
    });

    it("undoes multiple commands in LIFO order", async () => {
      const bus = makeBus();
      const order: string[] = [];
      for (const name of ["A", "B", "C"]) {
        await bus.execute({ description: name, execute: () => { order.push(`exec:${name}`); }, undo: () => { order.push(`undo:${name}`); } });
      }
      await bus.undo();
      await bus.undo();
      expect(order).toEqual(["exec:A", "exec:B", "exec:C", "undo:C", "undo:B"]);
    });
  });

  describe("redo", () => {
    it("re-executes the last undone command", async () => {
      const bus = makeBus();
      const execute = vi.fn();
      await bus.execute({ description: "A", execute, undo: vi.fn() });
      await bus.undo();
      await bus.redo();
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it("returns null when nothing to redo", async () => {
      const bus = makeBus();
      expect(await bus.redo()).toBeNull();
    });

    it("moves command back to undo stack after redo", async () => {
      const bus = makeBus();
      await bus.execute({ description: "A", execute: vi.fn(), undo: vi.fn() });
      await bus.undo();
      await bus.redo();
      expect(bus.canUndo).toBe(true);
      expect(bus.canRedo).toBe(false);
    });
  });

  describe("peek", () => {
    it("peekUndo returns description without popping", async () => {
      const bus = makeBus();
      await bus.execute({ description: "My Action", execute: vi.fn(), undo: vi.fn() });
      expect(bus.peekUndo()).toBe("My Action");
      expect(bus.undoCount).toBe(1); // unchanged
    });

    it("peekRedo returns null when redo stack empty", () => {
      const bus = makeBus();
      expect(bus.peekRedo()).toBeNull();
    });
  });

  describe("clear", () => {
    it("empties both stacks", async () => {
      const bus = makeBus();
      await bus.execute({ description: "X", execute: vi.fn(), undo: vi.fn() });
      await bus.undo();
      bus.clear();
      expect(bus.canUndo).toBe(false);
      expect(bus.canRedo).toBe(false);
    });
  });

  describe("makeSetCommand", () => {
    it("sets value on execute", async () => {
      const bus = makeBus();
      let value = "old";
      await bus.execute(makeSetCommand("Set value", () => value, (v) => { value = v; }, "new"));
      expect(value).toBe("new");
    });

    it("restores previous value on undo", async () => {
      const bus = makeBus();
      let value = "original";
      await bus.execute(makeSetCommand("Set value", () => value, (v) => { value = v; }, "changed"));
      await bus.undo();
      expect(value).toBe("original");
    });
  });

  describe("makeBatchCommand", () => {
    it("executes all sub-commands in order", async () => {
      const bus = makeBus();
      const log: string[] = [];
      const batch = makeBatchCommand("Batch", [
        { description: "A", execute: () => { log.push("A"); }, undo: () => { log.push("undo:A"); } },
        { description: "B", execute: () => { log.push("B"); }, undo: () => { log.push("undo:B"); } },
      ]);
      await bus.execute(batch);
      expect(log).toEqual(["A", "B"]);
    });

    it("undoes sub-commands in reverse order", async () => {
      const bus = makeBus();
      const log: string[] = [];
      const batch = makeBatchCommand("Batch", [
        { description: "A", execute: () => { log.push("exec:A"); }, undo: () => { log.push("undo:A"); } },
        { description: "B", execute: () => { log.push("exec:B"); }, undo: () => { log.push("undo:B"); } },
      ]);
      await bus.execute(batch);
      await bus.undo();
      expect(log).toEqual(["exec:A", "exec:B", "undo:B", "undo:A"]);
    });
  });
});
