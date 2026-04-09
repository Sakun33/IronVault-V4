const CLOUD_TOKEN_KEY = 'iv_cloud_token';
const SYNC_QUEUE_KEY = 'iv_sync_queue';
const DEVICE_ID_KEY = 'iv_device_id';
const CLOUD_SYNCED_VAULTS_KEY = 'iv_cloud_synced_vaults';

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
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
export async function listCloudVaults(): Promise<CloudVaultMeta[]> {
  try {
    const res = await fetch('/api/vaults/cloud', { headers: authHeaders() });
    if (!res.ok) return [];
    const { vaults } = await res.json();
    return vaults ?? [];
  } catch { return []; }
}

// ── Download vault blob ───────────────────────────────────────────────────────
export async function downloadCloudVault(vaultId: string): Promise<CloudVaultFull | null> {
  try {
    const res = await fetch(`/api/vaults/cloud/${vaultId}`, { headers: authHeaders() });
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
}

export async function pushCloudVault(
  vaultId: string,
  vaultName: string,
  encryptedBlob: string,
  isDefault = false,
): Promise<PushResult> {
  const token = getCloudToken();
  if (!token) return { success: false };
  const clientModifiedAt = new Date().toISOString();
  const sourceDeviceId = getOrCreateDeviceId();
  try {
    // Try PUT first (update existing)
    const putRes = await fetch(`/api/vaults/cloud/${vaultId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ encryptedBlob, vaultName, isDefault, clientModifiedAt }),
    });
    if (putRes.status === 404) {
      // Not in cloud yet — create it
      const postRes = await fetch('/api/vaults/cloud', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ vaultId, vaultName, encryptedBlob, isDefault, clientModifiedAt, sourceDeviceId }),
      });
      if (postRes.status === 403) {
        const body = await postRes.json();
        if (body.code === 'PLAN_UPGRADE_REQUIRED') return { success: false, planError: true };
        return { success: false };
      }
      return { success: postRes.ok };
    }
    if (putRes.status === 403) {
      const body = await putRes.json();
      if (body.code === 'PLAN_UPGRADE_REQUIRED') return { success: false, planError: true };
      return { success: false };
    }
    if (!putRes.ok) return { success: false };
    const body = await putRes.json();
    if (body.serverNewer) {
      return { success: false, serverNewer: true, serverBlob: body.vault?.encryptedBlob };
    }
    return { success: true };
  } catch { return { success: false }; }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteCloudVault(vaultId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vaults/cloud/${vaultId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    return res.ok;
  } catch { return false; }
}

// ── Set default ───────────────────────────────────────────────────────────────
export async function setCloudDefault(vaultId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/vaults/cloud/${vaultId}/default`, {
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
