/**
 * Security Scanner — history persistence.
 *
 * Scan results are stored as JSON in localStorage under a single key. We use
 * localStorage rather than a dedicated IndexedDB store so we don't need a
 * schema migration on storage.ts (the existing `persistent_data` store is
 * encrypted and only accessible after vault unlock — scanner history should
 * survive lock too).
 *
 * Storage is bounded to the last 30 scans to keep size sane.
 */

import type { ScanResult } from './types';

const KEY = 'ironvault_security_scans';
const MAX_HISTORY = 30;

export function loadHistory(): ScanResult[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

export function saveScan(result: ScanResult): void {
  try {
    const history = loadHistory();
    history.unshift(result);
    const trimmed = history.slice(0, MAX_HISTORY);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // best-effort — quota errors are ignored
  }
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}
