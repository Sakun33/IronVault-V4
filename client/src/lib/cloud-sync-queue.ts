/**
 * Cloud sync push queue.
 *
 * Design (matches 1Password / Bitwarden / Apple Keychain):
 *   - Every local mutation calls `enqueuePush()` with no conditions.
 *   - The queue coalesces rapid-fire saves into one push (500ms batching).
 *   - Failed pushes retry with exponential backoff (3s, 10s, 30s, 1m, 2m).
 *   - Plan-error (403 PLAN_UPGRADE_REQUIRED) is permanent — don't retry.
 *   - The newest enqueue always wins: if a save lands while a retry is
 *     scheduled, the retry is cancelled and the new exporter takes over.
 *
 * Status & timing are surfaced through three channels so the UI never has
 * to call into this module directly:
 *   - `vault:cloud:push:start`   — push attempt began
 *   - `vault:cloud:push:done`    — push succeeded; lastSyncTime updated
 *   - `vault:cloud:push:failed`  — push failed; detail.{error, retrying, planError}
 *
 * The queue does NOT check `isVaultCloudSynced`, `isNoteEditing`, the
 * dirty flag, anti-wipe item-count gates, or anything else. The only
 * conditions for skipping a push are:
 *   1. No cloud token in localStorage (user is fully local-only)
 *   2. The active vault has explicitly opted out via
 *      `iv_local_only_${vaultId}` in localStorage
 *
 * Pull is handled separately in `use-cloud-auto-sync.ts` and is the only
 * code path that respects `isNoteEditing()` — pulling can destructively
 * replace local state, but pushing only writes our blob to the server.
 */

import { pushCloudVault, getCloudToken } from './cloud-vault-sync';

const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000, 120_000];
const COALESCE_MS = 500;

const LAST_SYNC_AT_KEY = 'iv_last_cloud_sync_at';
const LAST_SYNC_ERROR_KEY = 'iv_last_cloud_sync_error';
const LOCAL_ONLY_PREFIX = 'iv_local_only_';

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'retrying' | 'failed';

interface PendingJob {
  vaultId: string;
  vaultName: string;
  /** Returns the encrypted blob to push. Closure captures the master
   *  password live at enqueue time. Returns null if the vault can't be
   *  exported (e.g. it's locked or the storage layer is mid-switch). */
  exporter: () => Promise<string | null>;
  attempt: number;
  enqueuedAt: number;
}

let pending: PendingJob | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let status: SyncStatus = 'idle';
let lastError: string | null = (() => {
  try { return localStorage.getItem(LAST_SYNC_ERROR_KEY); } catch { return null; }
})();
let lastSyncAt: number | null = (() => {
  try {
    const raw = localStorage.getItem(LAST_SYNC_AT_KEY);
    return raw ? parseInt(raw, 10) || null : null;
  } catch { return null; }
})();

function clearTimer(): void {
  if (timer) { clearTimeout(timer); timer = null; }
}

function setStatus(next: SyncStatus): void {
  if (status === next) return;
  status = next;
}

export function getSyncStatus(): SyncStatus { return status; }
export function getLastSyncAt(): number | null { return lastSyncAt; }
export function getLastSyncError(): string | null { return lastError; }
export function isPushPending(): boolean { return pending !== null || inFlight; }

/**
 * Whether the active vault is opted into cloud sync at all.
 *
 * Eligibility is decoupled from `getCloudToken()` on purpose: a paid user
 * who has just cleared their browser cache will land in the app with no
 * cloud token for a beat (the token is fetched as part of the next
 * authenticated request). Marking them "ineligible" during that window
 * surfaced as the alarming "Local only" pill on a Lifetime account.
 *
 * The only signal that disables sync for a vault is the explicit
 * `iv_local_only_${vaultId}` opt-out flag. That flag is set ONLY by:
 *   1. The user explicitly choosing "create local vault" in vault-picker
 *   2. The server returning 403 PLAN_UPGRADE_REQUIRED on a push (free
 *      plan can't sync)
 * So the flag is the authoritative source of "this vault is local-only".
 *
 * If the queue runs without a token, `pushCloudVault` returns
 * `{ success: false, status: 0, error: 'Not signed in to cloud' }`, the
 * queue retries with backoff, and once the token comes back the retry
 * succeeds — no manual reconnection needed.
 */
export function isCloudSyncEligible(vaultId: string | null | undefined): boolean {
  if (!vaultId) return false;
  try {
    if (localStorage.getItem(`${LOCAL_ONLY_PREFIX}${vaultId}`) === '1') return false;
  } catch { /* localStorage disabled — assume eligible */ }
  return true;
}

/**
 * Whether this vault has been explicitly opted into local-only mode.
 * Distinguishes a paid user mid-token-refresh ("not opted out, just
 * waiting for the token") from a free-plan user or someone who chose a
 * local vault on purpose.
 */
export function isLocalOnly(vaultId: string | null | undefined): boolean {
  if (!vaultId) return false;
  try {
    return localStorage.getItem(`${LOCAL_ONLY_PREFIX}${vaultId}`) === '1';
  } catch { return false; }
}

/**
 * Schedule a push. Safe to call from any CRUD path; the queue handles
 * coalescing, debouncing, and retries on its own.
 *
 * The exporter is invoked just before the push so it always reads the
 * latest local state. If the queue is mid-retry from an earlier push,
 * this call REPLACES the pending job with the newer one — only the most
 * recent state ever reaches the server, which is fine because every
 * push uploads the whole encrypted blob.
 */
export function enqueuePush(
  vaultId: string,
  vaultName: string,
  exporter: () => Promise<string | null>,
): void {
  if (!isCloudSyncEligible(vaultId)) {
    return;
  }

  pending = { vaultId, vaultName, exporter, attempt: 0, enqueuedAt: Date.now() };
  clearTimer();
  setStatus('pending');
  // Quick coalesce window so a burst of saves (bulk import, fast typing
  // autosave) becomes a single push instead of N.
  timer = setTimeout(() => { void runPush(); }, COALESCE_MS);
  console.info(`[SYNC-QUEUE] enqueued push for vault ${vaultId} (coalesced ${COALESCE_MS}ms)`);
}

/**
 * Force the pending push to run immediately. Called by retry buttons in
 * the UI and after the user manually clears a sync error.
 */
export function retryNow(): void {
  if (!pending) return;
  clearTimer();
  void runPush();
}

async function runPush(): Promise<void> {
  if (!pending) return;
  if (inFlight) return; // a previous retry is still active; it will pick up the latest job
  const job = pending;
  inFlight = true;
  setStatus(job.attempt === 0 ? 'syncing' : 'retrying');
  window.dispatchEvent(new CustomEvent('vault:cloud:push:start', {
    detail: { vaultId: job.vaultId, attempt: job.attempt },
  }));

  let blob: string | null = null;
  try {
    blob = await job.exporter();
  } catch (e: any) {
    inFlight = false;
    const msg = e?.message || String(e);
    console.error('[SYNC-QUEUE] export failed:', msg);
    return failJob(`Couldn't export vault: ${msg}`, /* permanent */ false);
  }

  if (!blob) {
    inFlight = false;
    return failJob('Vault exporter returned no data', /* permanent */ true);
  }

  try {
    const result = await pushCloudVault(job.vaultId, job.vaultName, blob, false);
    inFlight = false;
    if (result.success) {
      pending = null;
      lastSyncAt = Date.now();
      lastError = null;
      try {
        localStorage.setItem(LAST_SYNC_AT_KEY, String(lastSyncAt));
        localStorage.removeItem(LAST_SYNC_ERROR_KEY);
      } catch { /* localStorage full / disabled — non-fatal */ }
      setStatus('synced');
      window.dispatchEvent(new CustomEvent('vault:cloud:push:done', {
        detail: { vaultId: job.vaultId, blobLength: blob.length, lastSyncAt },
      }));
      console.info(`[SYNC-QUEUE] success vault=${job.vaultId} bytes=${blob.length}`);
      return;
    }

    // Plan upgrade required → permanent failure for this vault. Mark
    // local-only so future enqueues are short-circuited at the gate
    // instead of bombing the server every save.
    if (result.planError) {
      try { localStorage.setItem(`${LOCAL_ONLY_PREFIX}${job.vaultId}`, '1'); } catch { /* ignore */ }
      pending = null;
      return failJob(result.error || 'Cloud sync requires Pro plan', /* permanent */ true);
    }

    // Server has newer data → don't retry; pull will reconcile shortly.
    if (result.serverNewer) {
      pending = null;
      return failJob('Server has newer data — pull pending', /* permanent */ true);
    }

    // Transient failure — schedule a retry.
    job.attempt += 1;
    if (job.attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[job.attempt - 1];
      console.warn(`[SYNC-QUEUE] retry ${job.attempt}/${RETRY_DELAYS_MS.length} in ${delay}ms — ${result.error}`);
      lastError = result.error || `HTTP ${result.status ?? '?'}`;
      try { localStorage.setItem(LAST_SYNC_ERROR_KEY, lastError); } catch { /* ignore */ }
      setStatus('retrying');
      window.dispatchEvent(new CustomEvent('vault:cloud:push:failed', {
        detail: { vaultId: job.vaultId, error: lastError, retrying: true, nextRetry: delay },
      }));
      timer = setTimeout(() => { void runPush(); }, delay);
      return;
    }

    // Out of retries.
    pending = null;
    return failJob(`Sync failed after ${RETRY_DELAYS_MS.length} attempts. Changes saved locally.`, /* permanent */ true);
  } catch (e: any) {
    inFlight = false;
    const msg = e?.message || String(e);
    job.attempt += 1;
    if (job.attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[job.attempt - 1];
      lastError = msg;
      try { localStorage.setItem(LAST_SYNC_ERROR_KEY, msg); } catch { /* ignore */ }
      setStatus('retrying');
      window.dispatchEvent(new CustomEvent('vault:cloud:push:failed', {
        detail: { vaultId: job.vaultId, error: msg, retrying: true, nextRetry: delay },
      }));
      timer = setTimeout(() => { void runPush(); }, delay);
      return;
    }
    pending = null;
    return failJob(msg, /* permanent */ true);
  }
}

function failJob(message: string, permanent: boolean): void {
  lastError = message;
  try { localStorage.setItem(LAST_SYNC_ERROR_KEY, message); } catch { /* ignore */ }
  setStatus('failed');
  console.error('[SYNC-QUEUE] push failed:', message, { permanent });
  window.dispatchEvent(new CustomEvent('vault:cloud:push:failed', {
    detail: { error: message, retrying: false, permanent },
  }));
}

/** Reset the queue. Used on logout / vault switch. */
export function resetSyncQueue(): void {
  clearTimer();
  pending = null;
  inFlight = false;
  setStatus('idle');
}
