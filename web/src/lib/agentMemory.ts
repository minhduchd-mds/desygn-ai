/**
 * agentMemory — Persistent memory layer for AI agents.
 *
 * 4-Tier Architecture:
 *   1. Working Memory  — Current session (in-memory Map)
 *   2. Episodic Memory — Recent interactions (IndexedDB, max 500)
 *   3. Semantic Memory — Learned patterns (IndexedDB, consolidated)
 *   4. Procedural Memory — Reusable actions (IndexedDB, permanent)
 *
 * Features:
 *   • IndexedDB-backed persistence (offline-first)
 *   • BM25 text search across all tiers
 *   • Pattern consolidation (episodic → semantic)
 *   • CommandBus integration (undo/redo persisted)
 *   • EventBus integration (auto-capture design events)
 *
 * Competitive Advantage:
 *   Unlike Figma's stateless code gen, AgentMemory learns from:
 *   - Developer feedback loops
 *   - Design system patterns across projects
 *   - Component naming conventions per team
 *   - Code generation errors and fixes
 */

import { eventBus } from "./eventBus";

// ── Types ─────────────────────────────────────────────────────

export type MemoryTier = "working" | "episodic" | "semantic" | "procedural";

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  type: MemoryEntryType;
  content: string;
  metadata: MemoryMetadata;
  embedding?: number[]; // Future: vector embedding for similarity search
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  score: number; // Relevance score (BM25 or custom)
}

export type MemoryEntryType =
  | "design-pattern"      // Recurring design patterns
  | "component-mapping"   // Figma component → code mapping
  | "naming-convention"   // Team naming rules
  | "code-feedback"       // Developer corrections
  | "generation-result"   // Code gen outputs (success/fail)
  | "design-token"        // Token usage patterns
  | "command-history"     // CommandBus persisted actions
  | "project-context";    // Project-level metadata

export interface MemoryMetadata {
  projectId?: string;
  componentName?: string;
  framework?: string;
  tags: string[];
  confidence: number;     // 0-1 confidence in this memory
  source: string;         // Where this memory came from
}

export interface MemoryQuery {
  text?: string;
  type?: MemoryEntryType;
  tier?: MemoryTier;
  tags?: string[];
  projectId?: string;
  limit?: number;
  minConfidence?: number;
}

export interface ConsolidationResult {
  merged: number;
  pruned: number;
  promoted: number; // episodic → semantic
}

// ── Constants ─────────────────────────────────────────────────

const DB_NAME = "designready-agent-memory";
const DB_VERSION = 1;
const STORE_NAME = "memories";
const MAX_EPISODIC = 500;
const MAX_WORKING = 100;
const CONSOLIDATION_THRESHOLD = 10; // Same pattern seen N times → promote

// ── IndexedDB Helpers ─────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("tier", "tier", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("projectId", "metadata.projectId", { unique: false });
        store.createIndex("tags", "metadata.tags", { unique: false, multiEntry: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbTransaction(
  db: IDBDatabase,
  mode: IDBTransactionMode = "readonly",
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function dbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── BM25 Simple Text Search ───────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean);
}

function computeBM25(query: string, document: string, k1 = 1.5, b = 0.75): number {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);
  const docLen = docTokens.length;
  const avgDocLen = 50; // Approximate average

  const termFreq = new Map<string, number>();
  for (const token of docTokens) {
    termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTokens) {
    const tf = termFreq.get(term) ?? 0;
    if (tf === 0) continue;
    const idf = Math.log(1 + 1 / (tf + 0.5)); // simplified IDF
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
    score += idf * (numerator / denominator);
  }

  return score;
}

// ── AgentMemory Class ─────────────────────────────────────────

export class AgentMemory {
  private working = new Map<string, MemoryEntry>();
  private db: IDBDatabase | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await openDB();
    this.initialized = true;
    this.subscribeToEvents();
  }

  // ── Core CRUD ───────────────────────────────────────────────

  async store(entry: Omit<MemoryEntry, "id" | "createdAt" | "accessedAt" | "accessCount" | "score">): Promise<string> {
    await this.ensureInit();
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: MemoryEntry = {
      ...entry,
      id,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      score: entry.metadata.confidence,
    };

    if (entry.tier === "working") {
      this.working.set(id, record);
      if (this.working.size > MAX_WORKING) {
        const oldest = [...this.working.entries()]
          .sort((a, b) => a[1].accessedAt - b[1].accessedAt)[0];
        if (oldest) this.working.delete(oldest[0]);
      }
    } else {
      const store = dbTransaction(this.db!, "readwrite");
      await dbRequest(store.put(record));
    }

    return id;
  }

  async retrieve(id: string): Promise<MemoryEntry | null> {
    await this.ensureInit();

    // Check working memory first
    if (this.working.has(id)) {
      const entry = this.working.get(id)!;
      entry.accessedAt = Date.now();
      entry.accessCount++;
      return entry;
    }

    // Check IndexedDB
    const store = dbTransaction(this.db!);
    const entry = await dbRequest(store.get(id)) as MemoryEntry | undefined;
    if (entry) {
      entry.accessedAt = Date.now();
      entry.accessCount++;
      // Update access stats
      const writeStore = dbTransaction(this.db!, "readwrite");
      await dbRequest(writeStore.put(entry));
    }
    return entry ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInit();
    this.working.delete(id);
    const store = dbTransaction(this.db!, "readwrite");
    await dbRequest(store.delete(id));
  }

  // ── Search ──────────────────────────────────────────────────

  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    await this.ensureInit();
    const limit = query.limit ?? 20;
    const minConfidence = query.minConfidence ?? 0;

    // Collect all entries from matching tier
    let entries: MemoryEntry[] = [];

    // Working memory
    if (!query.tier || query.tier === "working") {
      entries.push(...this.working.values());
    }

    // IndexedDB entries
    if (!query.tier || query.tier !== "working") {
      const store = dbTransaction(this.db!);
      const allEntries = await dbRequest(store.getAll()) as MemoryEntry[];
      entries.push(...allEntries);
    }

    // Filter by type
    if (query.type) {
      entries = entries.filter(e => e.type === query.type);
    }

    // Filter by tier
    if (query.tier) {
      entries = entries.filter(e => e.tier === query.tier);
    }

    // Filter by project
    if (query.projectId) {
      entries = entries.filter(e => e.metadata.projectId === query.projectId);
    }

    // Filter by tags
    if (query.tags?.length) {
      entries = entries.filter(e =>
        query.tags!.some(tag => e.metadata.tags.includes(tag))
      );
    }

    // Filter by confidence
    entries = entries.filter(e => e.metadata.confidence >= minConfidence);

    // BM25 scoring if text query provided
    if (query.text) {
      entries = entries.map(e => ({
        ...e,
        score: computeBM25(query.text!, e.content),
      })).filter(e => e.score > 0);
    }

    // Sort by score descending, then by accessedAt
    entries.sort((a, b) => b.score - a.score || b.accessedAt - a.accessedAt);

    return entries.slice(0, limit);
  }

  // ── Pattern Learning ────────────────────────────────────────

  /**
   * Record a design pattern observation.
   * After CONSOLIDATION_THRESHOLD observations, promotes to semantic memory.
   */
  async learnPattern(
    componentName: string,
    pattern: string,
    projectId: string,
    framework = "react",
  ): Promise<void> {
    await this.ensureInit();

    // Check if similar pattern already exists
    const existing = await this.search({
      text: `${componentName} ${pattern}`,
      type: "design-pattern",
      limit: 5,
    });

    const similar = existing.find(e =>
      e.metadata.componentName === componentName &&
      computeBM25(pattern, e.content) > 2.0
    );

    if (similar) {
      // Increment access count (pattern seen again)
      similar.accessCount++;
      similar.accessedAt = Date.now();
      similar.metadata.confidence = Math.min(1, similar.metadata.confidence + 0.05);

      // Promote to semantic if threshold reached
      if (similar.accessCount >= CONSOLIDATION_THRESHOLD && similar.tier === "episodic") {
        similar.tier = "semantic";
        similar.metadata.confidence = Math.min(1, similar.metadata.confidence + 0.2);
      }

      const store = dbTransaction(this.db!, "readwrite");
      await dbRequest(store.put(similar));
    } else {
      // Store new pattern in episodic memory
      await this.store({
        tier: "episodic",
        type: "design-pattern",
        content: `[${componentName}] ${pattern}`,
        metadata: {
          projectId,
          componentName,
          framework,
          tags: ["design-pattern", componentName.toLowerCase()],
          confidence: 0.3,
          source: "design-scan",
        },
      });
    }
  }

  /**
   * Record code generation feedback.
   * Helps the system learn what works and what doesn't.
   */
  async recordFeedback(
    componentName: string,
    generatedCode: string,
    feedback: "positive" | "negative" | "corrected",
    correction?: string,
  ): Promise<void> {
    await this.ensureInit();

    const content = feedback === "corrected"
      ? `[CORRECTION] ${componentName}: ${correction}`
      : `[${feedback.toUpperCase()}] ${componentName}: ${generatedCode.slice(0, 200)}`;

    await this.store({
      tier: feedback === "corrected" ? "procedural" : "episodic",
      type: "code-feedback",
      content,
      metadata: {
        componentName,
        tags: ["feedback", feedback, componentName.toLowerCase()],
        confidence: feedback === "corrected" ? 0.9 : 0.5,
        source: "developer-feedback",
      },
    });
  }

  /**
   * Record a component → code mapping for future reference.
   */
  async recordMapping(
    componentName: string,
    figmaStructure: string,
    codeOutput: string,
    framework: string,
    projectId: string,
  ): Promise<void> {
    await this.ensureInit();

    await this.store({
      tier: "episodic",
      type: "component-mapping",
      content: `${componentName}\n---FIGMA---\n${figmaStructure}\n---CODE---\n${codeOutput}`,
      metadata: {
        projectId,
        componentName,
        framework,
        tags: ["mapping", framework, componentName.toLowerCase()],
        confidence: 0.6,
        source: "code-generation",
      },
    });
  }

  // ── Consolidation ───────────────────────────────────────────

  /**
   * Run memory consolidation: merge duplicates, prune old episodic,
   * promote frequently-accessed patterns to semantic.
   */
  async consolidate(): Promise<ConsolidationResult> {
    await this.ensureInit();
    const result: ConsolidationResult = { merged: 0, pruned: 0, promoted: 0 };

    const store = dbTransaction(this.db!, "readwrite");
    const allEntries = await dbRequest(store.getAll()) as MemoryEntry[];

    // 1. Prune old episodic entries beyond MAX
    const episodic = allEntries
      .filter(e => e.tier === "episodic")
      .sort((a, b) => b.accessedAt - a.accessedAt);

    if (episodic.length > MAX_EPISODIC) {
      const toDelete = episodic.slice(MAX_EPISODIC);
      for (const entry of toDelete) {
        const deleteStore = dbTransaction(this.db!, "readwrite");
        await dbRequest(deleteStore.delete(entry.id));
        result.pruned++;
      }
    }

    // 2. Promote high-access episodic → semantic
    for (const entry of episodic) {
      if (entry.accessCount >= CONSOLIDATION_THRESHOLD && entry.tier === "episodic") {
        entry.tier = "semantic";
        entry.metadata.confidence = Math.min(1, entry.metadata.confidence + 0.2);
        const writeStore = dbTransaction(this.db!, "readwrite");
        await dbRequest(writeStore.put(entry));
        result.promoted++;
      }
    }

    return result;
  }

  // ── Statistics ──────────────────────────────────────────────

  async getStats(): Promise<{
    working: number;
    episodic: number;
    semantic: number;
    procedural: number;
    total: number;
  }> {
    await this.ensureInit();
    const store = dbTransaction(this.db!);
    const allEntries = await dbRequest(store.getAll()) as MemoryEntry[];

    const counts = { working: this.working.size, episodic: 0, semantic: 0, procedural: 0, total: 0 };
    for (const entry of allEntries) {
      if (entry.tier === "episodic") counts.episodic++;
      else if (entry.tier === "semantic") counts.semantic++;
      else if (entry.tier === "procedural") counts.procedural++;
    }
    counts.total = counts.working + counts.episodic + counts.semantic + counts.procedural;
    return counts;
  }

  // ── Export/Import (Portability) ─────────────────────────────

  async exportAll(): Promise<MemoryEntry[]> {
    await this.ensureInit();
    const store = dbTransaction(this.db!);
    const allEntries = await dbRequest(store.getAll()) as MemoryEntry[];
    return [...this.working.values(), ...allEntries];
  }

  async importBatch(entries: MemoryEntry[]): Promise<number> {
    await this.ensureInit();
    let imported = 0;
    for (const entry of entries) {
      if (entry.tier === "working") {
        this.working.set(entry.id, entry);
      } else {
        const store = dbTransaction(this.db!, "readwrite");
        await dbRequest(store.put(entry));
      }
      imported++;
    }
    return imported;
  }

  /** Clear all memories (use in tests or logout). */
  async clear(): Promise<void> {
    this.working.clear();
    if (this.db) {
      const store = dbTransaction(this.db, "readwrite");
      await dbRequest(store.clear());
    }
  }

  // ── Private Helpers ─────────────────────────────────────────

  private async ensureInit(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  /**
   * Auto-capture design events into memory.
   */
  private subscribeToEvents(): void {
    eventBus.on("design:generated", (payload) => {
      this.store({
        tier: "episodic",
        type: "generation-result",
        content: `Generated ${payload.template} for ${payload.projectName} in ${payload.durationMs}ms`,
        metadata: {
          projectId: payload.projectName,
          tags: ["generation", payload.template],
          confidence: 0.5,
          source: "event-capture",
        },
      });
    });

    eventBus.on("project:created", (payload) => {
      this.store({
        tier: "working",
        type: "project-context",
        content: `Project: ${payload.name} | Category: ${payload.category} | Template: ${payload.template}`,
        metadata: {
          projectId: payload.name,
          tags: ["project", payload.category],
          confidence: 1.0,
          source: "event-capture",
        },
      });
    });
  }
}

// ── Singleton export ──────────────────────────────────────────

export const agentMemory = new AgentMemory();
