import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Env Variables Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/envvar');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Environment Variables').first()).toBeVisible();
  });

  test('shows fallback state in web mode', async ({ appPage }) => {
    await expect(appPage.getByText(/Desktop Required|桌面版/i).first()).toBeVisible();
    await expect(
      appPage.getByText(/only available in the Cognia desktop application|desktop application/i).first(),
    ).toBeVisible();
  });

  test('does not render desktop envvar tabs in web mode', async ({ appPage }) => {
    await expect(appPage.getByTestId('envvar-tabs')).toHaveCount(0);
  });

  test('page does not crash without Tauri backend', async ({ appPage }) => {
    // The page should render without errors in web mode
    const body = appPage.locator('body');
    await expect(body).toBeVisible();
    // No uncaught error overlay should appear
    await expect(appPage.locator('#nextjs__container_errors_overlay')).not.toBeVisible();
  });
});
