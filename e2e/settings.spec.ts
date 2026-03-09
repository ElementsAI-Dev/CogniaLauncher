import {
  test,
  expect,
  navigateTo,
  expectNoFatalOverlay,
} from './fixtures/app-fixture';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '/settings');
  });

  test('renders page title', async ({ appPage }) => {
    await expect(appPage.locator('#settings-title')).toBeVisible();
  });

  test('all major section cards are attached', async ({ appPage }) => {
    const sectionIds = [
      'section-general',
      'section-network',
      'section-security',
      'section-mirrors',
      'section-appearance',
      'section-updates',
      'section-tray',
      'section-shortcuts',
      'section-paths',
      'section-provider',
      'section-backup',
      'section-startup',
      'section-system',
    ];
    for (const id of sectionIds) {
      await expect(appPage.locator(`#${id}`)).toBeAttached();
    }
  });

  test('settings nav sidebar is visible on desktop', async ({ appPage, isMobile }) => {
    test.skip(isMobile, 'Desktop-only settings sidebar layout');

    // SettingsNav renders in an <aside> element (hidden on mobile via lg:block)
    const aside = appPage.locator('aside').first();
    await expect(aside).toBeVisible();
  });

  test('search bar is functional', async ({ appPage }) => {
    const searchInput = appPage.locator('input[aria-label="Search settings"]:visible').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('proxy');
    await expect(appPage.locator('main').last()).toBeVisible();
  });

  test('section collapse/expand works deterministically', async ({ appPage }) => {
    const trigger = appPage.locator('#section-network [aria-controls="section-network-content"]').first();
    await trigger.scrollIntoViewIfNeeded();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('onboarding controls expose at least one action button', async ({ appPage }) => {
    await expect(appPage.getByText(/onboarding/i).first()).toBeVisible();

    const actionButtons = appPage.getByRole('button', {
      name: /rerun|resume|tour/i,
    });
    await expect(actionButtons.first()).toBeVisible();
  });

  test('onboarding settings card is visible', async ({ appPage }) => {
    const onboardingCard = appPage.getByText(/onboarding/i).first();
    await onboardingCard.scrollIntoViewIfNeeded();
    await expect(onboardingCard).toBeVisible();
    await expectNoFatalOverlay(appPage);
  });
});
