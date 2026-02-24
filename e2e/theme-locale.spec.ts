import { test, expect, navigateTo, SIDEBAR } from './fixtures/app-fixture';

test.describe('Theme Switching', () => {
  test('switch to dark mode adds .dark class to html', async ({ appPage }) => {
    // Click theme toggle button (has sr-only text)
    const themeToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle theme/i }) }).first();
    await themeToggle.click();

    // Select "Dark" from dropdown
    await appPage.getByRole('menuitemradio', { name: /dark/i }).click();

    // <html> should have class "dark"
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });

  test('switch to light mode removes .dark class', async ({ appPage }) => {
    // First set dark
    const themeToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle theme/i }) }).first();
    await themeToggle.click();
    await appPage.getByRole('menuitemradio', { name: /dark/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    // Now switch to light
    await themeToggle.click();
    await appPage.getByRole('menuitemradio', { name: /light/i }).click();
    await expect(appPage.locator('html')).not.toHaveClass(/dark/);
  });

  test('theme persists across navigation', async ({ appPage }) => {
    // Set dark theme
    const themeToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle theme/i }) }).first();
    await themeToggle.click();
    await appPage.getByRole('menuitemradio', { name: /dark/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    // Navigate to settings
    await navigateTo(appPage, '/settings');
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });

  test('theme persists across page reload', async ({ appPage }) => {
    // Set dark theme
    const themeToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle theme/i }) }).first();
    await themeToggle.click();
    await appPage.getByRole('menuitemradio', { name: /dark/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    // Reload page
    await appPage.reload();
    await appPage.waitForSelector(SIDEBAR, { state: 'visible', timeout: 15_000 });
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('Locale Switching', () => {
  test('switch to Chinese changes sidebar labels', async ({ appPage }) => {
    // Click language toggle button
    const langToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle language/i }) }).first();
    await langToggle.click();

    // Select Chinese (中文)
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();

    // Sidebar should now show Chinese labels — "仪表板" for Dashboard
    await expect(appPage.locator(SIDEBAR).getByText('仪表板').first()).toBeVisible();
  });

  test('switch back to English reverts labels', async ({ appPage }) => {
    // Switch to Chinese first
    const langToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle language/i }) }).first();
    await langToggle.click();
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();
    await expect(appPage.locator(SIDEBAR).getByText('仪表板').first()).toBeVisible();

    // Switch back to English
    await langToggle.click();
    await appPage.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(appPage.locator(SIDEBAR).getByText('Dashboard').first()).toBeVisible();
  });

  test('locale persists across navigation', async ({ appPage }) => {
    // Switch to Chinese
    const langToggle = appPage.locator(SIDEBAR).locator('button').filter({ has: appPage.locator('.sr-only', { hasText: /toggle language/i }) }).first();
    await langToggle.click();
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();
    await expect(appPage.locator(SIDEBAR).getByText('仪表板').first()).toBeVisible();

    // Navigate to settings
    await navigateTo(appPage, '/settings');

    // Should still be in Chinese
    await expect(appPage.locator(SIDEBAR).getByText('仪表板').first()).toBeVisible();
  });
});
