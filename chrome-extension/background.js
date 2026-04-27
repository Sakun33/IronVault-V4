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
//   5. Auto-lock: alarm checks lastActivity each minute; configurable timeout
//      (default 5 min) wipes session storage.

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

const DEFAULT_AUTOLOCK_MIN = 5;
const ALLOWED_AUTOLOCK_MIN = [1, 5, 15, 30];
const ALARM_NAME = 'ironvault-autolock';
const SESSION_CHECK_ALARM = 'ironvault-session-check';
const SESSION_CHECK_PERIOD_MIN = 5;

// Persistent (chrome.storage.local) — keyed for clarity:
//   K_CACHE: { encryptedBlob, vaultId, vaultName, token, email, syncedAt }
//   K_BIO:   { credentialId, prfSaltB64, wrap: { ct, iv } }
//   autoLockMinutes (number)
//   rememberedEmail (string)
const K_CACHE = 'ironvault.cache';
const K_BIO = 'ironvault.biometric';

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

function domainMatches(pageDomain, entryDomain) {
  if (!pageDomain || !entryDomain) return false;
  if (pageDomain === entryDomain) return true;
  // Match subdomains in either direction: mail.google.com ↔ google.com
  return pageDomain.endsWith('.' + entryDomain) || entryDomain.endsWith('.' + pageDomain);
}

async function getAutoLockMinutes() {
  const { autoLockMinutes } = await chrome.storage.local.get('autoLockMinutes');
  return typeof autoLockMinutes === 'number' && autoLockMinutes > 0
    ? autoLockMinutes
    : DEFAULT_AUTOLOCK_MIN;
}

async function setAutoLockMinutes(minutes) {
  if (!ALLOWED_AUTOLOCK_MIN.includes(minutes)) {
    throw new Error(`Auto-lock must be one of ${ALLOWED_AUTOLOCK_MIN.join(', ')} minutes.`);
  }
  await chrome.storage.local.set({ autoLockMinutes: minutes });
  await chrome.storage.session.set({ autoLockMinutes: minutes });
}

async function getCache() {
  const { [K_CACHE]: c } = await chrome.storage.local.get(K_CACHE);
  return c || null;
}

async function setCache(c) {
  await chrome.storage.local.set({ [K_CACHE]: c });
}

async function getBiometric() {
  const { [K_BIO]: b } = await chrome.storage.local.get(K_BIO);
  return b || null;
}

async function clearAccount() {
  await chrome.storage.local.remove([K_CACHE, K_BIO, 'rememberedEmail']);
  chrome.alarms.clear(SESSION_CHECK_ALARM);
  await lock();
}

async function getRememberedEmail() {
  const { rememberedEmail } = await chrome.storage.local.get('rememberedEmail');
  return rememberedEmail || '';
}

async function rememberEmail(email) {
  await chrome.storage.local.set({ rememberedEmail: email });
}

async function touchActivity() {
  await chrome.storage.session.set({ lastActivity: Date.now() });
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

// ── Lock / unlock ───────────────────────────────────────────────────────────
async function lock() {
  await chrome.storage.session.clear();
  chrome.alarms.clear(ALARM_NAME);
  await updateBadge();
}

async function ensureAutoLockAlarm() {
  // Periodic check — fires every minute, decides whether to lock based on
  // configured timeout vs lastActivity. Cheaper than scheduling a new alarm
  // on every interaction.
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { unlocked, lastActivity, autoLockMinutes } = await chrome.storage.session.get([
    'unlocked', 'lastActivity', 'autoLockMinutes',
  ]);
  if (!unlocked) {
    chrome.alarms.clear(ALARM_NAME);
    return;
  }
  const limitMs = (autoLockMinutes || DEFAULT_AUTOLOCK_MIN) * 60 * 1000;
  if (Date.now() - (lastActivity || 0) > limitMs) {
    await lock();
  }
});

// ── Core unlock flow ────────────────────────────────────────────────────────
async function performLogin({ email, accountPassword, masterPassword, vaultId }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');
  if (!accountPassword) throw new Error('Account password is required.');
  if (!masterPassword) throw new Error('Master password is required.');

  // Step 1: account auth → JWT
  const accountPasswordHash = await sha256Hex(accountPassword);
  const { token, sessionId } = await authToken(normalizedEmail, accountPasswordHash);

  // Step 2: list cloud vaults — if multiple and none chosen, return for picker
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
  } else {
    chosen = vaults.find(v => v.isDefault) || null;
  }
  if (!chosen) {
    return {
      needsVaultSelection: true,
      vaults: vaults.map(v => ({
        vaultId: v.vaultId, vaultName: v.vaultName, isDefault: !!v.isDefault,
      })),
    };
  }

  // Step 3: download blob and decrypt with master password
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

  // Cache the still-encrypted blob + token so future unlocks can run offline
  // (no API roundtrip — only the master password is needed).
  await setCache({
    encryptedBlob: full.encryptedBlob,
    vaultId: chosen.vaultId,
    vaultName: chosen.vaultName,
    token,
    sessionId: sessionId || null,
    email: normalizedEmail,
    syncedAt: Date.now(),
  });

  // Step 4: re-wrap each password with a fresh per-session key, drop master
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

  // Wrap master password under the session key. This lets us re-encrypt the
  // vault when the user adds a new entry without re-prompting for it. The
  // wrap key (sessionKey) is itself stored only in chrome.storage.session,
  // which is in-memory and cleared on browser close — same boundary as the
  // already-wrapped per-entry password ciphertexts.
  const wrappedMaster = await aesGcmEncrypt(masterPassword, sessionKey);

  // payload (full plaintext) goes out of scope after this function returns.
  await chrome.storage.session.set({
    unlocked: true,
    email: normalizedEmail,
    token,
    sessionId: sessionId || null,
    vaultId: chosen.vaultId,
    vaultName: chosen.vaultName,
    sessionKeyB64: b64Encode(sessionKeyRaw),
    wrappedMaster: { ct: b64Encode(wrappedMaster.ciphertext), iv: b64Encode(wrappedMaster.iv) },
    passwordIndex,
    wrappedSecrets,
    lastActivity: Date.now(),
    autoLockMinutes: await getAutoLockMinutes(),
  });
  await rememberEmail(normalizedEmail);
  await ensureAutoLockAlarm();
  await ensureSessionCheckAlarm();
  await updateBadge();

  return {
    success: true,
    email: normalizedEmail,
    vaultName: chosen.vaultName,
    entryCount: passwordIndex.length,
  };
}

// ── Offline re-unlock from the cached encrypted blob ────────────────────────
// After auto-lock / manual lock / browser-restart while still signed in: the
// server token + encrypted blob are already cached in chrome.storage.local.
// We just need the master password to decrypt the blob — no API call.
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
    email: cache.email,
    token: cache.token,
    sessionId: cache.sessionId || null,
    vaultId: cache.vaultId,
    vaultName: cache.vaultName,
    sessionKeyB64: b64Encode(sessionKeyRaw),
    wrappedMaster: { ct: b64Encode(wrappedMaster.ciphertext), iv: b64Encode(wrappedMaster.iv) },
    passwordIndex,
    wrappedSecrets,
    lastActivity: Date.now(),
    autoLockMinutes: await getAutoLockMinutes(),
  });
  await ensureAutoLockAlarm();
  await ensureSessionCheckAlarm();
  await updateBadge();

  return {
    success: true,
    email: cache.email,
    vaultName: cache.vaultName,
    entryCount: passwordIndex.length,
  };
}

// ── Biometric unlock (WebAuthn PRF) ─────────────────────────────────────────
// The popup performs the WebAuthn ceremony (service workers can't reach the
// platform authenticator). After a successful PRF assertion, the popup
// forwards the 32-byte PRF output here as a one-shot secret. We use it to
// AES-wrap the master password. The PRF output is bound to the credential
// and the per-install salt — it is NOT a stored secret on its own.
async function biometricEnable({ credentialId, prfSaltB64, prfOutputB64, masterPassword }) {
  if (!credentialId || !prfSaltB64 || !prfOutputB64 || !masterPassword) {
    throw new Error('Biometric setup is missing fields.');
  }
  const cache = await getCache();
  if (!cache || !cache.encryptedBlob) throw new Error('Sign in first.');
  // Verify the master password actually unlocks the cached blob before we
  // wrap it — otherwise we'd persist a bad password under biometrics.
  try {
    await decryptCloudBlob(cache.encryptedBlob, masterPassword);
  } catch {
    throw new Error('Master password did not unlock the vault.');
  }
  const wrapKey = await importSessionKey(b64Decode(prfOutputB64));
  const { ciphertext, iv } = await aesGcmEncrypt(masterPassword, wrapKey);
  await chrome.storage.local.set({
    [K_BIO]: {
      credentialId,
      prfSaltB64,
      wrap: { ct: b64Encode(ciphertext), iv: b64Encode(iv) },
    },
  });
  return { success: true };
}

async function biometricDisable() {
  await chrome.storage.local.remove(K_BIO);
  return { success: true };
}

async function biometricUnlock({ prfOutputB64 }) {
  if (!prfOutputB64) throw new Error('Biometric did not produce a key.');
  const bio = await getBiometric();
  if (!bio) throw new Error('Biometric is not configured.');
  const wrapKey = await importSessionKey(b64Decode(prfOutputB64));
  let masterPassword;
  try {
    const pt = await aesGcmDecrypt(b64Decode(bio.wrap.ct), wrapKey, b64Decode(bio.wrap.iv));
    masterPassword = new TextDecoder().decode(pt);
  } catch {
    throw new Error('Biometric authentication did not match.');
  }
  const result = await performUnlock({ masterPassword });
  // best-effort: drop reference (JS GC reclaims when collected).
  masterPassword = null;
  return result;
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
  await touchActivity();
  return {
    id: meta.id,
    name: meta.name,
    url: meta.url,
    username: meta.username,
    password: new TextDecoder().decode(pt),
  };
}

// ── Add new entry (password / note / subscription) ─────────────────────────
// Decrypts the cached blob with the supplied master password, appends the
// new item to the matching collection, re-encrypts with a fresh salt+IV, and
// pushes the new blob to /api/vault/items/add. The web app will see it on the
// next cloud sync. Master password is required — supplied either from the
// add-entry form or unwrapped from chrome.storage.session.
async function addItem({ masterPassword, item }) {
  if (!item || !item.kind) throw new Error('item required');

  const cache = await getCache();
  if (!cache?.encryptedBlob || !cache?.token || !cache?.vaultId) {
    throw new Error('Sign in first.');
  }

  // Always re-derive against the current master password — the user may have
  // typed a fresh one in the form, which wouldn't match the wrapped one.
  let payload;
  try {
    payload = await decryptCloudBlob(cache.encryptedBlob, masterPassword);
  } catch (err) {
    if (err && err.message === 'WRONG_MASTER_PASSWORD') {
      throw new Error('Wrong master password.');
    }
    throw new Error('Could not decrypt vault.');
  }

  const nowIso = new Date().toISOString();
  const id = (crypto.randomUUID && crypto.randomUUID()) ||
    `iv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (item.kind === 'password') {
    if (!Array.isArray(payload.passwords)) payload.passwords = [];
    payload.passwords.push({
      id,
      name: item.title || '',
      url: item.url || '',
      username: item.username || '',
      password: item.password || '',
      notes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } else if (item.kind === 'note') {
    if (!Array.isArray(payload.notes)) payload.notes = [];
    payload.notes.push({
      id,
      title: item.title || '',
      content: item.content || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } else if (item.kind === 'subscription') {
    if (!Array.isArray(payload.subscriptions)) payload.subscriptions = [];
    payload.subscriptions.push({
      id,
      name: item.title || '',
      cost: typeof item.cost === 'number' ? item.cost : Number(item.cost) || 0,
      currency: item.currency || 'USD',
      billingDate: item.billingDate || '',
      billingCycle: item.billingCycle || 'monthly',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } else {
    throw new Error(`Unknown item kind: ${item.kind}`);
  }

  // Re-encrypt with the same master password (fresh salt+IV).
  const newBlob = await encryptCloudBlob(payload, masterPassword);

  // Push to server. /api/vault/items/add returns 401 if our session was
  // revoked; surface that distinctly so we can wipe local state.
  try {
    await uploadVaultBlob(cache.token, cache.vaultId, newBlob, {
      itemType: item.kind,
      title: item.title || '',
    });
  } catch (err) {
    if (err && err.message === 'SESSION_REVOKED') {
      await clearAccount();
      throw new Error('Your session was revoked. Please sign in again.');
    }
    throw err;
  }

  // Persist the new blob locally so future offline unlocks see the new entry.
  await setCache({ ...cache, encryptedBlob: newBlob, syncedAt: Date.now() });

  // Update the unlocked-session indices so the UI reflects the new entry
  // without needing a full re-unlock.
  const session = await chrome.storage.session.get(['unlocked', 'sessionKeyB64', 'wrappedSecrets', 'passwordIndex']);
  if (session.unlocked && session.sessionKeyB64 && item.kind === 'password') {
    const sessionKey = await importSessionKey(b64Decode(session.sessionKeyB64));
    const wrapped = await aesGcmEncrypt(item.password || '', sessionKey);
    const newWrapped = { ...(session.wrappedSecrets || {}), [id]: { ct: b64Encode(wrapped.ciphertext), iv: b64Encode(wrapped.iv) } };
    const newIndex = [
      ...(session.passwordIndex || []),
      {
        id,
        name: item.title || '',
        url: item.url || '',
        username: item.username || '',
        domain: extractDomain(item.url || ''),
      },
    ];
    await chrome.storage.session.set({ wrappedSecrets: newWrapped, passwordIndex: newIndex });
    await updateBadge();
  }

  await touchActivity();
  return { success: true, id, kind: item.kind };
}

// ── Session-check alarm ────────────────────────────────────────────────────
// Polls /api/auth/session/check every SESSION_CHECK_PERIOD_MIN minutes.
// On 401 we wipe ALL local extension data — encrypted blob, biometric wrap,
// session storage — so the user can't recover from a revoked session by
// re-entering the master password offline.
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
    return; // network error — assume valid, retry next tick
  }
  if (res && res.valid === false) {
    console.log('[ironvault] session revoked — wiping local data');
    await clearAccount();
    chrome.alarms.clear(SESSION_CHECK_ALARM);
    await updateBadge();
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SESSION_CHECK_ALARM) return;
  await runSessionCheck();
});

// ── Status / queries ────────────────────────────────────────────────────────
async function getStatus() {
  const s = await chrome.storage.session.get([
    'unlocked', 'email', 'vaultName', 'passwordIndex', 'autoLockMinutes',
  ]);
  const cache = await getCache();
  const bio = await getBiometric();
  return {
    unlocked: !!s.unlocked,
    signedIn: !!cache,
    email: s.email || cache?.email || (await getRememberedEmail()),
    vaultName: s.vaultName || cache?.vaultName || null,
    entryCount: Array.isArray(s.passwordIndex) ? s.passwordIndex.length : 0,
    autoLockMinutes: s.autoLockMinutes || (await getAutoLockMinutes()),
    autoLockOptions: ALLOWED_AUTOLOCK_MIN,
    biometricEnabled: !!bio,
    biometricCredentialId: bio?.credentialId || null,
    biometricPrfSaltB64: bio?.prfSaltB64 || null,
    syncedAt: cache?.syncedAt || null,
  };
}

async function getDomainMatches(pageUrl) {
  const { unlocked, passwordIndex } = await chrome.storage.session.get(['unlocked', 'passwordIndex']);
  if (!unlocked) return { unlocked: false, matches: [] };
  const pageDomain = extractDomain(pageUrl);
  if (!pageDomain) return { unlocked: true, matches: [] };
  await touchActivity();
  const matches = (passwordIndex || []).filter(p => domainMatches(pageDomain, p.domain));
  return {
    unlocked: true,
    matches: matches.map(m => ({ id: m.id, name: m.name, username: m.username, url: m.url })),
  };
}

async function searchEntries(query) {
  const { unlocked, passwordIndex } = await chrome.storage.session.get(['unlocked', 'passwordIndex']);
  if (!unlocked) return { unlocked: false, entries: [] };
  await touchActivity();
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

// ── Message router ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Distinguish content-script callers (have sender.tab) from popup (no tab).
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

        case 'SIGN_OUT': {
          if (fromContent) throw new Error('Sign-out must come from the popup.');
          await clearAccount();
          sendResponse({ ok: true });
          break;
        }

        case 'BIOMETRIC_ENABLE': {
          if (fromContent) throw new Error('Biometric setup must come from the popup.');
          sendResponse({ ok: true, ...(await biometricEnable(msg)) });
          break;
        }

        case 'BIOMETRIC_DISABLE': {
          if (fromContent) throw new Error('Biometric setup must come from the popup.');
          sendResponse({ ok: true, ...(await biometricDisable()) });
          break;
        }

        case 'BIOMETRIC_UNLOCK': {
          if (fromContent) throw new Error('Biometric unlock must come from the popup.');
          sendResponse({ ok: true, ...(await biometricUnlock(msg)) });
          break;
        }

        case 'RESYNC': {
          if (fromContent) throw new Error('Re-sync must come from the popup.');
          sendResponse({ ok: true, ...(await resync()) });
          break;
        }

        case 'LOCK':
          await lock();
          sendResponse({ ok: true });
          break;

        case 'SEARCH': {
          if (fromContent) throw new Error('Listing is popup-only.');
          sendResponse({ ok: true, ...(await searchEntries(msg.query)) });
          break;
        }

        case 'GET_DOMAIN_MATCHES': {
          // Use sender.tab.url so a malicious page can't lie about its origin.
          const url = fromContent && sender.tab ? sender.tab.url : msg.url;
          sendResponse({ ok: true, ...(await getDomainMatches(url)) });
          break;
        }

        case 'GET_PASSWORD_FOR_FILL': {
          // Returns the single requested credential. Both popup (reveal-eye)
          // and content (autofill) call this. Content is gated by user gesture
          // (only fires on click in the in-page picker).
          const cred = await decryptOne(msg.id);
          sendResponse({ ok: true, credential: cred });
          // Log autofill (only when triggered from a content script, i.e.
          // an actual page fill — not a popup reveal/copy, which is logged
          // separately or not at all to avoid double-counting).
          if (fromContent) {
            const sess = await chrome.storage.session.get(['token']);
            if (sess.token) {
              logActivity(sess.token, 'filled', 'password', cred.name).catch(() => {});
            }
          }
          break;
        }

        case 'ADD_ITEM': {
          if (fromContent) throw new Error('Adding entries must come from the popup.');
          sendResponse({ ok: true, ...(await addItem(msg)) });
          break;
        }

        case 'GET_SETTINGS':
          sendResponse({
            ok: true,
            autoLockMinutes: await getAutoLockMinutes(),
            rememberedEmail: await getRememberedEmail(),
          });
          break;

        case 'SET_AUTOLOCK': {
          // setAutoLockMinutes enforces the ALLOWED_AUTOLOCK_MIN whitelist.
          await setAutoLockMinutes(Number(msg.minutes));
          sendResponse({ ok: true });
          break;
        }

        case 'GET_AUTOLOCK_OPTIONS':
          sendResponse({ ok: true, options: ALLOWED_AUTOLOCK_MIN });
          break;

        case 'TOUCH_ACTIVITY':
          await touchActivity();
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ ok: false, error: 'Unknown message type.' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: (err && err.message) || 'Internal error.' });
    }
  })();

  // Keep the message channel open for the async response.
  return true;
});

// Re-arm the badge whenever the SW spins up. Lock on browser startup so
// session storage's "cleared on browser close" guarantee is reflected in UI.
chrome.runtime.onInstalled.addListener(async () => {
  const c = await getCache();
  if (c?.token) await ensureSessionCheckAlarm();
  await updateBadge();
});
chrome.runtime.onStartup.addListener(async () => {
  await lock();
  const c = await getCache();
  if (c?.token) {
    await ensureSessionCheckAlarm();
    // Run an immediate check on startup so a session revoked while the
    // browser was closed wipes data the moment the user reopens Chrome.
    runSessionCheck().catch(() => {});
  }
  await updateBadge();
});
self.addEventListener('activate', () => updateBadge());
