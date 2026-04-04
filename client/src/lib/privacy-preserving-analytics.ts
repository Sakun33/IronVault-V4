// Privacy-Preserving Metrics Collection System
// Collects only aggregate metadata (counts and usage stats) - no user content
// All data encrypted with AES-256-GCM before storage

export interface SectionMetrics {
  total: number;
  added: number;
  deleted: number;
  lastModified: string;
}

export interface AppMetrics {
  appLaunches: number;
  dailyUnlocks: Record<string, number>; // date -> count
  lastLaunch: string;
  lastUnlock: string;
}

export interface PlatformInfo {
  os: string;
  browser: string;
  version: string;
  userAgent: string; // truncated for privacy
}

export interface LicenseInfo {
  plan: 'free' | 'pro' | 'lifetime';
  activatedAt: string;
  expiresAt?: string;
  revenue: number;
}

export interface AnalyticsData {
  sections: {
    passwords: SectionMetrics;
    subscriptions: SectionMetrics;
    notes: SectionMetrics;
    expenses: SectionMetrics;
    reminders: SectionMetrics;
    bankStatements: SectionMetrics;
    investments: SectionMetrics;
  };
  app: AppMetrics;
  platform: PlatformInfo;
  license: LicenseInfo;
  lastUpdated: string;
  version: string;
}

export interface EncryptedAnalyticsRecord {
  iv: string; // base64 encoded IV
  ciphertext: string; // base64 encoded encrypted data
  tag: string; // base64 encoded auth tag
  timestamp: string;
  version: string;
}

export class PrivacyPreservingAnalytics {
  private key: CryptoKey | null = null;
  private readonly keyDerivationParams = {
    name: 'PBKDF2',
    salt: new Uint8Array(16), // Will be generated
    iterations: 100000, // OWASP recommended minimum
    hash: 'SHA-256'
  };

  constructor() {
    this.generateSalt();
  }

  private generateSalt(): void {
    this.keyDerivationParams.salt = crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Derive encryption key from master password using PBKDF2
   * Follows NIST guidelines for key derivation
   */
  async deriveKey(masterPassword: string): Promise<void> {
    try {
      const passwordBuffer = new TextEncoder().encode(masterPassword);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      this.key = await crypto.subtle.deriveKey(
        this.keyDerivationParams,
        keyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to derive encryption key:', error);
      throw new Error('Key derivation failed');
    }
  }

  /**
   * Encrypt analytics data using AES-256-GCM
   * Each record gets a unique IV for security
   */
  async encryptAnalytics(data: AnalyticsData): Promise<EncryptedAnalyticsRecord> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const dataBuffer = new TextEncoder().encode(JSON.stringify(data));
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        dataBuffer
      );

      // Extract ciphertext and auth tag
      const ciphertext = new Uint8Array(encrypted.slice(0, -16));
      const tag = new Uint8Array(encrypted.slice(-16));

      return {
        iv: this.arrayBufferToBase64(iv),
        ciphertext: this.arrayBufferToBase64(ciphertext),
        tag: this.arrayBufferToBase64(tag),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Analytics encryption failed:', error);
      throw new Error('Analytics encryption failed');
    }
  }

  /**
   * Decrypt analytics data using AES-256-GCM
   * Verifies authentication tag for integrity
   */
  async decryptAnalytics(encryptedRecord: EncryptedAnalyticsRecord): Promise<AnalyticsData> {
    if (!this.key) {
      throw new Error('Encryption key not derived');
    }

    try {
      const iv = this.base64ToArrayBuffer(encryptedRecord.iv);
      const ciphertext = this.base64ToArrayBuffer(encryptedRecord.ciphertext);
      const tag = this.base64ToArrayBuffer(encryptedRecord.tag);

      // Combine ciphertext and tag
      const encryptedData = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      encryptedData.set(new Uint8Array(ciphertext), 0);
      encryptedData.set(new Uint8Array(tag), ciphertext.byteLength);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        encryptedData
      );

      const decryptedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Analytics decryption failed:', error);
      throw new Error('Analytics decryption failed');
    }
  }

  /**
   * Create default analytics structure with zero counts
   */
  createDefaultAnalytics(): AnalyticsData {
    const now = new Date().toISOString();
    
    return {
      sections: {
        passwords: { total: 0, added: 0, deleted: 0, lastModified: now },
        subscriptions: { total: 0, added: 0, deleted: 0, lastModified: now },
        notes: { total: 0, added: 0, deleted: 0, lastModified: now },
        expenses: { total: 0, added: 0, deleted: 0, lastModified: now },
        reminders: { total: 0, added: 0, deleted: 0, lastModified: now },
        bankStatements: { total: 0, added: 0, deleted: 0, lastModified: now },
        investments: { total: 0, added: 0, deleted: 0, lastModified: now }
      },
      app: {
        appLaunches: 0,
        dailyUnlocks: {},
        lastLaunch: now,
        lastUnlock: now
      },
      platform: this.getPlatformInfo(),
      license: {
        plan: 'free',
        activatedAt: now,
        revenue: 0
      },
      lastUpdated: now,
      version: '1.0.0'
    };
  }

  /**
   * Get platform information (privacy-preserving)
   */
  private getPlatformInfo(): PlatformInfo {
    const userAgent = navigator.userAgent;
    
    // Detect OS (no specific version for privacy)
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    // Detect Browser (no specific version for privacy)
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return {
      os,
      browser,
      version: '1.0.0', // App version, not OS version
      userAgent: userAgent.substring(0, 100) // Truncated for privacy
    };
  }

  /**
   * Store encrypted analytics in IndexedDB
   */
  async storeAnalytics(analytics: AnalyticsData): Promise<void> {
    try {
      const encrypted = await this.encryptAnalytics(analytics);
      
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      await store.put({
        key: 'analytics',
        value: encrypted,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store analytics:', error);
      throw new Error('Analytics storage failed');
    }
  }

  /**
   * Retrieve and decrypt analytics from IndexedDB
   */
  async getAnalytics(): Promise<AnalyticsData | null> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readonly');
      const store = transaction.objectStore('meta_v3');
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get('analytics');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!result) {
        return null;
      }

      return await this.decryptAnalytics(result.value);
    } catch (error) {
      console.error('Failed to retrieve analytics:', error);
      return null;
    }
  }

  /**
   * Update section metrics (privacy-preserving)
   */
  async updateSectionMetrics(section: keyof AnalyticsData['sections'], operation: 'add' | 'delete'): Promise<void> {
    try {
      let analytics = await this.getAnalytics();
      if (!analytics) {
        analytics = this.createDefaultAnalytics();
      }

      const now = new Date().toISOString();
      
      if (operation === 'add') {
        analytics.sections[section].total++;
        analytics.sections[section].added++;
      } else if (operation === 'delete') {
        analytics.sections[section].total = Math.max(0, analytics.sections[section].total - 1);
        analytics.sections[section].deleted++;
      }
      
      analytics.sections[section].lastModified = now;
      analytics.lastUpdated = now;

      await this.storeAnalytics(analytics);
    } catch (error) {
      console.error('Failed to update section metrics:', error);
    }
  }

  /**
   * Track app launch
   */
  async trackAppLaunch(): Promise<void> {
    try {
      let analytics = await this.getAnalytics();
      if (!analytics) {
        analytics = this.createDefaultAnalytics();
      }

      const now = new Date().toISOString();
      analytics.app.appLaunches++;
      analytics.app.lastLaunch = now;
      analytics.lastUpdated = now;

      await this.storeAnalytics(analytics);
    } catch (error) {
      console.error('Failed to track app launch:', error);
    }
  }

  /**
   * Track vault unlock (Daily Active Users)
   */
  async trackVaultUnlock(): Promise<void> {
    try {
      let analytics = await this.getAnalytics();
      if (!analytics) {
        analytics = this.createDefaultAnalytics();
      }

      const now = new Date().toISOString();
      const today = now.split('T')[0]; // YYYY-MM-DD
      
      analytics.app.dailyUnlocks[today] = (analytics.app.dailyUnlocks[today] || 0) + 1;
      analytics.app.lastUnlock = now;
      analytics.lastUpdated = now;

      await this.storeAnalytics(analytics);
    } catch (error) {
      console.error('Failed to track vault unlock:', error);
    }
  }

  /**
   * Update license information
   */
  async updateLicenseInfo(plan: 'free' | 'pro' | 'lifetime', revenue: number = 0): Promise<void> {
    try {
      let analytics = await this.getAnalytics();
      if (!analytics) {
        analytics = this.createDefaultAnalytics();
      }

      const now = new Date().toISOString();
      analytics.license.plan = plan;
      analytics.license.activatedAt = now;
      analytics.license.revenue += revenue;
      analytics.lastUpdated = now;

      await this.storeAnalytics(analytics);
    } catch (error) {
      console.error('Failed to update license info:', error);
    }
  }

  /**
   * Get analytics summary for display
   */
  async getAnalyticsSummary(): Promise<{
    totalRecords: number;
    dailyActiveUsers: number;
    mostUsedSection: string;
    licenseBreakdown: Record<string, number>;
    platformInfo: PlatformInfo;
  }> {
    try {
      const analytics = await this.getAnalytics();
      if (!analytics) {
        return {
          totalRecords: 0,
          dailyActiveUsers: 0,
          mostUsedSection: 'passwords',
          licenseBreakdown: { free: 1, pro: 0, lifetime: 0 },
          platformInfo: this.getPlatformInfo()
        };
      }

      // Calculate total records across all sections
      const totalRecords = Object.values(analytics.sections)
        .reduce((sum, section) => sum + section.total, 0);

      // Calculate daily active users (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const dailyActiveUsers = last7Days.reduce((sum, date) => 
        sum + (analytics.app.dailyUnlocks[date] || 0), 0);

      // Find most used section
      const mostUsedSection = Object.entries(analytics.sections)
        .reduce((max, [section, metrics]) => 
          metrics.total > max.total ? { section, total: metrics.total } : max,
          { section: 'passwords', total: 0 }
        ).section;

      return {
        totalRecords,
        dailyActiveUsers,
        mostUsedSection,
        licenseBreakdown: {
          free: analytics.license.plan === 'free' ? 1 : 0,
          pro: analytics.license.plan === 'pro' ? 1 : 0,
          lifetime: analytics.license.plan === 'lifetime' ? 1 : 0
        },
        platformInfo: analytics.platform
      };
    } catch (error) {
      console.error('Failed to get analytics summary:', error);
      return {
        totalRecords: 0,
        dailyActiveUsers: 0,
        mostUsedSection: 'passwords',
        licenseBreakdown: { free: 1, pro: 0, lifetime: 0 },
        platformInfo: this.getPlatformInfo()
      };
    }
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('vault_v3', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('meta_v3')) {
          const store = db.createObjectStore('meta_v3', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get salt for key derivation
   */
  getSalt(): string {
    return this.arrayBufferToBase64(this.keyDerivationParams.salt);
  }

  /**
   * Set salt for key derivation
   */
  setSalt(saltBase64: string): void {
    this.keyDerivationParams.salt = new Uint8Array(this.base64ToArrayBuffer(saltBase64));
  }

  /**
   * Clear all analytics data
   */
  async clearAnalytics(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      await store.delete('analytics');
    } catch (error) {
      console.error('Failed to clear analytics:', error);
      throw new Error('Analytics clearing failed');
    }
  }
}

// Singleton instance
export const privacyPreservingAnalytics = new PrivacyPreservingAnalytics();
