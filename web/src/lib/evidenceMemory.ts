/**
 * Evidence-Based Memory Engine v3
 * Self-Learning Agent Core — Production-grade implementation
 *
 * Architecture:
 *   • HNSW vector search for semantic similarity (O(log n) vs O(n))
 *   • StatsCache for O(1) statistics retrieval
 *   • Sigmoid decay curve (realistic knowledge half-life)
 *   • Tag-indexed contradiction detection (O(k) vs O(n²))
 *   • Atomic store/validate/delete operations
 *   • Garbage collection for expired records (confidence = 0)
 *
 * Philosophy: "Memory is not truth. Memory is candidate evidence.
 *             Validated source is truth."
 */

import { HNSWIndex, SimpleEmbedding } from "./hnswVectorSearch";
import { StatsCache } from "./performanceOptimizations";

// ── Types ─────────────────────────────────────────────────────

export type EvidenceSource = "design-file" | "user-feedback" | "ai-inference" | "pattern-match";

export interface EvidenceRecord {
  id: string;
  content: string;
  source: EvidenceSource;
  confidence: number; // 0.0 - 1.0
  validated: boolean;
  validatedBy?: "design-file" | "user-feedback" | "developer";
  validatedAt?: number;
  contradictions: string[];
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface Contradiction {
  recordId: string;
  conflictingId: string;
  conflictType: "value-mismatch" | "semantic-conflict" | "version-conflict";
  severity: "low" | "medium" | "high";
  details: string;
}

export interface EvidenceMemoryConfig {
  decayRatePerDay?: number;         // default 0.05
  minConfidenceThreshold?: number;  // default 0.3
  maxRecords?: number;              // default 10000
  enableVectorSearch?: boolean;     // default true
  vectorDimensions?: number;        // default 128
  decayFunction?: "linear" | "sigmoid"; // default sigmoid
  gcThreshold?: number;             // default 0.05 — remove records below this
}

export interface MemoryStats {
  totalRecords: number;
  validatedRecords: number;
  contradictions: number;
  averageConfidence: number;
  recordsBySource: Record<EvidenceSource, number>;
}

// ── Constants ─────────────────────────────────────────────────

const SOURCE_HIERARCHY: Record<EvidenceSource, number> = {
  "design-file": 4,
  "user-feedback": 3,
  "ai-inference": 2,
  "pattern-match": 1,
};

// ── Engine ────────────────────────────────────────────────────

export class EvidenceMemoryEngine {
  private records: Map<string, EvidenceRecord> = new Map();
  private sourceIndex: Map<EvidenceSource, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private contradictionIndex: Map<string, Contradiction[]> = new Map();
  private config: Required<EvidenceMemoryConfig>;
  private isConfigured = false;

  // Performance: O(1) stats via running counters
  private statsCache: StatsCache;

  // Performance: O(log n) semantic search via HNSW
  private vectorIndex: HNSWIndex | null = null;
  private embedder: SimpleEmbedding | null = null;

  // Monotonic ID counter for uniqueness
  private idCounter = 0;

  constructor() {
    this.config = {
      decayRatePerDay: 0.05,
      minConfidenceThreshold: 0.3,
      maxRecords: 10000,
      enableVectorSearch: true,
      vectorDimensions: 128,
      decayFunction: "sigmoid",
      gcThreshold: 0.05,
    };

    this.statsCache = new StatsCache();

    // Initialize source index
    const sources: EvidenceSource[] = ["design-file", "user-feedback", "ai-inference", "pattern-match"];
    sources.forEach((source) => this.sourceIndex.set(source, new Set()));
  }

  // ── Configuration ───────────────────────────────────────────

  configure(config: EvidenceMemoryConfig): void {
    this.config = { ...this.config, ...config };
    this.isConfigured = true;

    // Initialize vector search if enabled
    if (this.config.enableVectorSearch && !this.vectorIndex) {
      this.vectorIndex = new HNSWIndex({
        dimensions: this.config.vectorDimensions,
        maxElements: this.config.maxRecords,
        M: 16,
        efConstruction: 200,
        efSearch: 50,
      });
      this.embedder = new SimpleEmbedding(this.config.vectorDimensions);
    }
  }

  // ── Store ───────────────────────────────────────────────────

  async storeEvidence(record: Omit<EvidenceRecord, "id" | "createdAt" | "lastAccessedAt" | "accessCount">): Promise<string> {
    if (!this.isConfigured) throw new Error("Memory engine not configured");
    if (this.records.size >= this.config.maxRecords) {
      // Try GC before failing
      await this.garbageCollect();
      if (this.records.size >= this.config.maxRecords) {
        throw new Error(`Memory limit reached (${this.config.maxRecords} records)`);
      }
    }

    const id = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${(++this.idCounter).toString(36)}`;
    const now = Date.now();

    const newRecord: EvidenceRecord = {
      ...record,
      id,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      contradictions: [],
    };

    // Atomic insert: update all indexes together
    this.records.set(id, newRecord);
    this.sourceIndex.get(record.source)?.add(id);

    for (const tag of record.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    }

    // Update stats cache (O(1))
    this.statsCache.onRecordAdded(record.source, record.confidence, record.validated);

    // Insert into HNSW vector index for semantic search
    if (this.vectorIndex && this.embedder && record.content.length > 0) {
      try {
        const embedding = this.embedder.embed(record.content);
        this.vectorIndex.insert(id, embedding);
      } catch {
        // Non-critical: vector search degrades gracefully
      }
    }

    // Detect contradictions against tag-matching records only
    await this.detectContradictionsForRecord(id);

    return id;
  }

  // ── Recall ──────────────────────────────────────────────────

  async recallEvidence(
    query: string,
    options?: {
      minConfidence?: number;
      onlySources?: EvidenceSource[];
      onlyValidated?: boolean;
      limit?: number;
    }
  ): Promise<EvidenceRecord[]> {
    const minConfidence = options?.minConfidence ?? this.config.minConfidenceThreshold;
    const onlyValidated = options?.onlyValidated ?? false;
    const limit = options?.limit ?? 50;
    const onlySources = options?.onlySources;
    const now = Date.now();

    // Strategy 1: Use HNSW vector search if query is non-empty and vector search is enabled
    let candidateIds: Set<string> | null = null;

    if (query && query.trim().length > 0 && this.vectorIndex && this.embedder && this.vectorIndex.size > 0) {
      const queryEmbedding = this.embedder.embed(query);
      const searchResults = this.vectorIndex.search(queryEmbedding, Math.min(limit * 3, this.records.size));
      candidateIds = new Set(searchResults.map((r) => r.id));
    }

    // Strategy 2: Fallback to text matching
    const results: EvidenceRecord[] = [];
    const candidates = candidateIds
      ? Array.from(candidateIds).map((id) => this.records.get(id)).filter(Boolean) as EvidenceRecord[]
      : Array.from(this.records.values());

    for (const record of candidates) {
      if (record.confidence < minConfidence) continue;
      if (onlyValidated && !record.validated) continue;
      if (onlySources && !onlySources.includes(record.source)) continue;

      // Apply decay calculation (read-only, doesn't mutate)
      const decayedConfidence = this.calculateDecayedConfidence(record, now);
      if (decayedConfidence < minConfidence) continue;

      // Text match filter (for non-vector search or as secondary filter)
      if (!candidateIds && !this.contentMatches(record.content, query)) continue;

      // Update access stats
      record.lastAccessedAt = now;
      record.accessCount++;

      results.push({ ...record, confidence: decayedConfidence });
    }

    // Sort: source hierarchy → confidence (descending)
    results.sort((a, b) => {
      const srcDiff = SOURCE_HIERARCHY[b.source] - SOURCE_HIERARCHY[a.source];
      if (srcDiff !== 0) return srcDiff;
      return b.confidence - a.confidence;
    });

    return results.slice(0, limit);
  }

  // ── Validate ────────────────────────────────────────────────

  async validateEvidence(
    recordId: string,
    source: "design-file" | "user-feedback" | "developer",
    _sourceDetails?: string
  ): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const oldConfidence = record.confidence;

    // Mark as validated
    record.validated = true;
    record.validatedBy = source;
    record.validatedAt = Date.now();

    // Boost confidence based on validation source authority
    const boost = source === "design-file" ? 0.4 : source === "user-feedback" ? 0.25 : 0.1;
    record.confidence = Math.min(1.0, record.confidence + boost);

    // Update stats cache
    this.statsCache.onRecordValidated(oldConfidence, record.confidence);

    // Clear contradictions — validated record is authoritative
    this.clearContradictionsFor(recordId);
  }

  // ── Decay ───────────────────────────────────────────────────

  async decayUnvalidated(): Promise<number> {
    let decayedCount = 0;
    const now = Date.now();
    const toDelete: string[] = [];

    for (const record of this.records.values()) {
      if (record.validated) continue;

      const timeSinceLastDecay = now - record.lastAccessedAt;
      const daysSinceLastDecay = timeSinceLastDecay / (1000 * 60 * 60 * 24);
      if (daysSinceLastDecay <= 0) continue;

      const oldConfidence = record.confidence;
      const newConfidence = this.applyDecay(record.confidence, daysSinceLastDecay);

      if (newConfidence < oldConfidence) {
        record.confidence = newConfidence;
        record.lastAccessedAt = now;
        decayedCount++;

        // Update stats
        this.statsCache.onConfidenceChanged(oldConfidence, newConfidence);

        // Tag for review (deduplicated)
        if (newConfidence < this.config.minConfidenceThreshold && !record.tags.includes("needs-review")) {
          record.tags.push("needs-review");
          if (!this.tagIndex.has("needs-review")) this.tagIndex.set("needs-review", new Set());
          this.tagIndex.get("needs-review")!.add(record.id);
        }

        // Mark for GC if below threshold
        if (newConfidence <= this.config.gcThreshold) {
          toDelete.push(record.id);
        }
      }
    }

    // Garbage collect expired records
    for (const id of toDelete) {
      this.deleteRecord(id);
    }

    return decayedCount;
  }

  // ── Promote ─────────────────────────────────────────────────

  async promoteToTruth(recordId: string): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const oldConfidence = record.confidence;
    record.validated = true;
    record.confidence = 1.0;
    record.validatedAt = Date.now();
    record.validatedBy = "developer";

    this.statsCache.onRecordValidated(oldConfidence, 1.0);
  }

  // ── Contradictions ──────────────────────────────────────────

  async detectContradictions(): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    const recordArray = Array.from(this.records.values());

    for (let i = 0; i < recordArray.length; i++) {
      for (let j = i + 1; j < recordArray.length; j++) {
        const r1 = recordArray[i];
        const r2 = recordArray[j];
        if (r1.validated || r2.validated) continue;

        const result = this.detectContradictionBetween(r1, r2);
        if (result) contradictions.push(...result);
      }
    }

    return contradictions;
  }

  getContradictions(recordId: string): Contradiction[] {
    return this.contradictionIndex.get(recordId) || [];
  }

  async resolveContradiction(recordId: string, keepSource: EvidenceSource): Promise<void> {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const contradictions = this.contradictionIndex.get(recordId) || [];
    for (const c of contradictions) {
      const conflicting = this.records.get(c.conflictingId);
      if (!conflicting) continue;

      if (conflicting.source !== keepSource) {
        this.deleteRecord(c.conflictingId);
      }
    }

    this.contradictionIndex.delete(recordId);
    record.contradictions = [];
  }

  // ── Stats (O(1) via cache) ──────────────────────────────────

  getStats(): MemoryStats {
    const cached = this.statsCache.getStats();
    return {
      totalRecords: this.records.size, // Source of truth for count
      validatedRecords: cached.validatedRecords,
      contradictions: cached.contradictions,
      averageConfidence: cached.averageConfidence,
      recordsBySource: {
        "design-file": this.sourceIndex.get("design-file")?.size ?? 0,
        "user-feedback": this.sourceIndex.get("user-feedback")?.size ?? 0,
        "ai-inference": this.sourceIndex.get("ai-inference")?.size ?? 0,
        "pattern-match": this.sourceIndex.get("pattern-match")?.size ?? 0,
      },
    };
  }

  // ── Snapshot ────────────────────────────────────────────────

  async exportSnapshot(): Promise<string> {
    return JSON.stringify({
      version: 2, // v3 engine uses snapshot version 2
      exportedAt: Date.now(),
      config: this.config,
      records: Array.from(this.records.values()),
      contradictions: Array.from(this.contradictionIndex.entries()),
    });
  }

  async importSnapshot(snapshotJson: string): Promise<void> {
    const snapshot = JSON.parse(snapshotJson);
    if (snapshot.version !== 1 && snapshot.version !== 2) {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }

    // Clear all state
    this.records.clear();
    this.contradictionIndex.clear();
    this.sourceIndex.forEach((set) => set.clear());
    this.tagIndex.clear();

    if (this.vectorIndex) {
      // Rebuild vector index
      this.vectorIndex = new HNSWIndex({
        dimensions: this.config.vectorDimensions,
        maxElements: this.config.maxRecords,
        M: 16,
        efConstruction: 200,
        efSearch: 50,
      });
    }

    // Rebuild vocabulary from imported records
    if (this.embedder && snapshot.records.length > 0) {
      this.embedder.buildVocabulary(snapshot.records.map((r: EvidenceRecord) => r.content));
    }

    // Restore records and rebuild all indexes
    for (const record of snapshot.records) {
      this.records.set(record.id, record);
      this.sourceIndex.get(record.source)?.add(record.id);

      for (const tag of record.tags || []) {
        if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
        this.tagIndex.get(tag)!.add(record.id);
      }

      // Rebuild vector index
      if (this.vectorIndex && this.embedder && record.content) {
        try {
          this.vectorIndex.insert(record.id, this.embedder.embed(record.content));
        } catch { /* skip on error */ }
      }

      // Track max ID counter
      const idParts = record.id.split("_");
      const counterPart = idParts[idParts.length - 1];
      const counter = parseInt(counterPart, 36);
      if (!isNaN(counter) && counter > this.idCounter) {
        this.idCounter = counter;
      }
    }

    for (const [recordId, contradictions] of snapshot.contradictions) {
      this.contradictionIndex.set(recordId, contradictions);
    }

    // Rebuild stats cache from scratch
    this.statsCache.recompute(
      Array.from(this.records.values()).map((r) => ({
        source: r.source,
        confidence: r.confidence,
        validated: r.validated,
      }))
    );
  }

  /**
   * Train the embedding model on current corpus
   * Call after bulk import for better vector search accuracy
   */
  trainEmbeddings(): void {
    if (!this.embedder || !this.vectorIndex) return;

    const contents = Array.from(this.records.values()).map((r) => r.content);
    if (contents.length === 0) return;

    this.embedder.buildVocabulary(contents);

    // Rebuild vector index with new embeddings
    this.vectorIndex = new HNSWIndex({
      dimensions: this.config.vectorDimensions,
      maxElements: this.config.maxRecords,
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    });

    for (const record of this.records.values()) {
      if (record.content) {
        try {
          this.vectorIndex.insert(record.id, this.embedder.embed(record.content));
        } catch { /* skip errors */ }
      }
    }
  }

  // ── Private ─────────────────────────────────────────────────

  private calculateDecayedConfidence(record: EvidenceRecord, now: number): number {
    if (record.validated) return record.confidence; // No decay for validated

    const ageMs = now - record.createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return this.applyDecay(record.confidence, ageDays);
  }

  private applyDecay(confidence: number, days: number): number {
    if (this.config.decayFunction === "sigmoid") {
      // Sigmoid decay: confidence drops slowly at first, then rapidly around half-life
      // halfLife = 1 / decayRate (e.g., rate 0.05 → half-life ~20 days)
      const halfLife = 1 / this.config.decayRatePerDay;
      const decayFactor = 1 / (1 + Math.exp((days - halfLife) / (halfLife * 0.3)));
      return confidence * decayFactor;
    }

    // Linear decay (legacy)
    return Math.max(0, confidence - this.config.decayRatePerDay * days);
  }

  private contentMatches(content: string, query: string): boolean {
    if (!query || query.trim().length === 0) return true;

    const contentLower = content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    if (queryWords.length === 0) return true;

    return queryWords.some((word) => contentLower.includes(word));
  }

  private detectContradictionBetween(r1: EvidenceRecord, r2: EvidenceRecord): Contradiction[] | null {
    if (!this.isSimilarContent(r1.content, r2.content)) return null;
    if (!r1.tags.some((tag) => r2.tags.includes(tag))) return null;

    const c1: Contradiction = {
      recordId: r1.id,
      conflictingId: r2.id,
      conflictType: "value-mismatch",
      severity: this.calculateSeverity(r1, r2),
      details: `Conflict: ${r1.source} vs ${r2.source}`,
    };
    const c2: Contradiction = {
      recordId: r2.id,
      conflictingId: r1.id,
      conflictType: "value-mismatch",
      severity: c1.severity,
      details: `Conflict: ${r2.source} vs ${r1.source}`,
    };

    if (!this.contradictionIndex.has(r1.id)) this.contradictionIndex.set(r1.id, []);
    if (!this.contradictionIndex.has(r2.id)) this.contradictionIndex.set(r2.id, []);
    this.contradictionIndex.get(r1.id)!.push(c1);
    this.contradictionIndex.get(r2.id)!.push(c2);
    r1.contradictions.push(r2.id);
    r2.contradictions.push(r1.id);

    this.statsCache.onContradictionChanged(2);

    return [c1, c2];
  }

  private calculateSeverity(r1: EvidenceRecord, r2: EvidenceRecord): "low" | "medium" | "high" {
    const avgConfidence = (r1.confidence + r2.confidence) / 2;
    if (avgConfidence > 0.7) return "high";
    if (avgConfidence > 0.4) return "medium";
    return "low";
  }

  private isSimilarContent(c1: string, c2: string): boolean {
    const words1 = new Set(c1.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
    const words2 = new Set(c2.toLowerCase().split(/\s+/).filter((w) => w.length > 1));

    if (words1.size === 0 || words2.size === 0) return false;

    let intersection = 0;
    for (const w of words1) {
      if (words2.has(w)) intersection++;
    }
    const union = new Set([...words1, ...words2]).size;
    return union > 0 && intersection / union > 0.4;
  }

  private async detectContradictionsForRecord(recordId: string): Promise<void> {
    const record = this.records.get(recordId);
    if (!record || record.tags.length === 0) return;

    // O(k) via tag index
    const candidateIds = new Set<string>();
    for (const tag of record.tags) {
      const tagRecords = this.tagIndex.get(tag);
      if (tagRecords) {
        for (const id of tagRecords) {
          if (id !== recordId) candidateIds.add(id);
        }
      }
    }

    for (const candidateId of candidateIds) {
      const existing = this.records.get(candidateId);
      if (!existing || existing.validated) continue;
      if (this.detectContradictionBetween(record, existing)) break;
    }
  }

  private clearContradictionsFor(recordId: string): void {
    const contradictions = this.contradictionIndex.get(recordId) || [];
    for (const c of contradictions) {
      const conflicting = this.records.get(c.conflictingId);
      if (conflicting) {
        conflicting.contradictions = conflicting.contradictions.filter((id) => id !== recordId);
      }
      // Remove from conflicting's index too
      const conflictingContradictions = this.contradictionIndex.get(c.conflictingId);
      if (conflictingContradictions) {
        this.contradictionIndex.set(
          c.conflictingId,
          conflictingContradictions.filter((cc) => cc.conflictingId !== recordId)
        );
      }
    }
    this.contradictionIndex.delete(recordId);
    const record = this.records.get(recordId);
    if (record) {
      this.statsCache.onContradictionChanged(-contradictions.length);
      record.contradictions = [];
    }
  }

  private deleteRecord(id: string): void {
    const record = this.records.get(id);
    if (!record) return;

    // Clean all indexes
    this.records.delete(id);
    this.sourceIndex.get(record.source)?.delete(id);
    this.contradictionIndex.delete(id);

    for (const tag of record.tags) {
      this.tagIndex.get(tag)?.delete(id);
    }

    // Remove from vector index
    if (this.vectorIndex?.has(id)) {
      this.vectorIndex.remove(id);
    }

    // Update stats
    this.statsCache.onRecordRemoved(record.source, record.confidence, record.validated);
  }

  private async garbageCollect(): Promise<number> {
    const toDelete: string[] = [];
    for (const record of this.records.values()) {
      if (!record.validated && record.confidence <= this.config.gcThreshold) {
        toDelete.push(record.id);
      }
    }

    for (const id of toDelete) {
      this.deleteRecord(id);
    }

    return toDelete.length;
  }
}

// ── Factory ───────────────────────────────────────────────────

export function createEvidenceMemory(config?: EvidenceMemoryConfig): EvidenceMemoryEngine {
  const engine = new EvidenceMemoryEngine();
  if (config) {
    engine.configure(config);
  }
  return engine;
}
