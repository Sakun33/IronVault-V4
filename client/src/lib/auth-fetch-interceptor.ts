/**
 * Global fetch interceptor that watches for 401 responses on authenticated
 * requests and triggers a centralized re-login flow.
 *
 * QA-R2 H2 fix: previously, when the cloud JWT expired (30-day TTL), every
 * call site silently logged the failure to console and kept the user in the
 * UI with a broken session — pushes failed quietly, vault sync stopped, and
 * the user had no idea they needed to log in again.
 *
 * Strategy:
 *  - Wrap `window.fetch` once on module load.
 *  - When a request includes an Authorization Bearer header (i.e., the
 *    caller intended an authenticated request) AND the response is 401,
 *    dispatch a `vault:auth:expired` event.
 *  - Auth-context listens for that event and runs accountLogout() →
 *    setLocation('/auth/login').
 *
 * We INTENTIONALLY do not auto-logout on 401s without an Authorization
 * header — those are expected during login (wrong password, etc.) and
 * during anonymous endpoints. We also skip the /api/auth/token endpoint
 * itself, since wrong-password returns 401 there but the user is mid-login.
 */

const SKIP_PATHS = [
  '/api/auth/token',
  '/api/auth/2fa/validate',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/register',
];

let installed = false;

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

    // Fire-and-forget — auth-context will pick this up.
    try {
      window.dispatchEvent(new CustomEvent('vault:auth:expired', { detail: { path } }));
    } catch { /* noop */ }
    return response;
  };
}
