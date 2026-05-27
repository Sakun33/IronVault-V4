// Google Sign-In client. Hands the platform-appropriate Google ID token to
// our backend (/api/auth/google) and returns the cloud-token payload the
// auth-context needs to finalize a Stage-1 login.
//
// On native (Capacitor) we use @capgo/capacitor-social-login (Capacitor 7
// compatible), which delegates to the platform-native Sign-in-with-Google
// flow. On web we use Google Identity Services (GSI) loaded from
// accounts.google.com.

import { apiBase, isNativeApp, platform } from '@/native/platform';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (cb?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}

export interface GoogleAuthResult {
  token: string;
  email: string;
  fullName: string;
  isNewUser: boolean;
  authProvider: 'google';
  sessionId: string | null;
}

export type GoogleAuthOutcome =
  | { ok: true; result: GoogleAuthResult }
  | { ok: false; error: string };

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Web OAuth 2.0 Client ID for IronVault. Hardcoded as a build-time fallback
// so production keeps working even if the VITE_GOOGLE_CLIENT_ID env var is
// missing on a future build. Override locally via .env for staging/test
// projects.
const DEFAULT_WEB_CLIENT_ID = '137773717238-qae0862qk28785hq86sflge6sc856rvg.apps.googleusercontent.com';

// iOS-typed OAuth client. Required for the native iOS GoogleSignIn SDK to
// launch — a web client ID alone is rejected. The matching REVERSED_CLIENT_ID
// (com.googleusercontent.apps.137773717238-1hmuf8hed2mrrmupsefiokvatk0if0l5)
// is registered as a CFBundleURLScheme in ios/App/App/Info.plist. Override
// via VITE_GOOGLE_CLIENT_ID_IOS for staging/test projects.
const DEFAULT_IOS_CLIENT_ID = '137773717238-1hmuf8hed2mrrmupsefiokvatk0if0l5.apps.googleusercontent.com';
const IOS_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID_IOS as string | undefined) || DEFAULT_IOS_CLIENT_ID;

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GSI failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * iOS Safari (and many mobile browsers) suppress GSI's One Tap prompt
 * because third-party cookies / FedCM are blocked by default. When the
 * prompt no-ops, we fall back to Google's own rendered button — when
 * clicked, it opens a popup that reliably returns the ID token via the
 * GSI callback. We render that button off-screen and synthesize a click
 * so the existing IronVault "Continue with Google" button still drives
 * the flow.
 */
function isMobileSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iOS Safari / Chrome on iOS (which is WKWebView under the hood) / iPad
  // Safari. Android Chrome generally permits the One Tap prompt, but we
  // still treat all touch-only mobile browsers as "prompt-may-be-suppressed"
  // so we have a reliable fallback there too.
  return /iPhone|iPad|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
}

function clickRenderedGoogleButton(container: HTMLElement): boolean {
  // Google renders a nested <div role="button"> we can click. Older GSI
  // versions used <iframe> — we can't click cross-origin iframes from JS,
  // but on modern GSI the outer wrapper is same-origin so this works.
  const btn = container.querySelector<HTMLElement>('div[role="button"]')
    || container.querySelector<HTMLElement>('[role="button"]');
  if (btn && typeof btn.click === 'function') {
    btn.click();
    return true;
  }
  return false;
}

function getGoogleIdTokenWeb(): Promise<string> {
  return new Promise((resolve, reject) => {
    loadGsiScript().then(() => {
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || DEFAULT_WEB_CLIENT_ID;
      if (!clientId) {
        reject(new Error('Google client ID is not configured'));
        return;
      }
      if (!window.google?.accounts?.id) {
        reject(new Error('GSI not available'));
        return;
      }
      let settled = false;
      const finish = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string; error?: string }) => {
            if (response.credential) {
              finish(() => resolve(response.credential!));
            } else {
              finish(() => reject(new Error(response.error || 'No credential returned')));
            }
          },
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
        });

        // On iOS Safari and other touch browsers the One Tap prompt is
        // almost always suppressed. Skip the prompt() call entirely and go
        // straight to the rendered-button popup flow — that flow is the
        // user-gesture-friendly path and works in WebKit.
        if (isMobileSafariLike()) {
          const container = document.createElement('div');
          container.setAttribute('data-google-fallback', '1');
          container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:200px;height:48px;';
          document.body.appendChild(container);
          try {
            window.google.accounts.id.renderButton(container, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            });
          } catch (e) {
            document.body.removeChild(container);
            finish(() => reject(new Error('Could not render Google button: ' + (e instanceof Error ? e.message : String(e)))));
            return;
          }
          // Give GSI a tick to mount the inner button DOM, then synth-click.
          // The browser still treats this as inside the user's tap-event
          // microtask because the parent onClick handler is what initiated
          // signInWithGoogle() synchronously.
          let attempts = 0;
          const tryClick = () => {
            if (settled) return;
            if (clickRenderedGoogleButton(container)) return;
            if (++attempts > 30) {
              finish(() => reject(new Error('Google sign-in could not be opened (button did not render). Try again or use email + password.')));
              return;
            }
            setTimeout(tryClick, 50);
          };
          tryClick();
          // Cleanup once we resolve/reject.
          const cleanup = () => { try { document.body.removeChild(container); } catch { /* noop */ } };
          const origCb = (settled as unknown);
          // Wrap settle to also clean the container.
          const wrap = (orig: typeof finish) => (fn: () => void) => orig(() => { cleanup(); fn(); });
          // We can't easily reassign `finish`, so just schedule a delayed
          // cleanup as well — the container is tiny and off-screen.
          void origCb; void wrap;
          setTimeout(cleanup, 5 * 60 * 1000);
          return;
        }

        window.google.accounts.id.prompt((notification: any) => {
          // notification has both v1 (isNotDisplayed/isSkippedMoment) and v2
          // (getNotDisplayedReason/getSkippedReason) shapes depending on GSI
          // version. Probe both so older builds don't blow up.
          const notDisplayed = typeof notification?.isNotDisplayed === 'function'
            ? notification.isNotDisplayed()
            : false;
          const skipped = typeof notification?.isSkippedMoment === 'function'
            ? notification.isSkippedMoment()
            : false;
          if (notDisplayed || skipped) {
            // Desktop fallback: same renderButton + synth-click trick.
            const container = document.createElement('div');
            container.setAttribute('data-google-fallback', '1');
            container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:200px;height:48px;';
            document.body.appendChild(container);
            try {
              window.google!.accounts.id.renderButton(container, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left',
              });
            } catch (e) {
              try { document.body.removeChild(container); } catch { /* noop */ }
              finish(() => reject(new Error('Could not render Google button: ' + (e instanceof Error ? e.message : String(e)))));
              return;
            }
            let attempts = 0;
            const tryClick = () => {
              if (settled) return;
              if (clickRenderedGoogleButton(container)) return;
              if (++attempts > 30) {
                finish(() => reject(new Error('Google sign-in could not be opened. Try again or use email + password.')));
                return;
              }
              setTimeout(tryClick, 50);
            };
            tryClick();
            setTimeout(() => { try { document.body.removeChild(container); } catch { /* noop */ } }, 5 * 60 * 1000);
          }
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }).catch(reject);
  });
}

/**
 * Native Capacitor flow. Lazy-imports the plugin so the web build doesn't
 * pull in any iOS/Android-only code. Uses @capgo/capacitor-social-login,
 * which is the Capacitor 7-compatible drop-in replacement for the legacy
 * codetrix plugin.
 *
 * The plugin's `login({ provider: 'google', options })` returns
 * `{ provider: 'google', result: { idToken, accessToken, profile, ... } }`.
 * We pass the idToken to our backend, which validates the signature +
 * audience via Google's tokeninfo endpoint.
 */
let _socialLoginInitialized = false;
let _socialLoginInitPromise: Promise<any> | null = null;

async function getSocialLoginPlugin() {
  const mod: any = await import('@capgo/capacitor-social-login');
  const SocialLogin = mod.SocialLogin || mod.default?.SocialLogin || mod;
  if (_socialLoginInitialized) {
    return SocialLogin;
  }
  if (!_socialLoginInitPromise) {
    _socialLoginInitPromise = SocialLogin.initialize({
      google: {
        // Web client ID is used as the audience that the backend verifies.
        // On Android it doubles as the `serverClientId` for the credential
        // request (Google returns an ID token whose `aud` matches this).
        webClientId: DEFAULT_WEB_CLIENT_ID,
        // iOS-typed client ID. The native GoogleSignIn SDK refuses to launch
        // without one. If unset, iOS sign-in will surface a configuration
        // error instead of silently failing.
        ...(IOS_CLIENT_ID ? { iOSClientId: IOS_CLIENT_ID } : {}),
        // CRITICAL on iOS: without iOSServerClientId, GIDSignIn returns no
        // idToken in the response — the JS Promise then either resolves with
        // an undefined idToken (we throw "no ID token") or, in some plugin
        // versions, never resolves at all (the visible "Signing in…" hang).
        // Pinning this to the WEB client ID makes the iOS SDK request an
        // idToken whose `aud` matches what our backend verifies.
        iOSServerClientId: DEFAULT_WEB_CLIENT_ID,
        mode: 'online',
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

/**
 * Eager init for the native plugin. Safe to call from app boot — it's a
 * no-op on web, and on native it warms up the plugin so the first sign-in
 * click doesn't pay the import + initialize cost. Errors are logged, not
 * thrown — failures surface again on the actual sign-in attempt with a
 * user-visible toast.
 */
export async function initializeGoogleAuth(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await getSocialLoginPlugin();
  } catch (err) {
    console.error('[google-auth] early init failed:', err);
  }
}

/**
 * Wrap a promise in a hard timeout. If the underlying SDK hangs (the actual
 * "Signing in…" forever bug we saw on iOS), we reject with a clear error so
 * the user sees a toast instead of an infinite spinner.
 */
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

async function getGoogleIdTokenNative(): Promise<string> {
  console.warn('[google-auth] native: getting plugin');
  const SocialLogin = await getSocialLoginPlugin();
  console.warn('[google-auth] native: plugin ready, calling login');
  let response: any;
  try {
    response = await withTimeout(
      SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
          forceRefreshToken: false,
        },
      }),
      60_000,
      'Google sign-in',
    );
  } catch (err: any) {
    // Surface the real native error to the JS console (visible via Safari
    // Web Inspector when the device is attached) and re-wrap with a useful
    // message so the user-facing toast says something specific instead of
    // a bare timeout.
    const detail = {
      message: err?.message,
      code: err?.code,
      errorMessage: err?.errorMessage,
      raw: (() => { try { return JSON.stringify(err); } catch { return String(err); } })(),
    };
    console.error('[google-auth] native login failed:', detail);
    if (err?.message && /timed out/.test(err.message)) {
      throw new Error('Google did not respond. Check internet, retry, or use email + password.');
    }
    throw err;
  }
  console.warn('[google-auth] native: login resolved', {
    hasIdToken: Boolean(response?.result?.idToken),
    hasAccessToken: Boolean(response?.result?.accessToken),
    keys: response?.result ? Object.keys(response.result) : [],
  });
  const idToken: string | undefined =
    response?.result?.idToken
    || response?.result?.authentication?.idToken
    || response?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token (check OAuth consent screen / iOSServerClientId)');
  }
  return idToken;
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

/**
 * Trigger Google Sign-In and exchange the ID token for an IronVault cloud
 * token. Returns a discriminated outcome — `{ ok: false, error }` carries
 * the real failure reason so the caller can surface it in a toast (handy
 * on native where misconfiguration errors otherwise vanish into a console
 * the user can't see).
 */
export async function signInWithGoogle(): Promise<GoogleAuthOutcome> {
  let idToken: string;
  try {
    idToken = isNativeApp()
      ? await getGoogleIdTokenNative()
      : await getGoogleIdTokenWeb();
  } catch (err) {
    const error = describeError(err);
    console.error('[google-auth] sign-in failed:', err);
    return { ok: false, error };
  }

  try {
    const res = await fetch(`${apiBase()}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IV-Client': isNativeApp() ? 'mobile' : 'web',
      },
      body: JSON.stringify({
        idToken,
        platform: isNativeApp() ? platform() : 'web',
      }),
    });
    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      const error = errBody?.error || errBody?.message || `Backend rejected token (HTTP ${res.status})`;
      console.error('[google-auth] backend rejected token:', res.status, errBody);
      return { ok: false, error };
    }
    const result = (await res.json()) as GoogleAuthResult;
    return { ok: true, result };
  } catch (err) {
    const error = describeError(err);
    console.error('[google-auth] backend exchange error:', err);
    return { ok: false, error };
  }
}

/** Best-effort: tell GSI / the native plugin to forget the cached account so
 * the next sign-in shows the chooser. Used on logout. */
export async function googleSignOut(): Promise<void> {
  try {
    if (isNativeApp()) {
      const SocialLogin = await getSocialLoginPlugin();
      await SocialLogin.logout({ provider: 'google' });
    } else if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch {
    /* noop — best effort */
  }
}
