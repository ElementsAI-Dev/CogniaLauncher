import { Sun, Moon, Monitor } from 'lucide-react';
import {
  Globe,
  Palette,
  Layers,
  Server,
  Terminal,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import type {
  BubbleHintDef,
  TourStepDef,
  StepIconMap,
  LanguageOption,
  ThemeOption,
  ShellOption,
} from '@/types/onboarding';

// ============================================================================
// Positioning Constants
// ============================================================================

export const POPOVER_OFFSET = 12;

export const TOUR_PADDING = 8;

export const ARROW_CLASS: Record<string, string> = {
  top: 'left-1/2 -translate-x-1/2 -bottom-[5px] rotate-45 border-b border-r',
  bottom: 'left-1/2 -translate-x-1/2 -top-[5px] rotate-45 border-t border-l',
  left: 'top-1/2 -translate-y-1/2 -right-[5px] rotate-45 border-t border-r',
  right: 'top-1/2 -translate-y-1/2 -left-[5px] rotate-45 border-b border-l',
};

// ============================================================================
// Bubble Hints
// ============================================================================

export const BUBBLE_HINTS: BubbleHintDef[] = [
  {
    id: 'dashboard-customize',
    target: '[data-hint="dashboard-customize"]',
    titleKey: 'onboarding.hints.dashboardCustomizeTitle',
    descKey: 'onboarding.hints.dashboardCustomizeDesc',
    side: 'bottom',
    route: '/',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 800,
    autoDismissMs: 6000,
  },
  {
    id: 'dashboard-drag',
    target: '[data-hint="dashboard-drag"]',
    titleKey: 'onboarding.hints.dashboardDragTitle',
    descKey: 'onboarding.hints.dashboardDragDesc',
    side: 'top',
    route: '/',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 500,
    autoDismissMs: 6000,
  },
  {
    id: 'env-version-switcher',
    target: '[data-hint="env-version-switcher"]',
    titleKey: 'onboarding.hints.envVersionSwitcherTitle',
    descKey: 'onboarding.hints.envVersionSwitcherDesc',
    side: 'bottom',
    route: '/environments',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 600,
    autoDismissMs: 6000,
  },
  {
    id: 'packages-search',
    target: '[data-hint="packages-search"]',
    titleKey: 'onboarding.hints.packagesSearchTitle',
    descKey: 'onboarding.hints.packagesSearchDesc',
    side: 'bottom',
    route: '/packages',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 500,
    autoDismissMs: 6000,
  },
  {
    id: 'cache-overview',
    target: '[data-hint="cache-overview"]',
    titleKey: 'onboarding.hints.cacheOverviewTitle',
    descKey: 'onboarding.hints.cacheOverviewDesc',
    side: 'bottom',
    route: '/cache',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 500,
    autoDismissMs: 6000,
  },
  {
    id: 'downloads-concurrent',
    target: '[data-hint="downloads-concurrent"]',
    titleKey: 'onboarding.hints.downloadsConcurrentTitle',
    descKey: 'onboarding.hints.downloadsConcurrentDesc',
    side: 'left',
    route: '/downloads',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 600,
    autoDismissMs: 6000,
  },
  {
    id: 'settings-mirrors',
    target: '[data-hint="settings-mirrors"]',
    titleKey: 'onboarding.hints.settingsMirrorsTitle',
    descKey: 'onboarding.hints.settingsMirrorsDesc',
    side: 'top',
    route: '/settings',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 500,
    autoDismissMs: 6000,
  },
  {
    id: 'providers-status',
    target: '[data-hint="providers-status"]',
    titleKey: 'onboarding.hints.providersStatusTitle',
    descKey: 'onboarding.hints.providersStatusDesc',
    side: 'bottom',
    route: '/providers',
    routeMatch: 'exact',
    showAfterOnboarding: true,
    delay: 500,
    autoDismissMs: 6000,
  },
  {
    id: 'command-palette-shortcut',
    target: '[data-tour="command-palette-btn"]',
    titleKey: 'onboarding.hints.commandPaletteShortcutTitle',
    descKey: 'onboarding.hints.commandPaletteShortcutDesc',
    side: 'bottom',
    showAfterOnboarding: true,
    delay: 1500,
    autoDismissMs: 6000,
  },
];

// ============================================================================
// Tour Steps
// ============================================================================

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
    id: 'providers',
    target: '[data-tour="nav-providers"]',
    titleKey: 'onboarding.tourProvidersTitle',
    descKey: 'onboarding.tourProvidersDesc',
    side: 'right',
  },
  {
    id: 'cache',
    target: '[data-tour="nav-cache"]',
    titleKey: 'onboarding.tourCacheTitle',
    descKey: 'onboarding.tourCacheDesc',
    side: 'right',
  },
  {
    id: 'downloads',
    target: '[data-tour="nav-downloads"]',
    titleKey: 'onboarding.tourDownloadsTitle',
    descKey: 'onboarding.tourDownloadsDesc',
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

// ============================================================================
// Wizard Step Icons
// ============================================================================

export const STEP_ICONS: StepIconMap = {
  'mode-selection': Sparkles,
  welcome: Layers,
  language: Globe,
  theme: Palette,
  'environment-detection': Layers,
  mirrors: Server,
  'shell-init': Terminal,
  complete: PartyPopper,
};

// ============================================================================
// Language Step Constants
// ============================================================================

export const LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { value: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳' },
];

// ============================================================================
// Theme Step Constants
// ============================================================================

export const THEMES: ThemeOption[] = [
  { value: 'light', icon: Sun, preview: 'bg-white border-gray-200 text-gray-900' },
  { value: 'dark', icon: Moon, preview: 'bg-gray-900 border-gray-700 text-gray-100' },
  { value: 'system', icon: Monitor, preview: 'bg-gradient-to-r from-white to-gray-900 border-gray-400' },
];

// ============================================================================
// Shell Init Constants
// ============================================================================

export const SHELL_OPTIONS: ShellOption[] = [
  {
    value: 'powershell',
    label: 'PowerShell',
    configFile: '$PROFILE',
    command: '# Add CogniaLauncher shim directory to PATH\n$env:PATH = "$env:LOCALAPPDATA\\CogniaLauncher\\shims;$env:PATH"',
  },
  {
    value: 'bash',
    label: 'Bash',
    configFile: '~/.bashrc',
    command: '# Add CogniaLauncher shim directory to PATH\nexport PATH="$HOME/.cognia/shims:$PATH"',
  },
  {
    value: 'zsh',
    label: 'Zsh',
    configFile: '~/.zshrc',
    command: '# Add CogniaLauncher shim directory to PATH\nexport PATH="$HOME/.cognia/shims:$PATH"',
  },
  {
    value: 'fish',
    label: 'Fish',
    configFile: '~/.config/fish/config.fish',
    command: '# Add CogniaLauncher shim directory to PATH\nfish_add_path $HOME/.cognia/shims',
  },
];
