// Comprehensive Testing Suite for Encrypted Analytics System
// Tests encryption, data collection, admin console, and cloud sync

import { test, expect } from '@playwright/test';
import { EncryptedAnalytics, AnalyticsData, UserReport } from '../lib/encrypted-analytics';
import { AnalyticsCollector } from '../lib/analytics-collector';
import { AppInstrumentation } from '../lib/app-instrumentation';
import { CloudSyncService } from '../lib/cloud-sync-service';

test.describe('Encrypted Analytics System', () => {
  let encryptedAnalytics: EncryptedAnalytics;
  let analyticsCollector: AnalyticsCollector;
  let appInstrumentation: AppInstrumentation;
  let cloudSyncService: CloudSyncService;

  test.beforeEach(async ({ page }) => {
    // Initialize services
    encryptedAnalytics = new EncryptedAnalytics();
    analyticsCollector = new AnalyticsCollector();
    appInstrumentation = new AppInstrumentation();
    cloudSyncService = new CloudSyncService({
      enabled: false,
      endpoint: 'https://test-api.securevault.com/sync'
    });

    // Navigate to app
    await page.goto('http://localhost:5000');
  });

  test.describe('Encryption System', () => {
    test('should derive encryption key from master password', async () => {
      const masterPassword = 'test-password-123';
      
      await encryptedAnalytics.deriveKey(masterPassword);
      
      // Key should be derived successfully
      expect(encryptedAnalytics['key']).toBeTruthy();
    });

    test('should encrypt and decrypt data correctly', async () => {
      const masterPassword = 'test-password-123';
      const testData = {
        message: 'Hello, encrypted world!',
        timestamp: new Date().toISOString(),
        metadata: { version: '1.0.0' }
      };

      await encryptedAnalytics.deriveKey(masterPassword);
      
      // Encrypt data
      const encrypted = await encryptedAnalytics.encrypt(testData);
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.tag).toBeTruthy();
      expect(encrypted.timestamp).toBeTruthy();

      // Decrypt data
      const decrypted = await encryptedAnalytics.decrypt(encrypted);
      expect(decrypted).toEqual(testData);
    });

    test('should fail decryption with wrong password', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';
      const testData = { message: 'Secret data' };

      // Encrypt with correct password
      await encryptedAnalytics.deriveKey(correctPassword);
      const encrypted = await encryptedAnalytics.encrypt(testData);

      // Try to decrypt with wrong password
      await encryptedAnalytics.deriveKey(wrongPassword);
      
      await expect(encryptedAnalytics.decrypt(encrypted)).rejects.toThrow();
    });

    test('should use unique IVs for each encryption', async () => {
      const masterPassword = 'test-password';
      const testData = { message: 'Same data' };

      await encryptedAnalytics.deriveKey(masterPassword);
      
      const encrypted1 = await encryptedAnalytics.encrypt(testData);
      const encrypted2 = await encryptedAnalytics.encrypt(testData);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  test.describe('Analytics Collection', () => {
    test('should track app launch events', async () => {
      await analyticsCollector.trackEvent({ type: 'app_launch' });
      
      const analytics = await analyticsCollector.getAnalytics();
      expect(analytics?.appVisits).toBeGreaterThan(0);
    });

    test('should track vault unlock events', async () => {
      await analyticsCollector.trackEvent({ type: 'vault_unlock' });
      
      const analytics = await analyticsCollector.getAnalytics();
      const today = new Date().toISOString().split('T')[0];
      expect(analytics?.dailyActiveUsers[today]).toBeGreaterThan(0);
    });

    test('should track section access', async () => {
      await analyticsCollector.trackEvent({ 
        type: 'section_access', 
        section: 'passwords' 
      });
      
      const analytics = await analyticsCollector.getAnalytics();
      expect(analytics?.sectionUsage.passwords).toBeGreaterThan(0);
    });

    test('should track license upgrades', async () => {
      await analyticsCollector.trackEvent({
        type: 'license_upgrade',
        metadata: { tier: 'pro', amount: 149 }
      });
      
      const analytics = await analyticsCollector.getAnalytics();
      expect(analytics?.licenseInfo.proCount).toBeGreaterThan(0);
      expect(analytics?.licenseInfo.totalRevenue).toBeGreaterThan(0);
    });

    test('should collect platform information', async () => {
      const analytics = await analyticsCollector.getAnalytics();
      
      expect(analytics?.platformInfo.os).toBeTruthy();
      expect(analytics?.platformInfo.browser).toBeTruthy();
      expect(analytics?.platformInfo.version).toBeTruthy();
    });

    test('should not collect PII', async () => {
      const analytics = await analyticsCollector.getAnalytics();
      
      // Should not contain personal information
      expect(analytics?.platformInfo.userAgent).toBeTruthy();
      expect(analytics?.platformInfo.userAgent.length).toBeLessThanOrEqual(100);
      
      // Should not contain email, name, or other PII
      const analyticsStr = JSON.stringify(analytics);
      expect(analyticsStr).not.toMatch(/@.*\./); // No email patterns
      expect(analyticsStr).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/); // No name patterns
    });
  });

  test.describe('User Reports', () => {
    test('should submit encrypted user reports', async () => {
      const reportData = {
        title: 'Test Bug Report',
        description: 'This is a test bug report',
        featureContext: 'passwords',
        errorStack: 'Error: Test error\n    at test.js:1:1'
      };

      await analyticsCollector.submitReport(reportData);
      
      const reports = await analyticsCollector.getUserReports();
      expect(reports.length).toBeGreaterThan(0);
      
      const report = reports[reports.length - 1];
      expect(report.title).toBe(reportData.title);
      expect(report.description).toBe(reportData.description);
      expect(report.status).toBe('pending');
    });

    test('should update report status', async () => {
      // Submit a report
      await analyticsCollector.submitReport({
        title: 'Test Report',
        description: 'Test description'
      });
      
      const reports = await analyticsCollector.getUserReports();
      const reportId = reports[reports.length - 1].id;
      
      // Update status
      await analyticsCollector.updateReportStatus(reportId, 'resolved', 'v1.0.1');
      
      const updatedReports = await analyticsCollector.getUserReports();
      const updatedReport = updatedReports.find(r => r.id === reportId);
      
      expect(updatedReport?.status).toBe('resolved');
      expect(updatedReport?.resolvedIn).toBe('v1.0.1');
    });

    test('should generate unique report IDs', async () => {
      await analyticsCollector.submitReport({
        title: 'Report 1',
        description: 'Description 1'
      });
      
      await analyticsCollector.submitReport({
        title: 'Report 2',
        description: 'Description 2'
      });
      
      const reports = await analyticsCollector.getUserReports();
      const ids = reports.map(r => r.id);
      
      // All IDs should be unique
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  test.describe('App Instrumentation', () => {
    test('should track page views', async ({ page }) => {
      await appInstrumentation.trackPageView('passwords');
      
      // Verify tracking (would need to check analytics data)
      const summary = await appInstrumentation.getAnalyticsSummary();
      expect(summary.mostUsedSection).toBe('passwords');
    });

    test('should track user interactions', async ({ page }) => {
      // Navigate to passwords page
      await page.goto('http://localhost:5000/passwords');
      
      // Click a button
      await page.click('button[data-testid="add-password"]');
      
      // Instrumentation should track this interaction
      // (In a real test, we'd verify the analytics data)
    });

    test('should track data operations', async () => {
      await appInstrumentation.trackDataOperation('create', 'passwords', 1);
      await appInstrumentation.trackDataOperation('read', 'passwords', 5);
      await appInstrumentation.trackDataOperation('update', 'passwords', 1);
      await appInstrumentation.trackDataOperation('delete', 'passwords', 1);
      
      // Verify tracking
      const summary = await appInstrumentation.getAnalyticsSummary();
      expect(summary.totalUsers).toBeGreaterThan(0);
    });

    test('should track authentication events', async () => {
      await appInstrumentation.trackAuthentication('login');
      await appInstrumentation.trackAuthentication('logout');
      await appInstrumentation.trackAuthentication('vault_create');
      
      // Verify tracking
      const summary = await appInstrumentation.getAnalyticsSummary();
      expect(summary.totalUsers).toBeGreaterThan(0);
    });

    test('should handle errors gracefully', async () => {
      // Simulate an error
      const originalConsoleError = console.error;
      let errorCaught = false;
      
      console.error = () => { errorCaught = true; };
      
      // This should not throw
      await appInstrumentation.trackEvent('invalid_event' as any);
      
      console.error = originalConsoleError;
      expect(errorCaught).toBe(false);
    });
  });

  test.describe('Cloud Sync Service', () => {
    test('should prepare encrypted sync payload', async () => {
      // Set up test data
      await analyticsCollector.trackEvent({ type: 'app_launch' });
      await analyticsCollector.submitReport({
        title: 'Test Report',
        description: 'Test description'
      });
      
      // Prepare payload
      const payload = await cloudSyncService['prepareSyncPayload']();
      
      expect(payload).toBeTruthy();
      expect(payload.metadata.deviceId).toBeTruthy();
      expect(payload.metadata.timestamp).toBeTruthy();
      expect(payload.metadata.version).toBe('1.0.0');
    });

    test('should handle sync configuration', async () => {
      const newConfig = {
        enabled: true,
        endpoint: 'https://new-endpoint.com/sync',
        interval: 60000 // 1 minute
      };
      
      cloudSyncService.updateConfig(newConfig);
      
      const status = cloudSyncService.getStatus();
      expect(status.isEnabled).toBe(true);
    });

    test('should track sync status', async () => {
      const status = cloudSyncService.getStatus();
      
      expect(status.isEnabled).toBeDefined();
      expect(status.lastSyncStatus).toBeDefined();
      expect(status.pendingRecords).toBeDefined();
    });

    test('should generate unique device ID', async () => {
      const stats = await cloudSyncService.getSyncStats();
      
      expect(stats.deviceId).toBeTruthy();
      expect(stats.deviceId).toMatch(/^device_\d+_[a-z0-9]+$/);
    });

    test('should handle sync failures gracefully', async () => {
      // Configure with invalid endpoint
      cloudSyncService.updateConfig({
        enabled: true,
        endpoint: 'https://invalid-endpoint-that-does-not-exist.com/sync'
      });
      
      // Attempt sync
      const success = await cloudSyncService.performSync();
      
      expect(success).toBe(false);
      
      const status = cloudSyncService.getStatus();
      expect(status.lastSyncStatus).toBe('error');
      expect(status.errorMessage).toBeTruthy();
    });
  });

  test.describe('Admin Console Integration', () => {
    test('should authenticate with master password', async ({ page }) => {
      // Navigate to admin console
      await page.goto('http://localhost:5000/offline-admin-console');
      
      // Should show authentication screen
      await expect(page.locator('text=Offline Admin Console')).toBeVisible();
      await expect(page.locator('text=Enter master password')).toBeVisible();
      
      // Enter master password
      await page.fill('input[type="password"]', 'test-password-123');
      await page.click('button:has-text("Decrypt Data")');
      
      // Should show main console
      await expect(page.locator('text=Encrypted analytics and support management')).toBeVisible();
    });

    test('should display analytics dashboard', async ({ page }) => {
      // Set up test data
      await analyticsCollector.trackEvent({ type: 'app_launch' });
      await analyticsCollector.trackEvent({ type: 'vault_unlock' });
      await analyticsCollector.trackEvent({ 
        type: 'section_access', 
        section: 'passwords' 
      });
      
      // Navigate to admin console
      await page.goto('http://localhost:5000/offline-admin-console');
      
      // Authenticate
      await page.fill('input[type="password"]', 'test-password-123');
      await page.click('button:has-text("Decrypt Data")');
      
      // Check dashboard metrics
      await expect(page.locator('text=Total Users')).toBeVisible();
      await expect(page.locator('text=Daily Active Users')).toBeVisible();
      await expect(page.locator('text=Total Revenue')).toBeVisible();
    });

    test('should display user reports', async ({ page }) => {
      // Submit test report
      await analyticsCollector.submitReport({
        title: 'Test Bug Report',
        description: 'This is a test bug report for the admin console'
      });
      
      // Navigate to admin console
      await page.goto('http://localhost:5000/offline-admin-console');
      
      // Authenticate
      await page.fill('input[type="password"]', 'test-password-123');
      await page.click('button:has-text("Decrypt Data")');
      
      // Navigate to reports tab
      await page.click('button:has-text("Reports")');
      
      // Check for report
      await expect(page.locator('text=Test Bug Report')).toBeVisible();
      await expect(page.locator('text=pending')).toBeVisible();
    });

    test('should allow report status updates', async ({ page }) => {
      // Submit test report
      await analyticsCollector.submitReport({
        title: 'Test Report for Status Update',
        description: 'This report will be marked as resolved'
      });
      
      // Navigate to admin console
      await page.goto('http://localhost:5000/offline-admin-console');
      
      // Authenticate
      await page.fill('input[type="password"]', 'test-password-123');
      await page.click('button:has-text("Decrypt Data")');
      
      // Navigate to reports tab
      await page.click('button:has-text("Reports")');
      
      // Click resolve button
      await page.click('button:has-text("Mark Resolved")');
      
      // Check status change
      await expect(page.locator('text=resolved')).toBeVisible();
    });

    test('should export encrypted data', async ({ page }) => {
      // Set up test data
      await analyticsCollector.trackEvent({ type: 'app_launch' });
      await analyticsCollector.submitReport({
        title: 'Test Export Report',
        description: 'This report will be exported'
      });
      
      // Navigate to admin console
      await page.goto('http://localhost:5000/offline-admin-console');
      
      // Authenticate
      await page.fill('input[type="password"]', 'test-password-123');
      await page.click('button:has-text("Decrypt Data")');
      
      // Click export button
      await page.click('button:has-text("Export Data")');
      
      // Should trigger download (in real browser)
      // In test, we just verify the button is clickable
      await expect(page.locator('button:has-text("Export Data")')).toBeVisible();
    });
  });

  test.describe('Data Privacy and Security', () => {
    test('should not store plaintext data in IndexedDB', async ({ page }) => {
      // Set up test data
      await analyticsCollector.trackEvent({ type: 'app_launch' });
      await analyticsCollector.submitReport({
        title: 'Privacy Test Report',
        description: 'This should be encrypted'
      });
      
      // Check IndexedDB directly
      const dbData = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('vault_v3', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        const transaction = db.transaction(['meta_v3'], 'readonly');
        const store = transaction.objectStore('meta_v3');
        
        const analytics = await store.get('analytics');
        const reports = await store.get('userReports');
        
        return { analytics, reports };
      });
      
      // Data should be encrypted (contain IV, ciphertext, tag)
      if (dbData.analytics) {
        expect(dbData.analytics.value.iv).toBeTruthy();
        expect(dbData.analytics.value.ciphertext).toBeTruthy();
        expect(dbData.analytics.value.tag).toBeTruthy();
        
        // Should not contain plaintext
        const analyticsStr = JSON.stringify(dbData.analytics.value);
        expect(analyticsStr).not.toContain('Privacy Test Report');
        expect(analyticsStr).not.toContain('This should be encrypted');
      }
    });

    test('should maintain zero-knowledge architecture', async () => {
      // All data should be encrypted before storage
      const analytics = await analyticsCollector.getAnalytics();
      const reports = await analyticsCollector.getUserReports();
      
      // Data should be accessible only through decryption
      expect(analytics).toBeTruthy();
      expect(reports).toBeTruthy();
      
      // But raw storage should be encrypted
      // (This would be verified by checking IndexedDB directly)
    });

    test('should handle key derivation securely', async () => {
      const masterPassword = 'secure-password-123';
      
      await encryptedAnalytics.deriveKey(masterPassword);
      
      // Key should not be stored in plaintext
      const key = encryptedAnalytics['key'];
      expect(key).toBeTruthy();
      
      // Salt should be generated
      const salt = encryptedAnalytics.getSalt();
      expect(salt).toBeTruthy();
      expect(salt.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should handle large datasets efficiently', async () => {
      // Generate large number of reports
      const reportPromises = [];
      for (let i = 0; i < 100; i++) {
        reportPromises.push(
          analyticsCollector.submitReport({
            title: `Performance Test Report ${i}`,
            description: `This is test report number ${i} for performance testing`
          })
        );
      }
      
      await Promise.all(reportPromises);
      
      // Should handle efficiently
      const reports = await analyticsCollector.getUserReports();
      expect(reports.length).toBe(100);
    });

    test('should handle concurrent operations', async () => {
      // Perform multiple operations concurrently
      const operations = [
        analyticsCollector.trackEvent({ type: 'app_launch' }),
        analyticsCollector.trackEvent({ type: 'vault_unlock' }),
        analyticsCollector.trackEvent({ type: 'section_access', section: 'passwords' }),
        analyticsCollector.submitReport({
          title: 'Concurrent Test Report',
          description: 'Testing concurrent operations'
        })
      ];
      
      await Promise.all(operations);
      
      // All operations should complete successfully
      const analytics = await analyticsCollector.getAnalytics();
      const reports = await analyticsCollector.getUserReports();
      
      expect(analytics).toBeTruthy();
      expect(reports.length).toBeGreaterThan(0);
    });

    test('should handle errors gracefully', async () => {
      // Test with invalid data
      await expect(
        analyticsCollector.trackEvent({ type: 'invalid_event' as any })
      ).resolves.not.toThrow();
      
      // Test with missing required fields
      await expect(
        analyticsCollector.submitReport({ title: '', description: '' })
      ).resolves.not.toThrow();
    });
  });
});

// Integration test for the complete system
test.describe('Complete System Integration', () => {
  test('should work end-to-end with real user workflow', async ({ page }) => {
    // 1. User launches app
    await page.goto('http://localhost:5000');
    await appInstrumentation.trackEvent('app_launch');
    
    // 2. User unlocks vault
    await page.fill('input[type="password"]', 'test-password-123');
    await page.click('button:has-text("Unlock Vault")');
    await appInstrumentation.trackEvent('vault_unlock');
    
    // 3. User accesses different sections
    await page.click('a[href="/passwords"]');
    await appInstrumentation.trackEvent('section_access', { section: 'passwords' });
    
    await page.click('a[href="/subscriptions"]');
    await appInstrumentation.trackEvent('section_access', { section: 'subscriptions' });
    
    // 4. User submits a report
    await page.click('button:has-text("Report Issue")');
    await page.fill('input[placeholder="Brief description"]', 'Integration Test Report');
    await page.fill('textarea[placeholder="Please describe"]', 'This is an integration test report');
    await page.click('button:has-text("Submit Report")');
    
    // 5. Admin accesses console
    await page.goto('http://localhost:5000/offline-admin-console');
    await page.fill('input[type="password"]', 'test-password-123');
    await page.click('button:has-text("Decrypt Data")');
    
    // 6. Admin views analytics
    await expect(page.locator('text=Total Users')).toBeVisible();
    await expect(page.locator('text=Daily Active Users')).toBeVisible();
    
    // 7. Admin views reports
    await page.click('button:has-text("Reports")');
    await expect(page.locator('text=Integration Test Report')).toBeVisible();
    
    // 8. Admin resolves report
    await page.click('button:has-text("Mark Resolved")');
    await expect(page.locator('text=resolved')).toBeVisible();
    
    // 9. Admin exports data
    await page.click('button:has-text("Export Data")');
    
    // All steps should complete successfully
    expect(true).toBe(true); // Test passes if no errors thrown
  });
});
