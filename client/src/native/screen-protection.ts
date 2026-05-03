import { registerPlugin } from '@capacitor/core';
import { isNativeApp, isAndroid } from './platform';

export interface ScreenProtectionSettings {
  preventScreenshots: boolean;
  hideInAppSwitcher: boolean;
}

interface ScreenProtectionPlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

const ScreenProtection = registerPlugin<ScreenProtectionPlugin>('ScreenProtection', {
  web: () => ({
    enable: async () => Promise.resolve(),
    disable: async () => Promise.resolve(),
  }),
});

let isScreenProtectionEnabled = false;

export async function enableScreenProtection(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  try {
    // DISABLED FOR INVESTOR DEMOS - Screen sharing allowed
    // if (isAndroid()) {
    //   await ScreenProtection.enable();
    // }
    
    isScreenProtectionEnabled = false; // Keep disabled for demos
  } catch (error) {
    console.error('Failed to enable screen protection:', error);
  }
}

export async function disableScreenProtection(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  try {
    if (isAndroid()) {
      await ScreenProtection.disable();
    }
    
    isScreenProtectionEnabled = false;
  } catch (error) {
    console.error('Failed to disable screen protection:', error);
  }
}

export function isScreenProtectionActive(): boolean {
  return isScreenProtectionEnabled;
}

export async function setScreenProtectionSettings(settings: ScreenProtectionSettings): Promise<void> {
  if (settings.preventScreenshots && settings.hideInAppSwitcher) {
    await enableScreenProtection();
  } else {
    await disableScreenProtection();
  }
}

export function setupPrivacyScreenOnBackground(): void {
  if (!isNativeApp()) return;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      addPrivacyOverlay();
    } else {
      removePrivacyOverlay();
    }
  });

  window.addEventListener('blur', () => {
    addPrivacyOverlay();
  });

  window.addEventListener('focus', () => {
    removePrivacyOverlay();
  });
}

function addPrivacyOverlay(): void {
  if (document.getElementById('privacy-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'privacy-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: hsl(var(--background));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    flex-direction: column;
    gap: 1rem;
  `;

  const icon = document.createElement('div');
  icon.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `;
  icon.style.color = 'hsl(var(--primary))';

  const text = document.createElement('div');
  text.textContent = 'IronVault';
  text.style.cssText = `
    font-size: 1.5rem;
    font-weight: 600;
    color: hsl(var(--foreground));
  `;

  overlay.appendChild(icon);
  overlay.appendChild(text);
  document.body.appendChild(overlay);
}

function removePrivacyOverlay(): void {
  const overlay = document.getElementById('privacy-overlay');
  if (overlay) {
    overlay.remove();
  }
}
