/**
 * Passkey (FIDO2 / WebAuthn) client.
 *
 * Two ceremonies: register (after the user is already signed-in, adds a
 * passkey to their account) and authenticate (replaces password on the
 * login page). Both use @simplewebauthn/browser to handle the platform
 * authenticator dance, and our /api/auth/passkey/* endpoints to issue +
 * verify challenges.
 *
 * Browser support: any modern browser on a device with a platform
 * authenticator (Touch ID, Face ID, Windows Hello, Android fingerprint).
 * Falls back gracefully when navigator.credentials is unavailable.
 */

import { apiBase, isNativeApp } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

export interface PasskeyAuthResult {
  token: string;
  userId: string;
  email: string;
  authProvider: 'passkey';
}

export type PasskeyOutcome<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export function isPasskeySupported(): boolean {
  // Capacitor native apps run in WKWebView on `capacitor://localhost`.
  // The WebAuthn RP ID must match the page origin, and iOS WKWebView
  // refuses cross-origin RP IDs even with Associated Domains — registering
  // a passkey for `ironvault.app` from `capacitor://localhost` fails with
  // a NotAllowedError. Native passkey support requires the
  // AuthenticationServices framework via a Capacitor plugin, not the
  // WebAuthn JS API. Until that lands, surface passkeys as web-only.
  if (isNativeApp()) return false;
  return typeof window !== 'undefined'
    && !!window.PublicKeyCredential
    && typeof navigator !== 'undefined'
    && !!navigator.credentials;
}

/** True when running inside the iOS/Android app — used to show a "use a browser" hint. */
export function isPasskeyBlockedByNativeApp(): boolean {
  return isNativeApp();
}

function authHeaders(): HeadersInit {
  const token = getCloudToken();
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') return 'Cancelled or no matching passkey.';
    if (err.name === 'NotSupportedError') return 'Passkeys are not supported on this device.';
    if (err.name === 'SecurityError') return 'Security check failed — must be on https.';
    return err.message;
  }
  return String(err);
}

/** Register a new passkey for the currently-signed-in account. */
export async function registerPasskey(deviceLabel: string): Promise<PasskeyOutcome<{ credentialId: string }>> {
  if (!isPasskeySupported()) return { ok: false, error: 'Passkeys are not supported in this browser' };
  try {
    const optsRes = await fetch(`${apiBase()}/api/auth/passkey/register-options`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!optsRes.ok) {
      const body = await optsRes.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${optsRes.status}` };
    }
    const options = await optsRes.json();
    const { startRegistration } = await import('@simplewebauthn/browser');
    const attestationResponse = await startRegistration({ optionsJSON: options });
    const regRes = await fetch(`${apiBase()}/api/auth/passkey/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ attestationResponse, deviceLabel }),
    });
    if (!regRes.ok) {
      const body = await regRes.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${regRes.status}` };
    }
    const body = await regRes.json();
    return { ok: true, result: { credentialId: body.credentialId } };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

/** Authenticate with a passkey (replaces password on the login page). */
export async function authenticateWithPasskey(email?: string): Promise<PasskeyOutcome<PasskeyAuthResult>> {
  if (!isPasskeySupported()) return { ok: false, error: 'Passkeys are not supported in this browser' };
  try {
    const optsRes = await fetch(`${apiBase()}/api/auth/passkey/authenticate-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!optsRes.ok) {
      const body = await optsRes.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${optsRes.status}` };
    }
    const options = await optsRes.json();
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const assertionResponse = await startAuthentication({ optionsJSON: options });
    const authRes = await fetch(`${apiBase()}/api/auth/passkey/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assertionResponse }),
    });
    if (!authRes.ok) {
      const body = await authRes.json().catch(() => ({}));
      return { ok: false, error: body?.error || `HTTP ${authRes.status}` };
    }
    const body = await authRes.json();
    return { ok: true, result: body as PasskeyAuthResult };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export interface RegisteredPasskey {
  credentialId: string;
  deviceLabel: string | null;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listPasskeys(): Promise<RegisteredPasskey[]> {
  try {
    const res = await fetch(`${apiBase()}/api/auth/passkey/list`, { headers: authHeaders() });
    if (!res.ok) return [];
    const body = await res.json();
    return body.credentials || [];
  } catch {
    return [];
  }
}

export async function deletePasskey(credentialId: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/auth/passkey/delete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ credentialId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
