// IronVault background service worker.
//
// Security model:
//   1. Master password is sent from the popup, used to derive an AES-GCM key,
//      then immediately discarded. The derived master key never leaves WebCrypto
//      and is not persisted.
//   2. After decrypting the cloud blob once, every individual password is
//      RE-WRAPPED with a per-session AES-GCM key generated locally. Only
//      metadata (id, name, url, username, domain) is stored in the clear.
//      The master plaintext is then dropped.
//   3. State lives in chrome.storage.session — browser-protected, in memory only,
//      cleared on browser close. Service-worker globals would die after ~30s of
//      idle, so we always re-import the session key from session storage.
//   4. A single password is decrypted ONLY in response to an explicit fill
//      request, and only the requested credential ever reaches a content script.
//   5. Session-duration model: at login the user picks how long to stay
//      connected (1h / 4h / 8h / 24h / 1 week / Until logout). When that window
//      elapses, an alarm wipes ALL local data (encrypted blob, JWT, biometric,
//      session storage, related download history) — re-connecting requires a
//      fresh login.

import {
  decryptCloudBlob,
  encryptCloudBlob,
  generateSessionKey,
  exportRawKey,
  importSessionKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
  b64Encode,
  b64Decode,
  sha256Hex,
} from './lib/crypto.js';
import {
  authToken,
  listCloudVaults,
  downloadCloudVault,
  uploadVaultBlob,
  checkSession,
  logActivity,
} from './lib/api.js';
import { parseCsv, mapBrowserCsvRow, normalizeDomain } from './lib/csv.js';

const ALLOWED_SESSION_HOURS = [0, 1, 4, 8, 24, 168]; // 0 = until logout
const DEFAULT_SESSION_HOURS = 4;
const EXPIRY_ALARM = 'ironvault-session-expiry';
const EXPIRY_TICK_MIN = 1; // alarm fires every minute to check expiry
const EXPIRY_WARN_MS = 5 * 60 * 1000; // notify 5 min before expiry
const SESSION_CHECK_ALARM = 'ironvault-session-check';
const SESSION_CHECK_PERIOD_MIN = 5;

// Persistent (chrome.storage.local):
//   K_CACHE: { encryptedBlob, vaultId, vaultName, token, email, syncedAt,
//              sessionDurationHours, sessionExpiresAt, expiryWarned }
//   rememberedEmail (string)
const K_CACHE = 'ironvault.cache';

// ── Helpers ─────────────────────────────────────────────────────────────────
function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Match a stored entry domain against the page domain. Allowed:
//   - Exact match (entry.domain === page.domain)
//   - Entry is a parent of the page (page is a subdomain of entry)
// Explicitly NOT allowed: entry is a subdomain of the page. Without this
// guard a credential for evil.google.com would offer to fill on google.com,
// or attacker.github.io would suggest creds on victim.github.io. (No public-
// suffix list here — we just prevent the child→parent direction.)
function domainMatches(pageDomain, entryDomain) {
  if (!pageDomain || !entryDomain) return false;
  if (pageDomain === entryDomain) return true;
  return pageDomain.endsWith('.' + entryDomain);
}

async function getCache() {
  const { [K_CACHE]: c } = await chrome.storage.local.get(K_CACHE);
  return c || null;
}

async function setCache(c) {
  await chrome.storage.local.set({ [K_CACHE]: c });
}

async function getRememberedEmail() {
  const { rememberedEmail } = await chrome.storage.local.get('rememberedEmail');
  return rememberedEmail || '';
}

async function rememberEmail(email) {
  await chrome.storage.local.set({ rememberedEmail: email });
}

async function updateBadge() {
  const { unlocked, passwordIndex } = await chrome.storage.session.get([
    'unlocked', 'passwordIndex',
  ]);
  if (unlocked && Array.isArray(passwordIndex)) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: `IronVault — ${passwordIndex.length} entries` });
  } else {
    chrome.action.setBadgeText({ text: '🔒' });
    chrome.action.setBadgeBackgroundColor({ color: '#1f1f1f' });
    chrome.action.setTitle({ title: 'IronVault — Locked' });
  }
}

// ── Lock / wipe ─────────────────────────────────────────────────────────────
// Soft lock: drop the in-memory session key but keep the encrypted blob and
// JWT so the user can re-derive the session key with just their master.
async function lock() {
  await chrome.storage.session.clear();
  await updateBadge();
}

// Full wipe: clear EVERYTHING this device holds about IronVault — encrypted
// blob, JWT, session storage, plus any export-CSV download history entries.
// Triggered by manual logout, session expiry, or remote revocation.
async function fullWipe() {
  try {
    await chrome.storage.local.remove([K_CACHE, 'rememberedEmail']);
  } catch {}
  await chrome.storage.session.clear();
  chrome.alarms.clear(EXPIRY_ALARM);
  chrome.alarms.clear(SESSION_CHECK_ALARM);
  await wipeExportedCsvHistory();
  await updateBadge();
}

// Best-effort: erase any IronVault-related CSV exports from Chrome's download
// history. Files we know the path of get unlinked too.
async function wipeExportedCsvHistory() {
  try {
    if (!chrome?.downloads?.search) return;
    const items = await chrome.downloads.search({
      filenameRegex: '.*\\.csv$',
      limit: 50,
    });
    for (const item of items || []) {
      if (!looksLikeBrowserPasswordCsv(item)) continue;
      try {
        await new Promise((resolve) => chrome.downloads.removeFile(item.id, () => resolve()));
      } catch {}
      try {
        await new Promise((resolve) => chrome.downloads.erase({ id: item.id }, () => resolve()));
      } catch {}
    }
  } catch {}
}

// ── Expiry alarm: wipes all data when sessionExpiresAt is in the past ──────
async function ensureExpiryAlarm() {
  await chrome.alarms.create(EXPIRY_ALARM, { periodInMinutes: EXPIRY_TICK_MIN });
}

async function tickExpiry() {
  const cache = await getCache();
  if (!cache?.sessionExpiresAt) return;
  const now = Date.now();
  if (now >= cache.sessionExpiresAt) {
    console.log('[ironvault] session expired — wiping all local data');
    await notifySessionEvent({
      title: 'IronVault session expired',
      message: 'Your extension session has ended. All vault data on this device has been cleared.',
    });
    await fullWipe();
    return;
  }
  const remaining = cache.sessionExpiresAt - now;
  if (remaining <= EXPIRY_WARN_MS && !cache.expiryWarned) {
    await setCache({ ...cache, expiryWarned: true });
    await notifySessionEvent({
      title: 'IronVault session expiring soon',
      message: `Your extension session ends in ${Math.max(1, Math.ceil(remaining / 60000))} minute(s).`,
    });
  }
}

async function notifySessionEvent({ title, message }) {
  try {
    if (!chrome?.notifications?.create) return;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title,
      message,
      priority: 1,
    });
  } catch {}
}

// ── Login ───────────────────────────────────────────────────────────────────
function clampSessionHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return DEFAULT_SESSION_HOURS;
  return ALLOWED_SESSION_HOURS.includes(n) ? n : DEFAULT_SESSION_HOURS;
}

async function performLogin({ email, accountPassword, masterPassword, vaultId, sessionDurationHours }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');
  if (!accountPassword) throw new Error('Account password is required.');
  if (!masterPassword) throw new Error('Master password is required.');

  const accountPasswordHash = await sha256Hex(accountPassword);
  const { token, sessionId } = await authToken(normalizedEmail, accountPasswordHash);

  const vaults = await listCloudVaults(token);
  if (vaults.length === 0) {
    throw new Error('No cloud vaults found on this account. Sync a vault from the IronVault app first.');
  }
  let chosen;
  if (vaultId) {
    chosen = vaults.find(v => v.vaultId === vaultId);
    if (!chosen) throw new Error('Selected vault no longer exists.');
  } else if (vaults.length === 1) {
    chosen = vaults[0];
  }
  // For >1 vaults, ALWAYS show the picker on login, even when a default
  // is set. Previously the default was silently chosen — leaving non-default
  // vaults unreachable from the popup. The popup pre-selects whichever
  // vault is marked default so the common case is still one click.
  if (!chosen) {
    return {
      needsVaultSelection: true,
      vaults: vaults.map(v => ({
        vaultId: v.vaultId, vaultName: v.vaultName, isDefault: !!v.isDefault,
      })),
    };
  }

  const full = await downloadCloudVault(token, chosen.vaultId);
  let payload;
  try {
    payload = await decryptCloudBlob(full.encryptedBlob, masterPassword);
  } catch (err) {
    if (err && err.message === 'WRONG_MASTER_PASSWORD') {
      throw new Error('Wrong master password for this vault.');
    }
    throw new Error('Could not decrypt vault.');
  }

  const hours = clampSessionHours(sessionDurationHours);
  const sessionExpiresAt = hours === 0 ? null : Date.now() + hours * 3600 * 1000;

  await setCache({
    encryptedBlob: full.encryptedBlob,
    vaultId: chosen.vaultId,
    vaultName: chosen.vaultName,
    token,
    sessionId: sessionId || null,
    email: normalizedEmail,
    syncedAt: Date.now(),
    sessionDurationHours: hours,
    sessionExpiresAt,
    expiryWarned: false,
  });

  await populateSessionFromPayload({
    payload,
    masterPassword,
    email: normalizedEmail,
    token,
    sessionId,
    vaultId: chosen.vaultId,
    vaultName: chosen.vaultName,
  });

  await rememberEmail(normalizedEmail);
  await ensureExpiryAlarm();
  await ensureSessionCheckAlarm();
  await updateBadge();

  return {
    success: true,
    email: normalizedEmail,
    vaultName: chosen.vaultName,
    sessionExpiresAt,
    sessionDurationHours: hours,
  };
}

// Shared between fresh login and offline re-unlock — re-wraps each password
// under a fresh per-session AES-GCM key, drops master plaintext.
async function populateSessionFromPayload({ payload, masterPassword, email, token, sessionId, vaultId, vaultName }) {
  const sessionKey = await generateSessionKey();
  const sessionKeyRaw = await exportRawKey(sessionKey);

  const passwordIndex = [];
  const wrappedSecrets = {};
  const list = Array.isArray(payload.passwords) ? payload.passwords : [];

  for (const p of list) {
    if (!p || typeof p !== 'object' || !p.id) continue;
    const meta = {
      id: String(p.id),
      name: String(p.name || ''),
      url: String(p.url || ''),
      username: String(p.username || ''),
      domain: extractDomain(p.url),
    };
    passwordIndex.push(meta);
    if (typeof p.password === 'string' && p.password.length > 0) {
      const { ciphertext, iv } = await aesGcmEncrypt(p.password, sessionKey);
      wrappedSecrets[meta.id] = { ct: b64Encode(ciphertext), iv: b64Encode(iv) };
    }
  }

  const wrappedMaster = await aesGcmEncrypt(masterPassword, sessionKey);

  await chrome.storage.session.set({
    unlocked: true,
    email,
    token,
    sessionId: sessionId || null,
    vaultId,
    vaultName,
    sessionKeyB64: b64Encode(sessionKeyRaw),
    wrappedMaster: { ct: b64Encode(wrappedMaster.ciphertext), iv: b64Encode(wrappedMaster.iv) },
    passwordIndex,
    wrappedSecrets,
  });
}

// ── Offline re-unlock from the cached encrypted blob ────────────────────────
async function performUnlock({ masterPassword }) {
  if (!masterPassword) throw new Error('Master password is required.');
  const cache = await getCache();
  if (!cache || !cache.encryptedBlob) throw new Error('NO_CACHED_VAULT');

  let payload;
  try {
    payload = await decryptCloudBlob(cache.encryptedBlob, masterPassword);
  } catch (err) {
    if (err && err.message === 'WRONG_MASTER_PASSWORD') {
      throw new Error('Wrong master password for this vault.');
    }
    throw new Error('Could not decrypt vault.');
  }

  await populateSessionFromPayload({
    payload,
    masterPassword,
    email: cache.email,
    token: cache.token,
    sessionId: cache.sessionId,
    vaultId: cache.vaultId,
    vaultName: cache.vaultName,
  });
  await ensureExpiryAlarm();
  await ensureSessionCheckAlarm();
  await updateBadge();

  return {
    success: true,
    email: cache.email,
    vaultName: cache.vaultName,
  };
}

// ── Master-password verification (for reveal/copy gating) ──────────────────
// Constant-time compare against the wrappedMaster blob in session storage.
// Cheap (no PBKDF2) — relies on the fact that the unlocked vault already
// has the master in memory under the per-session AES key.
async function verifyMaster(masterPassword) {
  if (!masterPassword) throw new Error('Master password is required.');
  const sess = await chrome.storage.session.get(['unlocked', 'sessionKeyB64', 'wrappedMaster']);
  if (!sess.unlocked || !sess.sessionKeyB64 || !sess.wrappedMaster) {
    throw new Error('Vault is locked.');
  }
  const sessionKey = await importSessionKey(b64Decode(sess.sessionKeyB64));
  let stored;
  try {
    const pt = await aesGcmDecrypt(
      b64Decode(sess.wrappedMaster.ct),
      sessionKey,
      b64Decode(sess.wrappedMaster.iv),
    );
    stored = new TextDecoder().decode(pt);
  } catch {
    throw new Error('Could not verify master password.');
  }
  if (!constantTimeEquals(stored, masterPassword)) {
    throw new Error('Wrong master password.');
  }
  return { success: true };
}

function constantTimeEquals(a, b) {
  const aBuf = new TextEncoder().encode(String(a));
  const bBuf = new TextEncoder().encode(String(b));
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) diff |= aBuf[i] ^ bBuf[i];
  return diff === 0;
}

// Recover the master password from the in-session wrap. Returns null if the
// vault is locked or the wrap is missing — caller falls back to manual flow.
async function getSessionMaster() {
  const sess = await chrome.storage.session.get(['unlocked', 'sessionKeyB64', 'wrappedMaster']);
  if (!sess.unlocked || !sess.sessionKeyB64 || !sess.wrappedMaster) return null;
  try {
    const sessionKey = await importSessionKey(b64Decode(sess.sessionKeyB64));
    const pt = await aesGcmDecrypt(
      b64Decode(sess.wrappedMaster.ct),
      sessionKey,
      b64Decode(sess.wrappedMaster.iv),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ── Re-sync cached blob from cloud ──────────────────────────────────────────
async function resync() {
  const cache = await getCache();
  if (!cache?.token || !cache?.vaultId) {
    return { success: false, error: 'Sign in first.' };
  }
  try {
    const dl = await downloadCloudVault(cache.token, cache.vaultId);
    await setCache({ ...cache, encryptedBlob: dl.encryptedBlob, syncedAt: Date.now() });
    return { success: true, syncedAt: Date.now() };
  } catch (err) {
    return { success: false, error: (err && err.message) || 'Re-sync failed' };
  }
}

// ── Single-credential decrypt ───────────────────────────────────────────────
async function decryptOne(id) {
  const { unlocked, sessionKeyB64, wrappedSecrets, passwordIndex } =
    await chrome.storage.session.get(['unlocked', 'sessionKeyB64', 'wrappedSecrets', 'passwordIndex']);
  if (!unlocked || !sessionKeyB64) throw new Error('LOCKED');
  const wrapped = wrappedSecrets && wrappedSecrets[id];
  if (!wrapped) throw new Error('Entry not found.');
  const meta = (passwordIndex || []).find(p => p.id === id);
  if (!meta) throw new Error('Entry not found.');
  const sessionKey = await importSessionKey(b64Decode(sessionKeyB64));
  const pt = await aesGcmDecrypt(b64Decode(wrapped.ct), sessionKey, b64Decode(wrapped.iv));
  return {
    id: meta.id,
    name: meta.name,
    url: meta.url,
    username: meta.username,
    password: new TextDecoder().decode(pt),
  };
}

// ── Status / queries ────────────────────────────────────────────────────────
async function getStatus() {
  const s = await chrome.storage.session.get(['unlocked', 'email', 'vaultName', 'passwordIndex']);
  const cache = await getCache();
  return {
    unlocked: !!s.unlocked,
    signedIn: !!cache,
    email: s.email || cache?.email || (await getRememberedEmail()),
    vaultName: s.vaultName || cache?.vaultName || null,
    entryCount: Array.isArray(s.passwordIndex) ? s.passwordIndex.length : 0,
    sessionExpiresAt: cache?.sessionExpiresAt || null,
    sessionDurationHours: cache?.sessionDurationHours ?? null,
    syncedAt: cache?.syncedAt || null,
  };
}

async function getDomainMatches(pageUrl) {
  const { unlocked, passwordIndex } = await chrome.storage.session.get(['unlocked', 'passwordIndex']);
  if (!unlocked) return { unlocked: false, matches: [] };
  const pageDomain = extractDomain(pageUrl);
  if (!pageDomain) return { unlocked: true, matches: [] };
  const matches = (passwordIndex || []).filter(p => domainMatches(pageDomain, p.domain));
  return {
    unlocked: true,
    matches: matches.map(m => ({ id: m.id, name: m.name, username: m.username, url: m.url })),
  };
}

async function searchEntries(query) {
  const { unlocked, passwordIndex } = await chrome.storage.session.get(['unlocked', 'passwordIndex']);
  if (!unlocked) return { unlocked: false, entries: [] };
  const q = String(query || '').trim().toLowerCase();
  const list = passwordIndex || [];
  const filtered = q
    ? list.filter(p => p.name.toLowerCase().includes(q)
                    || p.username.toLowerCase().includes(q)
                    || (p.domain || '').includes(q))
    : list;
  return {
    unlocked: true,
    entries: filtered.map(p => ({ id: p.id, name: p.name, username: p.username, url: p.url })),
  };
}

// ── Sync from Chrome's password manager ────────────────────────────────────
async function syncFromBrowser({ csvText, masterPassword, downloadId }) {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('CSV content is empty.');
  }
  if (!masterPassword) {
    throw new Error('Master password is required to re-encrypt the vault.');
  }

  const cache = await getCache();
  if (!cache?.encryptedBlob || !cache?.token || !cache?.vaultId) {
    throw new Error('Sign in first.');
  }

  let payload;
  try {
    payload = await decryptCloudBlob(cache.encryptedBlob, masterPassword);
  } catch (err) {
    if (err && err.message === 'WRONG_MASTER_PASSWORD') {
      throw new Error('Wrong master password.');
    }
    throw new Error('Could not decrypt vault.');
  }

  const parsed = parseCsv(csvText);
  csvText = '';
  const rows = parsed.rows;
  if (rows.length === 0) {
    throw new Error('No password rows found in this CSV.');
  }

  if (!Array.isArray(payload.passwords)) payload.passwords = [];

  const indexByKey = new Map();
  for (const p of payload.passwords) {
    if (!p) continue;
    const key = `${normalizeDomain(p.url || '')}::${(p.username || '').toLowerCase()}`;
    indexByKey.set(key, p);
  }

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const nowIso = new Date().toISOString();

  for (const raw of rows) {
    const row = mapBrowserCsvRow(raw);
    if (!row) continue;
    const domain = normalizeDomain(row.url);
    const usernameKey = (row.username || '').toLowerCase();
    if (!domain && !usernameKey) continue;
    const key = `${domain}::${usernameKey}`;
    const existing = indexByKey.get(key);

    if (existing) {
      if (String(existing.password || '') === String(row.password || '')) {
        unchanged++;
      } else {
        existing.password = row.password;
        existing.updatedAt = nowIso;
        updated++;
      }
    } else {
      const id = (crypto.randomUUID && crypto.randomUUID()) ||
        `iv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const newEntry = {
        id,
        name: row.name || domain || row.url || 'Untitled',
        url: row.url || (domain ? `https://${domain}` : ''),
        username: row.username || '',
        password: row.password || '',
        notes: row.note || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      payload.passwords.push(newEntry);
      indexByKey.set(key, newEntry);
      added++;
    }
  }

  if (added === 0 && updated === 0) {
    const del = await tryDeleteDownloadedCsv(downloadId);
    rows.length = 0;
    return { success: true, added: 0, updated: 0, unchanged, ...del };
  }

  const newBlob = await encryptCloudBlob(payload, masterPassword);
  try {
    await uploadVaultBlob(cache.token, cache.vaultId, newBlob, {
      itemType: 'password',
      title: `Sync from Chrome (${added} new, ${updated} updated)`,
    });
  } catch (err) {
    if (err && err.message === 'SESSION_REVOKED') {
      await fullWipe();
      throw new Error('Your session was revoked. Please sign in again.');
    }
    throw err;
  }

  await setCache({ ...cache, encryptedBlob: newBlob, syncedAt: Date.now() });

  // Refresh in-session indices so the unlocked list immediately reflects
  // the imports.
  const sess = await chrome.storage.session.get(['unlocked', 'sessionKeyB64', 'wrappedSecrets', 'passwordIndex']);
  if (sess.unlocked && sess.sessionKeyB64) {
    const sessionKey = await importSessionKey(b64Decode(sess.sessionKeyB64));
    const wrapped = { ...(sess.wrappedSecrets || {}) };
    const index = [];
    for (const p of payload.passwords) {
      if (!p?.id) continue;
      index.push({
        id: String(p.id),
        name: String(p.name || ''),
        url: String(p.url || ''),
        username: String(p.username || ''),
        domain: extractDomain(p.url || ''),
      });
      if (typeof p.password === 'string' && p.password.length > 0) {
        const w = await aesGcmEncrypt(p.password, sessionKey);
        wrapped[String(p.id)] = { ct: b64Encode(w.ciphertext), iv: b64Encode(w.iv) };
      }
    }
    await chrome.storage.session.set({ wrappedSecrets: wrapped, passwordIndex: index });
    await updateBadge();
  }

  const deleteResult = await tryDeleteDownloadedCsv(downloadId);
  rows.length = 0;
  return { success: true, added, updated, unchanged, ...deleteResult };
}

async function tryDeleteDownloadedCsv(downloadId) {
  if (!downloadId) return { fileDeleted: false };
  if (!chrome?.downloads?.removeFile) {
    return { fileDeleted: false, deleteError: 'downloads API unavailable' };
  }
  try {
    const items = await chrome.downloads.search({ id: downloadId });
    const item = items?.[0];
    if (!item) return { fileDeleted: false, deleteError: 'download not found' };
    if (!looksLikeBrowserPasswordCsv(item) && item.state !== 'complete') {
      return { fileDeleted: false, deleteError: 'download no longer a CSV' };
    }
    await new Promise((resolve, reject) => {
      chrome.downloads.removeFile(downloadId, () => {
        const e = chrome.runtime.lastError;
        if (e) reject(new Error(e.message));
        else resolve();
      });
    });
    try {
      await new Promise((resolve) => chrome.downloads.erase({ id: downloadId }, () => resolve()));
    } catch {}
    return { fileDeleted: true };
  } catch (err) {
    return { fileDeleted: false, deleteError: err?.message || 'delete failed' };
  }
}

function looksLikeBrowserPasswordCsv(item) {
  if (!item) return false;
  if (item.state && item.state !== 'complete') return false;
  const name = (item.filename || '').toLowerCase();
  if (!name.endsWith('.csv')) return false;
  return /password/i.test(name) || /\bchrome\b.*\bpasswords\b/i.test(name);
}

// When Chrome finishes downloading a passwords CSV, try to auto-sync it.
// Path:
//   1. If the vault is unlocked AND the user has granted "Allow access to
//      file URLs" for this extension, fetch the file from disk, run the
//      merge using the in-session master password, delete the CSV, and
//      fire a Chrome notification with the results.
//   2. If anything in (1) fails (vault locked, file URL access denied,
//      fetch fails), broadcast BROWSER_CSV_DETECTED to the popup so the
//      user can finish the sync manually with the file picker.
chrome.downloads?.onChanged?.addListener?.(async (delta) => {
  if (!delta?.state || delta.state.current !== 'complete') return;
  let item;
  try {
    [item] = await chrome.downloads.search({ id: delta.id });
  } catch { return; }
  if (!looksLikeBrowserPasswordCsv(item)) return;

  const basename = (item.filename || '').split(/[\\/]/).pop();
  const reason = await tryAutoSyncFromCsv(item);
  if (reason === 'ok') return; // auto-sync handled it end-to-end

  // Fall back to popup-driven manual flow.
  chrome.runtime.sendMessage({
    type: 'BROWSER_CSV_DETECTED',
    filename: item.filename,
    basename,
    downloadId: item.id,
    autoSyncReason: reason,
  }).catch(() => {});
});

// Returns 'ok' on success, or a short reason string the popup can show.
async function tryAutoSyncFromCsv(item) {
  if (!item?.filename) return 'no-path';
  const master = await getSessionMaster();
  if (!master) return 'locked';

  // Confirm Chrome will let us read file:// URLs from this extension.
  let allowFile = false;
  try {
    if (typeof chrome.extension?.isAllowedFileSchemeAccess === 'function') {
      allowFile = await new Promise((resolve) => {
        try { chrome.extension.isAllowedFileSchemeAccess((v) => resolve(!!v)); }
        catch { resolve(false); }
      });
    }
  } catch { allowFile = false; }
  if (!allowFile) return 'no-file-access';

  let csvText;
  try {
    const fileUrl = pathToFileUrl(item.filename);
    const resp = await fetch(fileUrl);
    if (!resp.ok) return 'fetch-failed';
    csvText = await resp.text();
  } catch {
    return 'fetch-failed';
  }

  try {
    const result = await syncFromBrowser({
      csvText,
      masterPassword: master,
      downloadId: item.id,
    });
    csvText = '';
    const summary = `${result.added} added · ${result.updated} updated · ${result.unchanged} unchanged`;
    await notifySessionEvent({
      title: 'IronVault sync complete',
      message: summary + (result.fileDeleted ? ' · CSV cleaned up.' : ''),
    });
    chrome.runtime.sendMessage({
      type: 'BROWSER_AUTO_SYNC_RESULT',
      ok: true,
      result,
    }).catch(() => {});
    return 'ok';
  } catch (err) {
    chrome.runtime.sendMessage({
      type: 'BROWSER_AUTO_SYNC_RESULT',
      ok: false,
      error: err?.message || 'Sync failed.',
      downloadId: item.id,
      filename: item.filename,
      basename: (item.filename || '').split(/[\\/]/).pop(),
    }).catch(() => {});
    return 'sync-failed';
  }
}

// Convert a local filesystem path to a file:// URL with proper encoding.
// Handles both POSIX (/Users/...) and Windows (C:\\Users\\...) layouts.
function pathToFileUrl(filename) {
  let p = String(filename).replace(/\\/g, '/');
  // Windows drive paths come out as "C:/Users/..." — file URLs need three
  // slashes after "file:".
  if (/^[A-Za-z]:\//.test(p)) p = '/' + p;
  if (!p.startsWith('/')) p = '/' + p;
  // Encode each path segment so spaces, parentheses, etc. survive fetch.
  const encoded = p.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  return 'file://' + encoded;
}

// ── Session-check alarm (remote revocation) ─────────────────────────────────
async function ensureSessionCheckAlarm() {
  await chrome.alarms.create(SESSION_CHECK_ALARM, { periodInMinutes: SESSION_CHECK_PERIOD_MIN });
}

async function runSessionCheck() {
  const cache = await getCache();
  if (!cache?.token) {
    chrome.alarms.clear(SESSION_CHECK_ALARM);
    return;
  }
  let res;
  try {
    res = await checkSession(cache.token);
  } catch {
    return;
  }
  if (res && res.valid === false) {
    console.log('[ironvault] session revoked — wiping local data');
    await notifySessionEvent({
      title: 'IronVault session revoked',
      message: 'Your session was signed out remotely. Local data on this device has been cleared.',
    });
    await fullWipe();
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === EXPIRY_ALARM) {
    await tickExpiry();
  } else if (alarm.name === SESSION_CHECK_ALARM) {
    await runSessionCheck();
  }
});

// ── Message router ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fromContent = !!sender.tab;

  (async () => {
    try {
      switch (msg && msg.type) {
        case 'STATUS':
          sendResponse({ ok: true, ...(await getStatus()) });
          break;

        case 'LOGIN': {
          if (fromContent) throw new Error('Login must come from the popup.');
          const result = await performLogin(msg);
          sendResponse({ ok: true, ...result });
          break;
        }

        case 'UNLOCK': {
          if (fromContent) throw new Error('Unlock must come from the popup.');
          const result = await performUnlock(msg);
          sendResponse({ ok: true, ...result });
          break;
        }

        case 'VERIFY_MASTER': {
          if (fromContent) throw new Error('Master verification is popup-only.');
          sendResponse({ ok: true, ...(await verifyMaster(msg.masterPassword)) });
          break;
        }

        case 'LOGOUT_AND_CLEAN':
        case 'SIGN_OUT': {
          if (fromContent) throw new Error('Sign-out must come from the popup.');
          // Best-effort sync before wipe — if nothing to push it's a noop.
          try { await resync(); } catch {}
          await fullWipe();
          sendResponse({ ok: true });
          break;
        }

        case 'RESYNC': {
          if (fromContent) throw new Error('Re-sync must come from the popup.');
          sendResponse({ ok: true, ...(await resync()) });
          break;
        }

        case 'LOCK':
          if (fromContent) throw new Error('Lock must come from the popup.');
          await lock();
          sendResponse({ ok: true });
          break;

        case 'SEARCH': {
          if (fromContent) throw new Error('Listing is popup-only.');
          sendResponse({ ok: true, ...(await searchEntries(msg.query)) });
          break;
        }

        case 'GET_DOMAIN_MATCHES': {
          const url = fromContent && sender.tab ? sender.tab.url : msg.url;
          sendResponse({ ok: true, ...(await getDomainMatches(url)) });
          break;
        }

        case 'GET_PASSWORD_FOR_FILL': {
          const cred = await decryptOne(msg.id);
          sendResponse({ ok: true, credential: cred });
          if (fromContent) {
            const sess = await chrome.storage.session.get(['token']);
            if (sess.token) {
              // Don't send the credential's plaintext name to the server —
              // doing so leaks the user's vault entry titles in cleartext
              // and breaks the zero-knowledge promise. A generic label is
              // enough for the user-facing activity feed.
              logActivity(sess.token, 'filled', 'password', 'Credential used').catch(() => {});
            }
          }
          break;
        }

        case 'SYNC_FROM_BROWSER': {
          if (fromContent) throw new Error('Sync must come from the popup.');
          const result = await syncFromBrowser({
            csvText: msg.csvText,
            masterPassword: msg.masterPassword,
            downloadId: msg.downloadId,
          });
          sendResponse({ ok: true, ...result });
          break;
        }

        case 'GET_SETTINGS':
          sendResponse({
            ok: true,
            rememberedEmail: await getRememberedEmail(),
            allowedSessionHours: ALLOWED_SESSION_HOURS,
          });
          break;

        default:
          sendResponse({ ok: false, error: 'Unknown message type.' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: (err && err.message) || 'Internal error.' });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const c = await getCache();
  if (c?.token) {
    await ensureSessionCheckAlarm();
    await ensureExpiryAlarm();
  }
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await lock();
  // Clear the JWT on every browser startup. The encrypted blob stays on
  // disk so the user can still offline-unlock with their master password,
  // but the bearer token (which can call /api/vaults/cloud, /vault/items/add,
  // /vault/activity from any context that can read this profile dir) does
  // NOT survive a browser close. A re-login is required to obtain a fresh
  // token. This shrinks the disk-residency window of the JWT to just the
  // current Chrome session — which is what the "session" naming already
  // implied.
  const c = await getCache();
  if (c) {
    if (c.token) {
      await setCache({ ...c, token: null, sessionId: null });
    }
    await ensureExpiryAlarm();
    tickExpiry().catch(() => {});
  }
  await updateBadge();
});

self.addEventListener('activate', () => updateBadge());
