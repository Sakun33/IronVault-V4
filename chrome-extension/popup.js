/**
 * IronVault popup controller.
 *
 * Handles sign-in, vault sync, and quick actions. The full vault decryption
 * lives in `background.js` so the popup can stay closed without breaking
 * autofill on already-loaded tabs.
 */

const els = {
  statusLine: document.getElementById('status-line'),
  views: {
    signin: document.getElementById('view-signin'),
    home: document.getElementById('view-home'),
    import: document.getElementById('view-import'),
  },
  signin: {
    form: document.getElementById('signin-form'),
    email: document.getElementById('signin-email'),
    password: document.getElementById('signin-password'),
    master: document.getElementById('signin-master'),
    submit: document.getElementById('signin-btn'),
    error: document.getElementById('signin-error'),
  },
  home: {
    autofillPill: document.getElementById('autofill-pill'),
    autofillStatus: document.getElementById('autofill-status'),
    fillHere: document.getElementById('btn-fill-here'),
    importBtn: document.getElementById('btn-import'),
    openVault: document.getElementById('btn-open-vault'),
    vaultInfo: document.getElementById('vault-info'),
    resync: document.getElementById('btn-resync'),
    signout: document.getElementById('btn-signout'),
  },
  importView: {
    open: document.getElementById('btn-open-chrome-passwords'),
    back: document.getElementById('btn-back-home'),
    status: document.getElementById('import-status'),
  },
};

function showView(name) {
  for (const [k, v] of Object.entries(els.views)) {
    v.classList.toggle('hidden', k !== name);
  }
}

function setStatus(text, ok = true) {
  els.statusLine.textContent = text;
  els.statusLine.style.color = ok ? '' : 'var(--iv-danger)';
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!state?.signedIn) {
    setStatus('Not connected', false);
    showView('signin');
    return;
  }
  setStatus(`Signed in as ${state.email}`);
  els.home.vaultInfo.textContent = state.vault
    ? `${state.vault.entryCount} credentials · synced ${formatRelative(state.vault.syncedAt)}`
    : 'Vault not yet loaded';
  showView('home');
}

function formatRelative(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

els.signin.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.signin.error.hidden = true;
  els.signin.submit.disabled = true;
  els.signin.submit.textContent = 'Connecting…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'SIGN_IN',
      email: els.signin.email.value.trim(),
      password: els.signin.password.value,
      masterPassword: els.signin.master.value,
    });
    if (!res?.ok) throw new Error(res?.error || 'Sign-in failed');
    await refresh();
  } catch (err) {
    els.signin.error.textContent = err.message;
    els.signin.error.hidden = false;
  } finally {
    els.signin.submit.disabled = false;
    els.signin.submit.textContent = 'Connect vault';
  }
});

els.home.signout.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
  await refresh();
});

els.home.resync.addEventListener('click', async () => {
  els.home.vaultInfo.textContent = 'Syncing…';
  await chrome.runtime.sendMessage({ type: 'RESYNC' });
  await refresh();
});

els.home.openVault.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.ironvault.app/passwords' });
});

els.home.fillHere.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, { type: 'IRONVAULT_OPEN_PICKER' }).catch(() => {});
  window.close();
});

els.home.importBtn.addEventListener('click', () => showView('import'));
els.importView.back.addEventListener('click', () => showView('home'));
els.importView.open.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://settings/passwords' });
  els.importView.status.textContent =
    'Watching your downloads folder… we\'ll notify you when the CSV arrives.';
  chrome.runtime.sendMessage({ type: 'WATCH_DOWNLOADS' });
});

refresh();
