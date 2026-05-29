// IronVault inline autofill UI.
//
// For every detected form we attach a badge to the anchor input. Clicking the
// badge opens a picker showing matching vault entries; selecting one fills
// the form. The picker shape differs per form type (login / card / identity)
// but the structural css / positioning code is shared.
//
// Public surface (window.IronVaultAutofill.ui):
//   attach(detection)         — attach a badge for a given form detection
//   detachAll()               — remove every badge + picker
//   repositionAll()           — used on scroll/resize
//   openForActiveElement()    — keyboard-shortcut entry point
//   showError(msg)            — toast a transient error in the picker area

(() => {
  if (window.IronVaultAutofill && window.IronVaultAutofill.ui) return;
  const ns = (window.IronVaultAutofill = window.IronVaultAutofill || {});
  const RUNTIME = chrome.runtime;
  if (!RUNTIME || !RUNTIME.sendMessage) return;

  const BADGE_CLASS = 'iv-af-badge';
  const PICKER_CLASS = 'iv-af-picker';
  const BADGE_SIZE = 26;
  const BADGE_INSET = 6;

  const badgesByAnchor = new WeakMap();
  const detectionsByBadge = new WeakMap();
  let activePicker = null;

  // ── Bridge helper ─────────────────────────────────────────────────────────
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

  // ── Icon helpers ──────────────────────────────────────────────────────────
  function svgLock() {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
  }
  function svgCard() {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>`;
  }
  function svgPerson() {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;
  }
  function iconForType(type) {
    if (type === 'card') return svgCard();
    if (type === 'identity') return svgPerson();
    return svgLock();
  }

  function maskCardPreview(num) {
    const digits = String(num || '').replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    return '•••• ' + digits.slice(-4);
  }

  function brandLabel(brand) {
    const b = String(brand || '').toLowerCase();
    if (b === 'visa') return 'Visa';
    if (b === 'mastercard') return 'Mastercard';
    if (b === 'amex') return 'Amex';
    if (b === 'discover') return 'Discover';
    if (b === 'rupay') return 'RuPay';
    if (b === 'diners') return 'Diners';
    if (b === 'jcb') return 'JCB';
    if (b === 'unionpay') return 'UnionPay';
    return 'Card';
  }

  // ── Positioning ───────────────────────────────────────────────────────────
  function repositionBadge(anchor, badge) {
    if (!anchor || !anchor.isConnected) { badge.style.display = 'none'; return; }
    const r = anchor.getBoundingClientRect();
    if (r.width < 12 || r.height < 6) { badge.style.display = 'none'; return; }
    badge.style.display = 'flex';
    const top = window.scrollY + r.top + (r.height - BADGE_SIZE) / 2;
    const left = window.scrollX + r.right - BADGE_SIZE - BADGE_INSET;
    badge.style.top = top + 'px';
    badge.style.left = left + 'px';
  }

  function repositionAll() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach((badge) => {
      const detection = detectionsByBadge.get(badge);
      if (detection && detection.anchor) repositionBadge(detection.anchor, badge);
    });
    if (activePicker && activePicker.badge) {
      positionPicker(activePicker.el, activePicker.badge);
    }
  }

  function positionPicker(picker, anchorBadge) {
    const rect = anchorBadge.getBoundingClientRect();
    let top = window.scrollY + rect.bottom + 6;
    const left = window.scrollX + Math.max(0, rect.right - 320);
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    picker.style.width = '300px';
    // If the picker would clip below viewport, flip above the badge.
    requestAnimationFrame(() => {
      const pr = picker.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - 10) {
        const newTop = window.scrollY + rect.top - pr.height - 6;
        if (newTop > window.scrollY + 4) picker.style.top = newTop + 'px';
      }
    });
  }

  // ── Badge attach ──────────────────────────────────────────────────────────
  function attach(detection) {
    if (!detection || !detection.anchor) return;
    const existing = badgesByAnchor.get(detection.anchor);
    if (existing) {
      // Update detection in case fields shifted
      detectionsByBadge.set(existing, detection);
      repositionBadge(detection.anchor, existing);
      return;
    }

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = BADGE_CLASS + ' iv-af-type-' + detection.type;
    badge.tabIndex = -1;
    badge.setAttribute('aria-label', `IronVault — fill ${detection.type}`);
    badge.title = 'IronVault autofill';
    badge.innerHTML = `<span class="iv-af-badge-icon">${iconForType(detection.type)}</span>`;

    badge.addEventListener('mousedown', (ev) => { ev.preventDefault(); });
    badge.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openPicker(detection, badge);
    });

    // Reserve space on the anchor input so the badge doesn't overlap typing.
    try {
      const cs = getComputedStyle(detection.anchor);
      const existingPad = parseFloat(cs.paddingRight) || 0;
      const reserved = BADGE_SIZE + Math.max(BADGE_INSET, 0) + 4;
      if (existingPad < reserved && detection.anchor.style) {
        detection.anchor.dataset.ivPrevPaddingRight =
          detection.anchor.style.paddingRight || '';
        detection.anchor.style.setProperty('padding-right', reserved + 'px', 'important');
      }
    } catch {}

    document.body.appendChild(badge);
    badgesByAnchor.set(detection.anchor, badge);
    detectionsByBadge.set(badge, detection);
    repositionBadge(detection.anchor, badge);
  }

  function detachAll() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach((b) => b.remove());
    closePicker();
  }

  // ── Picker ────────────────────────────────────────────────────────────────
  function closePicker() {
    document.querySelectorAll('.' + PICKER_CLASS).forEach((p) => p.remove());
    activePicker = null;
  }

  async function openPicker(detection, badge) {
    closePicker();

    const picker = document.createElement('div');
    picker.className = PICKER_CLASS + ' iv-af-type-' + detection.type;
    picker.setAttribute('role', 'menu');
    picker.innerHTML = `
      <div class="iv-af-picker-head">
        <span class="iv-af-picker-icon">${iconForType(detection.type)}</span>
        <span class="iv-af-picker-title">${pickerTitle(detection.type)}</span>
      </div>
      <div class="iv-af-picker-body">
        <div class="iv-af-msg">Looking up matches…</div>
      </div>
    `;
    document.body.appendChild(picker);
    activePicker = { el: picker, badge, detection };
    positionPicker(picker, badge);

    const body = picker.querySelector('.iv-af-picker-body');

    let result;
    if (detection.type === 'login' || detection.type === 'signup') {
      result = await send({ type: 'GET_DOMAIN_MATCHES' });
    } else if (detection.type === 'card') {
      result = await send({ type: 'GET_CARD_MATCHES' });
    } else if (detection.type === 'identity') {
      result = await send({ type: 'GET_IDENTITY_MATCHES' });
    }
    if (!result) { showMsg(body, 'Could not reach IronVault.', true); return; }
    if (!result.ok) { showMsg(body, result.error || 'Could not reach IronVault.', true); return; }

    if (result.unlocked === false) {
      body.innerHTML = '';
      const locked = document.createElement('div');
      locked.className = 'iv-af-msg';
      locked.innerHTML = '🔒 IronVault is locked.';
      body.appendChild(locked);
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'iv-af-cta';
      openBtn.textContent = 'Unlock';
      openBtn.addEventListener('click', () => {
        // Service worker can't open the popup; the user has to click the
        // toolbar action themselves. We just inform.
        showMsg(body, 'Click the IronVault icon in the toolbar to unlock.', false);
      });
      body.appendChild(openBtn);
      return;
    }

    const list = detection.type === 'card' ? (result.cards || [])
      : detection.type === 'identity' ? (result.identities || [])
      : (result.matches || []);

    body.innerHTML = '';
    if (list.length === 0) {
      showMsg(body, emptyMsg(detection.type), false);
      // For login/signup, surface a "Save once you sign in" affordance.
      if (detection.type === 'signup' || detection.type === 'login') {
        const hint = document.createElement('div');
        hint.className = 'iv-af-hint';
        hint.textContent = 'IronVault will offer to save after you sign up here.';
        body.appendChild(hint);
      }
      return;
    }

    for (const item of list) {
      body.appendChild(renderRow(detection, item));
    }
  }

  function pickerTitle(type) {
    if (type === 'card') return 'Credit cards';
    if (type === 'identity') return 'Identities';
    if (type === 'signup') return 'Use a saved login';
    return 'Saved logins';
  }
  function emptyMsg(type) {
    if (type === 'card') return 'No cards saved.';
    if (type === 'identity') return 'No identities saved.';
    return 'No saved logins for this site.';
  }

  function showMsg(body, text, err) {
    body.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'iv-af-msg' + (err ? ' iv-af-err' : '');
    div.textContent = text;
    body.appendChild(div);
  }

  // ── Row rendering per type ────────────────────────────────────────────────
  function renderRow(detection, item) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'iv-af-row';
    const name = document.createElement('div');
    name.className = 'iv-af-name';
    const sub = document.createElement('div');
    sub.className = 'iv-af-sub';

    if (detection.type === 'card') {
      name.textContent = item.cardName || brandLabel(item.brand);
      sub.textContent = `${brandLabel(item.brand)} • ${maskCardPreview(item.lastFour ? '' + item.lastFour : '')}`;
    } else if (detection.type === 'identity') {
      name.textContent = item.title || 'Identity';
      const subParts = [];
      if (item.fullName) subParts.push(item.fullName);
      if (item.email) subParts.push(item.email);
      sub.textContent = subParts.join(' • ') || (item.city || '');
    } else {
      name.textContent = item.name || '(untitled)';
      sub.textContent = item.username || '—';
    }
    row.append(name, sub);

    row.addEventListener('click', async () => {
      row.classList.add('is-filling');
      sub.textContent = 'Filling…';
      const filled = await fillFromVault(detection, item);
      if (filled.ok) {
        closePicker();
      } else {
        row.classList.remove('is-filling');
        sub.textContent = '⚠ ' + (filled.error || 'Fill failed');
      }
    });
    return row;
  }

  async function fillFromVault(detection, item) {
    const filler = (window.IronVaultAutofill && window.IronVaultAutofill.filler);
    if (!filler) return { ok: false, error: 'Filler not loaded' };
    try {
      if (detection.type === 'login' || detection.type === 'signup') {
        const resp = await send({ type: 'GET_PASSWORD_FOR_FILL', id: item.id });
        if (!resp.ok) return { ok: false, error: resp.error };
        const cred = resp.credential;
        filler.fillLogin(detection, cred);
        cred.password = '';
        return { ok: true };
      }
      if (detection.type === 'card') {
        const resp = await send({ type: 'GET_CARD_FOR_FILL', id: item.id });
        if (!resp.ok) return { ok: false, error: resp.error };
        const card = resp.card;
        filler.fillCard(detection, card);
        if (card.cvv) card.cvv = '';
        if (card.cardNumber) card.cardNumber = '';
        return { ok: true };
      }
      if (detection.type === 'identity') {
        const resp = await send({ type: 'GET_IDENTITY_FOR_FILL', id: item.id });
        if (!resp.ok) return { ok: false, error: resp.error };
        filler.fillIdentity(detection, resp.identity);
        return { ok: true };
      }
      return { ok: false, error: 'Unsupported form type' };
    } catch (err) {
      return { ok: false, error: err?.message || 'Fill failed' };
    }
  }

  // ── Keyboard shortcut entry point ─────────────────────────────────────────
  function findDetectionFor(target) {
    if (!target) return null;
    // Walk known badges/anchors to find the detection whose group contains
    // the focused element, OR whose anchor IS the focused element.
    let best = null;
    document.querySelectorAll('.' + BADGE_CLASS).forEach((b) => {
      const det = detectionsByBadge.get(b);
      if (!det) return;
      if (det.anchor === target) { best = det; return; }
      if (det.groupEl && det.groupEl.contains && det.groupEl.contains(target)) {
        if (!best) best = det;
      }
    });
    return best;
  }

  function openForActiveElement() {
    const focused = document.activeElement;
    let det = findDetectionFor(focused);
    if (!det) {
      // Fall back to the first detection on the page so the shortcut always
      // does *something* useful.
      const firstBadge = document.querySelector('.' + BADGE_CLASS);
      if (firstBadge) det = detectionsByBadge.get(firstBadge);
    }
    if (!det) return false;
    const badge = badgesByAnchor.get(det.anchor);
    if (!badge) return false;
    openPicker(det, badge);
    return true;
  }

  // ── Global handlers ───────────────────────────────────────────────────────
  document.addEventListener('click', (ev) => {
    if (!activePicker) return;
    if (ev.target.closest('.' + PICKER_CLASS)) return;
    if (ev.target.classList && ev.target.classList.contains(BADGE_CLASS)) return;
    if (ev.target.closest('.' + BADGE_CLASS)) return;
    closePicker();
  }, true);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && activePicker) {
      closePicker();
    }
  });

  window.addEventListener('scroll', repositionAll, { passive: true });
  window.addEventListener('resize', repositionAll, { passive: true });

  ns.ui = { attach, detachAll, repositionAll, openForActiveElement, closePicker };
})();
