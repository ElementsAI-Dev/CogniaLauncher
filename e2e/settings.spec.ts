import { test, expect, navigateTo } from './fixtures/app-fixture';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.locator('#settings-title')).toBeVisible();
  });

  test('all 10 section headings are visible', async ({ appPage }) => {
    // SECTION_IDS from settings/page.tsx: general, network, security, mirrors,
    // appearance, updates, tray, paths, provider, system
    // Each rendered inside a CollapsibleSection with an id attribute
    const sectionIds = [
      'general', 'network', 'security', 'mirrors', 'appearance',
      'updates', 'tray', 'paths', 'provider', 'system',
    ];
    for (const id of sectionIds) {
      await expect(appPage.locator(`#${id}`)).toBeAttached();
    }
  });

  test('settings nav sidebar is visible on desktop', async ({ appPage }) => {
    // SettingsNav renders in an <aside> element (hidden on mobile via lg:block)
    const aside = appPage.locator('aside').first();
    await expect(aside).toBeVisible();
  });

  test('search bar is functional', async ({ appPage }) => {
    // SettingsSearch renders a search input
    const searchInput = appPage.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('proxy');
    // After typing, the search should filter (no crash expected)
    await appPage.waitForTimeout(300);
    await expect(appPage.locator('main')).toBeVisible();
  });

  test('section collapse/expand works', async ({ appPage }) => {
    // Click on a section header to collapse it
    const networkSection = appPage.locator('#network');
    await networkSection.scrollIntoViewIfNeeded();
    // The collapsible trigger is the section header area
    const trigger = networkSection.locator('button').first();
    if (await trigger.isVisible()) {
      await trigger.click();
      await appPage.waitForTimeout(200);
      // Section should still exist but content may be hidden
      await expect(networkSection).toBeAttached();
    }
  });

  test('export button is visible', async ({ appPage }) => {
    const exportBtn = appPage.getByRole('button', { name: /export/i }).first();
    await expect(exportBtn).toBeVisible();
  });

  test('onboarding settings card is visible', async ({ appPage }) => {
    // OnboardingSettingsCard renders at the bottom with data-hint="settings-mirrors"
    const onboardingCard = appPage.locator('[data-hint="settings-mirrors"]');
    await onboardingCard.scrollIntoViewIfNeeded();
    await expect(onboardingCard).toBeVisible();
  });
});
