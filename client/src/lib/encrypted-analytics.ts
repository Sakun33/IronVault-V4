// Encrypted Analytics System for IronVault
// Implements AES-256-GCM encryption with PBKDF2 key derivation
// Follows OWASP guidelines for secure data storage

// Note: Using Web Crypto API directly in browser environment

export interface AnalyticsData {
  totalInstalls: number;
  dailyActiveUsers: Record<string, number>; // date -> count
  sectionUsage: Record<string, number>; // section -> count
  appVisits: number;
  platformInfo: {
    os: string;
    browser: string;
    version: string;
  };
  licenseInfo: {
    freeCount: number;
    proCount: number;
    lifetimeCount: number;
    totalRevenue: number;
  };
  lastUpdated: string;
}

export interface UserReport {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  vaultVersion: string;
  platform: string;
  featureContext: string;
  errorStack?: string;
  screenshot?: string;
  logs?: string;
  status: 'pending' | 'resolved' | 'escalated';
  resolvedIn?: string; // version when resolved
}

export interface EncryptedRecord {
  iv: string; // base64 encoded IV
  ciphertext: string; // base64 encoded encrypted data
  tag: string; // base64 encoded auth tag
  timestamp: string;
}

export class EncryptedAnalytics {
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
    // Generate a random salt for key derivation
    this.keyDerivationParams.salt = crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Derive encryption key from master password using PBKDF2
   * Follows OWASP guidelines for key derivation
   */
  async deriveKey(masterPassword: string): Promise<void> {
    try {
      const passwordBuffer = new TextEncoder().encode(masterPassword);
      
      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Derive AES-GCM key
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
   * Encrypt data using AES-256-GCM
   * Each record gets a unique IV for security
   */
  async encrypt(data: any): Promise<EncryptedRecord> {
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
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * Verifies authentication tag for integrity
   */
  async decrypt(encryptedRecord: EncryptedRecord): Promise<any> {
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
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Store encrypted analytics data in IndexedDB
   */
  async storeAnalytics(analytics: AnalyticsData): Promise<void> {
    try {
      const encrypted = await this.encrypt(analytics);
      
      // Store in IndexedDB meta_v3.analytics
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
   * Retrieve and decrypt analytics data from IndexedDB
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

      return await this.decrypt(result.value);
    } catch (error) {
      console.error('Failed to retrieve analytics:', error);
      return null;
    }
  }

  /**
   * Store encrypted user report in IndexedDB
   */
  async storeUserReport(report: UserReport): Promise<void> {
    try {
      const encrypted = await this.encrypt(report);
      
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      // Get existing reports array
      const existing = await new Promise<any>((resolve, reject) => {
        const request = store.get('userReports');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const reports = existing ? await this.decrypt(existing.value) : [];
      
      // Add new report
      reports.push(encrypted);
      
      // Store updated array
      await store.put({
        key: 'userReports',
        value: await this.encrypt(reports),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store user report:', error);
      throw new Error('User report storage failed');
    }
  }

  /**
   * Retrieve and decrypt all user reports from IndexedDB
   */
  async getUserReports(): Promise<UserReport[]> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readonly');
      const store = transaction.objectStore('meta_v3');
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get('userReports');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!result) {
        return [];
      }

      const encryptedReports = await this.decrypt(result.value);
      const reports: UserReport[] = [];
      
      // Decrypt each report
      for (const encryptedReport of encryptedReports) {
        try {
          const report = await this.decrypt(encryptedReport);
          reports.push(report);
        } catch (error) {
          console.error('Failed to decrypt report:', error);
        }
      }

      return reports;
    } catch (error) {
      console.error('Failed to retrieve user reports:', error);
      return [];
    }
  }

  /**
   * Update report status (resolve/escalate)
   */
  async updateReportStatus(reportId: string, status: 'resolved' | 'escalated', resolvedIn?: string): Promise<void> {
    try {
      const reports = await this.getUserReports();
      const reportIndex = reports.findIndex(r => r.id === reportId);
      
      if (reportIndex === -1) {
        throw new Error('Report not found');
      }

      reports[reportIndex].status = status;
      if (resolvedIn) {
        reports[reportIndex].resolvedIn = resolvedIn;
      }

      // Re-encrypt and store
      const encrypted = await this.encrypt(reports);
      
      const db = await this.openDatabase();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      await store.put({
        key: 'userReports',
        value: encrypted,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update report status:', error);
      throw new Error('Report status update failed');
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
        
        // Create meta_v3 store if it doesn't exist
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
}

// Singleton instance
export const encryptedAnalytics = new EncryptedAnalytics();
