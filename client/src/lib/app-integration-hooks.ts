// App Integration Hooks
// Integrates privacy-preserving analytics and support tickets into IronVault
// Maintains zero-knowledge architecture while providing admin insights

import { PrivacyPreservingAnalytics } from './privacy-preserving-analytics';
import { EncryptedSupportTickets } from './encrypted-support-tickets';
import { SecureSyncTransport } from './secure-sync-transport';

export interface IntegrationConfig {
  analyticsEnabled: boolean;
  supportTicketsEnabled: boolean;
  syncEnabled: boolean;
  masterPassword: string;
  syncEndpoint?: string;
}

export interface VaultSection {
  name: string;
  displayName: string;
  icon: string;
}

export class AppIntegrationHooks {
  private analytics: PrivacyPreservingAnalytics;
  private supportTickets: EncryptedSupportTickets;
  private syncTransport: SecureSyncTransport;
  private config: IntegrationConfig;
  private isInitialized = false;

  // Define vault sections for tracking
  private readonly vaultSections: VaultSection[] = [
    { name: 'passwords', displayName: 'Passwords', icon: '🔐' },
    { name: 'subscriptions', displayName: 'Subscriptions', icon: '💳' },
    { name: 'notes', displayName: 'Notes', icon: '📝' },
    { name: 'expenses', displayName: 'Expenses', icon: '💰' },
    { name: 'reminders', displayName: 'Reminders', icon: '⏰' },
    { name: 'bankStatements', displayName: 'Bank Statements', icon: '🏦' },
    { name: 'investments', displayName: 'Investments', icon: '📈' }
  ];

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.analytics = new PrivacyPreservingAnalytics();
    this.supportTickets = new EncryptedSupportTickets();
    this.syncTransport = new SecureSyncTransport({
      enabled: config.syncEnabled,
      endpoint: config.syncEndpoint || 'https://api.securevault.com/sync',
      interval: 12 * 60 * 60 * 1000, // 12 hours
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      batchSize: 100,
      useTLS: true
    });
  }

  /**
   * Initialize integration with master password
   */
  async initialize(): Promise<void> {
    try {
      // Set up encryption for all services
      await this.analytics.deriveKey(this.config.masterPassword);
      await this.supportTickets.deriveKey(this.config.masterPassword);
      await this.syncTransport.setupEncryption(this.config.masterPassword);

      // Track app launch
      if (this.config.analyticsEnabled) {
        await this.analytics.trackAppLaunch();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize app integration:', error);
      throw new Error('Integration initialization failed');
    }
  }

  /**
   * Track vault unlock (Daily Active Users)
   */
  async trackVaultUnlock(): Promise<void> {
    if (!this.isInitialized || !this.config.analyticsEnabled) return;

    try {
      await this.analytics.trackVaultUnlock();
    } catch (error) {
      console.error('Failed to track vault unlock:', error);
    }
  }

  /**
   * Track section access
   */
  async trackSectionAccess(sectionName: string): Promise<void> {
    if (!this.isInitialized || !this.config.analyticsEnabled) return;

    // Validate section name
    const section = this.vaultSections.find(s => s.name === sectionName);
    if (!section) {
      return;
    }

    try {
      // This would be called when user navigates to a section
      // For now, we'll just log it
    } catch (error) {
      console.error('Failed to track section access:', error);
    }
  }

  /**
   * Track record creation
   */
  async trackRecordCreated(sectionName: string): Promise<void> {
    if (!this.isInitialized || !this.config.analyticsEnabled) return;

    const section = this.vaultSections.find(s => s.name === sectionName);
    if (!section) {
      return;
    }

    try {
      await this.analytics.updateSectionMetrics(sectionName as any, 'add');
    } catch (error) {
      console.error('Failed to track record creation:', error);
    }
  }

  /**
   * Track record deletion
   */
  async trackRecordDeleted(sectionName: string): Promise<void> {
    if (!this.isInitialized || !this.config.analyticsEnabled) return;

    const section = this.vaultSections.find(s => s.name === sectionName);
    if (!section) {
      return;
    }

    try {
      await this.analytics.updateSectionMetrics(sectionName as any, 'delete');
    } catch (error) {
      console.error('Failed to track record deletion:', error);
    }
  }

  /**
   * Track license upgrade
   */
  async trackLicenseUpgrade(plan: 'free' | 'pro' | 'lifetime', revenue: number = 0): Promise<void> {
    if (!this.isInitialized || !this.config.analyticsEnabled) return;

    try {
      await this.analytics.updateLicenseInfo(plan, revenue);
    } catch (error) {
      console.error('Failed to track license upgrade:', error);
    }
  }

  /**
   * Submit support ticket
   */
  async submitSupportTicket(ticketData: {
    title: string;
    description: string;
    category: 'bug' | 'feature' | 'performance' | 'ui' | 'other';
    priority: 'low' | 'medium' | 'high' | 'critical';
    featureContext?: string;
    errorStack?: string;
    logs?: string;
    screenshot?: string;
  }): Promise<string> {
    if (!this.isInitialized || !this.config.supportTicketsEnabled) {
      throw new Error('Support tickets not enabled');
    }

    try {
      return await this.supportTickets.submitTicket(ticketData);
    } catch (error) {
      console.error('Failed to submit support ticket:', error);
      throw new Error('Support ticket submission failed');
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary() {
    if (!this.isInitialized || !this.config.analyticsEnabled) {
      return null;
    }

    try {
      return await this.analytics.getAnalyticsSummary();
    } catch (error) {
      console.error('Failed to get analytics summary:', error);
      return null;
    }
  }

  /**
   * Get support ticket statistics
   */
  async getSupportTicketStats() {
    if (!this.isInitialized || !this.config.supportTicketsEnabled) {
      return null;
    }

    try {
      return await this.supportTickets.getTicketStats();
    } catch (error) {
      console.error('Failed to get support ticket stats:', error);
      return null;
    }
  }

  /**
   * Get all support tickets
   */
  async getAllSupportTickets() {
    if (!this.isInitialized || !this.config.supportTicketsEnabled) {
      return [];
    }

    try {
      return await this.supportTickets.getAllTickets();
    } catch (error) {
      console.error('Failed to get support tickets:', error);
      return [];
    }
  }

  /**
   * Update support ticket status
   */
  async updateSupportTicketStatus(ticketId: string, status: 'resolved' | 'escalated', resolvedIn?: string): Promise<void> {
    if (!this.isInitialized || !this.config.supportTicketsEnabled) {
      throw new Error('Support tickets not enabled');
    }

    try {
      await this.supportTickets.updateTicketStatus(ticketId, status, resolvedIn);
    } catch (error) {
      console.error('Failed to update support ticket status:', error);
      throw new Error('Support ticket status update failed');
    }
  }

  /**
   * Search support tickets
   */
  async searchSupportTickets(query: string) {
    if (!this.isInitialized || !this.config.supportTicketsEnabled) {
      return [];
    }

    try {
      return await this.supportTickets.searchTickets(query);
    } catch (error) {
      console.error('Failed to search support tickets:', error);
      return [];
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    if (!this.isInitialized || !this.config.syncEnabled) {
      return null;
    }

    try {
      return this.syncTransport.getStatus();
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return null;
    }
  }

  /**
   * Perform manual sync
   */
  async performSync(): Promise<boolean> {
    if (!this.isInitialized || !this.config.syncEnabled) {
      return false;
    }

    try {
      return await this.syncTransport.performSync();
    } catch (error) {
      console.error('Failed to perform sync:', error);
      return false;
    }
  }

  /**
   * Test sync connection
   */
  async testSyncConnection(): Promise<boolean> {
    if (!this.isInitialized || !this.config.syncEnabled) {
      return false;
    }

    try {
      return await this.syncTransport.testConnection();
    } catch (error) {
      console.error('Failed to test sync connection:', error);
      return false;
    }
  }

  /**
   * Update integration configuration
   */
  async updateConfig(newConfig: Partial<IntegrationConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // If master password changed, re-initialize
    if (newConfig.masterPassword && newConfig.masterPassword !== oldConfig.masterPassword) {
      await this.initialize();
    }

    // If sync settings changed, update sync transport
    if (newConfig.syncEnabled !== undefined || newConfig.syncEndpoint) {
      this.syncTransport.updateConfig({
        enabled: this.config.syncEnabled,
        endpoint: this.config.syncEndpoint || 'https://api.securevault.com/sync'
      });
    }
  }

  /**
   * Export all data
   */
  async exportAllData(): Promise<{
    analytics: string;
    tickets: string;
    config: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }

    try {
      const analytics = await this.analytics.getAnalytics();
      const tickets = await this.supportTickets.getAllTickets();
      
      const analyticsEncrypted = analytics ? await this.analytics.encryptAnalytics(analytics) : null;
      const ticketsEncrypted: any[] = [];
      
      for (const ticket of tickets) {
        const encrypted = await this.supportTickets.encryptTicket(ticket);
        ticketsEncrypted.push(encrypted);
      }

      return {
        analytics: JSON.stringify(analyticsEncrypted, null, 2),
        tickets: JSON.stringify(ticketsEncrypted, null, 2),
        config: JSON.stringify(this.config, null, 2)
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error('Data export failed');
    }
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }

    try {
      await this.analytics.clearAnalytics();
      await this.supportTickets.clearAllTickets();
      await this.syncTransport.clearSyncData();
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Data clearing failed');
    }
  }

  /**
   * Get integration health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!this.isInitialized) {
      issues.push('Integration not initialized');
      recommendations.push('Call initialize() with master password');
    }

    if (this.config.analyticsEnabled && !this.analytics) {
      issues.push('Analytics service not available');
      recommendations.push('Check analytics configuration');
    }

    if (this.config.supportTicketsEnabled && !this.supportTickets) {
      issues.push('Support tickets service not available');
      recommendations.push('Check support tickets configuration');
    }

    if (this.config.syncEnabled) {
      const syncHealth = this.syncTransport.getHealthStatus();
      issues.push(...syncHealth.issues);
      recommendations.push(...syncHealth.recommendations);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get vault sections
   */
  getVaultSections(): VaultSection[] {
    return [...this.vaultSections];
  }

  /**
   * Check if section is valid
   */
  isValidSection(sectionName: string): boolean {
    return this.vaultSections.some(s => s.name === sectionName);
  }

  /**
   * Get section display name
   */
  getSectionDisplayName(sectionName: string): string {
    const section = this.vaultSections.find(s => s.name === sectionName);
    return section ? section.displayName : sectionName;
  }

  /**
   * Get section icon
   */
  getSectionIcon(sectionName: string): string {
    const section = this.vaultSections.find(s => s.name === sectionName);
    return section ? section.icon : '📁';
  }

  /**
   * Enable/disable analytics
   */
  setAnalyticsEnabled(enabled: boolean): void {
    this.config.analyticsEnabled = enabled;
  }

  /**
   * Enable/disable support tickets
   */
  setSupportTicketsEnabled(enabled: boolean): void {
    this.config.supportTicketsEnabled = enabled;
  }

  /**
   * Enable/disable sync
   */
  setSyncEnabled(enabled: boolean): void {
    this.config.syncEnabled = enabled;
    this.syncTransport.updateConfig({ enabled });
  }

  /**
   * Get current configuration
   */
  getConfig(): IntegrationConfig {
    return { ...this.config };
  }
}

// Factory function to create integration instance
export function createAppIntegration(config: IntegrationConfig): AppIntegrationHooks {
  return new AppIntegrationHooks(config);
}

// Default configuration
export const defaultIntegrationConfig: IntegrationConfig = {
  analyticsEnabled: true,
  supportTicketsEnabled: true,
  syncEnabled: false,
  masterPassword: '',
  syncEndpoint: 'https://api.securevault.com/sync'
};
