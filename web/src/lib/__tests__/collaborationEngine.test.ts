/**
 * Collaboration Engine (CRDT) tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CollaborationSession,
  LWWRegister,
  ORSet,
  incrementClock,
  mergeClock,
  compareClocks,
} from "../collaborationEngine";
import type { VectorClock } from "../collaborationEngine";

describe("Vector Clock", () => {
  it("increments a clock", () => {
    const clock: VectorClock = { a: 1, b: 2 };
    const next = incrementClock(clock, "a");
    expect(next.a).toBe(2);
    expect(next.b).toBe(2);
  });

  it("initializes new peer at 1", () => {
    const clock: VectorClock = {};
    const next = incrementClock(clock, "x");
    expect(next.x).toBe(1);
  });

  it("merges two clocks (element-wise max)", () => {
    const a: VectorClock = { p1: 3, p2: 1 };
    const b: VectorClock = { p1: 1, p2: 5, p3: 2 };
    const merged = mergeClock(a, b);
    expect(merged.p1).toBe(3);
    expect(merged.p2).toBe(5);
    expect(merged.p3).toBe(2);
  });

  it("compares: a before b", () => {
    const a: VectorClock = { p1: 1, p2: 1 };
    const b: VectorClock = { p1: 2, p2: 2 };
    expect(compareClocks(a, b)).toBe("before");
  });

  it("compares: a after b", () => {
    const a: VectorClock = { p1: 3, p2: 3 };
    const b: VectorClock = { p1: 1, p2: 2 };
    expect(compareClocks(a, b)).toBe("after");
  });

  it("compares: concurrent", () => {
    const a: VectorClock = { p1: 2, p2: 1 };
    const b: VectorClock = { p1: 1, p2: 2 };
    expect(compareClocks(a, b)).toBe("concurrent");
  });
});

describe("LWWRegister", () => {
  let reg: LWWRegister<string>;

  beforeEach(() => {
    reg = new LWWRegister();
  });

  it("sets and gets values", () => {
    reg.set("color", "#ff0000", 100, "peer-a");
    expect(reg.get("color")).toBe("#ff0000");
  });

  it("last writer wins (higher timestamp)", () => {
    reg.set("color", "#ff0000", 100, "peer-a");
    reg.set("color", "#00ff00", 200, "peer-b");
    expect(reg.get("color")).toBe("#00ff00");
  });

  it("ignores older writes", () => {
    reg.set("color", "#00ff00", 200, "peer-a");
    reg.set("color", "#ff0000", 100, "peer-b");
    expect(reg.get("color")).toBe("#00ff00");
  });

  it("breaks ties by peer ID (lexicographic)", () => {
    reg.set("color", "#aaa", 100, "peer-a");
    reg.set("color", "#bbb", 100, "peer-b");
    expect(reg.get("color")).toBe("#bbb"); // "peer-b" > "peer-a"
  });

  it("merges two registers", () => {
    const other = new LWWRegister<string>();
    reg.set("x", "local", 100, "a");
    other.set("x", "remote", 200, "b");

    const conflicts = reg.merge(other);
    expect(reg.get("x")).toBe("remote");
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].resolution).toBe("remote");
  });

  it("tracks size", () => {
    reg.set("a", "1", 1, "p");
    reg.set("b", "2", 2, "p");
    expect(reg.size).toBe(2);
  });

  it("lists entries", () => {
    reg.set("x", "1", 1, "p");
    reg.set("y", "2", 2, "p");
    expect(reg.entries().length).toBe(2);
  });
});

describe("ORSet", () => {
  let set: ORSet<string>;

  beforeEach(() => {
    set = new ORSet();
  });

  it("adds elements", () => {
    set.add("Button", "button", "tag-1");
    expect(set.has("button")).toBe(true);
    expect(set.size).toBe(1);
  });

  it("removes elements", () => {
    set.add("Button", "button", "tag-1");
    set.remove("button", ["tag-1"]);
    expect(set.has("button")).toBe(false);
  });

  it("survives partial remove (add wins)", () => {
    set.add("Button", "button", "tag-1");
    set.add("Button", "button", "tag-2");
    set.remove("button", ["tag-1"]);
    expect(set.has("button")).toBe(true); // tag-2 still alive
  });

  it("merges two sets (union of adds minus tombstones)", () => {
    const other = new ORSet<string>();
    set.add("Button", "button", "tag-a");
    other.add("Card", "card", "tag-b");

    set.merge(other);
    expect(set.has("button")).toBe(true);
    expect(set.has("card")).toBe(true);
  });

  it("merge respects remote tombstones", () => {
    const other = new ORSet<string>();
    set.add("Button", "button", "tag-1");
    other.add("Button", "button", "tag-1");
    other.remove("button", ["tag-1"]);

    set.merge(other);
    expect(set.has("button")).toBe(false);
  });

  it("returns all values", () => {
    set.add("A", "a", "t1");
    set.add("B", "b", "t2");
    expect(set.values().length).toBe(2);
  });
});

describe("CollaborationSession", () => {
  let session: CollaborationSession;

  beforeEach(() => {
    session = new CollaborationSession("peer-1", "Alice");
  });

  describe("token operations", () => {
    it("sets and gets tokens", () => {
      session.setToken("primary-color", "#00d4ff");
      expect(session.getToken("primary-color")).toBe("#00d4ff");
    });

    it("returns operation on set", () => {
      const op = session.setToken("spacing-sm", "8px");
      expect(op.type).toBe("lww-set");
      expect(op.peerId).toBe("peer-1");
      expect(op.value).toBe("8px");
    });

    it("tracks token count", () => {
      session.setToken("a", "1");
      session.setToken("b", "2");
      expect(session.getTokenCount()).toBe(2);
    });
  });

  describe("component operations", () => {
    it("adds components", () => {
      session.addComponent("Button");
      expect(session.hasComponent("Button")).toBe(true);
    });

    it("removes components", () => {
      session.addComponent("Card");
      session.removeComponent("Card");
      expect(session.hasComponent("Card")).toBe(false);
    });

    it("lists components", () => {
      session.addComponent("Button");
      session.addComponent("Card");
      expect(session.getComponents().length).toBe(2);
    });

    it("returns null when removing non-existent", () => {
      expect(session.removeComponent("Ghost")).toBeNull();
    });
  });

  describe("remote operations", () => {
    it("applies remote token set", () => {
      const op = {
        id: "op-remote",
        type: "lww-set" as const,
        peerId: "peer-2",
        timestamp: Date.now() + 1000,
        clock: { "peer-2": 1 },
        key: "color",
        value: "#ff0000",
      };

      session.applyRemoteOperation(op);
      expect(session.getToken("color")).toBe("#ff0000");
    });

    it("applies remote component add", () => {
      const op = {
        id: "op-remote",
        type: "orset-add" as const,
        peerId: "peer-2",
        timestamp: Date.now(),
        clock: { "peer-2": 1 },
        key: "navbar",
        value: "Navbar",
        tag: "peer-2-tag-1",
      };

      session.applyRemoteOperation(op);
      expect(session.hasComponent("Navbar")).toBe(true);
    });

    it("detects conflicts on concurrent token writes", () => {
      session.setToken("color", "#00ff00");

      const op = {
        id: "op-remote",
        type: "lww-set" as const,
        peerId: "peer-2",
        timestamp: Date.now() + 1000, // Remote wins
        clock: { "peer-2": 1 },
        key: "color",
        value: "#ff0000",
      };

      session.applyRemoteOperation(op);
      const conflicts = session.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].key).toBe("color");
    });
  });

  describe("peer management", () => {
    it("tracks self as active peer", () => {
      const peers = session.getActivePeers();
      expect(peers.length).toBe(1);
      expect(peers[0].name).toBe("Alice");
    });

    it("adds remote peers", () => {
      session.addPeer("peer-2", "Bob");
      expect(session.getActivePeers().length).toBe(2);
    });

    it("removes peers (marks inactive)", () => {
      session.addPeer("peer-2", "Bob");
      session.removePeer("peer-2");
      expect(session.getActivePeers().length).toBe(1);
    });

    it("updates peer cursor", () => {
      session.addPeer("peer-2", "Bob");
      session.updatePeerCursor("peer-2", 100, 200);
      const bob = session.getActivePeers().find(p => p.id === "peer-2");
      expect(bob?.cursor).toEqual({ x: 100, y: 200 });
    });
  });

  describe("state tracking", () => {
    it("counts operations", () => {
      session.setToken("a", "1");
      session.addComponent("Button");
      expect(session.getOperationCount()).toBe(2);
    });

    it("advances vector clock", () => {
      session.setToken("a", "1");
      session.setToken("b", "2");
      const clock = session.getClock();
      expect(clock["peer-1"]).toBe(2);
    });
  });
});
