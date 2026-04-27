/**
 * IronVault background service worker.
 *
 * Responsibilities:
 *  1. Sign in to api.ironvault.app and cache the JWT.
 *  2. Pull the encrypted vault blob from the server and decrypt it locally
 *     using the user's master password (zero-knowledge — the server never
 *     sees the master password).
 *  3. Serve queries from the content script: "give me credentials for
 *     domain X".
 *  4. Watch the downloads folder for a Chrome passwords CSV and offer to
 *     import it.
 */

const API_BASE = 'https://www.ironvault.app';
const SIGNED_IN_KEY = 'ironvault.session';
const VAULT_KEY = 'ironvault.vault';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSession() {
  const { [SIGNED_IN_KEY]: s } = await chrome.storage.local.get(SIGNED_IN_KEY);
  return s || null;
}

async function setSession(s) {
  await chrome.storage.local.set({ [SIGNED_IN_KEY]: s });
}

async function getVault() {
  const { [VAULT_KEY]: v } = await chrome.storage.local.get(VAULT_KEY);
  return v || null;
}

async function setVault(v) {
  await chrome.storage.local.set({ [VAULT_KEY]: v });
}

async function clearAll() {
  await chrome.storage.local.remove([SIGNED_IN_KEY, VAULT_KEY]);
}

// ── Crypto: derive key from master password and decrypt vault ────────────────

async function deriveKey(masterPassword, salt, iterations = 250_000) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decrypt the encrypted vault blob.
 *
 * The blob format produced by the IronVault web app is JSON of the shape:
 *   { v: 1, salt: <b64>, iv: <b64>, ct: <b64>, iterations: 250000 }
 *
 * Older blobs may use slightly different field names; this function tolerates
 * a couple of common variants without throwing.
 */
async function decryptVaultBlob(blobJson, masterPassword) {
  let parsed;
  try {
    parsed = typeof blobJson === 'string' ? JSON.parse(blobJson) : blobJson;
  } catch {
    throw new Error('Vault blob is not valid JSON');
  }

  const saltB64 = parsed.salt || parsed.s;
  const ivB64 = parsed.iv || parsed.nonce;
  const ctB64 = parsed.ct || parsed.ciphertext || parsed.data;
  const iterations = parsed.iterations || parsed.iter || 250_000;

  if (!saltB64 || !ivB64 || !ctB64) {
    throw new Error('Vault blob is missing salt/iv/ciphertext');
  }

  const key = await deriveKey(masterPassword, b64ToBytes(saltB64), iterations);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(ctB64)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

// ── API calls ────────────────────────────────────────────────────────────────

async function apiSignIn(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Sign-in failed: ${res.status} ${detail.slice(0, 120)}`);
  }
  return res.json();
}

async function apiFetchEncryptedVault(token) {
  const list = await fetch(`${API_BASE}/api/vaults/cloud`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!list.ok) throw new Error(`Vault list failed: ${list.status}`);
  const { vaults } = await list.json();
  if (!vaults?.length) throw new Error('No cloud vaults found on this account');
  const target = vaults.find(v => v.isDefault) || vaults[0];

  const blob = await fetch(`${API_BASE}/api/vaults/cloud/${encodeURIComponent(target.vaultId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!blob.ok) throw new Error(`Vault fetch failed: ${blob.status}`);
  const data = await blob.json();
  return { vaultId: target.vaultId, vaultName: target.vaultName, encryptedBlob: data.encryptedBlob };
}

// ── Sign-in + sync flow ──────────────────────────────────────────────────────

async function signIn(email, password, masterPassword) {
  const auth = await apiSignIn(email, password);
  const token = auth.token || auth.accessToken;
  if (!token) throw new Error('Server did not return a token');

  const vaultRaw = await apiFetchEncryptedVault(token);
  const decrypted = await decryptVaultBlob(vaultRaw.encryptedBlob, masterPassword)
    .catch(() => { throw new Error('Could not decrypt vault — wrong master password?'); });

  const entries = normalizeEntries(decrypted);

  await setSession({ email, token, signedInAt: Date.now() });
  await setVault({
    vaultId: vaultRaw.vaultId,
    vaultName: vaultRaw.vaultName,
    entries,
    entryCount: entries.length,
    syncedAt: Date.now(),
    /**
     * We keep the master password in `chrome.storage.local` so we can re-sync
     * later without prompting again. This is encrypted-at-rest by Chrome's
     * profile storage but is NOT a perfect secret. Users who don't want this
     * can sign out from the popup.
     */
    masterPassword,
  });
  return { ok: true };
}

function normalizeEntries(decrypted) {
  // The web app stores passwords under various shapes depending on schema
  // version. Flatten them to { name, username, password, url }.
  const list = Array.isArray(decrypted)
    ? decrypted
    : decrypted?.passwords || decrypted?.entries || decrypted?.items || [];
  return list.map(e => ({
    id: e.id || crypto.randomUUID(),
    name: e.name || e.title || e.label || '',
    username: e.username || e.user || e.email || '',
    password: e.password || e.pass || '',
    url: e.url || e.uri || e.website || '',
  })).filter(e => e.password);
}

async function resync() {
  const session = await getSession();
  const vault = await getVault();
  if (!session || !vault?.masterPassword) return { ok: false, error: 'Not signed in' };
  try {
    const vaultRaw = await apiFetchEncryptedVault(session.token);
    const decrypted = await decryptVaultBlob(vaultRaw.encryptedBlob, vault.masterPassword);
    const entries = normalizeEntries(decrypted);
    await setVault({
      ...vault,
      vaultId: vaultRaw.vaultId,
      vaultName: vaultRaw.vaultName,
      entries,
      entryCount: entries.length,
      syncedAt: Date.now(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Domain matching ──────────────────────────────────────────────────────────

function hostFromUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchEntries(entries, targetDomain) {
  if (!targetDomain) return [];
  const target = targetDomain.toLowerCase().replace(/^www\./, '');
  return entries.filter(e => {
    const host = hostFromUrl(e.url);
    if (!host) return false;
    if (host === target) return true;
    // suffix match: foo.example.com matches example.com
    return host.endsWith(`.${target}`) || target.endsWith(`.${host}`);
  });
}

// ── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'GET_STATE': {
          const session = await getSession();
          const vault = await getVault();
          sendResponse({
            signedIn: !!session,
            email: session?.email,
            vault: vault ? { entryCount: vault.entryCount, syncedAt: vault.syncedAt } : null,
          });
          break;
        }
        case 'SIGN_IN': {
          const res = await signIn(msg.email, msg.password, msg.masterPassword);
          sendResponse(res);
          break;
        }
        case 'SIGN_OUT': {
          await clearAll();
          sendResponse({ ok: true });
          break;
        }
        case 'RESYNC': {
          const res = await resync();
          sendResponse(res);
          break;
        }
        case 'GET_MATCHES': {
          const vault = await getVault();
          if (!vault?.entries) { sendResponse({ matches: [] }); break; }
          const matches = matchEntries(vault.entries, msg.domain).map(e => ({
            id: e.id,
            name: e.name,
            username: e.username,
            url: e.url,
          }));
          sendResponse({ matches });
          break;
        }
        case 'GET_CREDENTIAL': {
          const vault = await getVault();
          const entry = vault?.entries?.find(e => e.id === msg.id);
          if (!entry) { sendResponse({ ok: false, error: 'Not found' }); break; }
          sendResponse({ ok: true, username: entry.username, password: entry.password });
          break;
        }
        case 'WATCH_DOWNLOADS': {
          await chrome.storage.local.set({ 'ironvault.watching': Date.now() });
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // async response
});

// ── Download watcher: pick up Chrome password CSV exports ───────────────────

chrome.downloads?.onChanged?.addListener(async (delta) => {
  if (delta.state?.current !== 'complete') return;
  const watchTs = (await chrome.storage.local.get('ironvault.watching'))['ironvault.watching'];
  if (!watchTs || Date.now() - watchTs > 30 * 60_000) return; // 30 min window
  const item = await new Promise(resolve => chrome.downloads.search({ id: delta.id }, items => resolve(items?.[0])));
  if (!item?.filename) return;
  const lower = item.filename.toLowerCase();
  const looksLikeChromeExport =
    lower.includes('passwords') && (lower.endsWith('.csv') || lower.endsWith('.tsv'));
  if (!looksLikeChromeExport) return;
  await chrome.notifications?.create?.({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Chrome passwords detected',
    message: 'Open the IronVault popup to upload them to your vault.',
    priority: 1,
  });
});
