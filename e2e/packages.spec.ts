import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Packages Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/packages');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Packages').first()).toBeVisible();
  });

  test('tabs render (installed, search, updates)', async ({ appPage }) => {
    // TabsList with tab triggers
    const tabList = appPage.getByRole('tablist').first();
    await expect(tabList).toBeVisible();
  });

  test('search bar is visible', async ({ appPage }) => {
    const searchInput = appPage.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
  });

  test('page does not crash without Tauri backend', async ({ appPage }) => {
    // In web mode, data fetches fail gracefully
    await expect(appPage.locator('main')).toBeVisible();
  });
});
