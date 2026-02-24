export interface BubbleHintDef {
  /** Unique hint ID for dismissal tracking */
  id: string;
  /** CSS selector to find the target element */
  target: string;
  /** i18n key for hint title */
  titleKey: string;
  /** i18n key for hint description */
  descKey: string;
  /** Preferred popover placement relative to the target */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Only show this hint when on this route (pathname startsWith match) */
  route?: string;
  /** Only show after onboarding wizard has been completed or skipped */
  showAfterOnboarding: boolean;
  /** Delay in ms before the hint appears after conditions are met */
  delay?: number;
}

export const BUBBLE_HINTS: BubbleHintDef[] = [
  {
    id: 'dashboard-customize',
    target: '[data-hint="dashboard-customize"]',
    titleKey: 'onboarding.hints.dashboardCustomizeTitle',
    descKey: 'onboarding.hints.dashboardCustomizeDesc',
    side: 'bottom',
    route: '/',
    showAfterOnboarding: true,
    delay: 800,
  },
  {
    id: 'dashboard-drag',
    target: '[data-hint="dashboard-drag"]',
    titleKey: 'onboarding.hints.dashboardDragTitle',
    descKey: 'onboarding.hints.dashboardDragDesc',
    side: 'top',
    route: '/',
    showAfterOnboarding: true,
    delay: 500,
  },
  {
    id: 'env-version-switcher',
    target: '[data-hint="env-version-switcher"]',
    titleKey: 'onboarding.hints.envVersionSwitcherTitle',
    descKey: 'onboarding.hints.envVersionSwitcherDesc',
    side: 'bottom',
    route: '/environments',
    showAfterOnboarding: true,
    delay: 600,
  },
  {
    id: 'packages-search',
    target: '[data-hint="packages-search"]',
    titleKey: 'onboarding.hints.packagesSearchTitle',
    descKey: 'onboarding.hints.packagesSearchDesc',
    side: 'bottom',
    route: '/packages',
    showAfterOnboarding: true,
    delay: 500,
  },
  {
    id: 'cache-overview',
    target: '[data-hint="cache-overview"]',
    titleKey: 'onboarding.hints.cacheOverviewTitle',
    descKey: 'onboarding.hints.cacheOverviewDesc',
    side: 'bottom',
    route: '/cache',
    showAfterOnboarding: true,
    delay: 500,
  },
  {
    id: 'downloads-concurrent',
    target: '[data-hint="downloads-concurrent"]',
    titleKey: 'onboarding.hints.downloadsConcurrentTitle',
    descKey: 'onboarding.hints.downloadsConcurrentDesc',
    side: 'left',
    route: '/downloads',
    showAfterOnboarding: true,
    delay: 600,
  },
  {
    id: 'settings-mirrors',
    target: '[data-hint="settings-mirrors"]',
    titleKey: 'onboarding.hints.settingsMirrorsTitle',
    descKey: 'onboarding.hints.settingsMirrorsDesc',
    side: 'top',
    route: '/settings',
    showAfterOnboarding: true,
    delay: 500,
  },
  {
    id: 'providers-status',
    target: '[data-hint="providers-status"]',
    titleKey: 'onboarding.hints.providersStatusTitle',
    descKey: 'onboarding.hints.providersStatusDesc',
    side: 'bottom',
    route: '/providers',
    showAfterOnboarding: true,
    delay: 500,
  },
  {
    id: 'command-palette-shortcut',
    target: '[data-tour="command-palette-btn"]',
    titleKey: 'onboarding.hints.commandPaletteShortcutTitle',
    descKey: 'onboarding.hints.commandPaletteShortcutDesc',
    side: 'bottom',
    showAfterOnboarding: true,
    delay: 1500,
  },
];
