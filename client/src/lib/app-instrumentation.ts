// App Instrumentation System
// Tracks usage events for analytics without collecting PII
// Integrates with the main IronVault app

import { analyticsCollector } from '@/lib/analytics-collector';

export interface InstrumentationConfig {
  enabled: boolean;
  trackPageViews: boolean;
  trackUserInteractions: boolean;
  trackPerformance: boolean;
  trackErrors: boolean;
}

export class AppInstrumentation {
  private config: InstrumentationConfig;
  private isInitialized = false;
  private currentSection = '';

  constructor(config: InstrumentationConfig = {
    enabled: true,
    trackPageViews: true,
    trackUserInteractions: true,
    trackPerformance: true,
    trackErrors: true
  }) {
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize instrumentation
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Track app launch
      await this.trackEvent('app_launch');

      // Set up error tracking
      if (this.config.trackErrors) {
        this.setupErrorTracking();
      }

      // Set up performance tracking
      if (this.config.trackPerformance) {
        this.setupPerformanceTracking();
      }

      // Set up user interaction tracking
      if (this.config.trackUserInteractions) {
        this.setupInteractionTracking();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize instrumentation:', error);
    }
  }

  /**
   * Track usage event
   */
  async trackEvent(type: 'app_launch' | 'vault_unlock' | 'section_access' | 'feature_usage' | 'license_upgrade', data?: any): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) return;

    try {
      await analyticsCollector.trackEvent({
        type,
        section: data?.section,
        feature: data?.feature,
        metadata: data?.metadata
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track vault unlock
   */
  async trackVaultUnlock(): Promise<void> {
    await this.trackEvent('vault_unlock');
  }

  /**
   * Track section access
   */
  async trackSectionAccess(section: string): Promise<void> {
    if (this.currentSection !== section) {
      this.currentSection = section;
      await this.trackEvent('section_access', { section });
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(feature: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent('feature_usage', { feature, metadata });
  }

  /**
   * Track license upgrade
   */
  async trackLicenseUpgrade(tier: string, amount: number): Promise<void> {
    await this.trackEvent('license_upgrade', { 
      tier, 
      amount,
      metadata: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError('JavaScript Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Unhandled Promise Rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });

    // React error boundary (if using React)
    if (typeof window !== 'undefined' && (window as any).React) {
      this.setupReactErrorBoundary();
    }
  }

  /**
   * Handle error tracking
   */
  private async handleError(errorType: string, errorData: Record<string, any>): Promise<void> {
    try {
      await analyticsCollector.submitReport({
        title: `${errorType} in ${this.currentSection || 'unknown'}`,
        description: `Automatic error report: ${errorType}`,
        featureContext: this.currentSection || 'general',
        errorStack: errorData.stack || JSON.stringify(errorData),
        logs: `Error Type: ${errorType}\nTimestamp: ${new Date().toISOString()}\nSection: ${this.currentSection}\nUser Agent: ${navigator.userAgent}`
      });
    } catch (error) {
      console.error('Failed to submit error report:', error);
    }
  }

  /**
   * Set up React error boundary
   */
  private setupReactErrorBoundary(): void {
    // This would be implemented in a React Error Boundary component
    // For now, we'll just log that React is available
    console.log('React error boundary setup available');
  }

  /**
   * Set up performance tracking
   */
  private setupPerformanceTracking(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (perfData) {
          this.trackFeatureUsage('page_load_performance', {
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint()
          });
        }
      }, 1000);
    });

    // Track memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.trackFeatureUsage('memory_usage', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Get First Paint timing
   */
  private getFirstPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  /**
   * Get First Contentful Paint timing
   */
  private getFirstContentfulPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : null;
  }

  /**
   * Set up user interaction tracking
   */
  private setupInteractionTracking(): void {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Track clicks on buttons, links, and interactive elements
      if (target.matches('button, a, [role="button"], [data-track]')) {
        const elementType = target.tagName.toLowerCase();
        const elementText = target.textContent?.trim().substring(0, 50) || '';
        const elementId = target.id || '';
        const elementClass = target.className || '';
        
        this.trackFeatureUsage('user_click', {
          elementType,
          elementText,
          elementId,
          elementClass,
          section: this.currentSection
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.trackFeatureUsage('form_submission', {
        formId: form.id || '',
        formAction: form.action || '',
        section: this.currentSection
      });
    });

    // Track keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        this.trackFeatureUsage('keyboard_shortcut', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          section: this.currentSection
        });
      }
    });
  }

  /**
   * Track page view
   */
  async trackPageView(page: string): Promise<void> {
    if (!this.config.trackPageViews) return;
    
    await this.trackSectionAccess(page);
  }

  /**
   * Track search queries (without storing the actual query)
   */
  async trackSearch(section: string, resultCount: number): Promise<void> {
    await this.trackFeatureUsage('search_performed', {
      section,
      resultCount,
      hasResults: resultCount > 0
    });
  }

  /**
   * Track data operations
   */
  async trackDataOperation(operation: 'create' | 'read' | 'update' | 'delete', section: string, count: number = 1): Promise<void> {
    await this.trackFeatureUsage('data_operation', {
      operation,
      section,
      count
    });
  }

  /**
   * Track export/import operations
   */
  async trackDataExport(section: string, format: string, recordCount: number): Promise<void> {
    await this.trackFeatureUsage('data_export', {
      section,
      format,
      recordCount
    });
  }

  async trackDataImport(section: string, format: string, recordCount: number): Promise<void> {
    await this.trackFeatureUsage('data_import', {
      section,
      format,
      recordCount
    });
  }

  /**
   * Track authentication events
   */
  async trackAuthentication(event: 'login' | 'logout' | 'vault_create' | 'vault_reset'): Promise<void> {
    await this.trackFeatureUsage('authentication', {
      event,
      section: 'auth'
    });
  }

  /**
   * Track settings changes
   */
  async trackSettingsChange(setting: string, value: any): Promise<void> {
    await this.trackFeatureUsage('settings_change', {
      setting,
      valueType: typeof value,
      section: 'settings'
    });
  }

  /**
   * Get current analytics summary
   */
  async getAnalyticsSummary() {
    return analyticsCollector.getAnalyticsSummary();
  }

  /**
   * Enable/disable instrumentation
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InstrumentationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
export const appInstrumentation = new AppInstrumentation();
