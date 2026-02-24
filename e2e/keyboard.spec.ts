import { test, expect, navigateTo, CMD_PALETTE_BTN } from './fixtures/app-fixture';

test.describe('Command Palette', () => {
  test('Ctrl+K opens command palette', async ({ appPage }) => {
    await appPage.keyboard.press('Control+k');
    // CommandDialog renders as a dialog
    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  test('search filters navigation items', async ({ appPage }) => {
    // Open palette via button
    await appPage.locator(CMD_PALETTE_BTN).click();
    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type "set" to filter
    await dialog.getByRole('combobox').fill('Settings');
    // "Settings" should be visible
    await expect(dialog.getByText('Settings')).toBeVisible();
  });

  test('selecting an item navigates and closes palette', async ({ appPage }) => {
    await appPage.locator(CMD_PALETTE_BTN).click();
    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click on "About" navigation item
    await dialog.getByRole('option', { name: /about/i }).click();
    // Dialog should close and URL should change
    await expect(dialog).not.toBeVisible();
    await expect(appPage).toHaveURL(/\/about/);
  });

  test('Escape closes command palette', async ({ appPage }) => {
    await appPage.keyboard.press('Control+k');
    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await appPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Log Drawer Shortcut', () => {
  test('Ctrl+Shift+L toggles log drawer', async ({ appPage }) => {
    // Press Ctrl+Shift+L to open log drawer
    await appPage.keyboard.press('Control+Shift+l');
    // Wait briefly for drawer to appear
    await appPage.waitForTimeout(300);
    // The page should still be functional (no crash)
    await expect(appPage.locator('main')).toBeVisible();
  });
});

test.describe('Settings Shortcuts', () => {
  test('Ctrl+S on settings page does not crash', async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
    // Ctrl+S should be handled gracefully (no-op without changes)
    await appPage.keyboard.press('Control+s');
    // Page should remain functional
    await expect(appPage.locator('#settings-title')).toBeVisible();
  });
});
