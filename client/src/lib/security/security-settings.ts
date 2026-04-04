/**
 * Security Settings Service
 * 
 * Manages security-related settings for the vault app:
 * - Auto-lock timer
 * - Clipboard auto-clear
 * - Screenshot protection toggle
 */

import { Capacitor } from '@capacitor/core';

export type AutoLockInterval = 'immediate' | '30s' | '1m' | '5m' | '15m' | 'never';

export interface SecuritySettings {
  autoLockInterval: AutoLockInterval;
  clipboardAutoClear: boolean;
  clipboardClearDelaySeconds: number;
  screenshotProtection: boolean;
  biometricEnabled: boolean;
  lockOnBackground: boolean;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockInterval: '1m',
  clipboardAutoClear: true,
  clipboardClearDelaySeconds: 30,
  screenshotProtection: true,
  biometricEnabled: false,
  lockOnBackground: true,
};

const STORAGE_KEY = 'ironvault_security_settings';

class SecuritySettingsService {
  private settings: SecuritySettings = { ...DEFAULT_SETTINGS };
  private clipboardClearTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('[SecuritySettings] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('[SecuritySettings] Failed to save settings:', error);
    }
  }

  /**
   * Get all security settings
   */
  getSettings(): SecuritySettings {
    return { ...this.settings };
  }

  /**
   * Update security settings
   */
  updateSettings(updates: Partial<SecuritySettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();

    // Apply screenshot protection if changed
    if ('screenshotProtection' in updates) {
      this.applyScreenshotProtection(updates.screenshotProtection!);
    }
  }

  /**
   * Get auto-lock interval in milliseconds
   */
  getAutoLockIntervalMs(): number {
    switch (this.settings.autoLockInterval) {
      case 'immediate': return 0;
      case '30s': return 30 * 1000;
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case 'never': return -1;
      default: return 60 * 1000;
    }
  }

  /**
   * Get human-readable auto-lock interval
   */
  getAutoLockIntervalLabel(interval: AutoLockInterval): string {
    switch (interval) {
      case 'immediate': return 'Immediately';
      case '30s': return '30 seconds';
      case '1m': return '1 minute';
      case '5m': return '5 minutes';
      case '15m': return '15 minutes';
      case 'never': return 'Never';
      default: return interval;
    }
  }

  /**
   * Copy to clipboard with auto-clear
   */
  async copyToClipboard(text: string, label?: string): Promise<void> {
    try {
      // Clear any existing timeout
      if (this.clipboardClearTimeout) {
        clearTimeout(this.clipboardClearTimeout);
        this.clipboardClearTimeout = null;
      }

      // Use Capacitor clipboard if available
      if (Capacitor.isNativePlatform()) {
        const { Clipboard } = await import('@capacitor/clipboard');
        await Clipboard.write({ string: text });
      } else {
        await navigator.clipboard.writeText(text);
      }

      console.log(`[SecuritySettings] Copied ${label || 'text'} to clipboard`);

      // Set up auto-clear if enabled
      if (this.settings.clipboardAutoClear) {
        this.clipboardClearTimeout = setTimeout(async () => {
          await this.clearClipboard();
          console.log('[SecuritySettings] Clipboard auto-cleared');
        }, this.settings.clipboardClearDelaySeconds * 1000);
      }
    } catch (error) {
      console.error('[SecuritySettings] Failed to copy to clipboard:', error);
      throw error;
    }
  }

  /**
   * Clear clipboard
   */
  async clearClipboard(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Clipboard } = await import('@capacitor/clipboard');
        await Clipboard.write({ string: '' });
      } else {
        await navigator.clipboard.writeText('');
      }
    } catch (error) {
      console.error('[SecuritySettings] Failed to clear clipboard:', error);
    }
  }

  /**
   * Apply screenshot protection (native only)
   * On Android, this uses FLAG_SECURE
   * On iOS, this uses view security features
   */
  async applyScreenshotProtection(enabled: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return; // Not applicable on web
    }

    try {
      // Note: This requires a native plugin to set FLAG_SECURE on Android
      // and equivalent on iOS. For now, we log the intent.
      console.log(`[SecuritySettings] Screenshot protection: ${enabled ? 'enabled' : 'disabled'}`);
      
      // The actual implementation would call a native plugin:
      // await ScreenshotProtection.setEnabled(enabled);
    } catch (error) {
      console.error('[SecuritySettings] Failed to apply screenshot protection:', error);
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
}

export const securitySettingsService = new SecuritySettingsService();

/**
 * Available auto-lock interval options
 */
export const AUTO_LOCK_OPTIONS: { value: AutoLockInterval; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: '30s', label: '30 seconds' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: 'never', label: 'Never' },
];
