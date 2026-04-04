import { test, expect } from '@playwright/test';

test.describe('Admin Console Comprehensive Tests', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // Test API health
    const healthResponse = await request.get('http://localhost:3001/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    // Login to get token
    const loginResponse = await request.post('http://localhost:3001/api/auth/login', {
      data: {
        username: 'admin',
        password: 'password'
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    adminToken = loginData.token;
    expect(adminToken).toBeTruthy();
  });

  test('Admin Console Login Flow', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Check if login form is visible
    await expect(page.locator('#login-form')).toBeVisible();
    
    // Fill login form
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#login-form')).toBeHidden();
    
    // Check if navigation tabs are visible
    await expect(page.locator('.nav-tab')).toHaveCount(8); // Dashboard, Investor Dashboard, Customers, Plans, Promotions, Notifications, Support, Settings
  });

  test('Dashboard KPIs Loading', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });
    
    // Check if KPIs are loaded
    await expect(page.locator('.kpi-card')).toHaveCount(8);
    
    // Check specific KPI values (allowing for dynamic values)
    const kpiValues = await page.locator('.kpi-value').allTextContents();
    expect(kpiValues).toContain('100000'); // Total customers
    expect(kpiValues).toContain('$399600.00'); // Monthly revenue
    expect(kpiValues).toContain('10000'); // New signups
    expect(kpiValues).toContain('2.5%'); // Churn rate
    expect(kpiValues).toContain('$4795200.00'); // Total revenue
    expect(kpiValues).toContain('12'); // Open tickets
    expect(kpiValues).toContain('3'); // Urgent tickets
  });

  test('Customer Search and Filtering', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Customers tab
    await page.click('text=Customers');
    await expect(page.locator('#customers-content')).toBeVisible();
    
    // Wait for customers to load
    await expect(page.locator('#customers-table')).toBeVisible({ timeout: 10000 });
    
    // Test search functionality
    await page.fill('#customers-search', 'john');
    await page.click('button:has-text("🔍 Filter")');
    
    // Wait for filtered results
    await expect(page.locator('#customers-results-info')).toContainText('Showing');
    
    // Test status filter
    await page.selectOption('#customers-status-filter', 'active');
    await page.click('button:has-text("🔍 Filter")');
    
    // Test region filter
    await page.selectOption('#customers-region-filter', 'US');
    await page.click('button:has-text("🔍 Filter")');
    
    // Test platform filter
    await page.selectOption('#customers-platform-filter', 'ios');
    await page.click('button:has-text("🔍 Filter")');
    
    // Test clear filters
    await page.click('button:has-text("Clear")');
    
    // Verify filters are cleared
    await expect(page.locator('#customers-search')).toHaveValue('');
    await expect(page.locator('#customers-status-filter')).toHaveValue('');
  });

  test('Support Tickets Search and Filtering', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Support tab
    await page.click('text=Support');
    await expect(page.locator('#support-content')).toBeVisible();
    
    // Wait for tickets to load
    await expect(page.locator('#support-tickets-table')).toBeVisible({ timeout: 10000 });
    
    // Wait for filter buttons to be visible
    await expect(page.locator('#support-content button:has-text("🔍 Filter")')).toBeVisible({ timeout: 5000 });
    
    // Test search functionality
    await page.fill('#tickets-search', 'support');
    await page.click('#support-content button:has-text("🔍 Filter")');
    
    // Wait for filtered results
    await expect(page.locator('#tickets-results-info')).toContainText('Showing');
    
    // Test status filter
    await page.selectOption('#tickets-status-filter', 'open');
    await page.click('#support-content button:has-text("🔍 Filter")');
    
    // Test priority filter
    await page.selectOption('#tickets-priority-filter', 'high');
    await page.click('#support-content button:has-text("🔍 Filter")');
    
    // Test clear filters
    await page.click('#support-content button:has-text("Clear")');
    
    // Verify filters are cleared
    await expect(page.locator('#tickets-search')).toHaveValue('');
    await expect(page.locator('#tickets-status-filter')).toHaveValue('');
  });

  test('Investor Dashboard Data Loading', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Investor Dashboard tab
    await page.click('text=Investor Dashboard');
    await expect(page.locator('#investor-dashboard-content')).toBeVisible();
    
    // Wait for investor dashboard to load
    await expect(page.locator('#investor-dashboard-container')).toBeVisible({ timeout: 10000 });
    
    // Check if KPI cards are present
    await expect(page.locator('.investor-kpi-card')).toHaveCount(8);
    
    // Check if charts are present
    await expect(page.locator('canvas')).toHaveCount(4); // Revenue Trend, Plan Mix, User Activity, Growth Funnel
  });

  test('Plans Management', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Plans tab
    await page.click('text=Plans');
    await expect(page.locator('#plans-content')).toBeVisible();
    
    // Wait for plans to load
    await expect(page.locator('#plans-table')).toBeVisible({ timeout: 10000 });
    
    // Check if plans are displayed
    await expect(page.locator('#plans-table table tbody tr')).toHaveCount(4); // Free, Pro Monthly, Pro Yearly, and possibly another plan
    
    // Test create plan button
    await page.click('button:has-text("Create Plan")');
    await expect(page.locator('[style*="position: fixed"]')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('Promotions Management', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Plans tab (promotions are under plans)
    await page.click('text=Plans');
    await expect(page.locator('#plans-content')).toBeVisible();
    
    // Click on Promotions sub-tab
    await page.click('text=Promotions');
    
    // Wait for promotions to load
    await expect(page.locator('#promotions-table')).toBeVisible({ timeout: 10000 });
    
    // Test create promotion button
    await page.click('button:has-text("Create Promotion")');
    await expect(page.locator('[style*="position: fixed"]')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('Notifications Management', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Plans tab (notifications are under plans)
    await page.click('text=Plans');
    await expect(page.locator('#plans-content')).toBeVisible();
    
    // Click on Notifications sub-tab
    await page.click('text=Notifications');
    
    // Wait for notifications to load
    await expect(page.locator('#notifications-table')).toBeVisible({ timeout: 10000 });
    
    // Test create notification button
    await page.click('button:has-text("Create Notification")');
    await expect(page.locator('[style*="position: fixed"]')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('Settings Page', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Settings tab
    await page.click('text=Settings');
    await expect(page.locator('#settings-content')).toBeVisible();
    
    // Check if system info is displayed
    await expect(page.locator('#system-info')).toBeVisible();
    
    // Check if admin users section is present
    await expect(page.locator('#admin-users-list')).toBeVisible();
  });

  test('API Endpoints Direct Testing', async ({ request }) => {
    // Test customers endpoint with filters
    const customersResponse = await request.get('http://localhost:3001/api/customers?search=john&status=active&limit=5', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    expect(customersResponse.ok()).toBeTruthy();
    const customersData = await customersResponse.json();
    expect(customersData.customers).toHaveLength(5);
    expect(customersData.pagination).toBeDefined();
    
    // Test support tickets endpoint with filters
    const ticketsResponse = await request.get('http://localhost:3001/api/support-tickets?search=support&status=open&limit=3', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    expect(ticketsResponse.ok()).toBeTruthy();
    const ticketsData = await ticketsResponse.json();
    expect(ticketsData.tickets).toHaveLength(3);
    expect(ticketsData.pagination).toBeDefined();
    
    // Test analytics endpoint
    const analyticsResponse = await request.get('http://localhost:3001/api/dashboard/analytics', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    expect(analyticsResponse.ok()).toBeTruthy();
    const analyticsData = await analyticsResponse.json();
    expect(analyticsData.totalCustomers).toBe(100000);
    expect(analyticsData.mrr).toBeDefined();
    expect(analyticsData.arr).toBeDefined();
  });

  test('Error Handling and Edge Cases', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Test invalid login
    await page.fill('input[name="username"]', 'invalid');
    await page.fill('input[name="password"]', 'invalid');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('#error-message')).toBeVisible();
    
    // Test valid login after invalid attempt
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Should successfully login
    await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('Pagination Functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to Customers tab
    await page.click('text=Customers');
    await expect(page.locator('#customers-content')).toBeVisible();
    
    // Wait for customers to load
    await expect(page.locator('#customers-table')).toBeVisible({ timeout: 10000 });
    
    // Check if pagination is present
    const pagination = page.locator('#customers-pagination');
    if (await pagination.isVisible()) {
      // Test pagination navigation
      await page.click('#customers-pagination button:has-text("→")');
      await expect(page.locator('#customers-results-info')).toContainText('Showing');
    }
  });

  test('Currency Functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Check if currency selector is present
    await expect(page.locator('#currency-selector')).toBeVisible();
    
    // Test currency change
    await page.selectOption('#currency-selector', 'EUR');
    
    // Wait for currency change to take effect
    await page.waitForTimeout(1000);
    
    // Check if currency selector value changed
    await expect(page.locator('#currency-selector')).toHaveValue('EUR');
  });
});
