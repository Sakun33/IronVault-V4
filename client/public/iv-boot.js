/*
 * CSP-001 (audit): All previously-inline boot scripts collapsed into a single
 * external file so the main-app CSP can drop `'unsafe-inline'` from
 * `script-src`. JSON-LD blocks (type="application/ld+json") are data, not
 * scripts, and remain inline — modern browsers do not gate them via
 * script-src.
 *
 * Order matters: GA must run before the SDK loads, but the SDK script tag is
 * `async` so the queueing pattern below is fine.
 */
(function () {
  // ── Google Analytics 4 init queue ──────────────────────────────────────────
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-5H25535Q8W');

  // ── Service-worker cache nuke ──────────────────────────────────────────────
  // Removes any ironvault cache not matching the current major version. Runs
  // before the app boots so a stale SW asset doesn't get reused.
  if ('serviceWorker' in navigator) {
    caches.keys().then(function (names) {
      names.filter(function (n) { return n.indexOf('v3.1') === -1; })
        .forEach(function (n) { caches.delete(n); });
    }).catch(function () { /* noop */ });
  }

  // ── Fonts: flip the print-media stylesheet to all-media after load ─────────
  // Previously expressed as `onload="this.media='all'"` on the <link>, which
  // CSP without `unsafe-hashes` cannot allow. Wiring it from JS keeps the
  // same behaviour without the inline event handler.
  document.querySelectorAll('link[data-async-font]').forEach(function (link) {
    link.addEventListener('load', function () { link.media = 'all'; });
  });

  // ── tawk.to live-chat init ────────────────────────────────────────────────
  // Loads the external chat widget script and hides the bubble by default —
  // the in-app Help button calls Tawk_API.maximize() to open it directly.
  var Tawk_API = window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  Tawk_API.onLoad = function () {
    try { if (typeof Tawk_API.hideWidget === 'function') Tawk_API.hideWidget(); } catch (e) { /* noop */ }
  };
  Tawk_API.onChatMinimized = function () {
    try { if (typeof Tawk_API.hideWidget === 'function') Tawk_API.hideWidget(); } catch (e) { /* noop */ }
  };
  var s1 = document.createElement('script');
  var s0 = document.getElementsByTagName('script')[0];
  s1.async = true;
  s1.src = 'https://embed.tawk.to/6a184abf549ee11c36b0d928/1jpne7vlu';
  s1.charset = 'UTF-8';
  s1.setAttribute('crossorigin', '*');
  if (s0 && s0.parentNode) s0.parentNode.insertBefore(s1, s0);
})();
