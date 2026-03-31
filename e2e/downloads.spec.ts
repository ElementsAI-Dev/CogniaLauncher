import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Downloads Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/downloads');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText('Downloads').first()).toBeVisible();
  });

  test('toolbar actions and search render', async ({ appPage }) => {
    await expect(appPage.getByRole('button', { name: /add download/i })).toBeVisible();
    await expect(appPage.getByRole('button', { name: /batch import/i })).toBeVisible();
    await expect(appPage.getByRole('button', { name: /from github/i })).toBeVisible();
    await expect(appPage.getByRole('button', { name: /from gitlab/i })).toBeVisible();
    await expect(appPage.getByPlaceholder(/search downloads/i)).toBeVisible();
  });

  test('opens settings panel and add download dialog', async ({ appPage }) => {
    await appPage.getByRole('button', { name: /settings/i }).first().click();
    await expect(appPage.getByText(/clipboard monitor/i)).toBeVisible();

    await appPage.getByRole('button', { name: /add download/i }).click();
    await expect(appPage.getByLabel(/url/i)).toBeVisible();
  });

  test('page remains stable in web mode', async ({ appPage }) => {
    await expect(appPage.locator('main').last()).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
