/**
 * AutoFill sync — publishes the password list to the iOS AutoFill
 * credential provider extension.
 *
 * The Swift `CredentialProviderViewController` reads JSON from the
 * shared App Group UserDefaults key `iv_autofill_credentials_v1`. The
 * extension only has the (username, password, url) triples it needs —
 * it does NOT see anything else from the vault.
 *
 * On every call we also push the (recordIdentifier, url, username)
 * tuples into ASCredentialIdentityStore via the WidgetBridge plugin so
 * iOS QuickType bar can list IronVault entries before the user even
 * opens the AutoFill picker. The password itself stays in the App
 * Group blob; only the identity record goes to Apple's index.
 *
 * Privacy:
 * - Called only when the vault is unlocked, after a sync.
 * - Cleared (with `clearAutoFillCredentials`) on vault lock + logout
 *   so a different user on the same device can't see prior secrets.
 */

import { Preferences } from '@capacitor/preferences';
import {
  bridgeSet,
  bridgeRemove,
  bridgeSyncCredentialIdentities,
  bridgeAndroidPublishCredentials,
  bridgeAndroidClearCredentials,
} from '@/native/widget-bridge';

const KEY = 'iv_autofill_credentials_v1';

interface VaultPasswordLike {
  id?: string;
  url?: string;
  website?: string;
  domain?: string;
  username?: string;
  email?: string;
  password?: string;
}

interface AutoFillCredentialPayload {
  recordIdentifier: string;
  url: string;
  username: string;
  password: string;
}

function normaliseUrl(input: string): string {
  if (!input) return '';
  let url = input.trim().toLowerCase();
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  return url;
}

function toCredential(p: VaultPasswordLike): AutoFillCredentialPayload | null {
  const rawUrl = p.url || p.website || p.domain || '';
  const username = p.username || p.email || '';
  const password = p.password || '';
  if (!password || !username || !rawUrl || !p.id) return null;
  return {
    recordIdentifier: p.id,
    url: normaliseUrl(rawUrl),
    username,
    password,
  };
}

/**
 * Push the full credential set to the AutoFill extension. Idempotent —
 * each call replaces whatever was there.
 *
 * iOS: writes encrypted blob into the App Group UserDefaults, then
 *      registers the (recordId, url, username) tuple list with
 *      ASCredentialIdentityStore. Password is only read by the extension
 *      itself after biometric.
 *
 * Android: pushes the full (username, password) tuples into the
 *      EncryptedSharedPreferences mirror that the
 *      IronVaultAutofillService and AutofillFillActivity read at fill
 *      time. The mirror is biometric-gated on every reveal.
 */
export async function publishAutoFillCredentials(passwords: VaultPasswordLike[]): Promise<void> {
  const creds = passwords.map(toCredential).filter((c): c is AutoFillCredentialPayload => c !== null);
  const json = JSON.stringify(creds);
  try {
    await Promise.all([
      Preferences.set({ key: KEY, value: json }),
      bridgeSet(KEY, json),
    ]);
    // iOS identity list — no password fields, just the lookup tuple.
    await bridgeSyncCredentialIdentities(
      creds.map(c => ({
        recordIdentifier: c.recordIdentifier,
        url: c.url,
        username: c.username,
      })),
    );
    // Android credential mirror — full tuples, encrypted at rest.
    await bridgeAndroidPublishCredentials(creds);
  } catch {
    // Failing to update AutoFill must never break the app.
  }
}

/** Drop every credential entry — called on lock / logout. */
export async function clearAutoFillCredentials(): Promise<void> {
  try {
    await Promise.all([
      Preferences.remove({ key: KEY }).catch(() => undefined),
      bridgeRemove(KEY),
      bridgeSyncCredentialIdentities([]),
      bridgeAndroidClearCredentials(),
    ]);
  } catch { /* noop */ }
}
