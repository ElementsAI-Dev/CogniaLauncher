import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

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

  test('changelog action opens dialog', async ({ appPage }) => {
    await appPage.getByRole('button', { name: /changelog/i }).first().click();
    await expect(appPage.getByRole('dialog')).toBeVisible();
    await appPage.keyboard.press('Escape');
  });

  test('page remains stable when actions are triggered in web mode', async ({ appPage }) => {
    await appPage.getByRole('button', { name: /check for updates/i }).first().click();
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
