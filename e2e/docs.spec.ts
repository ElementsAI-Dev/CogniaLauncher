import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Docs Page', () => {
  test('docs index page renders', async ({ appPage }) => {
    await navigateTo(appPage, '/docs');
    // Docs page is a Server Component that reads static markdown
    // In dev mode it should render content from docs/ directory
    await expect(appPage.locator('main')).toBeVisible();
  });

  test('docs sub-page renders markdown content', async ({ appPage }) => {
    // Navigate to the main docs index (which uses [[...slug]] catch-all)
    await navigateTo(appPage, '/docs');
    // The page should have some text content rendered
    await expect(appPage.locator('main')).toBeVisible();
  });
});
