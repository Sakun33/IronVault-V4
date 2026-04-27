// IronVault popup. Four views: login (first-time), unlock (signed-in/locked),
// list (unlocked), settings.
// All sensitive ops live in background.js — the popup only renders state and
// forwards user actions over chrome.runtime.sendMessage. WebAuthn ceremonies
// happen here because service workers can't reach the platform authenticator;
// the resulting PRF output is forwarded as a one-shot secret.

const REVEAL_TIMEOUT_MS = 5000;
const COPY_CLEAR_TIMEOUT_MS = 30000;
const ALLOWED_AUTOLOCK = [1, 5, 15, 30];
const PRF_SALT_LABEL = 'ironvault.prf.v1'; // bound to credential, never secret on its own

const $ = (id) => document.getElementById(id);

const ui = {
  loginPanel: $('iv-login-panel'),
  unlockPanel: $('iv-unlock-panel'),
  listPanel: $('iv-list-panel'),
  settingsPanel: $('iv-settings-panel'),

  loginForm: $('iv-login-form'),
  emailInput: $('iv-email'),
  accountPwInput: $('iv-account-password'),
  masterPwInput: $('iv-master-password'),
  vaultPicker: $('iv-vault-picker'),
  vaultSelect: $('iv-vault-select'),
  loginError: $('iv-login-error'),
  loginSubmit: $('iv-login-submit'),

  unlockForm: $('iv-unlock-form'),
  unlockSub: $('iv-unlock-sub'),
  unlockMaster: $('iv-unlock-master'),
  unlockError: $('iv-unlock-error'),
  unlockSubmit: $('iv-unlock-submit'),
  biometricBtn: $('iv-biometric-btn'),
  signoutLink: $('iv-signout-link'),

  vaultNameLabel: $('iv-vault-name'),
  lockBtn: $('iv-lock-btn'),
  settingsBtn: $('iv-settings-btn'),

  search: $('iv-search'),
  list: $('iv-list'),
  listEmpty: $('iv-list-empty'),

  autoLockInput: $('iv-autolock-input'),
  settingsMsg: $('iv-settings-msg'),
  settingsSave: $('iv-settings-save'),
  settingsBack: $('iv-settings-back'),

  bioStatus: $('iv-bio-status'),
  bioEnable: $('iv-bio-enable'),
  bioDisable: $('iv-bio-disable'),
  bioMsg: $('iv-bio-msg'),
  resync: $('iv-resync'),
  signout: $('iv-signout'),
};

let pendingReveal = null; // { id, pwEl, btnEl, timer }
let lastStatus = null;

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

// ── View routing ────────────────────────────────────────────────────────────
function showPanel(name) {
  ui.loginPanel.hidden = name !== 'login';
  ui.unlockPanel.hidden = name !== 'unlock';
  ui.listPanel.hidden = name !== 'list';
  ui.settingsPanel.hidden = name !== 'settings';
}

function setHeader(unlocked, vaultName) {
  ui.lockBtn.hidden = !unlocked;
  if (unlocked && vaultName) {
    ui.vaultNameLabel.hidden = false;
    ui.vaultNameLabel.textContent = vaultName;
  } else {
    ui.vaultNameLabel.hidden = true;
  }
}

async function refreshState() {
  cancelReveal();
  try {
    const status = await send({ type: 'STATUS' });
    lastStatus = status;
    if (status.unlocked) {
      setHeader(true, status.vaultName);
      showPanel('list');
      await loadList('');
    } else if (status.signedIn) {
      setHeader(false);
      showPanel('unlock');
      ui.unlockSub.textContent = status.email
        ? `Signed in as ${status.email}. Enter your master password.`
        : 'Enter your master password.';
      const supported = await prfSupported();
      ui.biometricBtn.hidden = !status.biometricEnabled || !supported;
      ui.unlockMaster.value = '';
      ui.unlockMaster.focus();
    } else {
      setHeader(false);
      showPanel('login');
      const settings = await send({ type: 'GET_SETTINGS' });
      if (settings.rememberedEmail && !ui.emailInput.value) {
        ui.emailInput.value = settings.rememberedEmail;
        ui.accountPwInput.focus();
      } else {
        ui.emailInput.focus();
      }
    }
  } catch (err) {
    setHeader(false);
    showPanel('login');
    showLoginError(err.message);
  }
}

// ── Login (first-time sign-in) ──────────────────────────────────────────────
function showLoginError(msg) {
  ui.loginError.textContent = msg;
  ui.loginError.hidden = !msg;
}

ui.loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showLoginError('');
  ui.loginSubmit.disabled = true;
  ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Connecting…';
  try {
    const payload = {
      type: 'LOGIN',
      email: ui.emailInput.value,
      accountPassword: ui.accountPwInput.value,
      masterPassword: ui.masterPwInput.value,
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
      showLoginError('Choose which vault to unlock and click again.');
      return;
    }
    ui.masterPwInput.value = '';
    ui.accountPwInput.value = '';
    await refreshState();
  } catch (err) {
    showLoginError(err.message);
  } finally {
    ui.loginSubmit.disabled = false;
    ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Connect vault';
  }
});

// ── Unlock (signed-in, master password or biometric) ───────────────────────
function showUnlockError(msg) {
  ui.unlockError.textContent = msg;
  ui.unlockError.hidden = !msg;
}

ui.unlockForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showUnlockError('');
  ui.unlockSubmit.disabled = true;
  ui.unlockSubmit.querySelector('.iv-btn-label').textContent = 'Unlocking…';
  try {
    await send({ type: 'UNLOCK', masterPassword: ui.unlockMaster.value });
    ui.unlockMaster.value = '';
    await refreshState();
  } catch (err) {
    showUnlockError(err.message);
  } finally {
    ui.unlockSubmit.disabled = false;
    ui.unlockSubmit.querySelector('.iv-btn-label').textContent = 'Unlock';
  }
});

ui.biometricBtn.addEventListener('click', async () => {
  showUnlockError('');
  if (!lastStatus?.biometricEnabled) return;
  try {
    const prfOutputB64 = await runWebAuthnPrf({
      mode: 'get',
      credentialIdB64: lastStatus.biometricCredentialId,
      prfSaltB64: lastStatus.biometricPrfSaltB64,
    });
    await send({ type: 'BIOMETRIC_UNLOCK', prfOutputB64 });
    await refreshState();
  } catch (err) {
    showUnlockError(err.message);
  }
});

ui.signoutLink.addEventListener('click', async () => {
  if (!confirm('Sign out and clear all local IronVault data on this device?')) return;
  await send({ type: 'SIGN_OUT' }).catch(() => {});
  await refreshState();
});

// ── List + reveal ───────────────────────────────────────────────────────────
async function loadList(query) {
  const { entries } = await send({ type: 'SEARCH', query });
  renderList(entries);
}

function renderList(entries) {
  ui.list.innerHTML = '';
  ui.listEmpty.hidden = entries.length > 0;
  for (const e of entries) {
    const li = document.createElement('li');
    li.className = 'iv-row';
    li.dataset.id = e.id;

    const info = document.createElement('div');
    info.className = 'iv-row-info';
    const name = document.createElement('div');
    name.className = 'iv-row-name';
    name.textContent = e.name || '(untitled)';
    const meta = document.createElement('div');
    meta.className = 'iv-row-meta';
    meta.textContent = e.username || '—';
    const pw = document.createElement('div');
    pw.className = 'iv-row-pw';
    pw.textContent = '•••••••••';
    info.append(name, meta, pw);

    const actions = document.createElement('div');
    actions.className = 'iv-row-actions';
    const eyeBtn = makeAction('👁', `Reveal "${e.name}" for 5s`);
    eyeBtn.addEventListener('click', () => toggleReveal(e.id, pw, eyeBtn));
    const copyBtn = makeAction('⎘', `Copy "${e.name}" password`);
    copyBtn.addEventListener('click', () => copyPassword(e.id, copyBtn));
    actions.append(eyeBtn, copyBtn);

    li.append(info, actions);
    ui.list.appendChild(li);
  }
}

function makeAction(label, title) {
  const b = document.createElement('button');
  b.className = 'iv-row-action';
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  return b;
}

function cancelReveal() {
  if (pendingReveal) {
    clearTimeout(pendingReveal.timer);
    if (pendingReveal.pwEl) pendingReveal.pwEl.textContent = '•••••••••';
    if (pendingReveal.btnEl) pendingReveal.btnEl.classList.remove('is-active');
    pendingReveal = null;
  }
}

async function toggleReveal(id, pwEl, btnEl) {
  if (pendingReveal && pendingReveal.id === id) {
    cancelReveal();
    return;
  }
  cancelReveal();
  try {
    const { credential } = await send({ type: 'GET_PASSWORD_FOR_FILL', id });
    pwEl.textContent = credential.password;
    btnEl.classList.add('is-active');
    const timer = setTimeout(() => cancelReveal(), REVEAL_TIMEOUT_MS);
    pendingReveal = { id, pwEl, btnEl, timer };
    setTimeout(() => { credential.password = ''; }, REVEAL_TIMEOUT_MS);
  } catch (err) {
    pwEl.textContent = '⚠ ' + err.message;
  }
}

async function copyPassword(id, btnEl) {
  try {
    const { credential } = await send({ type: 'GET_PASSWORD_FOR_FILL', id });
    await navigator.clipboard.writeText(credential.password);
    credential.password = '';
    const original = btnEl.textContent;
    btnEl.textContent = '✓';
    btnEl.classList.add('is-active');
    setTimeout(() => {
      btnEl.textContent = original;
      btnEl.classList.remove('is-active');
    }, 1200);
    // Auto-clear clipboard after 30s — best-effort, browsers may deny.
    setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, COPY_CLEAR_TIMEOUT_MS);
  } catch (err) {
    btnEl.textContent = '⚠';
    setTimeout(() => { btnEl.textContent = '⎘'; }, 1500);
  }
}

ui.search.addEventListener('input', () => {
  loadList(ui.search.value).catch(() => {});
});

// ── Lock / settings ─────────────────────────────────────────────────────────
ui.lockBtn.addEventListener('click', async () => {
  cancelReveal();
  await send({ type: 'LOCK' }).catch(() => {});
  ui.search.value = '';
  await refreshState();
});

ui.settingsBtn.addEventListener('click', async () => {
  cancelReveal();
  await openSettings();
});

async function openSettings() {
  populateAutolockOptions();
  const s = await send({ type: 'GET_SETTINGS' }).catch(() => null);
  if (s) ui.autoLockInput.value = String(s.autoLockMinutes);
  ui.settingsMsg.hidden = true;
  await refreshBiometricUi();
  showPanel('settings');
}

function populateAutolockOptions() {
  if (ui.autoLockInput && ui.autoLockInput.tagName === 'SELECT' && ui.autoLockInput.options.length === 0) {
    for (const m of ALLOWED_AUTOLOCK) {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = `${m} minute${m === 1 ? '' : 's'}`;
      ui.autoLockInput.appendChild(opt);
    }
  }
}

ui.settingsSave.addEventListener('click', async () => {
  ui.settingsMsg.hidden = false;
  ui.settingsMsg.textContent = '';
  try {
    const minutes = Number(ui.autoLockInput.value);
    if (!ALLOWED_AUTOLOCK.includes(minutes)) {
      throw new Error(`Auto-lock must be one of ${ALLOWED_AUTOLOCK.join(', ')} minutes.`);
    }
    await send({ type: 'SET_AUTOLOCK', minutes });
    ui.settingsMsg.textContent = 'Saved.';
  } catch (err) {
    ui.settingsMsg.textContent = err.message;
  }
});

ui.settingsBack.addEventListener('click', () => refreshState());

// ── Biometric (settings) ────────────────────────────────────────────────────
async function refreshBiometricUi() {
  const status = await send({ type: 'STATUS' }).catch(() => null);
  const supported = await prfSupported();
  if (!supported) {
    ui.bioStatus.textContent = 'This device does not support a WebAuthn platform authenticator (Touch ID / Windows Hello / Face ID).';
    ui.bioEnable.disabled = true;
    ui.bioDisable.hidden = true;
    return;
  }
  if (status?.biometricEnabled) {
    ui.bioStatus.textContent = 'Biometric unlock is enabled.';
    ui.bioEnable.hidden = true;
    ui.bioDisable.hidden = false;
  } else {
    ui.bioStatus.textContent = 'Use Touch ID / Windows Hello / Face ID instead of typing the master password.';
    ui.bioEnable.hidden = false;
    ui.bioDisable.hidden = true;
  }
  ui.bioMsg.hidden = true;
}

ui.bioEnable.addEventListener('click', async () => {
  ui.bioMsg.hidden = true;
  // Need master password to bind to biometric. Prompt only inside an explicit
  // user-gesture handler so the WebAuthn dialog is allowed to surface.
  const master = window.prompt('Enter your master password to bind biometric unlock:');
  if (!master) return;
  try {
    const { credentialIdB64, prfSaltB64, prfOutputB64 } = await runWebAuthnPrf({ mode: 'create' });
    await send({
      type: 'BIOMETRIC_ENABLE',
      credentialId: credentialIdB64,
      prfSaltB64,
      prfOutputB64,
      masterPassword: master,
    });
    ui.bioMsg.hidden = false;
    ui.bioMsg.textContent = 'Biometric unlock enabled.';
    await refreshBiometricUi();
  } catch (err) {
    ui.bioMsg.hidden = false;
    ui.bioMsg.textContent = err.message;
  }
});

ui.bioDisable.addEventListener('click', async () => {
  if (!confirm('Disable biometric unlock?')) return;
  try {
    await send({ type: 'BIOMETRIC_DISABLE' });
    ui.bioMsg.hidden = false;
    ui.bioMsg.textContent = 'Biometric unlock disabled.';
    await refreshBiometricUi();
  } catch (err) {
    ui.bioMsg.hidden = false;
    ui.bioMsg.textContent = err.message;
  }
});

ui.resync.addEventListener('click', async () => {
  ui.settingsMsg.hidden = false;
  ui.settingsMsg.textContent = 'Re-syncing…';
  try {
    const r = await send({ type: 'RESYNC' });
    ui.settingsMsg.textContent = r.success ? 'Vault re-synced.' : (r.error || 'Re-sync failed.');
  } catch (err) {
    ui.settingsMsg.textContent = err.message;
  }
});

ui.signout.addEventListener('click', async () => {
  if (!confirm('Sign out and clear all local IronVault data on this device?')) return;
  try {
    await send({ type: 'SIGN_OUT' });
    await refreshState();
  } catch (err) {
    ui.settingsMsg.hidden = false;
    ui.settingsMsg.textContent = err.message;
  }
});

// ── WebAuthn PRF ────────────────────────────────────────────────────────────
async function prfSupported() {
  if (!('credentials' in navigator) || !window.PublicKeyCredential) return false;
  try {
    const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    return !!ok;
  } catch {
    return false;
  }
}

function bytesToB64(bytes) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

async function deriveSaltBytes(label) {
  const data = new TextEncoder().encode(label);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

async function runWebAuthnPrf({ mode, credentialIdB64, prfSaltB64 }) {
  const saltBytes = prfSaltB64 ? b64ToBytes(prfSaltB64) : await deriveSaltBytes(PRF_SALT_LABEL);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const rpId = location.hostname || 'localhost'; // chrome-extension hostname

  if (mode === 'create') {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'IronVault Extension', id: rpId },
        user: { id: userId, name: 'ironvault-user', displayName: 'IronVault' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        challenge,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        extensions: { prf: { eval: { first: saltBytes } } },
      },
    });
    if (!cred) throw new Error('Biometric registration was cancelled.');
    let prfFirst = cred.getClientExtensionResults?.()?.prf?.results?.first;
    if (!prfFirst) {
      // Many authenticators only emit PRF on assertion, not on registration.
      const second = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: cred.rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
          rpId,
          extensions: { prf: { eval: { first: saltBytes } } },
        },
      });
      prfFirst = second?.getClientExtensionResults?.()?.prf?.results?.first;
    }
    if (!prfFirst) {
      throw new Error('This authenticator does not support WebAuthn PRF (required for biometric unlock).');
    }
    return {
      credentialIdB64: bytesToB64(cred.rawId),
      prfSaltB64: bytesToB64(saltBytes),
      prfOutputB64: bytesToB64(prfFirst),
    };
  }

  // mode === 'get'
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: credentialIdB64
        ? [{ id: b64ToBytes(credentialIdB64), type: 'public-key' }]
        : undefined,
      userVerification: 'required',
      timeout: 60000,
      rpId,
      extensions: { prf: { eval: { first: saltBytes } } },
    },
  });
  if (!assertion) throw new Error('Biometric authentication was cancelled.');
  const r = assertion.getClientExtensionResults?.()?.prf?.results?.first;
  if (!r) throw new Error('Authenticator did not return a PRF value.');
  return bytesToB64(r);
}

// ── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', cancelReveal);
populateAutolockOptions();
refreshState();
