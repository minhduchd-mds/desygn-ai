/**
 * Server Sync Engine — IndexedDB ↔ Server persistence bridge.
 * LWW (Last-Writer-Wins) conflict resolution with offline queue support.
 */

// ─── Types ─────────────────────────────────────────────

export interface ServerSyncConfig {
  serverUrl: string;
  authToken?: string;
  syncIntervalMs?: number;
  batchSize?: number;
  retryAttempts?: number;
}

export interface MemoryRecord {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  version: number;
  updatedAt: number;
  deletedAt?: number;
  checksum?: string;
}

export interface SyncStatus {
  state: "idle" | "syncing" | "error" | "offline";
  lastSyncAt: number | null;
  pendingPush: number;
  pendingPull: number;
  conflicts: number;
  error?: string;
}

export interface ConflictRecord {
  id: string;
  local: MemoryRecord;
  remote: MemoryRecord;
  resolution?: "local" | "remote" | "merged";
}

export type ConflictStrategy = "lww" | "local-wins" | "remote-wins" | "manual";

interface SyncBatch {
  records: MemoryRecord[];
  cursor?: string;
  hasMore: boolean;
}

// ─── Constants ─────────────────────────────────────────

const DEFAULT_SYNC_INTERVAL = 30_000; // 30s
const DEFAULT_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ─── ServerSyncEngine ─────────────────────────────────

export class ServerSyncEngine {
  private config: ServerSyncConfig | null = null;
  private status: SyncStatus = {
    state: "idle",
    lastSyncAt: null,
    pendingPush: 0,
    pendingPull: 0,
    conflicts: 0,
  };
  private conflicts: ConflictRecord[] = [];
  private pushQueue: MemoryRecord[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private conflictStrategy: ConflictStrategy = "lww";
  private onSyncCallback?: (status: SyncStatus) => void;
  private onConflictCallback?: (conflicts: ConflictRecord[]) => void;

  configure(config: ServerSyncConfig): void {
    this.config = {
      ...config,
      syncIntervalMs: config.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      retryAttempts: config.retryAttempts ?? MAX_RETRIES,
    };
  }

  setConflictStrategy(strategy: ConflictStrategy): void {
    this.conflictStrategy = strategy;
  }

  onSync(callback: (status: SyncStatus) => void): void {
    this.onSyncCallback = callback;
  }

  onConflict(callback: (conflicts: ConflictRecord[]) => void): void {
    this.onConflictCallback = callback;
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  getConflicts(): ConflictRecord[] {
    return [...this.conflicts];
  }

  // ─── Push (Local → Server) ────────────────────────────

  queuePush(records: MemoryRecord[]): void {
    this.pushQueue.push(...records);
    this.status.pendingPush = this.pushQueue.length;
    this.notify();
  }

  async pushMemories(): Promise<{ pushed: number; failed: number }> {
    if (!this.config) throw new Error("ServerSync not configured");
    if (this.pushQueue.length === 0) return { pushed: 0, failed: 0 };

    this.status.state = "syncing";
    this.notify();

    let pushed = 0;
    let failed = 0;
    const batchSize = this.config.batchSize ?? DEFAULT_BATCH_SIZE;

    while (this.pushQueue.length > 0) {
      const batch = this.pushQueue.splice(0, batchSize);

      try {
        const response = await this.apiPost<{ accepted: number; conflicts: Array<{ id: string; remote: MemoryRecord }> }>(
          "/sync/push",
          { records: batch },
        );

        pushed += response.accepted;

        // Handle conflicts from server
        if (response.conflicts?.length) {
          for (const conflict of response.conflicts) {
            const local = batch.find((r) => r.id === conflict.id);
            if (local) {
              this.handleConflict(local, conflict.remote);
            }
          }
        }
      } catch (err) {
        // Re-queue failed batch
        this.pushQueue.unshift(...batch);
        failed += batch.length;
        this.status.error = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    this.status.pendingPush = this.pushQueue.length;
    this.status.state = failed > 0 ? "error" : "idle";
    this.status.lastSyncAt = Date.now();
    this.notify();

    return { pushed, failed };
  }

  // ─── Pull (Server → Local) ────────────────────────────

  async pullMemories(since?: number): Promise<MemoryRecord[]> {
    if (!this.config) throw new Error("ServerSync not configured");

    this.status.state = "syncing";
    this.notify();

    const allRecords: MemoryRecord[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const batch = await this.apiGet<SyncBatch>("/sync/pull", {
          since: since ?? this.status.lastSyncAt ?? 0,
          cursor,
          limit: this.config.batchSize ?? DEFAULT_BATCH_SIZE,
        });

        allRecords.push(...batch.records);
        cursor = batch.cursor;
        hasMore = batch.hasMore;
      }

      this.status.pendingPull = 0;
      this.status.state = "idle";
      this.status.lastSyncAt = Date.now();
    } catch (err) {
      this.status.state = "error";
      this.status.error = err instanceof Error ? err.message : String(err);
    }

    this.notify();
    return allRecords;
  }

  // ─── Full Sync ────────────────────────────────────────

  async fullSync(localRecords: MemoryRecord[]): Promise<{
    pushed: number;
    pulled: MemoryRecord[];
    conflicts: ConflictRecord[];
  }> {
    // Push local changes
    this.queuePush(localRecords);
    const pushResult = await this.pushMemories();

    // Pull remote changes
    const pulled = await this.pullMemories();

    return {
      pushed: pushResult.pushed,
      pulled,
      conflicts: this.conflicts,
    };
  }

  // ─── Conflict Resolution ──────────────────────────────

  resolveConflict(id: string, resolution: "local" | "remote" | "merged", mergedData?: Record<string, unknown>): void {
    const conflict = this.conflicts.find((c) => c.id === id);
    if (!conflict) return;

    conflict.resolution = resolution;

    let resolved: MemoryRecord;
    switch (resolution) {
      case "local":
        resolved = conflict.local;
        break;
      case "remote":
        resolved = conflict.remote;
        break;
      case "merged":
        resolved = { ...conflict.local, data: mergedData ?? conflict.local.data, version: Math.max(conflict.local.version, conflict.remote.version) + 1 };
        break;
    }

    // Queue the resolved record for push
    this.queuePush([resolved]);

    // Remove from conflicts
    this.conflicts = this.conflicts.filter((c) => c.id !== id);
    this.status.conflicts = this.conflicts.length;
    this.notify();
  }

  resolveAllConflicts(strategy?: ConflictStrategy): void {
    const s = strategy ?? this.conflictStrategy;
    const toResolve = [...this.conflicts];

    for (const conflict of toResolve) {
      switch (s) {
        case "lww":
          this.resolveConflict(
            conflict.id,
            conflict.local.updatedAt >= conflict.remote.updatedAt ? "local" : "remote",
          );
          break;
        case "local-wins":
          this.resolveConflict(conflict.id, "local");
          break;
        case "remote-wins":
          this.resolveConflict(conflict.id, "remote");
          break;
        case "manual":
          // Leave for manual resolution
          break;
      }
    }
  }

  // ─── Auto Sync ────────────────────────────────────────

  startAutoSync(): void {
    if (this.syncTimer) return;
    const interval = this.config?.syncIntervalMs ?? DEFAULT_SYNC_INTERVAL;

    this.syncTimer = setInterval(async () => {
      if (this.status.state === "syncing") return;
      try {
        await this.pushMemories();
        await this.pullMemories();
      } catch {
        this.status.state = "error";
        this.notify();
      }
    }, interval);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ─── Snapshot Export/Import ────────────────────────────

  async exportSnapshot(): Promise<string> {
    const data = {
      version: 1,
      exportedAt: Date.now(),
      status: this.status,
      pendingQueue: this.pushQueue,
      conflicts: this.conflicts,
    };
    return JSON.stringify(data);
  }

  async importSnapshot(json: string): Promise<void> {
    const data = JSON.parse(json);
    if (data.version !== 1) throw new Error("Unsupported snapshot version");
    this.pushQueue = data.pendingQueue ?? [];
    this.conflicts = data.conflicts ?? [];
    this.status.pendingPush = this.pushQueue.length;
    this.status.conflicts = this.conflicts.length;
    this.notify();
  }

  // ─── Private ──────────────────────────────────────────

  private handleConflict(local: MemoryRecord, remote: MemoryRecord): void {
    if (this.conflictStrategy !== "manual") {
      // Auto-resolve
      const resolution = this.conflictStrategy === "lww"
        ? (local.updatedAt >= remote.updatedAt ? "local" : "remote")
        : this.conflictStrategy === "local-wins" ? "local" : "remote";

      this.queuePush([resolution === "local" ? local : remote]);
      return;
    }

    // Manual — store for user resolution
    this.conflicts.push({ id: local.id, local, remote });
    this.status.conflicts = this.conflicts.length;
    this.onConflictCallback?.(this.conflicts);
    this.notify();
  }

  private notify(): void {
    this.onSyncCallback?.(this.status);
  }

  private async apiGet<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.config) throw new Error("Not configured");

    const url = new URL(`${this.config.serverUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
    }

    return this.fetchWithRetry<T>(url.toString(), { method: "GET" });
  }

  private async apiPost<T>(endpoint: string, body: unknown): Promise<T> {
    if (!this.config) throw new Error("Not configured");
    const url = `${this.config.serverUrl}${endpoint}`;
    return this.fetchWithRetry<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async fetchWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    const maxRetries = this.config?.retryAttempts ?? MAX_RETRIES;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(this.config?.authToken ? { "Authorization": `Bearer ${this.config.authToken}` } : {}),
          },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Server ${response.status}: ${text.slice(0, 200)}`);
        }

        return await response.json() as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
        }
      }
    }

    this.status.state = "offline";
    this.notify();
    throw lastError ?? new Error("Request failed");
  }
}

// ─── Factory ───────────────────────────────────────────

export function createServerSync(config?: ServerSyncConfig): ServerSyncEngine {
  const engine = new ServerSyncEngine();
  if (config) engine.configure(config);
  return engine;
}
