// Cloud Sync Service for IronVault
// Handles encrypted data synchronization to cloud endpoints
// Maintains zero-knowledge architecture

import { PrivacyPreservingAnalytics } from './privacy-preserving-analytics';
import { EncryptedSupportTickets } from './encrypted-support-tickets';

export interface SyncConfig {
  enabled: boolean;
  endpoint: string;
  interval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  batchSize: number;
}

export interface SyncStatus {
  isEnabled: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: 'success' | 'error' | 'pending' | 'idle';
  pendingRecords: number;
  errorMessage: string | null;
  nextSyncTime: string | null;
}

export interface SyncPayload {
  analytics: any; // EncryptedAnalyticsRecord
  reports: any[]; // EncryptedTicketRecord[]
  metadata: {
    timestamp: string;
    version: string;
    deviceId: string;
    recordCount: number;
  };
}

export class CloudSyncService {
  private config: SyncConfig;
  private status: SyncStatus;
  private syncInterval: NodeJS.Timeout | null = null;
  private analytics: PrivacyPreservingAnalytics;
  private supportTickets: EncryptedSupportTickets;
  private deviceId: string;

  constructor(config: SyncConfig = {
    enabled: false,
    endpoint: 'https://api.securevault.com/sync',
    interval: 12 * 60 * 60 * 1000, // 12 hours
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 100
  }) {
    this.config = config;
    this.analytics = new PrivacyPreservingAnalytics();
    this.supportTickets = new EncryptedSupportTickets();
    this.deviceId = this.generateDeviceId();
    
    this.status = {
      isEnabled: config.enabled,
      lastSyncTime: null,
      lastSyncStatus: 'idle',
      pendingRecords: 0,
      errorMessage: null,
      nextSyncTime: null
    };

    this.initialize();
  }

  /**
   * Initialize sync service
   */
  private async initialize(): Promise<void> {
    if (this.config.enabled) {
      await this.startSync();
    }
    
    // Load saved status
    const savedStatus = localStorage.getItem('cloud-sync-status');
    if (savedStatus) {
      try {
        const parsed = JSON.parse(savedStatus);
        this.status = { ...this.status, ...parsed };
      } catch (error) {
        console.error('Failed to load sync status:', error);
      }
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('securevault-device-id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('securevault-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * Start automatic sync
   */
  async startSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.config.enabled = true;
    this.status.isEnabled = true;
    this.updateNextSyncTime();

    // Initial sync
    await this.performSync();

    // Set up interval
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.config.interval);

    this.saveStatus();
  }

  /**
   * Stop automatic sync
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.config.enabled = false;
    this.status.isEnabled = false;
    this.status.nextSyncTime = null;
    this.saveStatus();
  }

  /**
   * Perform manual sync
   */
  async performSync(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    this.status.lastSyncStatus = 'pending';
    this.saveStatus();

    try {
      // Prepare sync payload
      const payload = await this.prepareSyncPayload();
      
      if (!payload) {
        this.status.lastSyncStatus = 'success';
        this.status.lastSyncTime = new Date().toISOString();
        this.saveStatus();
        return true;
      }

      // Send to cloud endpoint
      const success = await this.sendToCloud(payload);
      
      if (success) {
        this.status.lastSyncStatus = 'success';
        this.status.lastSyncTime = new Date().toISOString();
        this.status.errorMessage = null;
        this.updateNextSyncTime();
      } else {
        this.status.lastSyncStatus = 'error';
        this.status.errorMessage = 'Sync failed';
      }

      this.saveStatus();
      return success;

    } catch (error) {
      console.error('Sync failed:', error);
      this.status.lastSyncStatus = 'error';
      this.status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.saveStatus();
      return false;
    }
  }

  /**
   * Prepare encrypted sync payload
   */
  private async prepareSyncPayload(): Promise<SyncPayload | null> {
    try {
      // Get analytics data
      const analytics = await this.analytics.getAnalytics();
      const reports = await this.supportTickets.getAllTickets();

      if (!analytics && reports.length === 0) {
        return null; // Nothing to sync
      }

      // Encrypt analytics
      const analyticsEncrypted = analytics ? await this.analytics.encryptAnalytics(analytics) : null;

      // Encrypt reports
      const reportsEncrypted: any[] = [];
      for (const report of reports) {
        const encrypted = await this.supportTickets.encryptTicket(report);
        reportsEncrypted.push(encrypted);
      }

      return {
        analytics: analyticsEncrypted,
        reports: reportsEncrypted,
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          deviceId: this.deviceId,
          recordCount: reportsEncrypted.length
        }
      };

    } catch (error) {
      console.error('Failed to prepare sync payload:', error);
      throw new Error('Payload preparation failed');
    }
  }

  /**
   * Send encrypted payload to cloud
   */
  private async sendToCloud(payload: SyncPayload): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < this.config.retryAttempts) {
      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': this.deviceId,
            'X-Sync-Version': '1.0.0'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          return true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        attempts++;
        console.error(`Sync attempt ${attempts} failed:`, error);
        
        if (attempts < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        } else {
          throw error;
        }
      }
    }

    return false;
  }

  /**
   * Update next sync time
   */
  private updateNextSyncTime(): void {
    if (this.config.enabled) {
      const nextSync = new Date(Date.now() + this.config.interval);
      this.status.nextSyncTime = nextSync.toISOString();
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save sync status to localStorage
   */
  private saveStatus(): void {
    try {
      localStorage.setItem('cloud-sync-status', JSON.stringify(this.status));
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    const wasEnabled = this.config.enabled;
    
    this.config = { ...this.config, ...newConfig };
    
    if (wasEnabled && !this.config.enabled) {
      this.stopSync();
    } else if (!wasEnabled && this.config.enabled) {
      this.startSync();
    } else if (this.config.enabled && this.config.interval !== newConfig.interval) {
      // Restart with new interval
      this.stopSync();
      this.startSync();
    }
  }

  /**
   * Test cloud endpoint connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        deviceId: this.deviceId
      };

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': this.deviceId,
          'X-Test-Mode': 'true'
        },
        body: JSON.stringify(testPayload)
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalRecords: number;
    lastSyncTime: string | null;
    syncFrequency: string;
    deviceId: string;
    endpoint: string;
  }> {
      const analytics = await this.analytics.getAnalytics();
      const reports = await this.supportTickets.getAllTickets();
    
    return {
      totalRecords: reports.length + (analytics ? 1 : 0),
      lastSyncTime: this.status.lastSyncTime,
      syncFrequency: this.formatInterval(this.config.interval),
      deviceId: this.deviceId,
      endpoint: this.config.endpoint
    };
  }

  /**
   * Format interval for display
   */
  private formatInterval(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Clear all sync data
   */
  async clearSyncData(): Promise<void> {
    try {
      // Clear analytics
      await this.analytics.clearAnalytics();
      
      // Reset status
      this.status = {
        isEnabled: false,
        lastSyncTime: null,
        lastSyncStatus: 'idle',
        pendingRecords: 0,
        errorMessage: null,
        nextSyncTime: null
      };
      
      this.saveStatus();
    } catch (error) {
      console.error('Failed to clear sync data:', error);
      throw new Error('Sync data clearing failed');
    }
  }

  /**
   * Export sync configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      status: this.status,
      deviceId: this.deviceId
    }, null, 2);
  }

  /**
   * Import sync configuration
   */
  importConfig(configJson: string): boolean {
    try {
      const data = JSON.parse(configJson);
      
      if (data.config) {
        this.updateConfig(data.config);
      }
      
      if (data.status) {
        this.status = { ...this.status, ...data.status };
        this.saveStatus();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import sync config:', error);
      return false;
    }
  }
}

// Singleton instance
export const cloudSyncService = new CloudSyncService();
