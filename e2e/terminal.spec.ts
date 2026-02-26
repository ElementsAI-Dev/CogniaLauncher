import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Terminal Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/terminal');
  });

  test('page loads with tabs visible', async ({ appPage }) => {
    await expect(appPage.getByRole('tab', { name: /Shells/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /Profiles/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /Shell Config/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /Frameworks/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /PowerShell/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /Proxy/i })).toBeVisible();
    await expect(appPage.getByRole('tab', { name: /Environment/i })).toBeVisible();
  });

  test('tab navigation switches content', async ({ appPage }) => {
    // Click Profiles tab
    await appPage.getByRole('tab', { name: /Profiles/i }).click();
    await expect(appPage.getByText(/Create Profile|No terminal profiles/i)).toBeVisible();

    // Click Environment tab
    await appPage.getByRole('tab', { name: /Environment/i }).click();
    await expect(appPage.getByText(/Shell Environment Variables|No environment variables/i)).toBeVisible();
  });

  test('shells tab shows content area', async ({ appPage }) => {
    // Default tab is shells - verify content area exists
    const shellsContent = appPage.locator('[role="tabpanel"]');
    await expect(shellsContent).toBeVisible();
  });
});
