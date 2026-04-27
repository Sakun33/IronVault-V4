// IronVault content script — runs on every http(s) page (no host permissions).
//
// Responsibilities:
//   1. Find login forms (visible password inputs).
//   2. Show a small IronVault badge anchored to each one.
//   3. On click: ask the background for credential metadata matching this
//      page's origin (background uses sender.tab.url, not our claim).
//   4. User picks an entry → background returns the single decrypted password.
//   5. Fill the username/password fields, dispatch native events, then drop
//      the plaintext from this scope.
//
// We never receive the full vault — only the one credential the user picks.

(() => {
  const BADGE_CLASS = 'iv-autofill-badge';
  const PICKER_CLASS = 'iv-autofill-picker';
  const RUNTIME = chrome.runtime;
  if (!RUNTIME || !RUNTIME.sendMessage) return;

  // Avoid double-injection if the content script is somehow loaded twice.
  if (window.__ironvaultInjected) return;
  window.__ironvaultInjected = true;

  const trackedInputs = new WeakSet();
  const badgesByInput = new WeakMap();

  function send(msg) {
    return new Promise((resolve) => {
      try {
        RUNTIME.sendMessage(msg, (resp) => {
          if (RUNTIME.lastError) return resolve({ ok: false, error: RUNTIME.lastError.message });
          resolve(resp || { ok: false, error: 'No response' });
        });
      } catch {
        resolve({ ok: false, error: 'Extension unavailable' });
      }
    });
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 10) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    return true;
  }

  function findUsernameInputFor(passwordInput) {
    const form = passwordInput.form;
    const candidates = form
      ? Array.from(form.querySelectorAll('input'))
      : Array.from(document.querySelectorAll('input'));
    // Prefer inputs that come BEFORE the password in the DOM.
    const beforePw = [];
    let seenPw = false;
    for (const el of candidates) {
      if (el === passwordInput) { seenPw = true; continue; }
      if (seenPw) continue;
      const t = (el.type || '').toLowerCase();
      if (t === 'email' || t === 'text' || t === 'tel' || t === '' ) {
        if (isVisible(el)) beforePw.push(el);
      }
    }
    if (beforePw.length > 0) return beforePw[beforePw.length - 1];
    // Fallback: any visible text/email input
    for (const el of candidates) {
      const t = (el.type || '').toLowerCase();
      if ((t === 'email' || t === 'text') && isVisible(el)) return el;
    }
    return null;
  }

  function fillNatively(input, value) {
    // React/Vue intercept setters on the element prototype — use the native
    // descriptor so dispatched events trigger framework state updates.
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function removePicker() {
    document.querySelectorAll('.' + PICKER_CLASS).forEach((el) => el.remove());
  }

  function positionPicker(picker, anchor) {
    const rect = anchor.getBoundingClientRect();
    const top = window.scrollY + rect.bottom + 4;
    const left = window.scrollX + rect.left;
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    picker.style.minWidth = Math.max(220, rect.width) + 'px';
  }

  async function openPicker(passwordInput, anchorEl) {
    removePicker();

    const picker = document.createElement('div');
    picker.className = PICKER_CLASS;
    picker.setAttribute('role', 'menu');

    // Initial loading state
    const loading = document.createElement('div');
    loading.className = 'iv-autofill-msg';
    loading.textContent = 'Looking up matches…';
    picker.appendChild(loading);

    document.body.appendChild(picker);
    positionPicker(picker, anchorEl);

    const result = await send({ type: 'GET_DOMAIN_MATCHES' });
    picker.innerHTML = '';

    if (!result.ok) {
      const err = document.createElement('div');
      err.className = 'iv-autofill-msg iv-autofill-err';
      err.textContent = result.error || 'Could not reach IronVault.';
      picker.appendChild(err);
      return;
    }

    if (!result.unlocked) {
      const locked = document.createElement('div');
      locked.className = 'iv-autofill-msg';
      locked.innerHTML = '🔒 IronVault is locked. Open the extension to unlock.';
      picker.appendChild(locked);
      return;
    }

    const matches = result.matches || [];
    if (matches.length === 0) {
      const none = document.createElement('div');
      none.className = 'iv-autofill-msg';
      none.textContent = 'No saved logins for this site.';
      picker.appendChild(none);
      return;
    }

    for (const m of matches) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'iv-autofill-row';
      row.innerHTML =
        `<div class="iv-autofill-name"></div>` +
        `<div class="iv-autofill-user"></div>`;
      row.querySelector('.iv-autofill-name').textContent = m.name || '(untitled)';
      row.querySelector('.iv-autofill-user').textContent = m.username || '—';
      row.addEventListener('click', async () => {
        row.textContent = 'Filling…';
        const decrypted = await send({ type: 'GET_PASSWORD_FOR_FILL', id: m.id });
        if (!decrypted.ok) {
          row.textContent = '⚠ ' + (decrypted.error || 'Failed');
          return;
        }
        const cred = decrypted.credential;
        try {
          const userInput = findUsernameInputFor(passwordInput);
          if (userInput && cred.username) fillNatively(userInput, cred.username);
          fillNatively(passwordInput, cred.password);
        } finally {
          // Drop the plaintext password ASAP. The fillNatively call has
          // already pushed it into the input value, which the page can read,
          // but that's intentional — the user is logging in.
          cred.password = '';
        }
        removePicker();
      });
      picker.appendChild(row);
    }
  }

  // Badge dimensions — kept in sync with .iv-autofill-badge in content.css.
  const BADGE_SIZE = 28;
  // Distance from the input's right edge to the badge's right edge.
  // Negative pulls the badge inside the input (1Password-style); positive
  // pushes it outside.
  const BADGE_INSET = 6;

  function attachBadge(passwordInput) {
    if (trackedInputs.has(passwordInput)) return;
    trackedInputs.add(passwordInput);

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = BADGE_CLASS;
    badge.title = 'Fetch from IronVault';
    badge.setAttribute('aria-label', 'Fetch from IronVault');
    // Real IronVault app icon (vault/safe). Loaded via chrome.runtime.getURL
    // from web_accessible_resources so we don't bloat content.js with a
    // base64 blob and the icon stays a single source of truth.
    const iconUrl = RUNTIME.getURL('icons/icon-48.png');
    const iconImg = document.createElement('img');
    iconImg.src = iconUrl;
    iconImg.alt = '';
    iconImg.setAttribute('aria-hidden', 'true');
    iconImg.className = 'iv-autofill-badge-img';
    iconImg.draggable = false;
    badge.appendChild(iconImg);
    badge.tabIndex = -1; // don't grab tab focus from the form
    badge.addEventListener('mousedown', (ev) => {
      // Prevent the password input from losing focus on click.
      ev.preventDefault();
    });
    badge.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openPicker(passwordInput, badge);
    });
    // Reserve space on the input's right side so the badge never overlaps
    // text the user is typing. We stash the prior padding so we can restore
    // it if the badge is ever removed.
    const cs = getComputedStyle(passwordInput);
    const existingPad = parseFloat(cs.paddingRight) || 0;
    const reserved = BADGE_SIZE + Math.max(BADGE_INSET, 0) + 4;
    if (existingPad < reserved) {
      passwordInput.dataset.ivPrevPaddingRight = passwordInput.style.paddingRight || '';
      passwordInput.style.setProperty('padding-right', reserved + 'px', 'important');
    }
    document.body.appendChild(badge);
    badgesByInput.set(passwordInput, badge);
    repositionBadge(passwordInput, badge);
  }

  function repositionBadge(input, badge) {
    if (!input.isConnected || !isVisible(input)) {
      badge.style.display = 'none';
      return;
    }
    const r = input.getBoundingClientRect();
    badge.style.display = 'flex';
    // Vertically centered with the input.
    const top = window.scrollY + r.top + (r.height - BADGE_SIZE) / 2;
    // Right-anchored, just inside the input's right edge.
    const left = window.scrollX + r.right - BADGE_SIZE - BADGE_INSET;
    badge.style.top = top + 'px';
    badge.style.left = left + 'px';
  }

  function scan() {
    const pwInputs = Array.from(document.querySelectorAll('input[type="password"]'));
    for (const el of pwInputs) {
      if (!isVisible(el)) continue;
      attachBadge(el);
    }
    // Reposition existing badges
    for (const el of pwInputs) {
      const b = badgesByInput.get(el);
      if (b) repositionBadge(el, b);
    }
  }

  // Re-scan when DOM changes (SPAs, dynamically rendered forms).
  let scanScheduled = false;
  const observer = new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => { scanScheduled = false; scan(); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('scroll', () => {
    for (const input of document.querySelectorAll('input[type="password"]')) {
      const b = badgesByInput.get(input);
      if (b) repositionBadge(input, b);
    }
  }, { passive: true });

  window.addEventListener('resize', scan, { passive: true });

  // Close picker on outside click or escape
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.' + PICKER_CLASS) && !ev.target.classList.contains(BADGE_CLASS)) {
      removePicker();
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') removePicker();
  });

  scan();
})();
