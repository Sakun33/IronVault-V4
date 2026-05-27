// Apple Sign-In client. Hands the platform-appropriate Apple identity token
// to our backend (/api/auth/apple) and returns the cloud-token payload the
// auth-context needs to finalize a Stage-1 login.
//
// On native (Capacitor) we reuse @capgo/capacitor-social-login which delegates
// to ASAuthorizationController on iOS and a web-redirect flow on Android. On
// web we load Apple's AppleID JS SDK from appleid.cdn-apple.com and use it to
// pop the auth window.

import { apiBase, isNativeApp, isIOS, platform } from '@/native/platform';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: any) => void;
        signIn: (options?: any) => Promise<{
          authorization: { id_token: string; code: string; state?: string };
          user?: { name?: { firstName?: string; lastName?: string }; email?: string };
        }>;
      };
    };
  }
}

export interface AppleAuthResult {
  token: string;
  email: string;
  fullName: string;
  isNewUser: boolean;
  authProvider: 'apple';
  sessionId: string | null;
}

export type AppleAuthOutcome =
  | { ok: true; result: AppleAuthResult }
  | { ok: false; error: string };

const APPLE_JS_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

// Apple Services ID (web/Android client identifier registered in the Apple
// developer console). Different from the iOS Bundle ID. Override via
// VITE_APPLE_SERVICES_ID for staging/test projects.
const DEFAULT_SERVICES_ID = 'app.ironvault.signin';
const SERVICES_ID =
  (import.meta.env.VITE_APPLE_SERVICES_ID as string | undefined) || DEFAULT_SERVICES_ID;

// Redirect URI registered with the Services ID in the Apple developer console.
// Used by the web flow only; native iOS bypasses this entirely. The Apple
// console requires HTTPS, so localhost dev needs a real https tunnel or you
// can just test from the deployed site.
const DEFAULT_REDIRECT_URI =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/apple/callback` : '';
const REDIRECT_URI =
  (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) || DEFAULT_REDIRECT_URI;

function loadAppleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AppleID?.auth) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_JS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Apple JS SDK failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = APPLE_JS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Apple JS SDK failed to load'));
    document.head.appendChild(script);
  });
}

interface AppleAuthPayload {
  idToken: string;
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
}

async function getAppleAuthWeb(): Promise<AppleAuthPayload> {
  try {
    await loadAppleScript();
  } catch (err) {
    // The Apple JS SDK is hosted at appleid.cdn-apple.com — corporate
    // firewalls and some VPNs block it, leaving the button forever
    // "Signing in…". Surface a real error so the toast tells the user.
    throw new Error('Could not load Apple sign-in. Check your network or VPN, then try again.');
  }
  if (!window.AppleID?.auth) throw new Error('AppleID SDK not available');
  // Random nonce binds the JS call to the token Apple returns.
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  try {
    window.AppleID.auth.init({
      clientId: SERVICES_ID,
      scope: 'name email',
      redirectURI: REDIRECT_URI,
      state: nonce,
      nonce,
      usePopup: true,
    });
  } catch (err) {
    throw new Error('Apple sign-in is not configured for this domain (Services ID / redirect URI mismatch).');
  }

  // signIn() returns a Promise that:
  //  - resolves with the id_token on success
  //  - rejects with { error: 'popup_closed_by_user' } if the user closes
  //  - hangs forever if the popup never opens (iOS Safari pop-up blocker)
  // Wrap with a hard 90s timeout so the calling button can't get stuck
  // in its disabled/loading state.
  let data: any;
  try {
    data = await withTimeout(
      window.AppleID.auth.signIn(),
      90_000,
      'Apple sign-in',
    );
  } catch (err: any) {
    const code = err?.error || err?.code || '';
    if (code === 'popup_closed_by_user') {
      throw new Error('Apple sign-in was cancelled.');
    }
    if (code === 'popup_blocked_by_browser') {
      throw new Error('Apple sign-in popup was blocked. Allow pop-ups for this site and try again.');
    }
    if (err?.message && /timed out/.test(err.message)) {
      throw new Error('Apple sign-in took too long to respond. Allow pop-ups for this site, or try email + password.');
    }
    // Bubble Apple's structured error if it has one, otherwise the message.
    if (err?.error) throw new Error(`Apple sign-in failed (${err.error}).`);
    throw err;
  }

  const idToken = data?.authorization?.id_token;
  if (!idToken) throw new Error('Apple did not return an identity token');
  return { idToken, user: data.user };
}

let _socialLoginInitialized = false;
let _socialLoginInitPromise: Promise<any> | null = null;

async function getAppleSocialLoginPlugin() {
  const mod: any = await import('@capgo/capacitor-social-login');
  const SocialLogin = mod.SocialLogin || mod.default?.SocialLogin || mod;
  if (_socialLoginInitialized) return SocialLogin;
  if (!_socialLoginInitPromise) {
    _socialLoginInitPromise = SocialLogin.initialize({
      apple: {
        // iOS uses the app's Bundle ID — passing the Services ID would be
        // wrong. On iOS the plugin ignores clientId and uses the bundle.
        // On web/Android the plugin's Apple flow uses this clientId as the
        // services identifier registered in the Apple developer console.
        clientId: SERVICES_ID,
        // Empty string on iOS prevents an external redirect.
        redirectUrl: isIOS() ? '' : REDIRECT_URI,
      },
    }).then(() => {
      _socialLoginInitialized = true;
    }).catch((err: unknown) => {
      _socialLoginInitPromise = null;
      throw err;
    });
  }
  await _socialLoginInitPromise;
  return SocialLogin;
}

export async function initializeAppleAuth(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await getAppleSocialLoginPlugin();
  } catch (err) {
    console.error('[apple-auth] early init failed:', err);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s — try again or use email + password.`));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function getAppleAuthNative(): Promise<AppleAuthPayload> {
  const SocialLogin = await getAppleSocialLoginPlugin();
  const response: any = await withTimeout(
    SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['email', 'name'] },
    }),
    60_000,
    'Apple sign-in',
  );
  const idToken: string | null = response?.result?.idToken || null;
  if (!idToken) {
    throw new Error('Apple did not return an identity token (check Sign in with Apple capability)');
  }
  const profile = response?.result?.profile || {};
  const user = (profile.givenName || profile.familyName)
    ? { name: { firstName: profile.givenName || undefined, lastName: profile.familyName || undefined }, email: profile.email || undefined }
    : undefined;
  return { idToken, user };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function signInWithApple(): Promise<AppleAuthOutcome> {
  let payload: AppleAuthPayload;
  try {
    payload = isNativeApp() ? await getAppleAuthNative() : await getAppleAuthWeb();
  } catch (err) {
    const error = describeError(err);
    console.error('[apple-auth] sign-in failed:', err);
    return { ok: false, error };
  }

  try {
    const res = await fetch(`${apiBase()}/api/auth/apple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IV-Client': isNativeApp() ? 'mobile' : 'web',
      },
      body: JSON.stringify({
        idToken: payload.idToken,
        platform: isNativeApp() ? platform() : 'web',
        user: payload.user,
      }),
    });
    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      const error = errBody?.error || errBody?.message || `Backend rejected token (HTTP ${res.status})`;
      console.error('[apple-auth] backend rejected token:', res.status, errBody);
      return { ok: false, error };
    }
    const result = (await res.json()) as AppleAuthResult;
    return { ok: true, result };
  } catch (err) {
    const error = describeError(err);
    console.error('[apple-auth] backend exchange error:', err);
    return { ok: false, error };
  }
}

export async function appleSignOut(): Promise<void> {
  try {
    if (isNativeApp()) {
      const SocialLogin = await getAppleSocialLoginPlugin();
      await SocialLogin.logout({ provider: 'apple' });
    }
  } catch {
    /* noop — best effort */
  }
}
