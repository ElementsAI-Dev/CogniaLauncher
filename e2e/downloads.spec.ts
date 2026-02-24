import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Downloads Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/downloads');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Downloads').first()).toBeVisible();
  });

  test('tabs render (active/history)', async ({ appPage }) => {
    const tabList = appPage.getByRole('tablist').first();
    await expect(tabList).toBeVisible();
  });
});
