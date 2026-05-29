/**
 * Widget Bridge — native side of widget-data.ts.
 *
 * @capacitor/preferences `group` is a key-prefix on UserDefaults.standard
 * (not a real App Group suite name), so values written through it are NOT
 * visible to the iOS Widget / AutoFill extensions, which run in their own
 * sandbox. We register a tiny custom Capacitor plugin called WidgetBridge
 * that writes to UserDefaults(suiteName: "group.app.ironvault.shared") so
 * the extensions can actually read it.
 *
 * On web / non-iOS the plugin simply doesn't register and every call here
 * becomes a no-op — keeps callers branchless.
 */

import { registerPlugin } from '@capacitor/core';
import { isNativeApp, isIOS, isAndroid } from './platform';

export const WIDGET_APP_GROUP = 'group.app.ironvault.shared';

export interface WidgetBridgePlugin {
  /** Persist a string value into the shared App Group UserDefaults. */
  setItem(options: { key: string; value: string }): Promise<void>;
  /** Read a string value from the shared App Group UserDefaults. */
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  /** Remove a key from the shared App Group UserDefaults. */
  removeItem(options: { key: string }): Promise<void>;
  /** Force WidgetKit to refresh all timelines for this app's widget kinds. */
  reloadAll(): Promise<void>;
  /**
   * Persist a list of credential identities into the iOS AutoFill credential
   * store via ASCredentialIdentityStore. The native side stores only the
   * (recordIdentifier, serviceIdentifier, user) tuple — never the password.
   * The actual password is fetched from the shared Keychain when AutoFill
   * activates and the host app authenticates the user.
   */
  syncCredentialIdentities(options: {
    identities: Array<{ recordIdentifier: string; url: string; username: string }>;
  }): Promise<void>;
}

/**
 * Android counterpart — a separate Capacitor plugin
 * (`com.ironvault.app.AutofillPlugin`) that pushes the credential mirror
 * into an EncryptedSharedPreferences blob read by the
 * IronVaultAutofillService and AutofillFillActivity.
 *
 * On Android the autofill service cannot share UserDefaults with the host
 * app the way the iOS extension does, so we move full (username, password)
 * tuples in addition to the identity list.
 */
export interface AndroidAutofillPlugin {
  publishCredentials(options: {
    credentials: Array<{ recordIdentifier: string; url: string; username: string; password: string }>;
  }): Promise<{ count: number }>;
  clearCredentials(): Promise<void>;
  isAutofillEnabled(): Promise<{ enabled: boolean; supported: boolean }>;
}

const Native = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
const AndroidAutofill = registerPlugin<AndroidAutofillPlugin>('AutofillPlugin');

function bridgeAvailable(): boolean {
  return isNativeApp() && isIOS();
}

function androidAutofillAvailable(): boolean {
  return isNativeApp() && isAndroid();
}

export async function bridgeSet(key: string, value: string): Promise<void> {
  if (!bridgeAvailable()) return;
  try {
    await Native.setItem({ key, value });
  } catch { /* noop — extension not installed yet */ }
}

export async function bridgeGet(key: string): Promise<string | null> {
  if (!bridgeAvailable()) return null;
  try {
    const r = await Native.getItem({ key });
    return r.value ?? null;
  } catch { return null; }
}

export async function bridgeRemove(key: string): Promise<void> {
  if (!bridgeAvailable()) return;
  try { await Native.removeItem({ key }); } catch { /* noop */ }
}

export async function bridgeReloadWidgets(): Promise<void> {
  if (!bridgeAvailable()) return;
  try { await Native.reloadAll(); } catch { /* noop */ }
}

export async function bridgeSyncCredentialIdentities(
  identities: Array<{ recordIdentifier: string; url: string; username: string }>,
): Promise<void> {
  if (!bridgeAvailable()) return;
  try {
    await Native.syncCredentialIdentities({ identities });
  } catch { /* noop */ }
}

/**
 * Push the full credential payload (including passwords) into the Android
 * autofill credential store. No-op on iOS / web — there the password
 * stays in the App Group blob and only the identity tuple is registered
 * with iOS.
 */
export async function bridgeAndroidPublishCredentials(
  credentials: Array<{ recordIdentifier: string; url: string; username: string; password: string }>,
): Promise<void> {
  if (!androidAutofillAvailable()) return;
  try {
    await AndroidAutofill.publishCredentials({ credentials });
  } catch { /* noop — service not installed yet, or vault locked */ }
}

/** Wipe the Android credential mirror (lock / logout). No-op elsewhere. */
export async function bridgeAndroidClearCredentials(): Promise<void> {
  if (!androidAutofillAvailable()) return;
  try {
    await AndroidAutofill.clearCredentials();
  } catch { /* noop */ }
}

/** Is the IronVault Android autofill service currently the default provider? */
export async function bridgeAndroidIsAutofillEnabled(): Promise<{ enabled: boolean; supported: boolean }> {
  if (!androidAutofillAvailable()) return { enabled: false, supported: false };
  try {
    return await AndroidAutofill.isAutofillEnabled();
  } catch {
    return { enabled: false, supported: false };
  }
}
