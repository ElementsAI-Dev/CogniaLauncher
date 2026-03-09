import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Docs Page', () => {
  test('docs index page renders', async ({ appPage }) => {
    await navigateTo(appPage, '/docs');
    // Docs page is a Server Component that reads static markdown
    // In dev mode it should render content from docs/ directory
    await expect(appPage.locator('main').last()).toBeVisible();
  });

  test('docs navigation search is interactive', async ({ appPage, isMobile }) => {
    await navigateTo(appPage, '/docs');

    if (isMobile) {
      await appPage.getByRole('button', { name: /menu/i }).first().click();
    }

    const searchTrigger = appPage.getByRole('button', { name: /search docs/i }).first();
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    const searchInput = appPage.getByPlaceholder(/search docs/i).last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('environment');
    await expect(searchInput).toHaveValue('environment');
  });

  test('docs search shows graceful no-results state', async ({ appPage, isMobile }) => {
    await navigateTo(appPage, '/docs');

    if (isMobile) {
      await appPage.getByRole('button', { name: /menu/i }).first().click();
    }

    const searchTrigger = appPage.getByRole('button', { name: /search docs/i }).first();
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    const searchInput = appPage.getByPlaceholder(/search docs/i).last();
    await searchInput.fill('definitely-no-doc-match-xyz');
    await expect(appPage.getByText(/no results found/i)).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
