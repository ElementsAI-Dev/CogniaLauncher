import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('WSL Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/wsl');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('WSL').first()).toBeVisible();
  });

  test('shows fallback state in web mode', async ({ appPage }) => {
    // In web mode (isTauri()=false), WSL page shows loading/fallback
    // The page should render without crashing
    await expect(appPage.locator('main')).toBeVisible();
  });
});
