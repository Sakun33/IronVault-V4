/**
 * Auto-Lock Service
 * Automatically locks the vault when the app goes to background
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { isNoteEditing } from '@/lib/note-editing-guard';

type LockCallback = () => void;

class AutoLockService {
  private static instance: AutoLockService;
  private lockCallback: LockCallback | null = null;
  private isEnabled: boolean = true;
  private initialized: boolean = false;
  private lastBackgroundTime: number = 0;
  private gracePeriodMs: number = 30 * 1000; // 30-second grace period (prevents spurious locks from screen dim / app-switch on mobile)
  private idleTimeoutMs: number = 5 * 60 * 1000; // 5 minutes default
  private idleTimerId: ReturnType<typeof setTimeout> | null = null;
  private idleEnabled: boolean = true;
  private boundResetIdle: () => void;

  private constructor() {
    this.boundResetIdle = this.resetIdleTimer.bind(this);
  }

  static getInstance(): AutoLockService {
    if (!AutoLockService.instance) {
      AutoLockService.instance = new AutoLockService();
    }
    return AutoLockService.instance;
  }

  /**
   * Initialize the auto-lock listener
   */
  async init(onLock: LockCallback): Promise<void> {
    this.lockCallback = onLock;

    if (this.initialized) return;
    
    // Load settings
    this.loadSettings();

    // Only add listeners on native platforms
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App went to background
          this.lastBackgroundTime = Date.now();
          
          if (this.isEnabled && this.gracePeriodMs === 0) {
            // Immediate lock
            this.triggerLock();
          }
        } else {
          // App came to foreground
          
          if (this.isEnabled && this.gracePeriodMs > 0) {
            // Check if grace period has passed
            const timeInBackground = Date.now() - this.lastBackgroundTime;
            if (timeInBackground >= this.gracePeriodMs) {
              this.triggerLock();
            }
          }
        }
      });

      // Also handle when app is paused/resumed
      App.addListener('pause', () => {
        this.lastBackgroundTime = Date.now();
        
        if (this.isEnabled && this.gracePeriodMs === 0) {
          this.triggerLock();
        }
      });

      App.addListener('resume', () => {
        
        if (this.isEnabled && this.gracePeriodMs > 0) {
          const timeInBackground = Date.now() - this.lastBackgroundTime;
          if (timeInBackground >= this.gracePeriodMs) {
            this.triggerLock();
          }
        }
      });
    } else {
      // Web: Use visibility change event with grace period only.
      // Do NOT lock immediately on hide (gracePeriodMs === 0 path is skipped on web)
      // to prevent spurious locks from screen dim / OS-level app-switch on mobile browsers.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.lastBackgroundTime = Date.now();
          // On web we always wait for the grace period; immediate lock is native-only.
        } else {
          // Reset idle timer so returning to the tab doesn't count as idle time.
          this.resetIdleTimer();

          if (this.isEnabled && this.gracePeriodMs > 0) {
            const timeHidden = Date.now() - this.lastBackgroundTime;
            if (timeHidden >= this.gracePeriodMs) {
              this.triggerLock();
            }
          }
        }
      });
    }

    // Start idle inactivity timer
    this.startIdleDetection();

    this.initialized = true;
  }

  private triggerLock(): void {
    // Hard guard: never auto-lock while the user is actively editing a note.
    // Idle/visibility/background events can fire even when the user is mid-
    // sentence (contentEditable inputs don't always reset every event we
    // listen for, especially on iOS Safari), and locking the vault closes
    // the editor and discards in-flight work.
    if (isNoteEditing()) {
      console.debug('[AutoLock] Skipping lock — note editor is open');
      // Reset the idle timer so we re-check after the editor closes.
      this.resetIdleTimer();
      return;
    }
    if (this.lockCallback) {
      this.lockCallback();
    }
  }

  private loadSettings(): void {
    try {
      const enabled = localStorage.getItem('autolock_enabled');
      const gracePeriod = localStorage.getItem('autolock_grace_period');
      const idleTimeout = localStorage.getItem('autolock_idle_timeout');
      const idleEnabled = localStorage.getItem('autolock_idle_enabled');
      
      this.isEnabled = enabled !== 'false'; // Enabled by default
      this.gracePeriodMs = gracePeriod ? parseInt(gracePeriod, 10) : 30 * 1000;
      this.idleTimeoutMs = idleTimeout ? parseInt(idleTimeout, 10) : 5 * 60 * 1000;
      this.idleEnabled = idleEnabled !== 'false'; // Enabled by default
    } catch (error) {
      console.error('[AutoLock] Failed to load settings:', error);
    }
  }

  /**
   * Start listening for user activity to detect idle state
   */
  private startIdleDetection(): void {
    if (!this.idleEnabled) return;

    // 'input' is added so typing inside contentEditable surfaces (notes
    // editor, etc.) reliably resets the idle timer — keydown alone misses
    // some IME / autocomplete edit paths on iOS Safari.
    const events = ['mousedown', 'mousemove', 'keydown', 'input', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
      document.addEventListener(event, this.boundResetIdle, { passive: true });
    });

    this.resetIdleTimer();
  }

  /**
   * Stop idle detection listeners
   */
  private stopIdleDetection(): void {
    const events = ['mousedown', 'mousemove', 'keydown', 'input', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
      document.removeEventListener(event, this.boundResetIdle);
    });

    if (this.idleTimerId) {
      clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
  }

  /**
   * Reset the idle timer — called on every user interaction
   */
  private resetIdleTimer(): void {
    if (this.idleTimerId) {
      clearTimeout(this.idleTimerId);
    }

    if (!this.idleEnabled || this.idleTimeoutMs <= 0) return;

    this.idleTimerId = setTimeout(() => {
      this.triggerLock();
    }, this.idleTimeoutMs);
  }

  /**
   * Enable or disable auto-lock
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('autolock_enabled', enabled.toString());
  }

  /**
   * Set grace period before locking (in milliseconds)
   * 0 = immediate lock when going to background
   */
  setGracePeriod(ms: number): void {
    this.gracePeriodMs = ms;
    localStorage.setItem('autolock_grace_period', ms.toString());
  }

  /**
   * Set idle timeout (in milliseconds)
   * 0 = disable idle lock
   */
  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
    localStorage.setItem('autolock_idle_timeout', ms.toString());

    // Restart idle timer with new timeout
    if (this.initialized) {
      this.resetIdleTimer();
    }
  }

  /**
   * Enable or disable idle lock
   */
  setIdleEnabled(enabled: boolean): void {
    this.idleEnabled = enabled;
    localStorage.setItem('autolock_idle_enabled', enabled.toString());

    if (enabled && this.initialized) {
      this.startIdleDetection();
    } else {
      this.stopIdleDetection();
    }
  }

  /**
   * Check if idle lock is enabled
   */
  isIdleEnabled(): boolean {
    return this.idleEnabled;
  }

  /**
   * Get current idle timeout
   */
  getIdleTimeout(): number {
    return this.idleTimeoutMs;
  }

  /**
   * Check if auto-lock is enabled
   */
  isAutoLockEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current grace period
   */
  getGracePeriod(): number {
    return this.gracePeriodMs;
  }

  /**
   * Cleanup — remove all listeners
   */
  destroy(): void {
    this.stopIdleDetection();
    this.initialized = false;
    this.lockCallback = null;
  }
}

export const autoLockService = AutoLockService.getInstance();
