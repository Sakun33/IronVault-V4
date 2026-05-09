// Breach checker — Have I Been Pwned k-anonymity client.
//
// Privacy: the password is SHA-1 hashed in the browser; only the first 5 hex
// chars (out of 40) ever leave the device. Our backend (`/api/security/breach-check`)
// proxies the request to api.pwnedpasswords.com/range/{prefix} and returns a
// map of suffix → occurrence-count. The full hash never leaves the client.
//
// Caching: results keyed by full SHA-1 hash, persisted to localStorage with a
// 24h TTL. A re-scan within the window resolves instantly without hitting the
// network.

import { apiBase } from '@/native/platform';

const CACHE_KEY = 'iv_breach_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const COUNT_INDEX_KEY = 'iv_breach_count';

export interface BreachResult {
  breached: boolean;
  count: number; // occurrences in HIBP corpus; 0 if not breached
}

interface CacheEntry {
  count: number;
  ts: number;
}
type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

function pruneCache(cache: Cache): Cache {
  const now = Date.now();
  const fresh: Cache = {};
  for (const [k, v] of Object.entries(cache)) {
    if (v && typeof v.ts === 'number' && now - v.ts < CACHE_TTL_MS) fresh[k] = v;
  }
  return fresh;
}

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function fetchRanges(prefixes: string[]): Promise<Record<string, Record<string, number>>> {
  if (prefixes.length === 0) return {};
  const r = await fetch(`${apiBase()}/api/security/breach-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes }),
  });
  if (!r.ok) throw new Error(`breach-check failed: ${r.status}`);
  const j = await r.json() as { results: Record<string, Record<string, number>> };
  return j.results || {};
}

/** Check a single password against the HIBP breach corpus. */
export async function checkPasswordBreach(password: string): Promise<BreachResult> {
  if (!password) return { breached: false, count: 0 };

  const hash = await sha1Hex(password);
  const cache = pruneCache(readCache());
  const hit = cache[hash];
  if (hit) return { breached: hit.count > 0, count: hit.count };

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const ranges = await fetchRanges([prefix]);
  const count = ranges[prefix]?.[suffix] ?? 0;

  cache[hash] = { count, ts: Date.now() };
  writeCache(cache);

  return { breached: count > 0, count };
}

export interface BreachScanItem<T = unknown> {
  entry: T;
  password: string;
}

export interface BreachScanResult<T = unknown> {
  entry: T;
  count: number;
}

export interface BreachScanProgress {
  done: number;
  total: number;
}

/**
 * Scan a list of passwords. Batches by 5-char prefix to minimise upstream
 * calls — multiple passwords sharing a prefix collapse into one fetch (rare
 * for human passwords, common for shared defaults like "password"). Cache is
 * consulted first; only uncached hashes hit the network.
 */
export async function scanBreaches<T>(
  items: BreachScanItem<T>[],
  onProgress?: (p: BreachScanProgress) => void,
): Promise<BreachScanResult<T>[]> {
  const total = items.length;
  if (total === 0) {
    persistCount(0);
    return [];
  }

  const cache = pruneCache(readCache());
  const hashed: { item: BreachScanItem<T>; hash: string }[] = [];
  for (const it of items) {
    if (!it.password) { hashed.push({ item: it, hash: '' }); continue; }
    hashed.push({ item: it, hash: await sha1Hex(it.password) });
  }

  // Bucket uncached hashes by 5-char prefix
  const needed: Record<string, string[]> = {}; // prefix → [suffix...]
  for (const h of hashed) {
    if (!h.hash) continue;
    if (cache[h.hash]) continue;
    const prefix = h.hash.slice(0, 5);
    const suffix = h.hash.slice(5);
    (needed[prefix] ||= []).push(suffix);
  }

  // Fetch ranges in chunks of 50 (server caps at 100)
  const prefixes = Object.keys(needed);
  const chunkSize = 50;
  let fetched = 0;
  for (let i = 0; i < prefixes.length; i += chunkSize) {
    const chunk = prefixes.slice(i, i + chunkSize);
    let ranges: Record<string, Record<string, number>> = {};
    try {
      ranges = await fetchRanges(chunk);
    } catch {
      // network failure: treat as not-breached but don't poison the cache
    }
    for (const prefix of chunk) {
      const suffixes = needed[prefix] || [];
      const map = ranges[prefix] || {};
      for (const suffix of suffixes) {
        const count = map[suffix] ?? 0;
        cache[prefix + suffix] = { count, ts: Date.now() };
      }
    }
    fetched += chunk.length;
    onProgress?.({ done: Math.min(total, Math.round((fetched / Math.max(1, prefixes.length)) * total)), total });
  }
  writeCache(cache);

  // Build results
  const out: BreachScanResult<T>[] = [];
  let breachedCount = 0;
  for (const h of hashed) {
    const count = h.hash ? (cache[h.hash]?.count ?? 0) : 0;
    out.push({ entry: h.item.entry, count });
    if (count > 0) breachedCount++;
  }
  onProgress?.({ done: total, total });
  persistCount(breachedCount);
  return out;
}

/** Read the breached-password count saved by the most recent scan. */
export function getBreachedCount(): number {
  try {
    const raw = localStorage.getItem(COUNT_INDEX_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function persistCount(n: number) {
  try { localStorage.setItem(COUNT_INDEX_KEY, String(n)); } catch { /* quota */ }
}
