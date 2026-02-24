import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('navigating to non-existent route shows 404 page', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz');
    // not-found.tsx renders "404" and "Page Not Found"
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Page Not Found')).toBeVisible();
  });

  test('404 page Dashboard link navigates to /', async ({ page }) => {
    await page.goto('/nonexistent-route-xyz');
    await expect(page.getByText('404')).toBeVisible();

    // Click "Dashboard" button (Link to /)
    const dashboardBtn = page.getByRole('link', { name: /dashboard/i });
    await dashboardBtn.click();
    await expect(page).toHaveURL('/');
  });
});
