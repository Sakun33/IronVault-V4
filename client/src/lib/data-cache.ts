/**
 * In-memory data cache with TTL.
 *
 * Used as a thin layer over expensive lookups (IndexedDB reads, derived
 * stats, API responses) so a re-mounted page hits the cache instead of
 * paying the full cost again. Cleared on logout via `invalidateCache()`.
 *
 * NOT a replacement for persistent storage — entries vanish on tab close.
 * Don't put anything sensitive here that isn't already in IDB / state.
 */
type Entry = { data: unknown; expiresAt: number };

const cache = new Map<string, Entry>();
const DEFAULT_TTL_MS = 30_000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/** Convenience: invalidate any cache key that startsWith the given prefix. */
export function invalidatePrefix(prefix: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
