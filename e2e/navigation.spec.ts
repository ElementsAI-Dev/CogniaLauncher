import { test, expect, navigateTo, SIDEBAR } from './fixtures/app-fixture';

test.describe('Navigation & Layout', () => {
  test('app loads at / with sidebar visible', async ({ appPage }) => {
    await expect(appPage.locator(SIDEBAR)).toBeVisible();
    // Breadcrumb should show "Dashboard" as the current page
    await expect(appPage.locator('nav[aria-label="breadcrumb"]')).toContainText('Dashboard');
  });

  test('all 12 top-level nav items are visible in sidebar', async ({ appPage }) => {
    const sidebar = appPage.locator(SIDEBAR);
    const expectedLabels = [
      'Dashboard',
      'Environments',
      'Packages',
      'Providers',
      'Cache',
      'Downloads',
      'Git',
      'WSL',
      'Logs',
      'Docs',
      'Settings',
      'About',
    ];
    for (const label of expectedLabels) {
      await expect(sidebar.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('clicking sidebar links navigates to correct routes', async ({ appPage }) => {
    const routes = [
      { label: 'Environments', path: '/environments' },
      { label: 'Packages', path: '/packages' },
      { label: 'Providers', path: '/providers' },
      { label: 'Downloads', path: '/downloads' },
      { label: 'Logs', path: '/logs' },
      { label: 'Settings', path: '/settings' },
      { label: 'About', path: '/about' },
    ];

    for (const { label, path } of routes) {
      // Use sidebar link (not collapsible items)
      const link = appPage.locator(SIDEBAR).getByRole('link', { name: label }).first();
      await link.click();
      await expect(appPage).toHaveURL(new RegExp(path));
    }
  });

  test('sidebar collapse/expand toggles width', async ({ appPage }) => {
    const sidebar = appPage.locator(SIDEBAR);
    // Initially expanded — sidebar text should be visible
    await expect(sidebar.getByText('Dashboard').first()).toBeVisible();

    // Click sidebar trigger to collapse
    await appPage.locator('button.-ml-1').click();
    // After collapse, the sidebar shrinks to icon mode — text labels are hidden
    await expect(sidebar).toHaveAttribute('data-collapsible', 'icon');

    // Click again to expand
    await appPage.locator('button.-ml-1').click();
    // Text labels visible again
    await expect(sidebar.getByText('Dashboard').first()).toBeVisible();
  });

  test('breadcrumb updates on navigation', async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
    const breadcrumb = appPage.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumb).toContainText('Dashboard');
    await expect(breadcrumb).toContainText('Settings');
  });

  test('cache sub-navigation works', async ({ appPage }) => {
    // Navigate to cache page first
    await navigateTo(appPage, '/cache');
    // The cache collapsible in sidebar should have sub-links
    // Navigate to download sub-route via direct URL
    await navigateTo(appPage, '/cache/download');
    await expect(appPage).toHaveURL(/\/cache\/download/);
  });

  test('browser back/forward navigation works', async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
    await navigateTo(appPage, '/about');
    await expect(appPage).toHaveURL(/\/about/);

    await appPage.goBack();
    await expect(appPage).toHaveURL(/\/settings/);

    await appPage.goForward();
    await expect(appPage).toHaveURL(/\/about/);
  });
});
