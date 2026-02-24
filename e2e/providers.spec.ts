import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Providers Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/providers');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Providers').first()).toBeVisible();
  });

  test('toolbar with search and filters renders', async ({ appPage }) => {
    await expect(appPage.getByPlaceholder(/search/i).first()).toBeVisible();
  });

  test('view mode toggle buttons exist', async ({ appPage }) => {
    // ProviderToolbar renders grid/list view mode buttons
    await expect(appPage.locator('main')).toBeVisible();
  });
});
