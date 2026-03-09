import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared E2E test fixture for CogniaLauncher.
 *
 * Provides helpers to wait for the app shell to be ready and
 * interact with common UI elements (theme toggle, language toggle, etc.).
 *
 * In web mode (`isTauri() = false`):
 * - SplashScreen is NOT shown (showSplash = false)
 * - Desktop-only pages (Git, WSL) show fallback components
 * - Tauri IPC calls fail gracefully / return empty data
 */

// ── Selectors (verified against source) ─────────────────────────────────────

/** data-tour="sidebar" on <Sidebar> in app-sidebar.tsx:81 */
const SIDEBAR = '[data-tour="sidebar"]';

/** SidebarTrigger button from ui/sidebar.tsx */
const SIDEBAR_TRIGGER = '[data-sidebar="trigger"]';

/** data-tour="command-palette-btn" on search button in app-shell.tsx:147 */
const CMD_PALETTE_BTN = '[data-tour="command-palette-btn"]';

/** Next.js fatal overlay container */
const NEXT_ERROR_OVERLAY = '#nextjs__container_errors_overlay';
const ONBOARDING_STORAGE_KEY = 'cognia-onboarding';

const ONBOARDING_DONE_STATE = {
  state: {
    mode: 'quick',
    completed: true,
    skipped: false,
    currentStep: 6,
    visitedSteps: [
      'mode-selection',
      'language',
      'theme',
      'environment-detection',
      'mirrors',
      'shell-init',
      'complete',
    ],
    tourCompleted: false,
    dismissedHints: [],
    hintsEnabled: true,
    version: 4,
    sessionState: 'completed',
    lastActiveStepId: 'complete',
    lastActiveAt: 0,
    canResume: false,
    sessionSummary: {
      mode: 'quick',
      locale: 'en',
      theme: 'light',
      mirrorPreset: 'default',
      detectedCount: 0,
      primaryEnvironment: null,
      manageableEnvironments: [],
      shellType: null,
      shellConfigured: null,
    },
  },
  version: 4,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedOnboardingState(page: Page) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: ONBOARDING_STORAGE_KEY, value: ONBOARDING_DONE_STATE },
  );
}

async function dismissSetupWizardIfVisible(page: Page) {
  const wizard = page.getByRole('dialog', { name: /setup wizard|设置向导/i }).first();
  if (!(await wizard.isVisible().catch(() => false))) return;

  const closeButton = wizard.getByRole('button', { name: /close|关闭/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click().catch(() => {});
  }

  const skipButton = wizard.getByRole('button', { name: /skip|跳过/i }).first();
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click().catch(() => {});
  }

  if (await wizard.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
  }

  await wizard.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
}

async function waitForAppReady(page: Page) {
  // In desktop layout the sidebar is visible; in compact/mobile layouts
  // the sidebar trigger is visible instead.
  await Promise.any([
    page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 60_000 }),
    page.waitForSelector(SIDEBAR_TRIGGER, { state: 'visible', timeout: 60_000 }),
  ]);
  await dismissSetupWizardIfVisible(page);
}

async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await dismissSetupWizardIfVisible(page);
}

async function toggleSidebar(page: Page) {
  await page.locator(SIDEBAR_TRIGGER).click();
}

async function openCommandPalette(page: Page) {
  await page.locator(CMD_PALETTE_BTN).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function expectNoFatalOverlay(page: Page) {
  await expect(page.locator(NEXT_ERROR_OVERLAY)).toHaveCount(0);
}

// ── Exported fixture ─────────────────────────────────────────────────────────

type AppFixtures = {
  appPage: Page;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    await seedOnboardingState(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await dismissSetupWizardIfVisible(page);
    await use(page);
  },
});

export {
  expect,
  waitForAppReady,
  navigateTo,
  toggleSidebar,
  openCommandPalette,
  expectNoFatalOverlay,
  SIDEBAR,
  SIDEBAR_TRIGGER,
  CMD_PALETTE_BTN,
};
