import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Logs Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/logs');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Logs').first()).toBeVisible();
  });

  test('tabs are visible', async ({ appPage }) => {
    // Logs page has Tabs component with real-time and file tabs
    const tabList = appPage.getByRole('tablist').first();
    await expect(tabList).toBeVisible();
  });
});
