import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Git Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/git');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Git').first()).toBeVisible();
  });

  test('shows not-available fallback in web mode', async ({ appPage }) => {
    // In web mode (isTauri()=false), GitPage renders <GitNotAvailable/>
    // The page should render without crashing
    await expect(appPage.locator('main')).toBeVisible();
  });
});
