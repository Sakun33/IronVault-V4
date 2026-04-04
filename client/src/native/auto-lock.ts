/**
 * Auto-Lock Service
 * Automatically locks the vault when the app goes to background
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

type LockCallback = () => void;

class AutoLockService {
  private static instance: AutoLockService;
  private lockCallback: LockCallback | null = null;
  private isEnabled: boolean = true;
  private initialized: boolean = false;
  private lastBackgroundTime: number = 0;
  private gracePeriodMs: number = 0; // Immediate lock by default
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
          console.log('[AutoLock] App went to background');
          
          if (this.isEnabled && this.gracePeriodMs === 0) {
            // Immediate lock
            this.triggerLock();
          }
        } else {
          // App came to foreground
          console.log('[AutoLock] App came to foreground');
          
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
        console.log('[AutoLock] App paused');
        this.lastBackgroundTime = Date.now();
        
        if (this.isEnabled && this.gracePeriodMs === 0) {
          this.triggerLock();
        }
      });

      App.addListener('resume', () => {
        console.log('[AutoLock] App resumed');
        
        if (this.isEnabled && this.gracePeriodMs > 0) {
          const timeInBackground = Date.now() - this.lastBackgroundTime;
          if (timeInBackground >= this.gracePeriodMs) {
            this.triggerLock();
          }
        }
      });
    } else {
      // Web: Use visibility change event
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.lastBackgroundTime = Date.now();
          console.log('[AutoLock] Tab hidden');
          
          if (this.isEnabled && this.gracePeriodMs === 0) {
            this.triggerLock();
          }
        } else {
          console.log('[AutoLock] Tab visible');
          
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
    console.log('[AutoLock] Service initialized, enabled:', this.isEnabled, 'idle timeout:', this.idleTimeoutMs, 'ms');
  }

  private triggerLock(): void {
    if (this.lockCallback) {
      console.log('[AutoLock] Triggering vault lock');
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
      this.gracePeriodMs = gracePeriod ? parseInt(gracePeriod, 10) : 0;
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

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
      document.addEventListener(event, this.boundResetIdle, { passive: true });
    });

    this.resetIdleTimer();
    console.log('[AutoLock] Idle detection started, timeout:', this.idleTimeoutMs, 'ms');
  }

  /**
   * Stop idle detection listeners
   */
  private stopIdleDetection(): void {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
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
      console.log('[AutoLock] Idle timeout reached, locking vault');
      this.triggerLock();
    }, this.idleTimeoutMs);
  }

  /**
   * Enable or disable auto-lock
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('autolock_enabled', enabled.toString());
    console.log('[AutoLock] Enabled:', enabled);
  }

  /**
   * Set grace period before locking (in milliseconds)
   * 0 = immediate lock when going to background
   */
  setGracePeriod(ms: number): void {
    this.gracePeriodMs = ms;
    localStorage.setItem('autolock_grace_period', ms.toString());
    console.log('[AutoLock] Grace period set to:', ms, 'ms');
  }

  /**
   * Set idle timeout (in milliseconds)
   * 0 = disable idle lock
   */
  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
    localStorage.setItem('autolock_idle_timeout', ms.toString());
    console.log('[AutoLock] Idle timeout set to:', ms, 'ms');

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
    console.log('[AutoLock] Idle detection enabled:', enabled);

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
