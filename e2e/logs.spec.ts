import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Logs Page', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop logs flow is validated in chromium only.');

  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/logs');
    const onboardingClose = appPage.getByRole('button', { name: /Close|关闭/i });
    if (await onboardingClose.isVisible().catch(() => false)) {
      await onboardingClose.click();
    }
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.getByText(/Logs|日志/).first()).toBeVisible();
  });

  test('tabs are visible', async ({ appPage }) => {
    const tabs = appPage.getByRole('tab');
    await expect(tabs.first()).toBeVisible();
    await expect(tabs.nth(1)).toBeVisible();
    await expect(tabs).toHaveCount(2);
  });

  test('files tab shows desktop-only guidance in non-tauri mode', async ({ appPage }) => {
    await appPage.getByRole('tab').nth(1).click();

    await expect(appPage.getByText(/Desktop|桌面/i).first()).toBeVisible();
    await expect(appPage.getByText(/Delete Selected|删除所选/i)).toHaveCount(0);
  });

  test('realtime export menu exposes txt/json/csv options', async ({ appPage }) => {
    await appPage.getByRole('tab').first().click();

    await appPage.locator('button:has(svg.lucide-download)').first().click();
    await expect(appPage.getByText(/Export TXT|导出 TXT/i)).toBeVisible();
    await expect(appPage.getByText(/Export JSON|导出 JSON/i)).toBeVisible();
    await expect(appPage.getByText(/Export CSV|导出 CSV/i)).toBeVisible();
  });

  test('advanced filter controls are reachable in realtime tab', async ({ appPage }) => {
    await appPage.getByRole('tab').first().click();
    await appPage.getByRole('button', { name: /Advanced|高级/i }).first().click();
    await expect(appPage.getByText(/Regex|正则/i).first()).toBeVisible();
  });
});
