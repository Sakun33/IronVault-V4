import { registerPlugin } from '@capacitor/core';
import { isNativeApp, isAndroid } from './platform';

export interface AutofillRequest {
  isAutofillRequest: boolean;
  packageName: string;
  webDomain: string;
}

export interface AutofillPlugin {
  getAutofillRequest(): Promise<AutofillRequest>;
  commitAutofill(options: { username: string; password: string }): Promise<void>;
  cancelAutofill(): Promise<void>;
}

const AutofillPluginNative = registerPlugin<AutofillPlugin>('AutofillPlugin');

/** Returns autofill request context if the app was launched by Android Autofill. */
export async function getAutofillRequest(): Promise<AutofillRequest | null> {
  if (!isNativeApp() || !isAndroid()) {
    return null;
  }
  try {
    return await AutofillPluginNative.getAutofillRequest();
  } catch {
    return null;
  }
}

/**
 * Commits the selected credential back to the Android Autofill system.
 * This closes the IronVault activity and fills the waiting login form.
 */
export async function commitAutofill(username: string, password: string): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  await AutofillPluginNative.commitAutofill({ username, password });
}

/** Cancels the autofill request without filling anything. */
export async function cancelAutofill(): Promise<void> {
  if (!isNativeApp() || !isAndroid()) return;
  await AutofillPluginNative.cancelAutofill();
}
