export interface TourStepDef {
  /** Unique step ID */
  id: string;
  /** CSS selector or data-tour attribute value to highlight */
  target: string;
  /** i18n key for step title */
  titleKey: string;
  /** i18n key for step description */
  descKey: string;
  /** Preferred popover placement */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Optional route to navigate to before showing this step */
  route?: string;
}

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    titleKey: 'onboarding.tourSidebarTitle',
    descKey: 'onboarding.tourSidebarDesc',
    side: 'right',
    route: '/',
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard-widgets"]',
    titleKey: 'onboarding.tourDashboardTitle',
    descKey: 'onboarding.tourDashboardDesc',
    side: 'bottom',
    route: '/',
  },
  {
    id: 'environments',
    target: '[data-tour="nav-environments"]',
    titleKey: 'onboarding.tourEnvironmentsTitle',
    descKey: 'onboarding.tourEnvironmentsDesc',
    side: 'right',
  },
  {
    id: 'packages',
    target: '[data-tour="nav-packages"]',
    titleKey: 'onboarding.tourPackagesTitle',
    descKey: 'onboarding.tourPackagesDesc',
    side: 'right',
  },
  {
    id: 'command-palette',
    target: '[data-tour="command-palette-btn"]',
    titleKey: 'onboarding.tourCommandPaletteTitle',
    descKey: 'onboarding.tourCommandPaletteDesc',
    side: 'bottom',
  },
  {
    id: 'settings',
    target: '[data-tour="nav-settings"]',
    titleKey: 'onboarding.tourSettingsTitle',
    descKey: 'onboarding.tourSettingsDesc',
    side: 'right',
  },
];
