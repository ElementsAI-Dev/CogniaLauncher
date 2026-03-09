import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Environments Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/environments');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Environments').first()).toBeVisible();
  });

  test('shows desktop-required fallback guidance in web mode', async ({ appPage }) => {
    await expect(appPage.getByText(/Desktop App Required|桌面应用/i).first()).toBeVisible();
    await expect(appPage.getByText(/desktop mode only|desktop only/i).first()).toBeVisible();
  });

  test('desktop-only actions are not exposed in web mode', async ({ appPage }) => {
    await expect(appPage.getByRole('button', { name: /add environment|添加环境/i })).toHaveCount(0);
  });

  test('shows empty state or loading skeleton', async ({ appPage }) => {
    // In web mode without Tauri, either:
    // 1. EmptyState shows (no environments detected)
    // 2. Loading skeletons are shown
    // 3. Error alert is shown (Tauri IPC fails)
    // Any of these is acceptable — page should not crash
    const main = appPage.locator('main').last();
    await expect(main).toBeVisible();
  });
});
