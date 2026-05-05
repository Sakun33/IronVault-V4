const CLOUD_TOKEN_KEY = 'iv_cloud_token';
const SYNC_QUEUE_KEY = 'iv_sync_queue';
const DEVICE_ID_KEY = 'iv_device_id';
const CLOUD_SYNCED_VAULTS_KEY = 'iv_cloud_synced_vaults';

// Cloud vault API lives at www.ironvault.app — use absolute URL so native
// Capacitor apps (origin: capacitor://localhost) can reach it over the network.
const CLOUD_API = 'https://www.ironvault.app';

export interface CloudVaultMeta {
  vaultId: string;
  vaultName: string;
  isDefault: boolean;
  clientModifiedAt: string | null;
  serverUpdatedAt: string | null;
  createdAt: string | null;
  sourceDeviceId: string | null;
}

export interface CloudVaultFull extends CloudVaultMeta {
  encryptedBlob: string;
}

// ── Device identity ───────────────────────────────────────────────────────────
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Token management ──────────────────────────────────────────────────────────
export function getCloudToken(): string | null {
  return localStorage.getItem(CLOUD_TOKEN_KEY);
}
export function storeCloudToken(token: string): void {
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
}
export function clearCloudToken(): void {
  localStorage.removeItem(CLOUD_TOKEN_KEY);
}

// ── Auth: exchange email+accountPasswordHash for JWT ──────────────────────────
export async function acquireCloudToken(email: string, accountPasswordHash: string): Promise<string | null> {
  try {
    const res = await fetch(`${CLOUD_API}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-iv-client': 'web' },
      body: JSON.stringify({ email, accountPasswordHash }),
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    if (token) { storeCloudToken(token); return token; }
    return null;
  } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const token = getCloudToken();
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ── List cloud vaults (metadata only) ────────────────────────────────────────
// MUST never throw — callers (vault picker on a fresh device, etc.) treat a
// failed cloud probe as "no cloud vaults visible right now" and fall back to
// the local-vault-only flow. Throwing here would block the entire vault picker
// behind a "vault cannot be fetched" error and prevent the user from creating
// a new local vault. We log the actual error so ops can spot tenant-wide
// auth/network issues, but the return shape is always [].
export async function listCloudVaults(): Promise<CloudVaultMeta[]> {
  const result = await listCloudVaultsWithStatus();
  return result.vaults;
}

// Same probe as listCloudVaults, but also reports whether the call SUCCEEDED.
// Use this from the vault picker so the UI can distinguish between
//   "we reached the server and there are no cloud vaults" (ok=true, vaults=[])
// and
//   "we couldn't reach the server / got 5xx / parsed garbage" (ok=false).
// Without this signal, a transient network error looks identical to a fresh
// account with no cloud vaults — and a user on a new device gets no hint
// that retrying might help.
export interface ListCloudVaultsResult {
  ok: boolean;
  vaults: CloudVaultMeta[];
  status?: number;
}
export async function listCloudVaultsWithStatus(): Promise<ListCloudVaultsResult> {
  try {
    const res = await fetch(`${CLOUD_API}/api/vaults/cloud`, { headers: authHeaders() });
    if (!res.ok) {
      console.error('[listCloudVaults] non-OK response:', res.status, res.statusText);
      // 401 specifically means "your token expired/was revoked" — the global
      // 401 interceptor will already redirect, so don't surface a banner.
      return { ok: res.status === 401, vaults: [], status: res.status };
    }
    const { vaults } = await res.json();
    return { ok: true, vaults: vaults ?? [], status: res.status };
  } catch (err) {
    console.error('[listCloudVaults] failed:', err);
    return { ok: false, vaults: [] };
  }
}

// ── Download vault blob ───────────────────────────────────────────────────────
export async function downloadCloudVault(vaultId: string): Promise<CloudVaultFull | null> {
  try {
    const res = await fetch(`${CLOUD_API}/api/vaults/cloud/${vaultId}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    // API returns fields at top level (not nested under `vault`)
    if (data.vaultId) return data as CloudVaultFull;
    return data.vault ?? null;
  } catch { return null; }
}

// ── Push (create or update) ───────────────────────────────────────────────────
export interface PushResult {
  success: boolean;
  serverNewer?: boolean;
  serverBlob?: string;
  planError?: boolean;
  /** HTTP status code (or 0 for network errors). Used by callers to decide
      whether to retry, surface a plan-upgrade prompt, or show a generic
      "sync failed" toast. */
  status?: number;
  /** Human-readable reason that pushes can be surfaced to the user. */
  error?: string;
}

export async function pushCloudVault(
  vaultId: string,
  vaultName: string,
  encryptedBlob: string,
  isDefault = false,
): Promise<PushResult> {
  const token = getCloudToken();
  if (!token) {
    console.error('[CLOUD-PUSH] No cloud token — user is not authenticated for cloud sync');
    return { success: false, status: 0, error: 'Not signed in to cloud' };
  }
  const clientModifiedAt = new Date().toISOString();
  const sourceDeviceId = getOrCreateDeviceId();
  // Log every push attempt with the size of the blob and the vault id so
  // failures can be triaged from the browser console without a debugger.
  console.info(`[CLOUD-PUSH] pushing vault ${vaultId} (${(encryptedBlob.length / 1024).toFixed(1)} KB) at ${clientModifiedAt}`);
  try {
    // Try PUT first (update existing)
    const putRes = await fetch(`${CLOUD_API}/api/vaults/cloud/${vaultId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ encryptedBlob, vaultName, isDefault, clientModifiedAt }),
    });
    if (putRes.status === 404) {
      // Not in cloud yet — create it
      console.info(`[CLOUD-PUSH] vault ${vaultId} not in cloud yet — creating`);
      const postRes = await fetch(`${CLOUD_API}/api/vaults/cloud`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ vaultId, vaultName, encryptedBlob, isDefault, clientModifiedAt, sourceDeviceId }),
      });
      if (postRes.status === 403) {
        const body = await postRes.json().catch(() => ({}));
        const planError = body.code === 'PLAN_UPGRADE_REQUIRED';
        const error = planError ? 'Cloud sync requires Pro or Lifetime plan' : (body.error || 'Forbidden');
        console.error(`[CLOUD-PUSH] POST ${vaultId} → 403:`, error);
        return { success: false, status: 403, error, planError };
      }
      if (!postRes.ok) {
        const text = await postRes.text().catch(() => '');
        console.error(`[CLOUD-PUSH] POST ${vaultId} → ${postRes.status}:`, text);
        return { success: false, status: postRes.status, error: text || `HTTP ${postRes.status}` };
      }
      console.info(`[CLOUD-PUSH] POST ${vaultId} success (created cloud entry)`);
      return { success: true, status: postRes.status };
    }
    if (putRes.status === 403) {
      const body = await putRes.json().catch(() => ({}));
      const planError = body.code === 'PLAN_UPGRADE_REQUIRED';
      const error = planError ? 'Cloud sync requires Pro or Lifetime plan' : (body.error || 'Forbidden');
      console.error(`[CLOUD-PUSH] PUT ${vaultId} → 403:`, error);
      return { success: false, status: 403, error, planError };
    }
    if (putRes.status === 401) {
      console.error(`[CLOUD-PUSH] PUT ${vaultId} → 401: token expired or invalid`);
      return { success: false, status: 401, error: 'Cloud session expired — please sign in again' };
    }
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      console.error(`[CLOUD-PUSH] PUT ${vaultId} → ${putRes.status}:`, text);
      return { success: false, status: putRes.status, error: text || `HTTP ${putRes.status}` };
    }
    const body = await putRes.json().catch(() => ({}));
    if (body.serverNewer) {
      console.warn(`[CLOUD-PUSH] PUT ${vaultId} → serverNewer (server has newer data, push refused)`);
      return { success: false, status: 200, serverNewer: true, serverBlob: body.vault?.encryptedBlob, error: 'Server has newer data' };
    }
    console.info(`[CLOUD-PUSH] PUT ${vaultId} success`);
    return { success: true, status: 200 };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error(`[CLOUD-PUSH] threw for vault ${vaultId}:`, msg);
    return { success: false, status: 0, error: msg };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteCloudVault(vaultId: string): Promise<boolean> {
  try {
    const res = await fetch(`${CLOUD_API}/api/vaults/cloud/${vaultId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    return res.ok;
  } catch { return false; }
}

// ── Set default ───────────────────────────────────────────────────────────────
export async function setCloudDefault(vaultId: string): Promise<boolean> {
  try {
    const res = await fetch(`${CLOUD_API}/api/vaults/cloud/${vaultId}/default`, {
      method: 'PATCH', headers: authHeaders(),
    });
    return res.ok;
  } catch { return false; }
}

// ── Cloud-synced vault registry (local tracking) ──────────────────────────────
export function markVaultAsCloudSynced(vaultId: string): void {
  try {
    const raw = localStorage.getItem(CLOUD_SYNCED_VAULTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(vaultId)) {
      ids.push(vaultId);
      localStorage.setItem(CLOUD_SYNCED_VAULTS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export function markVaultAsNotCloudSynced(vaultId: string): void {
  try {
    const raw = localStorage.getItem(CLOUD_SYNCED_VAULTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(CLOUD_SYNCED_VAULTS_KEY, JSON.stringify(ids.filter(id => id !== vaultId)));
  } catch {}
}

export function isVaultCloudSynced(vaultId: string): boolean {
  try {
    const raw = localStorage.getItem(CLOUD_SYNCED_VAULTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(vaultId);
  } catch { return false; }
}

// ── Offline queue ─────────────────────────────────────────────────────────────
interface SyncQueueItem {
  vaultId: string;
  vaultName: string;
  operation: 'push' | 'delete';
  timestamp: number;
}

export function queueOfflineSync(vaultId: string, vaultName: string, operation: 'push' | 'delete'): void {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
    // Remove any existing entry for this vaultId
    const filtered = queue.filter(i => i.vaultId !== vaultId);
    filtered.push({ vaultId, vaultName, operation, timestamp: Date.now() });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function removeSyncQueueItem(vaultId: string): void {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue.filter(i => i.vaultId !== vaultId)));
  } catch {}
}
