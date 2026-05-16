/**
 * collaborationEngine — CRDT-based real-time collaboration.
 *
 * Provides:
 *   • Last-Writer-Wins Register (LWW) for token values
 *   • Grow-Only Set (G-Set) for component additions
 *   • Observed-Remove Set (OR-Set) for components with deletion
 *   • Vector clocks for causal ordering
 *   • Conflict detection & resolution
 *   • Peer presence tracking
 *
 * Architecture:
 *   Local mutation → CRDT operation → Broadcast → Remote merge
 *   All operations are commutative, associative, idempotent.
 */

// ── Types ────────────────────────────────────────────────────────

export interface VectorClock {
  [peerId: string]: number;
}

export interface CRDTOperation {
  id: string;
  type: "lww-set" | "gset-add" | "orset-add" | "orset-remove";
  peerId: string;
  timestamp: number;
  clock: VectorClock;
  key: string;
  value: unknown;
  tag?: string; // For OR-Set unique tags
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  lastSeen: number;
  active: boolean;
}

export interface ConflictRecord {
  key: string;
  localValue: unknown;
  remoteValue: unknown;
  resolution: "local" | "remote";
  timestamp: number;
}

// ── Vector Clock Utilities ───────────────────────────────────────

export function incrementClock(clock: VectorClock, peerId: string): VectorClock {
  return { ...clock, [peerId]: (clock[peerId] || 0) + 1 };
}

export function mergeClock(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [peer, tick] of Object.entries(b)) {
    merged[peer] = Math.max(merged[peer] || 0, tick);
  }
  return merged;
}

export function compareClocks(a: VectorClock, b: VectorClock): "before" | "after" | "concurrent" {
  let aBefore = false;
  let aAfter = false;

  const allPeers = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const peer of allPeers) {
    const aVal = a[peer] || 0;
    const bVal = b[peer] || 0;
    if (aVal < bVal) aBefore = true;
    if (aVal > bVal) aAfter = true;
  }

  if (aBefore && !aAfter) return "before";
  if (aAfter && !aBefore) return "after";
  return "concurrent";
}

// ── LWW Register ─────────────────────────────────────────────────

export class LWWRegister<T> {
  private state: Map<string, { value: T; timestamp: number; peerId: string }> = new Map();

  set(key: string, value: T, timestamp: number, peerId: string): void {
    const existing = this.state.get(key);
    if (!existing || timestamp > existing.timestamp ||
        (timestamp === existing.timestamp && peerId > existing.peerId)) {
      this.state.set(key, { value, timestamp, peerId });
    }
  }

  get(key: string): T | undefined {
    return this.state.get(key)?.value;
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  merge(other: LWWRegister<T>): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];

    for (const [key, remote] of other.state) {
      const local = this.state.get(key);
      if (local) {
        if (remote.timestamp > local.timestamp ||
            (remote.timestamp === local.timestamp && remote.peerId > local.peerId)) {
          conflicts.push({
            key,
            localValue: local.value,
            remoteValue: remote.value,
            resolution: "remote",
            timestamp: Date.now(),
          });
          this.state.set(key, remote);
        } else if (remote.timestamp < local.timestamp) {
          conflicts.push({
            key,
            localValue: local.value,
            remoteValue: remote.value,
            resolution: "local",
            timestamp: Date.now(),
          });
        }
      } else {
        this.state.set(key, remote);
      }
    }

    return conflicts;
  }

  entries(): [string, T][] {
    return [...this.state.entries()].map(([k, v]) => [k, v.value]);
  }

  get size(): number {
    return this.state.size;
  }
}

// ── OR-Set (Observed-Remove Set) ─────────────────────────────────

export class ORSet<T> {
  private elements: Map<string, { value: T; tags: Set<string> }> = new Map();
  private tombstones: Set<string> = new Set();

  add(value: T, key: string, tag: string): void {
    const existing = this.elements.get(key);
    if (existing) {
      existing.tags.add(tag);
    } else {
      this.elements.set(key, { value, tags: new Set([tag]) });
    }
    this.tombstones.delete(tag);
  }

  remove(key: string, tags: string[]): boolean {
    const existing = this.elements.get(key);
    if (!existing) return false;

    for (const tag of tags) {
      existing.tags.delete(tag);
      this.tombstones.add(tag);
    }

    if (existing.tags.size === 0) {
      this.elements.delete(key);
    }
    return true;
  }

  has(key: string): boolean {
    return this.elements.has(key);
  }

  get(key: string): T | undefined {
    return this.elements.get(key)?.value;
  }

  values(): T[] {
    return [...this.elements.values()].map(e => e.value);
  }

  getTags(key: string): string[] {
    return [...(this.elements.get(key)?.tags ?? [])];
  }

  merge(other: ORSet<T>): void {
    for (const [key, { value, tags }] of other.elements) {
      for (const tag of tags) {
        if (!this.tombstones.has(tag)) {
          this.add(value, key, tag);
        }
      }
    }

    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
      // Remove the tag from all elements
      for (const [key, elem] of this.elements) {
        elem.tags.delete(tag);
        if (elem.tags.size === 0) {
          this.elements.delete(key);
        }
      }
    }
  }

  get size(): number {
    return this.elements.size;
  }
}

// ── Collaboration Session ────────────────────────────────────────

export class CollaborationSession {
  private peerId: string;
  private clock: VectorClock = {};
  private tokens: LWWRegister<string> = new LWWRegister();
  private components: ORSet<string> = new ORSet();
  private peers: Map<string, Peer> = new Map();
  private operations: CRDTOperation[] = [];
  private conflicts: ConflictRecord[] = [];

  constructor(peerId: string, peerName: string) {
    this.peerId = peerId;
    this.peers.set(peerId, {
      id: peerId,
      name: peerName,
      color: this.generateColor(peerId),
      lastSeen: Date.now(),
      active: true,
    });
  }

  // Token operations (LWW)
  setToken(key: string, value: string): CRDTOperation {
    this.clock = incrementClock(this.clock, this.peerId);
    const timestamp = Date.now();
    this.tokens.set(key, value, timestamp, this.peerId);

    const op: CRDTOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "lww-set",
      peerId: this.peerId,
      timestamp,
      clock: { ...this.clock },
      key,
      value,
    };
    this.operations.push(op);
    return op;
  }

  getToken(key: string): string | undefined {
    return this.tokens.get(key);
  }

  // Component operations (OR-Set)
  addComponent(name: string): CRDTOperation {
    this.clock = incrementClock(this.clock, this.peerId);
    const tag = `${this.peerId}-${Date.now()}`;
    this.components.add(name, name.toLowerCase(), tag);

    const op: CRDTOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "orset-add",
      peerId: this.peerId,
      timestamp: Date.now(),
      clock: { ...this.clock },
      key: name.toLowerCase(),
      value: name,
      tag,
    };
    this.operations.push(op);
    return op;
  }

  removeComponent(name: string): CRDTOperation | null {
    const key = name.toLowerCase();
    const tags = this.components.getTags(key);
    if (tags.length === 0) return null;

    this.clock = incrementClock(this.clock, this.peerId);
    this.components.remove(key, tags);

    const op: CRDTOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "orset-remove",
      peerId: this.peerId,
      timestamp: Date.now(),
      clock: { ...this.clock },
      key,
      value: tags,
    };
    this.operations.push(op);
    return op;
  }

  hasComponent(name: string): boolean {
    return this.components.has(name.toLowerCase());
  }

  getComponents(): string[] {
    return this.components.values();
  }

  // Remote operation application
  applyRemoteOperation(op: CRDTOperation): void {
    this.clock = mergeClock(this.clock, op.clock);

    switch (op.type) {
      case "lww-set": {
        const existingValue = this.tokens.get(op.key);
        this.tokens.set(op.key, op.value as string, op.timestamp, op.peerId);
        const newValue = this.tokens.get(op.key);
        if (existingValue !== undefined && existingValue !== newValue) {
          this.conflicts.push({
            key: op.key,
            localValue: existingValue,
            remoteValue: op.value,
            resolution: newValue === op.value ? "remote" : "local",
            timestamp: Date.now(),
          });
        }
        break;
      }
      case "orset-add":
        this.components.add(op.value as string, op.key, op.tag!);
        break;
      case "orset-remove":
        this.components.remove(op.key, op.value as string[]);
        break;
    }

    this.operations.push(op);
  }

  // Peer management
  addPeer(id: string, name: string): void {
    this.peers.set(id, {
      id,
      name,
      color: this.generateColor(id),
      lastSeen: Date.now(),
      active: true,
    });
  }

  removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) {
      peer.active = false;
    }
  }

  updatePeerCursor(id: string, x: number, y: number): void {
    const peer = this.peers.get(id);
    if (peer) {
      peer.cursor = { x, y };
      peer.lastSeen = Date.now();
    }
  }

  getActivePeers(): Peer[] {
    return [...this.peers.values()].filter(p => p.active);
  }

  // State
  getConflicts(): ConflictRecord[] {
    return [...this.conflicts];
  }

  getOperationCount(): number {
    return this.operations.length;
  }

  getClock(): VectorClock {
    return { ...this.clock };
  }

  getTokenCount(): number {
    return this.tokens.size;
  }

  private generateColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
}
