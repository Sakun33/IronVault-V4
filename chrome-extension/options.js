// IronVault options page — autofill settings + never-save management.

const $ = (id) => document.getElementById(id);

const ui = {
  login: $('opt-login'),
  card: $('opt-card'),
  identity: $('opt-identity'),
  badge: $('opt-badge'),
  save: $('opt-save'),
  shortcut: $('iv-opt-shortcut'),
  changeShortcut: $('iv-opt-change-shortcut'),
  neverList: $('iv-opt-neversave'),
  neverEmpty: $('iv-opt-neversave-empty'),
  status: $('iv-opt-status'),
};

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp || !resp.ok) return reject(new Error((resp && resp.error) || 'Request failed'));
      resolve(resp);
    });
  });
}

function setStatus(text) {
  ui.status.textContent = text || '';
  if (text) setTimeout(() => { if (ui.status.textContent === text) ui.status.textContent = ''; }, 1800);
}

async function loadShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find(c => c.name === 'open-autofill-picker');
    if (cmd && cmd.shortcut) {
      ui.shortcut.textContent = cmd.shortcut;
    } else {
      ui.shortcut.textContent = 'Not set';
    }
  } catch {
    ui.shortcut.textContent = 'Ctrl + Shift + L';
  }
}

function renderNeverList(list) {
  ui.neverList.innerHTML = '';
  if (!list || list.length === 0) {
    ui.neverEmpty.hidden = false;
    return;
  }
  ui.neverEmpty.hidden = true;
  for (const domain of list) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = domain;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await send({ type: 'REMOVE_NEVER_SAVE_DOMAIN', domain });
        renderNeverList(r.neverSaveDomains);
        setStatus(`Removed ${domain}`);
      } catch (err) {
        setStatus(err.message);
        btn.disabled = false;
      }
    });
    li.append(span, btn);
    ui.neverList.appendChild(li);
  }
}

async function loadAll() {
  try {
    const r = await send({ type: 'GET_AUTOFILL_SETTINGS' });
    ui.login.checked = !!r.settings.loginEnabled;
    ui.card.checked = !!r.settings.cardEnabled;
    ui.identity.checked = !!r.settings.identityEnabled;
    ui.badge.checked = !!r.settings.inlineBadgeEnabled;
    ui.save.checked = !!r.settings.savePromptEnabled;
    renderNeverList(r.neverSaveDomains);
  } catch (err) {
    setStatus(err.message);
  }
  loadShortcut();
}

async function patch(field, value) {
  try {
    await send({ type: 'SET_AUTOFILL_SETTINGS', patch: { [field]: value } });
    setStatus('Saved');
  } catch (err) {
    setStatus(err.message);
  }
}

ui.login.addEventListener('change',    () => patch('loginEnabled',         ui.login.checked));
ui.card.addEventListener('change',     () => patch('cardEnabled',          ui.card.checked));
ui.identity.addEventListener('change', () => patch('identityEnabled',      ui.identity.checked));
ui.badge.addEventListener('change',    () => patch('inlineBadgeEnabled',   ui.badge.checked));
ui.save.addEventListener('change',     () => patch('savePromptEnabled',    ui.save.checked));

ui.changeShortcut.addEventListener('click', () => {
  // chrome://extensions/shortcuts is the only surface where the user can edit
  // command shortcuts — there's no API to do it from inside the extension.
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

loadAll();
