import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

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

  test('search and view mode interactions are functional', async ({ appPage }) => {
    const searchInput = appPage.getByPlaceholder(/search providers/i).first();
    await searchInput.fill('npm');
    await expect(searchInput).toHaveValue('npm');

    const listViewToggle = appPage.locator('[aria-label="List view"]').first();
    await listViewToggle.click();
    await expect(listViewToggle).toHaveAttribute('aria-checked', 'true');
  });

  test('page stays stable under web-mode provider calls', async ({ appPage }) => {
    await appPage.getByRole('button', { name: /check status/i }).first().click();
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
