const cache = new Map<string, unknown>();

export function getCached<T>(key: unknown): T | undefined {
  return cache.get(JSON.stringify(key)) as T | undefined;
}

export function setCached(key: unknown, value: unknown): void {
  cache.set(JSON.stringify(key), value);
}

export function clearCache(): void {
  cache.clear();
}
