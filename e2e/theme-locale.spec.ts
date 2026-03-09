import type { Page } from '@playwright/test';

import { test, expect, navigateTo, waitForAppReady, SIDEBAR } from './fixtures/app-fixture';

async function getVisibleSidebar(appPage: Page, isMobile: boolean) {
  if (isMobile) {
    const trigger = appPage.locator('[data-sidebar="trigger"]').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const mobileSidebar = appPage.locator('[data-sidebar="sidebar"][data-mobile="true"]').first();
    await expect(mobileSidebar).toBeVisible();
    return mobileSidebar;
  }

  const sidebar = appPage.locator(SIDEBAR).first();
  await expect(sidebar).toBeVisible();
  return sidebar;
}

function themeToggle(appPage: Page) {
  return appPage.getByRole('button', { name: /toggle theme|切换主题/i }).first();
}

function languageToggle(appPage: Page) {
  return appPage.getByRole('button', { name: /toggle language|切换语言/i }).first();
}

test.describe('Theme Switching', () => {
  test('switch to dark mode adds .dark class to html', async ({ appPage }) => {
    await themeToggle(appPage).click();

    // Select "Dark" from dropdown
    await appPage.getByRole('menuitemradio', { name: /dark|深色/i }).click();

    // <html> should have class "dark"
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });

  test('switch to light mode removes .dark class', async ({ appPage }) => {
    await themeToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: /dark|深色/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    await themeToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: /light|浅色/i }).click();
    await expect(appPage.locator('html')).not.toHaveClass(/dark/);
  });

  test('theme persists across navigation', async ({ appPage }) => {
    await themeToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: /dark|深色/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    await navigateTo(appPage, '/settings');
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });

  test('theme persists across page reload', async ({ appPage }) => {
    await themeToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: /dark|深色/i }).click();
    await expect(appPage.locator('html')).toHaveClass(/dark/);

    await appPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(appPage);
    await expect(appPage.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('Locale Switching', () => {
  test('switch to Chinese changes sidebar labels', async ({ appPage, isMobile }) => {
    await languageToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();

    const sidebar = await getVisibleSidebar(appPage, isMobile);
    await expect(sidebar.getByText('仪表盘').first()).toBeVisible();
  });

  test('switch back to English reverts labels', async ({ appPage, isMobile }) => {
    await languageToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();
    let sidebar = await getVisibleSidebar(appPage, isMobile);
    await expect(sidebar.getByText('仪表盘').first()).toBeVisible();

    if (isMobile) {
      const viewport = appPage.viewportSize();
      if (viewport) {
        await appPage.mouse.click(viewport.width - 4, 8);
      } else {
        await appPage.keyboard.press('Escape');
      }
    }

    await languageToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: 'English' }).click();
    sidebar = await getVisibleSidebar(appPage, isMobile);
    await expect(sidebar.getByText('Dashboard').first()).toBeVisible();
  });

  test('locale persists across navigation', async ({ appPage, isMobile }) => {
    await languageToggle(appPage).click();
    await appPage.getByRole('menuitemradio', { name: '中文' }).click();
    let sidebar = await getVisibleSidebar(appPage, isMobile);
    await expect(sidebar.getByText('仪表盘').first()).toBeVisible();

    await navigateTo(appPage, '/settings');

    sidebar = await getVisibleSidebar(appPage, isMobile);
    await expect(sidebar.getByText('仪表盘').first()).toBeVisible();
  });
});
