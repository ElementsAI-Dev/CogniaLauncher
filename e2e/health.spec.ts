import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Health Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/health');
  });

  test('renders health page title', async ({ appPage }) => {
    await expect(appPage.getByText('Health Check').first()).toBeVisible();
  });

  test('shows desktop-only fallback in web mode', async ({ appPage }) => {
    await expect(appPage.getByText(/desktop app required/i).first()).toBeVisible();
    await expect(appPage.getByText(/desktop mode only/i).first()).toBeVisible();

    await expect(appPage.getByRole('button', { name: /run check/i })).toHaveCount(0);
    await expect(appPage.getByRole('tablist')).toHaveCount(0);
  });

  test('page stays stable without desktop runtime', async ({ appPage }) => {
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
