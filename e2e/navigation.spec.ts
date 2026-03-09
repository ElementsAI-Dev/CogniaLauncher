import type { Page } from '@playwright/test';

import {
  test,
  expect,
  navigateTo,
  toggleSidebar,
  expectNoFatalOverlay,
  SIDEBAR,
} from './fixtures/app-fixture';

async function getSidebar(appPage: Page, isMobile: boolean) {
  if (isMobile) {
    const trigger = appPage.locator('[data-sidebar="trigger"]').first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const mobileSidebar = appPage.locator('[data-sidebar="sidebar"][data-mobile="true"]').first();
    await expect(mobileSidebar).toBeVisible();
    return mobileSidebar;
  }

  const desktopSidebar = appPage.locator(SIDEBAR).first();
  await expect(desktopSidebar).toBeVisible();
  return desktopSidebar;
}

test.describe('Navigation & Layout', () => {
  test('app loads at / with sidebar visible', async ({ appPage, isMobile }) => {
    await getSidebar(appPage, isMobile);
    // Breadcrumb should show "Dashboard" as the current page
    await expect(appPage.locator('nav[aria-label="breadcrumb"]')).toContainText('Dashboard');
  });

  test('all primary nav items are visible in sidebar', async ({ appPage, isMobile }) => {
    const sidebar = await getSidebar(appPage, isMobile);
    const expectedLabels = [
      'Dashboard',
      'Environments',
      'Packages',
      'Providers',
      'Cache',
      'Downloads',
      'Git',
      'Env Variables',
      'Terminal',
      'Toolbox',
      'WSL',
      'Logs',
      'Documentation',
      'Settings',
      'About',
    ];
    for (const label of expectedLabels) {
      await expect(sidebar.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('sidebar links expose expected route hrefs', async ({ appPage, isMobile }) => {
    const sidebar = await getSidebar(appPage, isMobile);
    const routes = [
      '/toolbox',
      '/settings',
      '/about',
    ];

    for (const path of routes) {
      const link = sidebar.locator(`a[href="${path}"]`).first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', path);
    }
  });

  test('sidebar collapse/expand toggles width', async ({ appPage, isMobile }) => {
    test.skip(isMobile, 'Desktop-only collapsible sidebar behavior');

    const desktopSidebar = appPage.locator('[data-slot="sidebar"]').first();
    const sidebar = appPage.locator(SIDEBAR);
    // Initially expanded — sidebar text should be visible
    await expect(sidebar.getByText('Dashboard').first()).toBeVisible();

    // Click sidebar trigger to collapse
    await toggleSidebar(appPage);
    await expect(desktopSidebar).toHaveAttribute('data-collapsible', 'icon');

    // Click again to expand
    await toggleSidebar(appPage);
    await expect(desktopSidebar).toHaveAttribute('data-collapsible', '');
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

  test('environments submenu exposes health report route', async ({ appPage, isMobile }) => {
    const sidebar = await getSidebar(appPage, isMobile);
    const environmentsTrigger = sidebar.getByRole('button', { name: /environments/i }).first();
    await environmentsTrigger.click();

    const healthLink = sidebar.locator('a[href="/health"]').first();
    await expect(healthLink).toBeVisible();
    await expect(healthLink).toContainText(/health report/i);
    await expectNoFatalOverlay(appPage);
  });

  test('direct route transitions remain stable', async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
    await expect(appPage).toHaveURL(/\/settings/);

    await navigateTo(appPage, '/about');
    await expect(appPage).toHaveURL(/\/about/);
    await expectNoFatalOverlay(appPage);
  });
});
