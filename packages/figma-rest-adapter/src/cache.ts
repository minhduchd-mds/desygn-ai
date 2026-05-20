/**
 * cache — Simple LRU cache with TTL.
 *
 * Used to avoid re-fetching the same Figma file within a short window.
 * Pure in-memory — no Redis dependency. For multi-instance deployments,
 * swap with Upstash Redis adapter (Week 5).
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class LruCache<T> {
  private store = new Map<string, Entry<T>>();

  constructor(
    private readonly maxEntries: number = 100,
    private readonly defaultTtlSeconds: number = 300,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Bump to MRU
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }

    this.store.delete(key);
    this.store.set(key, { value, expiresAt });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
