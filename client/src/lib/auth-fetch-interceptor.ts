/**
 * Global fetch interceptor that watches for 401 responses on authenticated
 * requests and triggers a centralized re-login flow.
 *
 * QA-R2 H2 fix: previously, when the cloud JWT expired (30-day TTL), every
 * call site silently logged the failure to console and kept the user in the
 * UI with a broken session — pushes failed quietly, vault sync stopped, and
 * the user had no idea they needed to log in again.
 *
 * REGRESSION-3 rework: the original time-based grace-period (5s) was too
 * narrow. Users routinely spend 10–30s on the vault picker before unlocking,
 * and any background API call during that window would 401 → bounce them
 * back to /auth/login mid-unlock. Hardened with three guards:
 *
 *   1) NO TOKEN → no expiry signal. If iv_cloud_token isn't in localStorage,
 *      we don't have a cloud session at all, so a 401 is expected (anonymous
 *      probe, stale page, etc.) — never an "expired" event.
 *   2) 30-second grace window after the most recent auth transition (login
 *      OR vault unlock). Long enough to cover the slow path through the
 *      vault picker.
 *   3) 10-second dispatch debounce. Even if multiple 401s fire in a burst
 *      (e.g. polling + heartbeat racing), we only kick the user out once.
 */

const SKIP_PATHS = [
  '/api/auth/token',
  '/api/auth/2fa/validate',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/register',
];

let installed = false;

// Most recent successful auth transition: account login OR vault unlock.
// markLoginComplete() bumps this to Date.now(); the interceptor honours a
// 30-second grace window after the bump before treating 401s as expired.
let lastLoginTime = 0;
const LOGIN_GRACE_PERIOD_MS = 30000;

// Boot-time grace window. The first 15 seconds after the page loads
// regularly have racing background calls (heartbeat, plan check, vault
// listing, entitlement lookup) firing BEFORE the auth context has
// restored the cloud token from localStorage / cookie. Without this
// guard, opening `https://ironvault.app/passwords` directly via the URL
// bar reproducibly bounced the user to /auth/login because one of those
// races came back 401 before the token finished loading.
const BOOT_TIME = Date.now();
const BOOT_GRACE_PERIOD_MS = 15_000;

// Debounce: only dispatch one expired event per 10s window. Without this,
// a burst of background polls (heartbeat + plan check + vault list +
// /api/auth/me) all 401-ing at the same time would each fire a separate
// logout → reload → ... cascade.
let lastExpiredDispatch = 0;
const EXPIRED_DEBOUNCE_MS = 10000;

export function markLoginComplete(): void {
  lastLoginTime = Date.now();
}

export function installAuthFetchInterceptor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await original(input, init);
    if (response.status !== 401) return response;

    // Resolve the URL string so we can run path checks regardless of the
    // input shape (string / URL / Request).
    let urlStr = '';
    try {
      if (typeof input === 'string') urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (input instanceof Request) urlStr = input.url;
    } catch { /* noop */ }
    if (!urlStr) return response;

    // Only consider our own API paths.
    let path = urlStr;
    try { path = new URL(urlStr, window.location.origin).pathname; } catch { /* noop */ }
    if (!path.startsWith('/api/')) return response;
    if (SKIP_PATHS.some(p => path.startsWith(p))) return response;

    // Guard #1: no cloud token in localStorage means there's no live cloud
    // session at all — this 401 isn't an "expiry", it's just "we never had
    // auth in the first place" (anonymous endpoint hit, stale page, etc.).
    // Silently let it through.
    try {
      if (!localStorage.getItem('iv_cloud_token')) return response;
    } catch { return response; }

    // Guard #2: boot-time grace. The first BOOT_GRACE_PERIOD_MS ms after
    // page load is dominated by races where API calls go out before the
    // cloud token finishes restoring. Direct URL navigation to a deep
    // route (e.g. /passwords) was bouncing the user to /auth/login because
    // of this — fix is simply to not treat any 401 as an expiry during
    // the boot window.
    if (Date.now() - BOOT_TIME < BOOT_GRACE_PERIOD_MS) {
      return response;
    }
    // Guard #3: 30-second grace window after a login or vault unlock. The
    // first 30s after sign-in often have racing background calls carrying
    // a stale Bearer header (vault listing, plan check, heartbeat). We
    // never want those to bounce the user straight back to /auth/login.
    if (lastLoginTime && Date.now() - lastLoginTime < LOGIN_GRACE_PERIOD_MS) {
      return response;
    }

    // Did the request actually carry a Bearer token? If not, the 401 is
    // expected (anonymous call), don't trigger logout.
    const hadAuth =
      (() => {
        try {
          if (init?.headers) {
            const h = new Headers(init.headers as HeadersInit);
            const v = h.get('Authorization');
            if (v && v.startsWith('Bearer ')) return true;
          }
          if (input instanceof Request) {
            const v = input.headers.get('Authorization');
            if (v && v.startsWith('Bearer ')) return true;
          }
        } catch { /* noop */ }
        return false;
      })();
    if (!hadAuth) return response;

    // Guard #3: dispatch debounce. Only kick the user out once per 10s
    // window — multiple racing 401s (heartbeat + plan check + vault list)
    // would otherwise stack into a flicker storm.
    const now = Date.now();
    if (now - lastExpiredDispatch < EXPIRED_DEBOUNCE_MS) return response;
    lastExpiredDispatch = now;

    // Fire-and-forget — auth-context will pick this up.
    try {
      window.dispatchEvent(new CustomEvent('vault:auth:expired', { detail: { path } }));
    } catch { /* noop */ }
    return response;
  };
}
