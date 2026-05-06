import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function platform(): Platform {
  const platformName = Capacitor.getPlatform();
  if (platformName === 'ios' || platformName === 'android') {
    return platformName as Platform;
  }
  return 'web';
}

export function isIOS(): boolean {
  return platform() === 'ios';
}

export function isAndroid(): boolean {
  return platform() === 'android';
}

export function isWeb(): boolean {
  return platform() === 'web';
}

export function getDeviceInfo() {
  return {
    isNative: isNativeApp(),
    platform: platform(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isWeb: isWeb(),
  };
}

/**
 * API base URL. On the web, relative URLs (/api/...) resolve to the same
 * origin (ironvault.app). On Capacitor native apps, the WebView runs on
 * capacitor://localhost — relative URLs go nowhere. This helper returns
 * the absolute production origin for native, empty string for web.
 */
export function apiBase(): string {
  return isNativeApp() ? 'https://www.ironvault.app' : '';
}
