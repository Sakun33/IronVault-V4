// IronVault popup. Three views: login, list, settings.
// All sensitive ops live in background.js — the popup only renders state and
// forwards user actions over chrome.runtime.sendMessage.

const REVEAL_TIMEOUT_MS = 5000;
const COPY_CLEAR_TIMEOUT_MS = 30000;

const $ = (id) => document.getElementById(id);

const ui = {
  loginPanel: $('iv-login-panel'),
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
};

let pendingReveal = null; // { id, timer }

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
    if (status.unlocked) {
      setHeader(true, status.vaultName);
      showPanel('list');
      await loadList('');
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

// ── Login ───────────────────────────────────────────────────────────────────
function showLoginError(msg) {
  ui.loginError.textContent = msg;
  ui.loginError.hidden = !msg;
}

ui.loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showLoginError('');
  ui.loginSubmit.disabled = true;
  ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Unlocking…';
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
      // Multi-vault account with no default — render picker and let user pick.
      ui.vaultSelect.innerHTML = '';
      result.vaults.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.vaultId;
        opt.textContent = v.vaultName + (v.isDefault ? ' (default)' : '');
        ui.vaultSelect.appendChild(opt);
      });
      ui.vaultPicker.hidden = false;
      showLoginError('Choose which vault to unlock and click Unlock again.');
      return;
    }
    // Wipe master password from the input the moment login succeeds.
    ui.masterPwInput.value = '';
    ui.accountPwInput.value = '';
    await refreshState();
  } catch (err) {
    showLoginError(err.message);
  } finally {
    ui.loginSubmit.disabled = false;
    ui.loginSubmit.querySelector('.iv-btn-label').textContent = 'Unlock';
  }
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
    // Best-effort: scrub `credential.password` from this scope after timer fires.
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
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
    }, COPY_CLEAR_TIMEOUT_MS);
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

function formatLockOption(min) {
  if (min === 1) return '1 minute';
  if (min < 60) return `${min} minutes`;
  const h = Math.floor(min / 60);
  return h === 1 ? '1 hour' : `${h} hours`;
}

ui.settingsBtn.addEventListener('click', async () => {
  cancelReveal();
  const [opts, s] = await Promise.all([
    send({ type: 'GET_AUTOLOCK_OPTIONS' }).catch(() => ({ options: [1, 5, 15, 30] })),
    send({ type: 'GET_SETTINGS' }).catch(() => null),
  ]);
  ui.autoLockInput.innerHTML = '';
  for (const min of opts.options) {
    const opt = document.createElement('option');
    opt.value = String(min);
    opt.textContent = formatLockOption(min);
    ui.autoLockInput.appendChild(opt);
  }
  if (s) ui.autoLockInput.value = String(s.autoLockMinutes);
  ui.settingsMsg.hidden = true;
  showPanel('settings');
});

ui.settingsSave.addEventListener('click', async () => {
  ui.settingsMsg.hidden = false;
  ui.settingsMsg.textContent = '';
  try {
    await send({ type: 'SET_AUTOLOCK', minutes: Number(ui.autoLockInput.value) });
    ui.settingsMsg.textContent = 'Saved.';
  } catch (err) {
    ui.settingsMsg.textContent = err.message;
  }
});

ui.settingsBack.addEventListener('click', () => refreshState());

// ── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', cancelReveal);
refreshState();
