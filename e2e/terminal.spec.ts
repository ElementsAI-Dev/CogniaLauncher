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
    const profilesPanel = appPage.getByRole('tabpanel', { name: /Profiles/i });
    await expect(profilesPanel).toBeVisible();
    await expect(profilesPanel.getByRole('button', { name: /Create Profile/i }).first()).toBeVisible();

    // Click Environment tab
    await appPage.getByRole('tab', { name: /Environment/i }).click();
    const environmentPanel = appPage.getByRole('tabpanel', { name: /Environment/i });
    await expect(environmentPanel).toBeVisible();
    await expect(
      environmentPanel.getByText(/Shell Environment Variables|No environment variables/i).first(),
    ).toBeVisible();
  });

  test('shells tab shows content area', async ({ appPage }) => {
    // Default tab is shells - verify content area exists
    const shellsContent = appPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(shellsContent).toBeVisible();
  });
});
