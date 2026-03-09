import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

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

  test('switches between queue and history tabs', async ({ appPage }) => {
    const historyTab = appPage.getByRole('tab', { name: /download history|history/i }).first();
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');

    await expect(appPage.getByPlaceholder(/search history/i)).toBeVisible();
  });

  test('page remains stable in web mode', async ({ appPage }) => {
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
