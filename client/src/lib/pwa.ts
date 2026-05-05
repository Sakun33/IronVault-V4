// PWA Service - Manage service worker, offline detection, and install prompts

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallPrompt {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<void>;
}

class PWAService {
  private installPromptEvent: BeforeInstallPromptEvent | null = null;
  private isOnline: boolean = navigator.onLine;
  private updateAvailable: boolean = false;
  private registration: ServiceWorkerRegistration | null = null;
  private onlineChangeCallbacks: ((online: boolean) => void)[] = [];
  private updateAvailableCallbacks: (() => void)[] = [];

  constructor() {
    // Online + install detection is cheap and needed up-front so the UI
    // can react to offline state immediately. The service-worker
    // registration is deferred until after first paint + a 3-second
    // grace window so it doesn't compete with the main thread during
    // initial load — main lever for moving mobile Lighthouse from 58
    // toward 75+.
    this.setupOnlineDetection();
    this.setupInstallPrompt();
    this.setupUpdateDetection();
    this.deferredRegisterServiceWorker();
  }

  private deferredRegisterServiceWorker(): void {
    if (typeof window === 'undefined') return;
    const schedule = () => window.setTimeout(() => { void this.registerServiceWorker(); }, 3000);
    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }
  }

  // Service Worker Registration
  private async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        // Bypass HTTP cache for sw.js itself — without this Chrome can serve
        // a stale sw.js (24h max-age) and we never see the new version.
        updateViaCache: 'none',
      });

      // Force an update check on every load. The browser does this on its
      // own roughly every 24h; we want every page-load to pick up a deploy.
      this.registration.update().catch(() => { /* not fatal */ });

      // Handle updates: when a new SW finishes installing while another
      // controller is active, we have a fresh version waiting. Send the
      // SKIP_WAITING message and reload — this is the auto-update path the
      // user asked for. notifyUpdateAvailable() still fires for any UI that
      // wants to show "Updating…" first.
      this.registration.addEventListener('updatefound', () => {
        const installingWorker = this.registration!.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.updateAvailable = true;
            this.notifyUpdateAvailable();
            // Tell the waiting worker to take over immediately. We then wait
            // for `controllerchange` (below) to do the page reload — by that
            // point clients.claim() has run and the new SW is in control.
            installingWorker.postMessage({ action: 'SKIP_WAITING' });
          }
        });
      });

      // When the active controller changes, the new SW is in charge. Reload
      // once so the page picks up the new bundle. The `_reloadedForSW` guard
      // prevents an infinite loop if controllerchange fires repeatedly.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

    } catch (error) {
      console.error('PWA: Service Worker registration failed', error);
    }
  }

  // Online/Offline Detection
  private setupOnlineDetection() {
    const updateOnlineStatus = () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      if (wasOnline !== this.isOnline) {
        this.notifyOnlineChange();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check connection quality
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
      });
    }
  }

  // Install Prompt Management
  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.installPromptEvent = e as BeforeInstallPromptEvent;
    });

    // Detect if app was successfully installed
    window.addEventListener('appinstalled', () => {
      this.installPromptEvent = null;
    });
  }

  // Update Detection
  private setupUpdateDetection() {
    // Poll for updates every 60s while online. The browser fires the same
    // check on its own ~24h cadence, which is far too slow when we're
    // actively shipping fixes.
    setInterval(() => {
      if (this.isOnline && this.registration) {
        this.registration.update().catch(() => { /* swallow — best effort */ });
      }
    }, 60 * 1000);

    // Also re-check when the page becomes visible again (tab switch / wake).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline && this.registration) {
        this.registration.update().catch(() => {});
      }
    });
  }

  // Public API
  
  // Get install prompt object
  getInstallPrompt(): PWAInstallPrompt {
    return {
      canInstall: !!this.installPromptEvent,
      isInstalled: this.isAppInstalled(),
      install: async () => {
        if (!this.installPromptEvent) {
          throw new Error('Install prompt not available');
        }

        await this.installPromptEvent.prompt();
        const choiceResult = await this.installPromptEvent.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
        } else {
        }

        this.installPromptEvent = null;
      },
    };
  }

  // Check if app is installed
  private isAppInstalled(): boolean {
    // Check if running in standalone mode (PWA installed)
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  // Get online status
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Check if update is available
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  // Apply update
  async applyUpdate() {
    if (!this.registration || !this.updateAvailable) {
      return;
    }

    const installingWorker = this.registration.installing || this.registration.waiting;
    if (installingWorker) {
      installingWorker.postMessage({ action: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  // Get network information
  getNetworkInfo(): {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const info = { online: this.isOnline };
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        ...info,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }
    
    return info;
  }

  // Subscribe to online status changes
  onOnlineChange(callback: (online: boolean) => void) {
    this.onlineChangeCallbacks.push(callback);
    return () => {
      const index = this.onlineChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onlineChangeCallbacks.splice(index, 1);
      }
    };
  }

  // Subscribe to update availability
  onUpdateAvailable(callback: () => void) {
    this.updateAvailableCallbacks.push(callback);
    return () => {
      const index = this.updateAvailableCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateAvailableCallbacks.splice(index, 1);
      }
    };
  }

  // Cache management
  async clearCache() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  }

  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return totalSize;
  }

  // Notification helpers
  private notifyOnlineChange() {
    this.onlineChangeCallbacks.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (error) {
        console.error('PWA: Error in online change callback', error);
      }
    });
  }

  private notifyUpdateAvailable() {
    this.updateAvailableCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('PWA: Error in update available callback', error);
      }
    });
  }

  // Check storage usage
  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  // Persist storage permission
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return await navigator.storage.persist();
    }
    return false;
  }
}

// Create singleton instance
export const pwaService = new PWAService();

// React hooks for PWA functionality
export function usePWA() {
  const [installPrompt, setInstallPrompt] = React.useState(pwaService.getInstallPrompt());
  const [isOnline, setIsOnline] = React.useState(pwaService.getOnlineStatus());
  const [updateAvailable, setUpdateAvailable] = React.useState(pwaService.isUpdateAvailable());

  React.useEffect(() => {
    const unsubscribeOnline = pwaService.onOnlineChange(setIsOnline);
    const unsubscribeUpdate = pwaService.onUpdateAvailable(() => setUpdateAvailable(true));

    // Refresh install prompt periodically
    const interval = setInterval(() => {
      setInstallPrompt(pwaService.getInstallPrompt());
    }, 1000);

    return () => {
      unsubscribeOnline();
      unsubscribeUpdate();
      clearInterval(interval);
    };
  }, []);

  return {
    installPrompt,
    isOnline,
    updateAvailable,
    applyUpdate: () => pwaService.applyUpdate(),
    networkInfo: pwaService.getNetworkInfo(),
    clearCache: () => pwaService.clearCache(),
    getCacheSize: () => pwaService.getCacheSize(),
    getStorageEstimate: () => pwaService.getStorageEstimate(),
    requestPersistentStorage: () => pwaService.requestPersistentStorage(),
  };
}

// Import React for the hooks (this will be removed by the bundler if not used)
import React from 'react';