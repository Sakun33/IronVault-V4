// IronVault content-script orchestrator.
//
// Order of operations (the previous JS files have all populated
// window.IronVaultAutofill.* before this runs because manifest.content_scripts
// loads them in array order, in the same isolated world):
//   1. Skip injection on the IronVault web app itself.
//   2. Periodically (on idle + on DOM mutation) call detector.detectForms()
//      and attach a badge per detection via ui.attach().
//   3. Wire save-prompt watching for every detection so submit captures fire.
//   4. Listen for runtime messages from popup / background:
//        IV_FILL_FROM_POPUP  — popup picked a credential; fill it here.
//        IV_OPEN_PICKER      — keyboard-shortcut entry, open picker on focus.
//        IV_VAULT_LOCKED     — refresh UI (badge tooltips, close pickers).
//   5. Show the save-credential prompt if a submit snapshot is pending.

(() => {
  if (window.__ironvaultAutofillMain) return;
  window.__ironvaultAutofillMain = true;

  // Don't run inside the IronVault web app — its own UI handles credentials.
  const host = (location.hostname || '').toLowerCase();
  if (host === 'ironvault.app' || host.endsWith('.ironvault.app')) return;

  // chrome.* may not exist on about:blank frames etc.
  if (!chrome.runtime || !chrome.runtime.sendMessage) return;

  const ns = window.IronVaultAutofill || {};
  if (!ns.detector || !ns.ui || !ns.filler) {
    console.warn('[IronVault] autofill modules missing — aborting.');
    return;
  }

  function rescan() {
    let detections;
    try { detections = ns.detector.detectForms(); }
    catch (err) { console.warn('[IronVault] detector failed:', err); return; }

    for (const det of detections) {
      try { ns.ui.attach(det); } catch (err) { console.warn('[IronVault] ui.attach failed:', err); }
      if (ns.savePrompt) ns.savePrompt.watchDetection(det);
    }
    // Reposition badges in case layout shifted.
    ns.ui.repositionAll();
  }

  // Debounced rescan on mutation — fires at most once per animation frame.
  let scanScheduled = false;
  const obs = new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => { scanScheduled = false; rescan(); });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // ── Runtime messages ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return false;

    if (msg.type === 'IV_OPEN_PICKER') {
      const ok = ns.ui.openForActiveElement();
      sendResponse?.({ ok });
      return false;
    }

    if (msg.type === 'IV_VAULT_LOCKED') {
      ns.ui.closePicker();
      sendResponse?.({ ok: true });
      return false;
    }

    if (msg.type === 'IV_FILL_FROM_POPUP' && msg.credential) {
      // Hard origin check — match the saved credential's domain against the
      // current page. Refuse the fill if the tab navigated post-pick.
      try {
        let entryDomain = (msg.credential.domain || '').toLowerCase();
        if (!entryDomain && msg.credential.url) {
          try {
            const u = new URL(msg.credential.url.includes('://') ? msg.credential.url : `https://${msg.credential.url}`);
            entryDomain = u.hostname.replace(/^www\./, '').toLowerCase();
          } catch { entryDomain = ''; }
        }
        const pageHost = (location.hostname || '').replace(/^www\./, '').toLowerCase();
        const matches = !!entryDomain && (pageHost === entryDomain || pageHost.endsWith('.' + entryDomain));
        if (!matches) {
          sendResponse?.({ ok: false, error: 'Refusing to fill — tab origin no longer matches the saved credential.' });
          return false;
        }
        const detections = ns.detector.detectForms()
          .filter(d => d.type === 'login' || d.type === 'signup');
        const target = detections[0];
        if (!target) {
          sendResponse?.({ ok: false, error: 'No login form on this page.' });
          return false;
        }
        ns.filler.fillLogin(target, msg.credential);
        sendResponse?.({ ok: true });
      } catch (err) {
        sendResponse?.({ ok: false, error: err?.message || 'Fill failed.' });
      }
      return false;
    }

    return false;
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  rescan();
  if (ns.savePrompt) {
    // Give the page a beat to settle, then offer to save anything captured by
    // a prior page load (e.g. the snapshot survived a redirect).
    setTimeout(() => ns.savePrompt.maybeShowPrompt(), 800);
  }
  // Belt and braces: a second rescan after document fully settles.
  setTimeout(rescan, 1500);
})();
