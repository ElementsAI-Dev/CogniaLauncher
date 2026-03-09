import { test, expect } from './fixtures/app-fixture';

test.describe('Error Handling', () => {
  test('navigating to non-existent route shows 404 page', async ({ appPage }) => {
    await appPage.goto('/nonexistent-route-xyz');
    // not-found.tsx renders "404" and "Page Not Found"
    await expect(appPage.getByText('404')).toBeVisible();
    await expect(appPage.getByText('Page Not Found')).toBeVisible();
  });

  test('404 page Dashboard link navigates to /', async ({ appPage }) => {
    await appPage.goto('/nonexistent-route-xyz');
    await expect(appPage.getByText('404')).toBeVisible();

    const dashboardBtn = appPage.locator('main').last().getByRole('link', { name: /^dashboard$/i });
    await dashboardBtn.click();
    await expect(appPage).toHaveURL('/');
  });
});
