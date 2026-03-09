import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Packages Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/packages');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByRole('heading', { name: /packages|包管理/i })).toBeVisible();
  });

  test('shows desktop-only fallback in web mode', async ({ appPage }) => {
    await expect(appPage.getByTestId('packages-web-fallback')).toBeVisible();
    await expect(appPage.getByText(/desktop app required|需要桌面应用/i).first()).toBeVisible();
    await expect(appPage.getByText(/desktop mode only|仅在桌面模式下可用/i).first()).toBeVisible();

    await expect(appPage.getByRole('tablist')).toHaveCount(0);
    await expect(appPage.getByRole('searchbox')).toHaveCount(0);
  });

  test('page does not crash without Tauri backend', async ({ appPage }) => {
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
