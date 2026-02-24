import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('About Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/about');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText(/about/i).first()).toBeVisible();
  });

  test('build dependencies section is visible', async ({ appPage }) => {
    await expect(appPage.getByText(/build dependencies/i).first()).toBeVisible();
    await expect(appPage.getByText('Tauri').first()).toBeVisible();
    await expect(appPage.getByText('React').first()).toBeVisible();
  });

  test('license section is visible', async ({ appPage }) => {
    await expect(appPage.getByText(/mit license/i).first()).toBeVisible();
  });
});
