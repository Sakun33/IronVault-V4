/**
 * Entitlements Cache
 * 
 * Handles offline caching of entitlements with integrity checks.
 * Provides grace period for offline usage.
 */

import type { Entitlements, CachedEntitlements } from './types';
import { CACHE_VALIDITY_HOURS, OFFLINE_GRACE_PERIOD_DAYS, PLAN_CAPABILITIES } from './types';
import { getDefaultEntitlements } from './gating';

const CACHE_KEY = 'ironvault_entitlements_cache';
const CACHE_VERSION = 1;

/**
 * Generate a simple checksum for integrity verification
 * Uses a hash of the entitlements JSON
 */
async function generateChecksum(entitlements: Entitlements): Promise<string> {
  const data = JSON.stringify(entitlements);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Use SubtleCrypto if available, fallback to simple hash
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }
  
  // Simple fallback hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Verify checksum of cached entitlements
 */
async function verifyChecksum(cached: CachedEntitlements): Promise<boolean> {
  const expectedChecksum = await generateChecksum(cached.entitlements);
  return cached.checksum === expectedChecksum;
}

/**
 * Serialize entitlements for storage (handles Date objects)
 */
function serializeEntitlements(entitlements: Entitlements): string {
  return JSON.stringify(entitlements, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
}

/**
 * Deserialize entitlements from storage (restores Date objects)
 */
function deserializeEntitlements(json: string): Entitlements {
  return JSON.parse(json, (key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });
}

/**
 * Cache entitlements to local storage
 */
export async function cacheEntitlements(entitlements: Entitlements): Promise<void> {
  try {
    const checksum = await generateChecksum(entitlements);
    
    const cached: CachedEntitlements = {
      entitlements,
      cachedAt: Date.now(),
      checksum,
      version: CACHE_VERSION,
    };
    
    const serialized = JSON.stringify({
      ...cached,
      entitlements: JSON.parse(serializeEntitlements(entitlements)),
    });
    
    localStorage.setItem(CACHE_KEY, serialized);
  } catch (error) {
    console.error('[EntitlementsCache] Failed to cache entitlements:', error);
  }
}

/**
 * Load cached entitlements from local storage
 * Returns null if cache is invalid, expired, or doesn't exist
 */
export async function loadCachedEntitlements(): Promise<Entitlements | null> {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) {
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    // Check version
    if (parsed.version !== CACHE_VERSION) {
      console.log('[EntitlementsCache] Cache version mismatch, clearing');
      clearCache();
      return null;
    }
    
    // Restore entitlements with proper Date objects
    const entitlements = deserializeEntitlements(JSON.stringify(parsed.entitlements));
    
    const cached: CachedEntitlements = {
      ...parsed,
      entitlements,
    };
    
    // Verify integrity
    const isValid = await verifyChecksum(cached);
    if (!isValid) {
      console.warn('[EntitlementsCache] Checksum mismatch, cache may be tampered');
      clearCache();
      return null;
    }
    
    return cached.entitlements;
  } catch (error) {
    console.error('[EntitlementsCache] Failed to load cached entitlements:', error);
    return null;
  }
}

/**
 * Check if cache is still valid (not expired)
 */
export function isCacheValid(): boolean {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return false;
    
    const parsed = JSON.parse(stored);
    const cachedAt = parsed.cachedAt;
    const now = Date.now();
    const maxAge = CACHE_VALIDITY_HOURS * 60 * 60 * 1000;
    
    return (now - cachedAt) < maxAge;
  } catch {
    return false;
  }
}

/**
 * Check if we're within the offline grace period
 */
export function isWithinGracePeriod(): boolean {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return false;
    
    const parsed = JSON.parse(stored);
    const cachedAt = parsed.cachedAt;
    const now = Date.now();
    const maxGrace = OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    
    return (now - cachedAt) < maxGrace;
  } catch {
    return false;
  }
}

/**
 * Get cache age in hours
 */
export function getCacheAgeHours(): number | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    const cachedAt = parsed.cachedAt;
    const now = Date.now();
    
    return (now - cachedAt) / (60 * 60 * 1000);
  } catch {
    return null;
  }
}

/**
 * Clear cached entitlements
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get entitlements with offline fallback
 * 
 * @param fetchFn - Function to fetch fresh entitlements from server/store
 * @param isOnline - Whether device is currently online
 * @returns Entitlements (either fresh or cached)
 */
export async function getEntitlementsWithFallback(
  fetchFn: () => Promise<Entitlements>,
  isOnline: boolean = navigator.onLine
): Promise<Entitlements> {
  // If online, try to fetch fresh entitlements
  if (isOnline) {
    try {
      const fresh = await fetchFn();
      await cacheEntitlements(fresh);
      return { ...fresh, isOffline: false };
    } catch (error) {
      console.warn('[EntitlementsCache] Failed to fetch fresh entitlements:', error);
      // Fall through to cache
    }
  }
  
  // Try to load from cache
  const cached = await loadCachedEntitlements();
  
  if (cached) {
    // Check if within grace period for offline usage
    if (isWithinGracePeriod()) {
      console.log('[EntitlementsCache] Using cached entitlements (offline mode)');
      return { ...cached, isOffline: true };
    } else {
      // Grace period expired - revert to free
      console.warn('[EntitlementsCache] Offline grace period expired');
      const freeEntitlements = getDefaultEntitlements('FREE');
      freeEntitlements.isOffline = true;
      return freeEntitlements;
    }
  }
  
  // No cache available - return free entitlements
  console.log('[EntitlementsCache] No cache available, using free entitlements');
  const freeEntitlements = getDefaultEntitlements('FREE');
  freeEntitlements.isOffline = !isOnline;
  return freeEntitlements;
}

/**
 * Mark that trial has been used (persisted separately from entitlements)
 */
export function markTrialUsed(): void {
  localStorage.setItem('ironvault_trial_used', 'true');
}

/**
 * Check if trial has been used
 */
export function hasTrialBeenUsed(): boolean {
  return localStorage.getItem('ironvault_trial_used') === 'true';
}
