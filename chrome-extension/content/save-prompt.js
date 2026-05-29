// IronVault save-credential prompt.
//
// Watches detected login/signup forms for submission, snapshots the user's
// inputs *before* the page navigates, then shows a top banner offering to
// save the credential to the vault.
//
// We snapshot on three signals (any of them is enough — they're cheap):
//   1. Native form 'submit' event.
//   2. A button[type=submit] inside the form being clicked.
//   3. Enter key pressed inside the form.
//
// The prompt is shown after a short delay so the user has a chance to see it
// even if the page navigates immediately. If the page DOES navigate away,
// the prompt re-injects on the next page load because the captured snapshot
// lives in chrome.storage.session (keyed by domain+username).

(() => {
  if (window.IronVaultAutofill && window.IronVaultAutofill.savePrompt) return;
  const ns = (window.IronVaultAutofill = window.IronVaultAutofill || {});
  const RUNTIME = chrome.runtime;
  if (!RUNTIME || !RUNTIME.sendMessage) return;

  const BAR_CLASS = 'iv-af-savebar';
  const PENDING_KEY = 'iv-pending-save';
  const PENDING_TTL_MS = 60_000; // pending snapshot expires after 60s

  let watchedForms = new WeakSet();
  let lastSnapshot = null;
  let promptShownForKey = null;

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

  function pageDomain() {
    try {
      return (location.hostname || '').replace(/^www\./, '').toLowerCase();
    } catch { return ''; }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────
  function snapshotDetection(detection) {
    if (!detection) return null;
    if (detection.type !== 'login' && detection.type !== 'signup') return null;
    const username = detection.fields.username?.value || '';
    const password = detection.fields.password?.value || '';
    const confirm = detection.fields.confirmPassword?.value || '';
    if (!password) return null;
    // Skip if confirm doesn't match (user is mid-typing).
    if (detection.type === 'signup' && confirm && confirm !== password) return null;
    return {
      type: detection.type,
      domain: pageDomain(),
      url: location.href,
      pageTitle: (document.title || '').slice(0, 120),
      username,
      password,
      capturedAt: Date.now(),
    };
  }

  function setLastSnapshot(snap) {
    if (!snap) return;
    lastSnapshot = snap;
    // Persist so a navigation away+back can still complete the offer.
    try {
      chrome.storage.session?.set?.({ [PENDING_KEY]: snap });
    } catch {}
  }

  async function restorePending() {
    try {
      const got = await chrome.storage.session?.get?.(PENDING_KEY);
      const snap = got?.[PENDING_KEY];
      if (!snap) return null;
      if (Date.now() - (snap.capturedAt || 0) > PENDING_TTL_MS) {
        chrome.storage.session?.remove?.(PENDING_KEY);
        return null;
      }
      // Only re-offer if domain still matches — credentials don't leak across origins.
      if (snap.domain !== pageDomain()) return null;
      return snap;
    } catch {
      return null;
    }
  }

  function clearPending() {
    try { chrome.storage.session?.remove?.(PENDING_KEY); } catch {}
  }

  // ── Form watch ────────────────────────────────────────────────────────────
  function watchDetection(detection) {
    if (!detection) return;
    if (detection.type !== 'login' && detection.type !== 'signup') return;

    const form = detection.groupEl?.tagName === 'FORM' ? detection.groupEl : null;
    const root = form || detection.groupEl || document;
    if (watchedForms.has(root)) {
      // Update the snapshot pipeline with the current detection.
      root.__ivDetection = detection;
      return;
    }
    watchedForms.add(root);
    root.__ivDetection = detection;

    const captureNow = () => {
      const det = root.__ivDetection;
      const snap = snapshotDetection(det);
      if (snap) setLastSnapshot(snap);
    };

    if (form) {
      form.addEventListener('submit', captureNow, true);
    }
    root.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') captureNow();
    }, true);
    root.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!t) return;
      const submitLike = t.closest('button[type="submit"], input[type="submit"], [role="button"]');
      if (!submitLike) return;
      const txt = ((submitLike.textContent || submitLike.value || '') + ' ' +
                   (submitLike.getAttribute('aria-label') || '')).toLowerCase();
      if (/(sign[\s_-]*in|log[\s_-]*in|sign[\s_-]*up|register|continue|next|create[\s_-]*account|submit)/.test(txt)) {
        captureNow();
      }
    }, true);
  }

  // ── Prompt UI ─────────────────────────────────────────────────────────────
  function isOnIronVault() {
    const h = pageDomain();
    return h === 'ironvault.app' || h.endsWith('.ironvault.app');
  }

  async function maybeShowPrompt() {
    if (isOnIronVault()) return;
    if (document.querySelector('.' + BAR_CLASS)) return;
    const snap = lastSnapshot || await restorePending();
    if (!snap) return;
    if (!snap.password) return;

    // Don't offer to save if domain is on never-save list, or vault already
    // has this credential. Ask background.
    const check = await send({
      type: 'CHECK_SAVE_CANDIDATE',
      domain: snap.domain,
      username: snap.username,
    });
    if (!check || !check.ok) return;
    if (check.suppressed) return;            // never-save or vault locked
    if (check.alreadyExistsExact) return;    // identical credential already saved
    const key = `${snap.domain}::${snap.username}::${snap.password.length}`;
    if (promptShownForKey === key) return;
    promptShownForKey = key;

    showBar(snap, check.alreadyExistsForUser ? 'update' : 'save');
  }

  function showBar(snap, mode) {
    const bar = document.createElement('div');
    bar.className = BAR_CLASS;
    bar.innerHTML = `
      <div class="iv-af-savebar-inner">
        <span class="iv-af-savebar-icon">${lockIcon()}</span>
        <div class="iv-af-savebar-text">
          <strong class="iv-af-savebar-title">${mode === 'update' ? 'Update password in IronVault?' : 'Save this password to IronVault?'}</strong>
          <span class="iv-af-savebar-sub"></span>
        </div>
        <div class="iv-af-savebar-actions">
          <button type="button" class="iv-af-savebar-btn iv-af-savebar-never">Never for this site</button>
          <button type="button" class="iv-af-savebar-btn iv-af-savebar-dismiss">Not now</button>
          <button type="button" class="iv-af-savebar-btn iv-af-savebar-primary">${mode === 'update' ? 'Update' : 'Save'}</button>
        </div>
      </div>
    `;
    const sub = bar.querySelector('.iv-af-savebar-sub');
    sub.textContent = `${snap.domain}${snap.username ? ' · ' + snap.username : ''}`;
    document.body.appendChild(bar);

    const close = () => {
      bar.classList.add('is-leaving');
      setTimeout(() => bar.remove(), 200);
    };

    bar.querySelector('.iv-af-savebar-dismiss').addEventListener('click', () => {
      clearPending();
      close();
    });

    bar.querySelector('.iv-af-savebar-never').addEventListener('click', async () => {
      await send({ type: 'BLOCK_SAVE_FOR_DOMAIN', domain: snap.domain });
      clearPending();
      close();
    });

    bar.querySelector('.iv-af-savebar-primary').addEventListener('click', async () => {
      const primary = bar.querySelector('.iv-af-savebar-primary');
      primary.disabled = true;
      primary.textContent = 'Saving…';
      const res = await send({
        type: 'SAVE_NEW_CREDENTIAL',
        credential: {
          name: snap.pageTitle || snap.domain,
          url: snap.url,
          username: snap.username,
          password: snap.password,
          domain: snap.domain,
        },
        mode,
      });
      if (!res || !res.ok) {
        primary.textContent = mode === 'update' ? 'Update' : 'Save';
        primary.disabled = false;
        sub.textContent = '⚠ ' + (res?.error || 'Save failed');
        return;
      }
      primary.textContent = '✓ Saved';
      clearPending();
      setTimeout(close, 1500);
    });

    // Auto-dismiss after 25s if user ignores.
    setTimeout(() => {
      if (document.body.contains(bar)) close();
    }, 25_000);
  }

  function lockIcon() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
  }

  // ── Public surface ────────────────────────────────────────────────────────
  ns.savePrompt = {
    watchDetection,
    maybeShowPrompt,
  };
})();
