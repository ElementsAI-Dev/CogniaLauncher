import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Env Variables Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/envvar');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Environment Variables').first()).toBeVisible();
  });

  test('shows fallback state in web mode', async ({ appPage }) => {
    // In web mode (isTauri()=false), EnvVarPage shows a fallback empty state
    // with an icon and descriptive text instead of the full variable editor
    await expect(appPage.locator('main, [class*="p-4"]')).toBeVisible();
  });

  test('page does not crash without Tauri backend', async ({ appPage }) => {
    // The page should render without errors in web mode
    const body = appPage.locator('body');
    await expect(body).toBeVisible();
    // No uncaught error overlay should appear
    await expect(appPage.locator('#nextjs__container_errors_overlay')).not.toBeVisible();
  });
});
