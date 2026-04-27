/**
 * IronVault content script.
 *
 * Detects login forms, asks the background worker for matching credentials,
 * and shows a small floating "fill" badge next to the username/password
 * fields. On click, fills both fields and dispatches input events so React
 * apps notice.
 */

(() => {
  const STATE = {
    badge: null,
    activeField: null,
    matches: null,
    domain: location.hostname.replace(/^www\./, ''),
  };

  /** Heuristic: is this an element that could be a username/email input? */
  function looksLikeUsernameField(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.type || '').toLowerCase();
    if (!['text', 'email', 'tel', ''].includes(type)) return false;
    const hint = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase();
    return /user|email|login|account|phone|mobile/.test(hint);
  }

  function findUsernameFieldFor(passwordEl) {
    // Walk back through the DOM looking for the nearest preceding
    // text/email input within the same form.
    const form = passwordEl.form;
    const candidates = form
      ? Array.from(form.querySelectorAll('input'))
      : Array.from(document.querySelectorAll('input'));
    let last = null;
    for (const el of candidates) {
      if (el === passwordEl) break;
      if (looksLikeUsernameField(el)) last = el;
    }
    return last;
  }

  function getPasswordFields() {
    return Array.from(document.querySelectorAll('input[type="password"]'))
      .filter(el => el.offsetParent !== null);
  }

  async function fetchMatches() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_MATCHES', domain: STATE.domain });
      STATE.matches = res?.matches || [];
    } catch {
      STATE.matches = [];
    }
  }

  function ensureBadge() {
    if (STATE.badge) return STATE.badge;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.setAttribute('aria-label', 'Fill from IronVault');
    badge.className = 'ironvault-badge';
    badge.textContent = 'IV';
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker();
    });
    document.body.appendChild(badge);
    STATE.badge = badge;
    return badge;
  }

  function positionBadge(target) {
    const badge = ensureBadge();
    const rect = target.getBoundingClientRect();
    badge.style.top = `${window.scrollY + rect.top + (rect.height - 22) / 2}px`;
    badge.style.left = `${window.scrollX + rect.right - 26}px`;
    badge.style.display = STATE.matches?.length ? 'flex' : 'none';
  }

  function openPicker() {
    if (!STATE.matches?.length) return;
    closePicker();
    const picker = document.createElement('div');
    picker.className = 'ironvault-picker';
    const header = document.createElement('div');
    header.className = 'ironvault-picker-header';
    header.innerHTML = `<span class="ironvault-picker-title">IronVault</span><span class="ironvault-picker-host">${STATE.domain}</span>`;
    picker.appendChild(header);
    for (const m of STATE.matches) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ironvault-picker-row';
      row.innerHTML = `
        <div class="ironvault-picker-row-name">${escapeHtml(m.name || m.username || 'Untitled')}</div>
        <div class="ironvault-picker-row-user">${escapeHtml(m.username || '')}</div>
      `;
      row.addEventListener('click', () => {
        fillCredential(m.id);
        closePicker();
      });
      picker.appendChild(row);
    }
    const badge = ensureBadge();
    const r = badge.getBoundingClientRect();
    picker.style.top = `${window.scrollY + r.bottom + 6}px`;
    picker.style.left = `${window.scrollX + r.right - 240}px`;
    document.body.appendChild(picker);
    STATE.picker = picker;
    setTimeout(() => document.addEventListener('click', dismissOnOutside, { once: true }), 0);
  }

  function dismissOnOutside(e) {
    if (STATE.picker && !STATE.picker.contains(e.target) && e.target !== STATE.badge) {
      closePicker();
    } else {
      setTimeout(() => document.addEventListener('click', dismissOnOutside, { once: true }), 0);
    }
  }

  function closePicker() {
    if (STATE.picker) {
      STATE.picker.remove();
      STATE.picker = null;
    }
  }

  async function fillCredential(id) {
    const res = await chrome.runtime.sendMessage({ type: 'GET_CREDENTIAL', id });
    if (!res?.ok) return;
    const passwordEl = STATE.activeField;
    if (!passwordEl) return;
    const userEl = findUsernameFieldFor(passwordEl);
    if (userEl) setReactNativeValue(userEl, res.username);
    setReactNativeValue(passwordEl, res.password);
  }

  /**
   * Setting `.value` directly on a React-managed input does not trigger
   * React's onChange handlers because React tracks the previous value
   * internally. We use the native value setter to bypass React's tracking.
   */
  function setReactNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ── Wiring ────────────────────────────────────────────────────────────────

  function onFocus(e) {
    if (e.target instanceof HTMLInputElement && e.target.type === 'password') {
      STATE.activeField = e.target;
      positionBadge(e.target);
    }
  }

  function rescan() {
    const fields = getPasswordFields();
    if (!fields.length) {
      if (STATE.badge) STATE.badge.style.display = 'none';
      return;
    }
    if (STATE.activeField && document.contains(STATE.activeField)) {
      positionBadge(STATE.activeField);
    } else {
      STATE.activeField = fields[0];
      positionBadge(fields[0]);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'IRONVAULT_OPEN_PICKER') openPicker();
  });

  document.addEventListener('focusin', onFocus, true);
  window.addEventListener('resize', rescan);
  window.addEventListener('scroll', rescan, true);

  const observer = new MutationObserver(() => rescan());
  observer.observe(document.documentElement, { subtree: true, childList: true });

  // Kick things off
  fetchMatches().then(rescan);
})();
