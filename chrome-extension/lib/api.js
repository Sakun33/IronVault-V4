// IronVault cloud API wrappers used by the extension's background service worker.
// Mirrors client/src/lib/cloud-vault-sync.ts.

const API_BASE = 'https://www.ironvault.app';

export async function authToken(email, accountPasswordHash) {
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, accountPasswordHash }),
  });
  if (res.status === 401) throw new Error('Wrong email or account password.');
  if (res.status === 403) throw new Error('Email not verified — open the IronVault app to verify first.');
  if (!res.ok) throw new Error('Login failed. Please try again.');
  const json = await res.json();
  if (!json.token) throw new Error('Login failed (no token returned).');
  return json.token;
}

export async function listCloudVaults(token) {
  const res = await fetch(`${API_BASE}/api/vaults/cloud`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not list your cloud vaults.');
  const { vaults } = await res.json();
  return Array.isArray(vaults) ? vaults : [];
}

export async function downloadCloudVault(token, vaultId) {
  const res = await fetch(`${API_BASE}/api/vaults/cloud/${encodeURIComponent(vaultId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not download the encrypted vault.');
  const data = await res.json();
  if (!data.encryptedBlob) throw new Error('Vault returned without encrypted data.');
  return data;
}
