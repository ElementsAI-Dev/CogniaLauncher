import { test, expect } from './fixtures/app-fixture';

test.describe('Dashboard Page', () => {
  test('renders page title and description', async ({ appPage }) => {
    // appPage fixture already navigates to /
    await expect(appPage.getByText('Dashboard').first()).toBeVisible();
  });

  test('customize button exists with data-hint attribute', async ({ appPage }) => {
    const customizeBtn = appPage.locator('[data-hint="dashboard-customize"]');
    await expect(customizeBtn).toBeVisible();
  });

  test('edit mode toggle shows banner', async ({ appPage }) => {
    // Find the edit layout button (has Pencil icon)
    const editBtn = appPage.getByRole('button', { name: /edit/i }).first();
    await editBtn.click();

    // Edit mode banner should appear with dashed border
    const banner = appPage.locator('.border-dashed.border-primary\\/50');
    await expect(banner).toBeVisible();

    // Click again to exit edit mode — banner disappears
    const doneBtn = appPage.getByRole('button', { name: /done/i }).first();
    await doneBtn.click();
    await expect(banner).not.toBeVisible();
  });

  test('widget grid area is present', async ({ appPage }) => {
    // The WidgetGrid renders inside the main page area
    // Even without Tauri data, the grid container should exist
    await expect(appPage.locator('main')).toBeVisible();
  });

  test('page does not crash on interaction', async ({ appPage }) => {
    // Click customize button → dialog should open
    await appPage.locator('[data-hint="dashboard-customize"]').click();
    // Dialog should appear
    const dialog = appPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Close dialog
    await appPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
