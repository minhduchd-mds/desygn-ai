/**
 * queryStore — lightweight SWR (stale-while-revalidate) without external deps.
 *
 * Features:
 *  • In-memory cache shared across all hook instances (same key = same data)
 *  • Stale-while-revalidate: returns cached data immediately, refetches in bg
 *  • Request deduplication: one in-flight fetch per key, no matter how many hooks
 *  • invalidate() / invalidatePrefix() for post-mutation cache busting
 *  • useMutation() for write operations (loading / error / data state)
 *  • Pure cache helpers (getCacheEntry, setCacheEntry) for SSR / testing
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  error?: Error;
}

const cache = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();

function notify(key: string): void {
  listeners.get(key)?.forEach((fn) => fn());
}

function addListener(key: string, fn: () => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => listeners.get(key)?.delete(fn);
}

// ── Public cache helpers ──────────────────────────────────────

export function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

export function setCacheEntry<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  notify(key);
}

/** Remove one key from cache and notify subscribers to re-fetch. */
export function invalidate(key: string): void {
  cache.delete(key);
  inflight.delete(key);
  notify(key);
}

/** Remove all keys that start with `prefix`. */
export function invalidatePrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      inflight.delete(key);
      notify(key);
    }
  }
}

/** Wipe the entire cache (tests / logout). */
export function clearQueryCache(): void {
  cache.clear();
  inflight.clear();
  // Do NOT clear listeners — components are still mounted
}

// ── useQuery ──────────────────────────────────────────────────

export interface QueryOptions {
  /** Consider cached data stale after this many ms (default 30 000). */
  staleMs?: number;
  /** Disable fetching while false (default true). */
  enabled?: boolean;
}

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** Force an immediate re-fetch, ignoring stale check. */
  refetch: () => void;
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: QueryOptions = {},
): QueryResult<T> {
  const { staleMs = 30_000, enabled = true } = opts;
  const [tick, rerender] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fetcherRef = useRef(fetcher);

  // Update fetcher ref in effect (not during render)
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const doFetch = useCallback(() => {
    if (inflight.has(key)) return; // dedup

    setIsLoading(true);

    const promise = fetcherRef.current().then(
      (data) => {
        cache.set(key, { data, timestamp: Date.now() });
        inflight.delete(key);
        setIsLoading(false);
        notify(key);
      },
      (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        const prev = cache.get(key) as CacheEntry<T> | undefined;
        cache.set(key, { data: prev?.data as T, timestamp: Date.now(), error });
        inflight.delete(key);
        setIsLoading(false);
        notify(key);
      },
    );

    inflight.set(key, promise);
  }, [key]);

  // Subscribe to cache changes for this key
  useEffect(() => addListener(key, () => rerender((n) => n + 1)), [key]);

  // Fetch when stale
  useEffect(() => {
    if (!enabled) return;
    const entry = cache.get(key);
    const isStale = !entry || Date.now() - entry.timestamp > staleMs;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isStale) doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, staleMs, tick]);

  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return {
    data: entry?.data,
    loading: isLoading || inflight.has(key),
    error: entry?.error,
    refetch: doFetch,
  };
}

// ── useMutation ───────────────────────────────────────────────

export interface MutationResult<T, V> {
  mutate: (vars: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  data: T | undefined;
  reset: () => void;
}

export function useMutation<T, V = void>(
  mutator: (vars: V) => Promise<T>,
): MutationResult<T, V> {
  const [state, setState] = useState<{
    loading: boolean;
    error?: Error;
    data?: T;
  }>({ loading: false });

  const mutate = useCallback(async (vars: V): Promise<T> => {
    setState({ loading: true });
    try {
      const result = await mutator(vars);
      setState({ loading: false, data: result });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ loading: false, error });
      throw err;
    }
  }, [mutator]);

  const reset = useCallback(() => setState({ loading: false }), []);

  return {
    mutate,
    loading: state.loading,
    error: state.error,
    data: state.data,
    reset,
  };
}
