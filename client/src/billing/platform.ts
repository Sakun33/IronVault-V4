import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export function getPlatform(): Platform {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

export function getPlatformDisplayName(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'ios':
      return 'App Store';
    case 'android':
      return 'Google Play';
    case 'web':
      return 'Web';
    default:
      return 'Unknown';
  }
}

export function getStoreName(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'ios':
      return 'the App Store';
    case 'android':
      return 'Google Play';
    default:
      return 'online';
  }
}
