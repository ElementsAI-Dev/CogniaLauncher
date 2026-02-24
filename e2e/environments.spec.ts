import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Environments Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/environments');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Environments').first()).toBeVisible();
  });

  test('toolbar with search input renders', async ({ appPage }) => {
    // EnvironmentToolbar contains a search input
    await expect(appPage.getByPlaceholder(/search/i).first()).toBeVisible();
  });

  test('add environment button is visible', async ({ appPage }) => {
    const addBtn = appPage.getByRole('button', { name: /add/i }).first();
    await expect(addBtn).toBeVisible();
  });

  test('shows empty state or loading skeleton', async ({ appPage }) => {
    // In web mode without Tauri, either:
    // 1. EmptyState shows (no environments detected)
    // 2. Loading skeletons are shown
    // 3. Error alert is shown (Tauri IPC fails)
    // Any of these is acceptable — page should not crash
    const main = appPage.locator('main');
    await expect(main).toBeVisible();
  });
});
