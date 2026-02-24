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

/** SidebarTrigger button in app-shell.tsx:136 */
const SIDEBAR_TRIGGER = 'button.-ml-1';

/** data-tour="command-palette-btn" on search button in app-shell.tsx:147 */
const CMD_PALETTE_BTN = '[data-tour="command-palette-btn"]';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForAppReady(page: Page) {
  // The sidebar is the first stable landmark rendered by AppShell.
  // In web mode there is no splash screen, so it should be visible immediately.
  await page.waitForSelector(SIDEBAR, { state: 'visible', timeout: 30_000 });
}

async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForAppReady(page);
}

// ── Exported fixture ─────────────────────────────────────────────────────────

type AppFixtures = {
  appPage: Page;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    await page.goto('/');
    await waitForAppReady(page);
    await use(page);
  },
});

export { expect, waitForAppReady, navigateTo, SIDEBAR, SIDEBAR_TRIGGER, CMD_PALETTE_BTN };
