// Analytics Collection System for IronVault
// Collects aggregated, non-PII usage metrics
// Follows privacy-by-design principles

import { encryptedAnalytics, AnalyticsData, UserReport } from './encrypted-analytics';

export interface UsageEvent {
  type: 'app_launch' | 'vault_unlock' | 'section_access' | 'feature_usage' | 'license_upgrade';
  section?: string;
  feature?: string;
  metadata?: Record<string, any>;
}

export interface PlatformInfo {
  os: string;
  browser: string;
  version: string;
  userAgent: string;
}

export class AnalyticsCollector {
  private isInitialized = false;
  private currentAnalytics: AnalyticsData | null = null;
  private readonly STORAGE_KEY = 'analytics';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize analytics collection
   */
  private async initialize(): Promise<void> {
    try {
      // Load existing analytics or create new
      this.currentAnalytics = await encryptedAnalytics.getAnalytics();
      
      if (!this.currentAnalytics) {
        this.currentAnalytics = this.createDefaultAnalytics();
        await this.saveAnalytics();
      }

      this.isInitialized = true;
      this.trackEvent({ type: 'app_launch' });
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  /**
   * Create default analytics structure
   */
  private createDefaultAnalytics(): AnalyticsData {
    return {
      totalInstalls: 1,
      dailyActiveUsers: {},
      sectionUsage: {
        passwords: 0,
        subscriptions: 0,
        notes: 0,
        expenses: 0,
        reminders: 0,
        bankStatements: 0,
        investments: 0
      },
      appVisits: 0,
      platformInfo: this.getPlatformInfo(),
      licenseInfo: {
        freeCount: 1,
        proCount: 0,
        lifetimeCount: 0,
        totalRevenue: 0
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get platform information (non-PII)
   */
  private getPlatformInfo(): PlatformInfo {
    const userAgent = navigator.userAgent;
    
    // Detect OS
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    // Detect Browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return {
      os,
      browser,
      version: this.getAppVersion(),
      userAgent: userAgent.substring(0, 100) // Truncate to avoid fingerprinting
    };
  }

  /**
   * Get app version from package.json or environment
   */
  private getAppVersion(): string {
    // In a real app, this would come from package.json or build process
    return '1.0.0';
  }

  /**
   * Track usage event
   */
  async trackEvent(event: UsageEvent): Promise<void> {
    if (!this.isInitialized || !this.currentAnalytics) {
      return;
    }

    try {
      switch (event.type) {
        case 'app_launch':
          this.currentAnalytics.appVisits++;
          break;

        case 'vault_unlock':
          this.trackDailyActiveUser();
          break;

        case 'section_access':
          if (event.section && this.currentAnalytics.sectionUsage[event.section] !== undefined) {
            this.currentAnalytics.sectionUsage[event.section]++;
          }
          break;

        case 'feature_usage':
          if (event.feature) {
            // Track feature usage in metadata
            if (!this.currentAnalytics.platformInfo) {
              this.currentAnalytics.platformInfo = this.getPlatformInfo();
            }
          }
          break;

        case 'license_upgrade':
          this.trackLicenseUpgrade(event.metadata);
          break;
      }

      this.currentAnalytics.lastUpdated = new Date().toISOString();
      await this.saveAnalytics();
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track daily active user
   */
  private trackDailyActiveUser(): void {
    if (!this.currentAnalytics) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.currentAnalytics.dailyActiveUsers[today] = (this.currentAnalytics.dailyActiveUsers[today] || 0) + 1;
  }

  /**
   * Track license upgrade
   */
  private trackLicenseUpgrade(metadata?: Record<string, any>): void {
    if (!this.currentAnalytics || !metadata) return;

    const { tier, amount } = metadata;
    
    switch (tier) {
      case 'pro':
        this.currentAnalytics.licenseInfo.proCount++;
        this.currentAnalytics.licenseInfo.freeCount = Math.max(0, this.currentAnalytics.licenseInfo.freeCount - 1);
        break;
      case 'lifetime':
        this.currentAnalytics.licenseInfo.lifetimeCount++;
        this.currentAnalytics.licenseInfo.freeCount = Math.max(0, this.currentAnalytics.licenseInfo.freeCount - 1);
        break;
    }

    if (amount && typeof amount === 'number') {
      this.currentAnalytics.licenseInfo.totalRevenue += amount;
    }
  }

  /**
   * Save analytics data (encrypted)
   */
  private async saveAnalytics(): Promise<void> {
    if (!this.currentAnalytics) return;

    try {
      await encryptedAnalytics.storeAnalytics(this.currentAnalytics);
    } catch (error) {
      console.error('Failed to save analytics:', error);
    }
  }

  /**
   * Get current analytics data
   */
  async getAnalytics(): Promise<AnalyticsData | null> {
    return await encryptedAnalytics.getAnalytics();
  }

  /**
   * Submit user report (encrypted)
   */
  async submitReport(reportData: {
    title: string;
    description: string;
    featureContext?: string;
    errorStack?: string;
    screenshot?: string;
    logs?: string;
  }): Promise<void> {
    try {
      const report: UserReport = {
        id: this.generateReportId(),
        title: reportData.title,
        description: reportData.description,
        timestamp: new Date().toISOString(),
        vaultVersion: this.getAppVersion(),
        platform: `${this.getPlatformInfo().os} ${this.getPlatformInfo().browser}`,
        featureContext: reportData.featureContext || 'general',
        errorStack: reportData.errorStack,
        screenshot: reportData.screenshot,
        logs: reportData.logs,
        status: 'pending'
      };

      await encryptedAnalytics.storeUserReport(report);
    } catch (error) {
      console.error('Failed to submit report:', error);
      throw new Error('Report submission failed');
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get user reports
   */
  async getUserReports(): Promise<UserReport[]> {
    return await encryptedAnalytics.getUserReports();
  }

  /**
   * Update report status
   */
  async updateReportStatus(reportId: string, status: 'resolved' | 'escalated', resolvedIn?: string): Promise<void> {
    await encryptedAnalytics.updateReportStatus(reportId, status, resolvedIn);
  }

  /**
   * Get analytics summary for display
   */
  getAnalyticsSummary(): {
    totalUsers: number;
    dailyActiveUsers: number;
    mostUsedSection: string;
    totalRevenue: number;
    platformBreakdown: Record<string, number>;
  } {
    if (!this.currentAnalytics) {
      return {
        totalUsers: 0,
        dailyActiveUsers: 0,
        mostUsedSection: 'passwords',
        totalRevenue: 0,
        platformBreakdown: {}
      };
    }

    const { sectionUsage, dailyActiveUsers, licenseInfo } = this.currentAnalytics;
    
    // Find most used section
    const mostUsedSection = Object.entries(sectionUsage)
      .reduce((max, [section, count]) => count > max.count ? { section, count } : max, { section: 'passwords', count: 0 })
      .section;

    // Calculate daily active users (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    });

    const recentActiveUsers = last7Days.reduce((sum, date) => sum + (dailyActiveUsers[date] || 0), 0);

    return {
      totalUsers: licenseInfo.freeCount + licenseInfo.proCount + licenseInfo.lifetimeCount,
      dailyActiveUsers: recentActiveUsers,
      mostUsedSection,
      totalRevenue: licenseInfo.totalRevenue,
      platformBreakdown: {
        [this.currentAnalytics.platformInfo.os]: 1
      }
    };
  }

  /**
   * Export analytics data (encrypted)
   */
  async exportAnalytics(): Promise<string> {
    const analytics = await this.getAnalytics();
    if (!analytics) {
      throw new Error('No analytics data available');
    }

    // Return encrypted data for export
    const encrypted = await encryptedAnalytics.encrypt(analytics);
    return JSON.stringify(encrypted, null, 2);
  }

  /**
   * Clear all analytics data
   */
  async clearAnalytics(): Promise<void> {
    try {
      const db = await encryptedAnalytics['openDatabase']();
      const transaction = db.transaction(['meta_v3'], 'readwrite');
      const store = transaction.objectStore('meta_v3');
      
      await store.delete('analytics');
      await store.delete('userReports');
      
      this.currentAnalytics = this.createDefaultAnalytics();
      await this.saveAnalytics();
    } catch (error) {
      console.error('Failed to clear analytics:', error);
      throw new Error('Analytics clearing failed');
    }
  }
}

// Singleton instance
export const analyticsCollector = new AnalyticsCollector();
