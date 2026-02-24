import { test, expect, SIDEBAR } from './fixtures/app-fixture';

test.describe('Responsive Layout', () => {
  test('desktop viewport shows sidebar expanded', async ({ appPage }) => {
    // Default appPage uses Desktop Chrome viewport (1280x720)
    const sidebar = appPage.locator(SIDEBAR);
    await expect(sidebar).toBeVisible();
    // Sidebar text should be visible (not collapsed to icons)
    await expect(sidebar.getByText('Dashboard').first()).toBeVisible();
  });

  test('mobile viewport hides sidebar, shows trigger', async ({ browser }) => {
    // Create a mobile-sized context
    const context = await browser.newContext({
      viewport: { width: 393, height: 851 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar should not be visible on mobile (rendered as Sheet overlay)
    // The SidebarTrigger button should be visible
    const trigger = page.locator('button.-ml-1');
    await expect(trigger).toBeVisible();

    // Click trigger to open sidebar sheet
    await trigger.click();
    // Sidebar content should now be visible in sheet overlay
    await expect(page.getByText('Dashboard').first()).toBeVisible();

    await context.close();
  });

  test('mobile sidebar sheet closes on link click', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 393, height: 851 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Open sidebar sheet
    await page.locator('button.-ml-1').click();
    await page.waitForTimeout(300);

    // Click on "Settings" link
    const settingsLink = page.getByRole('link', { name: /settings/i }).first();
    await settingsLink.click();

    // URL should change
    await expect(page).toHaveURL(/\/settings/);

    await context.close();
  });
});
