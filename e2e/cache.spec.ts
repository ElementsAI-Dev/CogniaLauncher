import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Cache Pages', () => {
  test('cache overview page renders', async ({ appPage }) => {
    await navigateTo(appPage, '/cache');
    await expect(appPage.locator('main')).toBeVisible();
  });

  test('sub-route /cache/download renders', async ({ appPage }) => {
    await navigateTo(appPage, '/cache/download');
    await expect(appPage).toHaveURL(/\/cache\/download/);
    await expect(appPage.locator('main')).toBeVisible();
  });

  test('sub-route /cache/metadata renders', async ({ appPage }) => {
    await navigateTo(appPage, '/cache/metadata');
    await expect(appPage).toHaveURL(/\/cache\/metadata/);
    await expect(appPage.locator('main')).toBeVisible();
  });
});
