// IronVault cloud API wrappers used by the extension's background service worker.
// Mirrors client/src/lib/cloud-vault-sync.ts.

const API_BASE = 'https://www.ironvault.app';

export async function authToken(email, accountPasswordHash) {
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-iv-client': 'extension' },
    body: JSON.stringify({ email, accountPasswordHash }),
  });
  if (res.status === 401) throw new Error('Wrong email or account password.');
  if (res.status === 403) throw new Error('Email not verified — open the IronVault app to verify first.');
  if (!res.ok) throw new Error('Login failed. Please try again.');
  const json = await res.json();
  if (!json.token) throw new Error('Login failed (no token returned).');
  // sessionId may be null if the server-side table provisioning failed; the
  // extension still works, the session_check polling just becomes a no-op.
  return { token: json.token, sessionId: json.sessionId || null };
}

export async function listCloudVaults(token) {
  const res = await fetch(`${API_BASE}/api/vaults/cloud`, {
    headers: { Authorization: `Bearer ${token}`, 'x-iv-client': 'extension' },
  });
  if (!res.ok) throw new Error('Could not list your cloud vaults.');
  const { vaults } = await res.json();
  return Array.isArray(vaults) ? vaults : [];
}

export async function downloadCloudVault(token, vaultId) {
  const res = await fetch(`${API_BASE}/api/vaults/cloud/${encodeURIComponent(vaultId)}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-iv-client': 'extension' },
  });
  if (!res.ok) throw new Error('Could not download the encrypted vault.');
  const data = await res.json();
  if (!data.encryptedBlob) throw new Error('Vault returned without encrypted data.');
  return data;
}

export async function uploadVaultBlob(token, vaultId, encryptedBlob, addedItem) {
  const res = await fetch(`${API_BASE}/api/vault/items/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-iv-client': 'extension',
    },
    body: JSON.stringify({
      vaultId,
      encryptedBlob,
      clientModifiedAt: new Date().toISOString(),
      addedItem: addedItem || null,
    }),
  });
  if (res.status === 401) {
    const err = new Error('SESSION_REVOKED');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    let body = '';
    try { body = JSON.stringify(await res.json()); } catch {}
    throw new Error('Could not save to cloud vault.' + (body ? ` (${body})` : ''));
  }
  return res.json();
}

export async function checkSession(token) {
  const res = await fetch(`${API_BASE}/api/auth/session/check`, {
    headers: { Authorization: `Bearer ${token}`, 'x-iv-client': 'extension' },
  });
  if (res.status === 401) return { valid: false };
  if (!res.ok) return { valid: true, error: true }; // fail-open on transient errors
  const json = await res.json();
  return { valid: !!json.valid };
}

export async function logActivity(token, action, itemType, itemTitle) {
  try {
    await fetch(`${API_BASE}/api/vault/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-iv-client': 'extension',
      },
      body: JSON.stringify({ action, itemType, itemTitle }),
    });
  } catch {
    // best-effort — never throw from activity logging
  }
}
