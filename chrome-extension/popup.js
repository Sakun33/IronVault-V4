// IronVault popup — thin client.
//
// Five screens: connect, login, unlock, connected, sync. The popup forwards
// all sensitive operations to background.js over chrome.runtime.sendMessage.
// Master password is required every time a password is revealed or copied —
// it is verified against the in-session wrappedMaster (no PBKDF2 round-trip),
// never cached in popup memory.
//
// The session-duration model replaces inactivity auto-lock: when the chosen
// duration elapses, background wipes ALL local data and the popup falls back
// to the connect screen.

const REVEAL_TIMEOUT_MS = 5000;
const COPY_CLEAR_TIMEOUT_MS = 30000;
const IRONVAULT_URL = 'https://www.ironvault.app';

const $ = (id) => document.getElementById(id);

const ui = {
  // Screens
  connect: $('iv-connect'),
  login: $('iv-login'),
  unlock: $('iv-unlock'),
  connected: $('iv-connected'),
  sync: $('iv-sync'),

  // Connect
  connectCta: $('iv-connect-cta'),
  connectSignup: $('iv-connect-signup'),

  // Login
  loginBack: $('iv-login-back'),
  loginForm: $('iv-login-form'),
  email: $('iv-email'),
  accountPw: $('iv-account-password'),
  masterPw: $('iv-master-password'),
  sessionDuration: $('iv-session-duration'),
  vaultPicker: $('iv-vault-picker'),
  vaultSelect: $('iv-vault-select'),
  loginError: $('iv-login-error'),
  loginSubmit: $('iv-login-submit'),

  // Unlock
  unlockSub: $('iv-unlock-sub'),
  unlockForm: $('iv-unlock-form'),
  unlockMaster: $('iv-unlock-master'),
  unlockError: $('iv-unlock-error'),
  unlockSubmit: $('iv-unlock-submit'),
  unlockLogout: $('iv-unlock-logout'),

  // Connected
  vaultName: $('iv-vault-name'),
  vaultEmail: $('iv-vault-email'),
  sessionPill: $('iv-session-pill'),
  lockBtn: $('iv-lock-btn'),
  search: $('iv-search'),
  empty: $('iv-empty'),
  cards: $('iv-cards'),
  syncBtn: $('iv-sync-btn'),
  logoutBtn: $('iv-logout-btn'),

  // Sync
  syncBack: $('iv-sync-back'),
  syncOpenTab: $('iv-sync-open-tab'),
  syncOpenExtSettings: $('iv-sync-open-ext-settings'),
  syncWaiting: $('iv-sync-waiting'),
  syncNeedsAccess: $('iv-sync-needs-file-access'),
  syncManual: $('iv-sync-manual'),
  syncFile: $('iv-sync-file'),
  syncDetected: $('iv-sync-detected'),
  syncDetectedName: $('iv-sync-detected-name'),
  syncMaster: $('iv-sync-master'),
  syncError: $('iv-sync-error'),
  syncResult: $('iv-sync-result'),
  syncSubmit: $('iv-sync-submit'),

  // Modal
  modalOverlay: $('iv-modal-overlay'),
  modalTitle: $('iv-modal-title'),
  modalSub: $('iv-modal-sub'),
  modalForm: $('iv-modal-form'),
  modalMaster: $('iv-modal-master'),
  modalError: $('iv-modal-error'),
  modalCancel: $('iv-modal-cancel'),
  modalSubmit: $('iv-modal-submit'),
};

let pendingReveal = null; // { id, pwEl, btnEl, timer }
let sessionTimer = null;
let lastStatus = null;
let syncDetectedFilename = '';
let syncDetectedDownloadId = null;
let modalResolver = null; // resolves to true (verified) or false (cancelled)

// ── Bridge ──────────────────────────────────────────────────────────────────
function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp || !resp.ok) return reject(new Error((resp && resp.error) || 'Request failed'));
      resolve(resp);
    });
  });
}

// ── Screen routing ──────────────────────────────────────────────────────────
function showScreen(name) {
  for (const key of ['connect', 'login', 'unlock', 'connected', 'sync']) {
    ui[key].hidden = key !== name;
  }
  if (name !== 'connected') stopSessionTimer();
}

async function refreshState() {
  cancelReveal();
  let status;
  try {
    status = await send({ type: 'STATUS' });
  } catch {
    showScreen('connect');
    return;
  }
  lastStatus = status;
  if (status.unlocked) {
    showConnected(status);
  } else if (status.signedIn) {
    showUnlock(status);
  } else {
    showScreen('connect');
  }
}

// ── Connect ────────────────────────────────────────────────────────────────
ui.connectCta.addEventListener('click', async () => {
  showScreen('login');
  setLoginError('');
  // Pre-fill remembered email so the user doesn't retype it.
  try {
    const settings = await send({ type: 'GET_SETTINGS' });
    if (settings.rememberedEmail && !ui.email.value) {
      ui.email.value = settings.rememberedEmail;
      ui.accountPw.focus();
      return;
    }
  } catch {}
  ui.email.focus();
});

ui.connectSignup.addEventListener('click', () => {
  chrome.tabs.create({ url: IRONVAULT_URL }).catch(() => {
    window.open(IRONVAULT_URL, '_blank');
  });
});

// ── Login ───────────────────────────────────────────────────────────────────
function setLoginError(msg) {
  ui.loginError.textContent = msg || '';
  ui.loginError.hidden = !msg;
}

ui.loginBack.addEventListener('click', () => {
  setLoginError('');
  showScreen('connect');
});

ui.loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  setLoginError('');
  ui.loginSubmit.disabled = true;
  ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Connecting…';
  try {
    const payload = {
      type: 'LOGIN',
      email: ui.email.value,
      accountPassword: ui.accountPw.value,
      masterPassword: ui.masterPw.value,
      sessionDurationHours: Number(ui.sessionDuration.value),
    };
    if (!ui.vaultPicker.hidden && ui.vaultSelect.value) {
      payload.vaultId = ui.vaultSelect.value;
    }
    const result = await send(payload);
    if (result.needsVaultSelection) {
      ui.vaultSelect.innerHTML = '';
      result.vaults.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.vaultId;
        opt.textContent = v.vaultName + (v.isDefault ? ' (default)' : '');
        ui.vaultSelect.appendChild(opt);
      });
      ui.vaultPicker.hidden = false;
      setLoginError('Choose which vault to unlock and click Connect again.');
      return;
    }
    ui.masterPw.value = '';
    ui.accountPw.value = '';
    await refreshState();
  } catch (err) {
    setLoginError(err.message);
  } finally {
    ui.loginSubmit.disabled = false;
    ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Connect vault';
  }
});

// ── Unlock (after soft lock) ────────────────────────────────────────────────
function showUnlock(status) {
  ui.unlockSub.textContent = status.email
    ? `Signed in as ${status.email}.`
    : 'Enter your master password.';
  ui.unlockMaster.value = '';
  ui.unlockError.hidden = true;
  showScreen('unlock');
  ui.unlockMaster.focus();
}

ui.unlockForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ui.unlockError.hidden = true;
  ui.unlockSubmit.disabled = true;
  ui.unlockSubmit.querySelector('.iv-btn-label').textContent = 'Unlocking…';
  try {
    await send({ type: 'UNLOCK', masterPassword: ui.unlockMaster.value });
    ui.unlockMaster.value = '';
    await refreshState();
  } catch (err) {
    ui.unlockError.textContent = err.message;
    ui.unlockError.hidden = false;
  } finally {
    ui.unlockSubmit.disabled = false;
    ui.unlockSubmit.querySelector('.iv-btn-label').textContent = 'Unlock';
  }
});

ui.unlockLogout.addEventListener('click', async () => {
  if (!confirm('Sign out and clear all local IronVault data on this device?')) return;
  await send({ type: 'LOGOUT_AND_CLEAN' }).catch(() => {});
  await refreshState();
});

// ── Connected screen ────────────────────────────────────────────────────────
function showConnected(status) {
  ui.vaultName.textContent = status.vaultName || 'Vault';
  ui.vaultEmail.textContent = status.email || '';
  ui.search.value = '';
  showScreen('connected');
  renderEmpty(); // empty by default — no list until search
  startSessionTimer(status);
  // Auto-search the active site so the popup is useful even before typing.
  prefillSearchForActiveTab();
}

async function prefillSearchForActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    if (!/^https?:\/\//i.test(tab.url)) return;
    const r = await send({ type: 'GET_DOMAIN_MATCHES', url: tab.url });
    if (r.matches && r.matches.length > 0) {
      renderCards(r.matches);
    }
  } catch {}
}

ui.search.addEventListener('input', async () => {
  const q = ui.search.value.trim();
  if (!q) {
    // No search → show empty state (or domain matches if we had any).
    renderEmpty();
    prefillSearchForActiveTab();
    return;
  }
  try {
    const { entries } = await send({ type: 'SEARCH', query: q });
    renderCards(entries);
  } catch (err) {
    renderEmpty();
  }
});

function renderEmpty() {
  ui.cards.innerHTML = '';
  ui.empty.hidden = false;
  ui.cards.hidden = true;
}

function renderCards(entries) {
  ui.empty.hidden = entries.length > 0;
  ui.cards.hidden = entries.length === 0;
  ui.cards.innerHTML = '';
  for (const e of entries) {
    ui.cards.appendChild(buildCard(e));
  }
}

function buildCard(entry) {
  const li = document.createElement('li');
  li.className = 'iv-card';
  li.dataset.id = entry.id;

  const fav = document.createElement('div');
  fav.className = 'iv-card-favicon';
  const faviconUrl = getFaviconUrl(entry.url);
  if (faviconUrl) {
    const img = document.createElement('img');
    img.src = faviconUrl;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      img.remove();
      fav.textContent = (entry.name || '?').charAt(0).toUpperCase();
    };
    fav.appendChild(img);
  } else {
    fav.textContent = (entry.name || '?').charAt(0).toUpperCase();
  }

  const body = document.createElement('div');
  body.className = 'iv-card-body';
  const name = document.createElement('div');
  name.className = 'iv-card-name';
  name.textContent = entry.name || '(untitled)';
  const username = document.createElement('div');
  username.className = 'iv-card-username';
  username.textContent = entry.username || '—';
  const pw = document.createElement('div');
  pw.className = 'iv-card-password';
  pw.textContent = '•••••••••';
  body.append(name, username, pw);

  const actions = document.createElement('div');
  actions.className = 'iv-card-actions';
  const fillBtn = makeIconBtn(svgFill(), `Fill "${entry.name}" on active tab`);
  fillBtn.addEventListener('click', () => fillEntry(entry));
  const eyeBtn = makeIconBtn(svgEye(), `Reveal "${entry.name}" for 5s`);
  eyeBtn.addEventListener('click', () => toggleReveal(entry, pw, eyeBtn));
  const copyBtn = makeIconBtn(svgCopy(), `Copy "${entry.name}" password`);
  copyBtn.addEventListener('click', () => copyEntry(entry, copyBtn));
  actions.append(fillBtn, eyeBtn, copyBtn);

  li.append(fav, body, actions);
  return li;
}

function makeIconBtn(svg, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'iv-card-action';
  b.title = title;
  b.innerHTML = svg;
  return b;
}

function svgEye() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function svgCopy() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
function svgFill() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 10l7 7 7-7"/></svg>`;
}

function getFaviconUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return '';
  }
}

// ── Reveal / copy / fill (master-password-gated) ───────────────────────────
function cancelReveal() {
  if (!pendingReveal) return;
  clearTimeout(pendingReveal.timer);
  if (pendingReveal.pwEl) {
    pendingReveal.pwEl.textContent = '•••••••••';
    pendingReveal.pwEl.classList.remove('is-revealed');
  }
  if (pendingReveal.btnEl) pendingReveal.btnEl.classList.remove('is-active');
  pendingReveal = null;
}

async function toggleReveal(entry, pwEl, btnEl) {
  if (pendingReveal && pendingReveal.id === entry.id) {
    cancelReveal();
    return;
  }
  cancelReveal();
  const verified = await promptMasterPassword({
    title: 'Reveal password',
    sub: `Enter your master password to reveal "${entry.name}" for 5 seconds.`,
  });
  if (!verified) return;
  try {
    const { credential } = await send({ type: 'GET_PASSWORD_FOR_FILL', id: entry.id });
    pwEl.textContent = credential.password;
    pwEl.classList.add('is-revealed');
    btnEl.classList.add('is-active');
    const timer = setTimeout(() => cancelReveal(), REVEAL_TIMEOUT_MS);
    pendingReveal = { id: entry.id, pwEl, btnEl, timer };
    setTimeout(() => { credential.password = ''; }, REVEAL_TIMEOUT_MS);
  } catch (err) {
    pwEl.textContent = '⚠ ' + err.message;
  }
}

async function copyEntry(entry, btnEl) {
  const verified = await promptMasterPassword({
    title: 'Copy password',
    sub: `Enter your master password to copy "${entry.name}". Clipboard auto-clears in 30s.`,
  });
  if (!verified) return;
  try {
    const { credential } = await send({ type: 'GET_PASSWORD_FOR_FILL', id: entry.id });
    await navigator.clipboard.writeText(credential.password);
    credential.password = '';
    btnEl.classList.add('is-active');
    setTimeout(() => btnEl.classList.remove('is-active'), 1500);
    setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, COPY_CLEAR_TIMEOUT_MS);
  } catch (err) {
    btnEl.title = '⚠ ' + err.message;
  }
}

async function fillEntry(entry) {
  // Auto-fill does NOT require master password — vault is already
  // decrypted in memory for the session duration. Background sends the
  // single credential to the active tab's content script.
  //
  // Pre-flight origin check: if the active tab no longer points at the
  // entry's saved domain (exact or subdomain), refuse to send. The content
  // script enforces the same rule again (defence-in-depth, in case the tab
  // navigates between this query and message delivery).
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    let tabHost = '';
    try {
      tabHost = new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch { return; }
    const entryDomain = (entry.domain || '').toLowerCase();
    if (!entryDomain || (tabHost !== entryDomain && !tabHost.endsWith('.' + entryDomain))) {
      // Don't silently fill into the wrong page. window.close() so the user
      // sees their click was acknowledged but no fill happened.
      window.close();
      return;
    }
    const { credential } = await send({ type: 'GET_PASSWORD_FOR_FILL', id: entry.id });
    await chrome.tabs.sendMessage(tab.id, {
      type: 'IV_FILL_FROM_POPUP',
      credential,
    }).catch(() => {});
    // Drop reference ASAP.
    credential.password = '';
    window.close();
  } catch {}
}

// ── Master-password modal ──────────────────────────────────────────────────
function promptMasterPassword({ title, sub }) {
  return new Promise((resolve) => {
    ui.modalTitle.textContent = title || 'Verify master password';
    ui.modalSub.textContent = sub || 'Re-enter your master password.';
    ui.modalMaster.value = '';
    ui.modalError.hidden = true;
    ui.modalOverlay.hidden = false;
    setTimeout(() => ui.modalMaster.focus(), 30);
    modalResolver = resolve;
  });
}

function closeModal(result) {
  ui.modalOverlay.hidden = true;
  ui.modalMaster.value = '';
  if (modalResolver) {
    const r = modalResolver;
    modalResolver = null;
    r(result);
  }
}

ui.modalForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ui.modalError.hidden = true;
  ui.modalSubmit.disabled = true;
  try {
    await send({ type: 'VERIFY_MASTER', masterPassword: ui.modalMaster.value });
    closeModal(true);
  } catch (err) {
    ui.modalError.textContent = err.message || 'Wrong master password.';
    ui.modalError.hidden = false;
    ui.modalMaster.value = '';
    ui.modalMaster.focus();
  } finally {
    ui.modalSubmit.disabled = false;
  }
});

ui.modalCancel.addEventListener('click', () => closeModal(false));
ui.modalOverlay.addEventListener('click', (ev) => {
  if (ev.target === ui.modalOverlay) closeModal(false);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !ui.modalOverlay.hidden) closeModal(false);
});

// ── Lock / logout ──────────────────────────────────────────────────────────
ui.lockBtn.addEventListener('click', async () => {
  cancelReveal();
  await send({ type: 'LOCK' }).catch(() => {});
  await refreshState();
});

ui.logoutBtn.addEventListener('click', async () => {
  if (!confirm('Sync & sign out? All local IronVault data on this device will be cleared.')) return;
  cancelReveal();
  const originalLabel = ui.logoutBtn.textContent;
  ui.logoutBtn.disabled = true;
  ui.logoutBtn.textContent = 'Signing out…';
  try {
    // LOGOUT_AND_CLEAN does best-effort cloud resync then fullWipe(). If the
    // service worker fails to respond (port closed, extension reload) we
    // still need to reset the popup UI so the user isn't stranded on the
    // connected screen. Belt-and-braces: also clear local extension storage
    // directly from the popup as a last-resort fallback.
    try {
      await send({ type: 'LOGOUT_AND_CLEAN' });
    } catch (err) {
      console.warn('[popup] LOGOUT_AND_CLEAN failed, falling back:', err);
      try {
        // Must match background.js K_CACHE = 'ironvault.cache' — the previous
        // 'ironvault.cache.v1' key never existed, so this fallback path silently
        // left the JWT + encrypted blob on disk after a "Sign out".
        await chrome.storage.local.remove(['ironvault.cache', 'rememberedEmail']);
      } catch {}
      try { await chrome.storage.session.clear(); } catch {}
    }
  } finally {
    // Always reset the button — refreshState will route to the connect
    // screen on success, but if we ever stay on the connected screen due
    // to an unexpected error, the button must remain usable.
    ui.logoutBtn.disabled = false;
    ui.logoutBtn.textContent = originalLabel;
  }
  // Force the popup back to the connect screen even if STATUS round-trips
  // a stale "connected" reading — the user just signed out.
  try {
    await refreshState();
  } catch {
    showScreen('connect');
  }
});

// ── Sync from Chrome ───────────────────────────────────────────────────────
// Default flow is "waiting" — the user clicks Sync from Chrome, the extension
// opens chrome://settings/passwords, and the background download watcher
// auto-merges the exported CSV using the in-session master password. If the
// user has not granted "Allow access to file URLs" we surface a one-tap link
// to that toggle plus a manual file-picker fallback.
function showSyncSubState(name) {
  ui.syncWaiting.hidden = name !== 'waiting';
  ui.syncNeedsAccess.hidden = name !== 'needs-access';
  ui.syncManual.hidden = name !== 'manual';
}

ui.syncBtn.addEventListener('click', async () => {
  resetSyncPanel();
  showScreen('sync');
  showSyncSubState('waiting');
  // Open chrome://settings/passwords so the user has one click less to make.
  try { await chrome.tabs.create({ url: 'chrome://settings/passwords' }); } catch {}
});

ui.syncBack.addEventListener('click', () => {
  resetSyncPanel();
  refreshState();
});

ui.syncOpenTab.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: 'chrome://settings/passwords' });
  } catch {
    setSyncError('Could not open Chrome settings. Paste chrome://settings/passwords into a new tab.');
  }
});

ui.syncOpenExtSettings.addEventListener('click', async () => {
  try {
    const id = chrome.runtime.id;
    await chrome.tabs.create({ url: `chrome://extensions/?id=${id}` });
  } catch {}
});

ui.syncFile.addEventListener('change', () => {
  ui.syncSubmit.disabled = !ui.syncFile.files?.length;
  setSyncError('');
});

function setSyncError(msg) {
  ui.syncError.textContent = msg || '';
  ui.syncError.hidden = !msg;
}

function resetSyncPanel() {
  setSyncError('');
  ui.syncResult.hidden = true;
  ui.syncResult.classList.remove('is-success');
  ui.syncResult.innerHTML = '';
  ui.syncFile.value = '';
  ui.syncMaster.value = '';
  ui.syncDetected.hidden = true;
  syncDetectedFilename = '';
  syncDetectedDownloadId = null;
  ui.syncSubmit.disabled = true;
  ui.syncSubmit.querySelector('.iv-btn-label').textContent = 'Import & sync';
  showSyncSubState('waiting');
}

function renderSyncSuccess(result, autoSynced) {
  let footer = '';
  if (result.fileDeleted) {
    footer = `<div class="iv-sync-result-note iv-sync-result-note-success">
      ✓ Exported CSV securely deleted from your Downloads folder.
    </div>`;
  } else if (result.deleteError) {
    footer = `<div class="iv-sync-result-note iv-sync-result-note-warning">
      ⚠️ Couldn't auto-delete the CSV (${escapeHtml(result.deleteError)}).
      Please delete it from your Downloads folder.
    </div>`;
  } else {
    footer = `<div class="iv-sync-result-note iv-sync-result-note-warning">
      ⚠️ Please delete the exported CSV from your Downloads folder now.
    </div>`;
  }
  const banner = autoSynced
    ? `<div class="iv-sync-result-note iv-sync-result-note-success">✨ Auto-synced from Chrome.</div>`
    : '';
  ui.syncResult.classList.add('is-success');
  ui.syncResult.innerHTML = `
    ${banner}
    <div class="iv-sync-result-row"><span>Added</span><strong>${result.added}</strong></div>
    <div class="iv-sync-result-row"><span>Updated</span><strong>${result.updated}</strong></div>
    <div class="iv-sync-result-row"><span>Unchanged</span><strong>${result.unchanged}</strong></div>
    ${footer}`;
  ui.syncResult.hidden = false;
  showSyncSubState(null); // hide all substates
  ui.syncWaiting.hidden = true;
  ui.syncNeedsAccess.hidden = true;
  ui.syncManual.hidden = true;
}

ui.syncSubmit.addEventListener('click', async () => {
  setSyncError('');
  const file = ui.syncFile.files?.[0];
  if (!file) { setSyncError('Pick the CSV file you exported from Chrome.'); return; }
  if (!ui.syncMaster.value) { setSyncError('Master password is required to re-encrypt the vault.'); return; }

  const downloadId = (syncDetectedFilename && file.name === syncDetectedFilename)
    ? syncDetectedDownloadId
    : null;

  ui.syncSubmit.disabled = true;
  ui.syncSubmit.querySelector('.iv-btn-label').textContent = 'Importing…';
  let csvText = await file.text();
  try {
    const result = await send({
      type: 'SYNC_FROM_BROWSER',
      csvText,
      masterPassword: ui.syncMaster.value,
      downloadId,
    });
    csvText = '';
    try { ui.syncFile.value = ''; } catch {}
    ui.syncMaster.value = '';
    renderSyncSuccess(result, false);
  } catch (err) {
    csvText = '';
    setSyncError(err.message || 'Sync failed.');
    ui.syncSubmit.disabled = false;
    ui.syncSubmit.querySelector('.iv-btn-label').textContent = 'Import & sync';
  }
});

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return;

  // Auto-sync from background succeeded — render the success card.
  if (msg.type === 'BROWSER_AUTO_SYNC_RESULT') {
    if (ui.sync.hidden) return; // popup not on sync screen
    if (msg.ok && msg.result) {
      renderSyncSuccess(msg.result, true);
    } else {
      // Auto-sync attempted but failed (e.g. wrong master, decrypt failure).
      // Drop into manual mode so the user can finish the job.
      syncDetectedFilename = msg.basename || '';
      syncDetectedDownloadId = typeof msg.downloadId === 'number' ? msg.downloadId : null;
      if (syncDetectedFilename) {
        ui.syncDetectedName.textContent = syncDetectedFilename;
        ui.syncDetected.hidden = false;
      }
      setSyncError(msg.error || 'Auto-sync failed.');
      showSyncSubState('manual');
    }
    return;
  }

  // CSV detected but background couldn't auto-sync — pick the right fallback.
  if (msg.type === 'BROWSER_CSV_DETECTED') {
    if (ui.sync.hidden) return;
    syncDetectedFilename = msg.basename || msg.filename || '';
    syncDetectedDownloadId = typeof msg.downloadId === 'number' ? msg.downloadId : null;
    if (syncDetectedFilename) {
      ui.syncDetectedName.textContent = syncDetectedFilename;
      ui.syncDetected.hidden = false;
    }
    if (msg.autoSyncReason === 'no-file-access') {
      showSyncSubState('needs-access');
    } else if (msg.autoSyncReason === 'locked') {
      setSyncError('Vault is locked — unlock the extension and try the export again.');
      showSyncSubState('manual');
    } else {
      // 'no-path', 'fetch-failed', or undefined (no file URL access checked
      // because vault was locked / first run). Drop into manual.
      showSyncSubState('manual');
    }
  }
});

// ── Session timer ──────────────────────────────────────────────────────────
function stopSessionTimer() {
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
}

function startSessionTimer(status) {
  stopSessionTimer();
  updateSessionPill(status);
  sessionTimer = setInterval(async () => {
    if (lastStatus && !lastStatus.sessionExpiresAt) {
      // Until-logout — no countdown to update.
      return;
    }
    // Re-fetch status periodically (every 10s) so we notice background-side
    // wipes (e.g. session expired in another popup, remote revocation).
    if (Date.now() % 10000 < 1000) {
      try {
        const s = await send({ type: 'STATUS' });
        lastStatus = s;
        if (!s.unlocked) { await refreshState(); return; }
      } catch {}
    }
    updateSessionPill(lastStatus);
  }, 1000);
}

function updateSessionPill(status) {
  if (!status) { ui.sessionPill.hidden = true; return; }
  ui.sessionPill.hidden = false;
  ui.sessionPill.classList.remove('is-warning', 'is-infinite');
  if (!status.sessionExpiresAt) {
    ui.sessionPill.textContent = 'Until logout';
    ui.sessionPill.classList.add('is-infinite');
    return;
  }
  const remaining = status.sessionExpiresAt - Date.now();
  if (remaining <= 0) {
    ui.sessionPill.textContent = 'Expired';
    ui.sessionPill.classList.add('is-warning');
    refreshState();
    return;
  }
  ui.sessionPill.textContent = formatRemaining(remaining) + ' left';
  if (remaining < 5 * 60 * 1000) ui.sessionPill.classList.add('is-warning');
}

function formatRemaining(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

// ── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  cancelReveal();
  stopSessionTimer();
});
refreshState();
