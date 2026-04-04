// Debug Seeding Test for Playwright
import { test, expect } from '@playwright/test';

test.describe('Debug Admin Console Seeding', () => {
  test('should debug seeding function with console logs', async ({ page }) => {
    // Listen to console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to admin console
    await page.goto('/offline-first-admin-console');
    await page.waitForLoadState('networkidle');

    // Check if admin console loads
    await expect(page.locator('h1')).toContainText('SubSafe Admin Console');

    // Click seed data button
    await page.click('header button:has-text("Seed Test Data")');
    
    // Wait a bit for the seeding process
    await page.waitForTimeout(5000);
    
    // Check console logs for seeding progress
    console.log('Console logs during seeding:', consoleLogs);
    
    // Check if any error occurred
    const errorLogs = consoleLogs.filter(log => log.includes('❌') || log.includes('Error'));
    if (errorLogs.length > 0) {
      console.log('Errors found:', errorLogs);
    }
    
    // Check if success occurred
    const successLogs = consoleLogs.filter(log => log.includes('✅') || log.includes('success'));
    console.log('Success logs:', successLogs);
    
    // Try to check if data was actually stored
    const dataCheck = await page.evaluate(async () => {
      try {
        const request = indexedDB.open('SubSafe', 3);
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const db = request.result;
            if (db.objectStoreNames.contains('users')) {
              const transaction = db.transaction(['users'], 'readonly');
              const store = transaction.objectStore('users');
              const getAllRequest = store.getAll();
              
              getAllRequest.onsuccess = () => {
                resolve({
                  success: true,
                  userCount: getAllRequest.result.length,
                  users: getAllRequest.result
                });
              };
              
              getAllRequest.onerror = () => {
                resolve({ success: false, error: 'Failed to get users' });
              };
            } else {
              resolve({ success: false, error: 'Users store does not exist' });
            }
          };
          
          request.onerror = () => {
            resolve({ success: false, error: 'Failed to open database' });
          };
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Data check result:', dataCheck);
    
    // The test passes if we can debug the issue
    expect(dataCheck).toBeDefined();
  });
});
