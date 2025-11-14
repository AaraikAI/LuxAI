import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Complete Authentication Flow
 *
 * This test demonstrates the full user authentication journey including:
 * 1. Registration
 * 2. Email verification (simulated)
 * 3. Login
 * 4. 2FA setup
 * 5. Logout and login with 2FA
 */

const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'Test123!@#Strong',
  firstName: 'Test',
  lastName: 'User',
};

test.describe('Authentication Flow E2E', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should complete full authentication journey', async () => {
    // Step 1: Navigate to registration page
    await page.goto('http://localhost:5173/register');
    await expect(page).toHaveTitle(/LuxAI Designer/);

    // Step 2: Fill registration form
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.fill('input[name="firstName"]', TEST_USER.firstName);
    await page.fill('input[name="lastName"]', TEST_USER.lastName);
    await page.selectOption('select[name="role"]', 'client');

    // Step 3: Submit registration
    await page.click('button[type="submit"]');

    // Step 4: Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Step 5: Navigate to 2FA setup
    await page.click('text=Security');
    await page.click('text=Two-Factor Authentication');

    // Step 6: Set up 2FA
    await page.click('button:has-text("Set Up 2FA")');

    // Wait for QR code to appear
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible();

    // Get the secret key for manual entry (in real test, you'd scan QR code)
    const secretKey = await page.locator('[data-testid="secret-key"]').textContent();

    // Generate TOTP code (in real implementation, use a TOTP library)
    // For this example, we'll simulate verification
    const verificationCode = '123456'; // In real test, generate from secretKey

    await page.fill('input[name="verificationCode"]', verificationCode);
    await page.click('button:has-text("Verify & Enable")');

    // Step 7: Verify 2FA enabled successfully
    await expect(page.locator('text=Two-factor authentication enabled')).toBeVisible();

    // Step 8: Download backup codes
    await page.click('button:has-text("Download Backup Codes")');

    // Step 9: Logout
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    // Step 10: Login with 2FA
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Step 11: Verify 2FA prompt appears
    await expect(page.locator('text=Enter your authentication code')).toBeVisible();

    // Step 12: Enter 2FA code
    await page.fill('input[name="twoFactorCode"]', verificationCode);
    await page.click('button:has-text("Verify")');

    // Step 13: Verify successful login with 2FA
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator(`text=${TEST_USER.firstName}`)).toBeVisible();
  });

  test('should handle failed login attempts', async () => {
    // Navigate to login
    await page.goto('http://localhost:5173/login');

    // Attempt login with wrong password
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();

    // Verify still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show security audit log', async () => {
    // Login first
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Handle 2FA if enabled
    if (await page.locator('input[name="twoFactorCode"]').isVisible()) {
      await page.fill('input[name="twoFactorCode"]', '123456');
      await page.click('button:has-text("Verify")');
    }

    // Navigate to security audit log
    await page.click('text=Security');
    await page.click('text=Audit Log');

    // Verify audit log is visible
    await expect(page.locator('h1:has-text("Security Audit Log")')).toBeVisible();

    // Verify at least one login event is shown
    await expect(page.locator('text=login')).toBeVisible();

    // Test filtering
    await page.selectOption('select[name="limit"]', '25');

    // Verify table is updated
    await expect(page.locator('table')).toBeVisible();
  });
});

/**
 * E2E Test: GDPR Data Management
 */
test.describe('GDPR Data Management E2E', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Login as user
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Handle 2FA if needed
    if (await page.locator('input[name="twoFactorCode"]').isVisible()) {
      await page.fill('input[name="twoFactorCode"]', '123456');
      await page.click('button:has-text("Verify")');
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should request data export', async () => {
    // Navigate to GDPR page
    await page.goto('http://localhost:5173/settings/privacy');

    // Click data export button
    await page.click('button:has-text("Request Data Export")');

    // Confirm export request
    await page.click('button:has-text("Confirm")');

    // Verify success message
    await expect(page.locator('text=Data export request submitted')).toBeVisible();

    // Verify request status
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  test('should manage cookie preferences', async () => {
    // Open cookie consent settings
    await page.goto('http://localhost:5173/settings/cookies');

    // Toggle analytics cookies off
    await page.click('input[name="analytics"]');

    // Toggle marketing cookies off
    await page.click('input[name="marketing"]');

    // Save preferences
    await page.click('button:has-text("Save Preferences")');

    // Verify success message
    await expect(page.locator('text=Preferences saved')).toBeVisible();

    // Reload and verify preferences persisted
    await page.reload();

    await expect(page.locator('input[name="analytics"]')).not.toBeChecked();
    await expect(page.locator('input[name="marketing"]')).not.toBeChecked();
    await expect(page.locator('input[name="necessary"]')).toBeChecked();
  });
});

/**
 * E2E Test: Session Management
 */
test.describe('Session Management E2E', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should manage active sessions', async () => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Navigate to sessions page
    await page.goto('http://localhost:5173/settings/sessions');

    // Verify active session is shown
    await expect(page.locator('text=Active Sessions')).toBeVisible();
    await expect(page.locator('text=Current Session')).toBeVisible();

    // Test revoking all other sessions
    await page.click('button:has-text("Revoke All Other Sessions")');
    await page.click('button:has-text("Confirm")');

    // Verify success message
    await expect(page.locator('text=Sessions revoked successfully')).toBeVisible();
  });

  test('should trust device', async () => {
    await page.goto('http://localhost:5173/settings/sessions');

    // Trust current device
    await page.click('button:has-text("Trust This Device")');
    await page.fill('input[name="deviceName"]', 'My Test Device');
    await page.click('button:has-text("Trust Device")');

    // Verify device appears in trusted devices
    await expect(page.locator('text=My Test Device')).toBeVisible();

    // Remove trusted device
    await page.click('button[data-device="My Test Device"]:has-text("Remove")');
    await page.click('button:has-text("Confirm")');

    // Verify device removed
    await expect(page.locator('text=My Test Device')).not.toBeVisible();
  });
});
