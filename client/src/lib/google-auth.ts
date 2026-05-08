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

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Web OAuth 2.0 Client ID for IronVault. Hardcoded as a build-time fallback
// so production keeps working even if the VITE_GOOGLE_CLIENT_ID env var is
// missing on a future build. Override locally via .env for staging/test
// projects.
const DEFAULT_WEB_CLIENT_ID = '137773717238-qae0862qk28785hq86sflge6sc856rvg.apps.googleusercontent.com';

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
 * Pop the web GSI prompt and return the Google-issued ID token (a JWT).
 *
 * GSI's One Tap prompt can silently no-op for a bunch of reasons (third-party
 * cookies disabled, user dismissed it 3+ times, FedCM blocked, etc.). When
 * that happens we fall back to a popup-based OAuth flow via initTokenClient,
 * which is more reliable but uses an access token rather than an ID token —
 * so we make a follow-up call to the userinfo endpoint and synthesize the
 * shape our backend expects. (We don't actually do that fallback here yet;
 * we surface the error and let the caller show a toast.)
 */
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
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string; error?: string }) => {
            if (response.credential) {
              resolve(response.credential);
            } else {
              reject(new Error(response.error || 'No credential returned'));
            }
          },
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
        });
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
            reject(new Error('Google prompt was suppressed — try the popup flow'));
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
async function getSocialLoginPlugin() {
  const mod: any = await import('@capgo/capacitor-social-login');
  const SocialLogin = mod.SocialLogin || mod.default?.SocialLogin || mod;
  if (!_socialLoginInitialized) {
    await SocialLogin.initialize({
      google: {
        // Web client ID — used by Android to request an ID token whose
        // `aud` claim matches GOOGLE_CLIENT_ID_WEB on the server. iOS uses
        // the same value here as the iOS client ID's "server client ID"
        // setting until we ship a separate iOS OAuth client.
        webClientId: DEFAULT_WEB_CLIENT_ID,
        mode: 'online',
      },
    });
    _socialLoginInitialized = true;
  }
  return SocialLogin;
}

async function getGoogleIdTokenNative(): Promise<string> {
  const SocialLogin = await getSocialLoginPlugin();
  const response: any = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
      forceRefreshToken: false,
    },
  });
  const idToken: string | undefined =
    response?.result?.idToken
    || response?.result?.authentication?.idToken
    || response?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token');
  }
  return idToken;
}

/**
 * Trigger Google Sign-In and exchange the ID token for an IronVault cloud
 * token. Returns null on user cancellation or any failure — caller is
 * expected to surface a toast.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult | null> {
  try {
    const idToken = isNativeApp()
      ? await getGoogleIdTokenNative()
      : await getGoogleIdTokenWeb();

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
      const errBody = await res.json().catch(() => ({}));
      console.error('[google-auth] backend rejected token:', res.status, errBody);
      return null;
    }
    return (await res.json()) as GoogleAuthResult;
  } catch (err) {
    console.error('[google-auth] error:', err);
    return null;
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
