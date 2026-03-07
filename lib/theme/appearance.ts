import { locales, type Locale } from '@/lib/i18n';
import {
  INTERFACE_RADII,
  isAccentColor,
  isChartColorTheme,
  isInterfaceDensity,
  isThemeMode,
  isWindowEffect,
  type AccentColor,
  type ChartColorTheme,
  type InterfaceDensity,
  type InterfaceRadius,
  type ThemeMode,
  type WindowEffect,
} from './types';

export type AppearanceConfigKey =
  | 'theme'
  | 'accentColor'
  | 'chartColorTheme'
  | 'interfaceRadius'
  | 'interfaceDensity'
  | 'reducedMotion'
  | 'language'
  | 'windowEffect';

export type AppearanceConfigPath =
  | 'appearance.theme'
  | 'appearance.accent_color'
  | 'appearance.chart_color_theme'
  | 'appearance.interface_radius'
  | 'appearance.interface_density'
  | 'appearance.reduced_motion'
  | 'appearance.language'
  | 'appearance.window_effect';

export const APPEARANCE_CONFIG_PATHS: Record<AppearanceConfigKey, AppearanceConfigPath> = {
  theme: 'appearance.theme',
  accentColor: 'appearance.accent_color',
  chartColorTheme: 'appearance.chart_color_theme',
  interfaceRadius: 'appearance.interface_radius',
  interfaceDensity: 'appearance.interface_density',
  reducedMotion: 'appearance.reduced_motion',
  language: 'appearance.language',
  windowEffect: 'appearance.window_effect',
};

export const APPEARANCE_STATE_PRECEDENCE = ['config', 'store', 'defaults'] as const;

export const APPEARANCE_DEFAULTS = {
  theme: 'system' as ThemeMode,
  accentColor: 'blue' as AccentColor,
  chartColorTheme: 'default' as ChartColorTheme,
  interfaceRadius: 0.625 as InterfaceRadius,
  interfaceDensity: 'comfortable' as InterfaceDensity,
  reducedMotion: false,
  windowEffect: 'auto' as WindowEffect,
  locale: 'en' as Locale,
};

export interface ParsedAppearanceConfig {
  theme: ThemeMode;
  accentColor: AccentColor;
  chartColorTheme: ChartColorTheme;
  interfaceRadius: InterfaceRadius;
  interfaceDensity: InterfaceDensity;
  reducedMotion: boolean;
  windowEffect: WindowEffect;
  locale: Locale;
  invalidKeys: AppearanceConfigKey[];
}

function isLocale(value?: string): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}

function normalizeToNearestInterfaceRadius(
  value: number,
  fallback: InterfaceRadius = APPEARANCE_DEFAULTS.interfaceRadius,
): InterfaceRadius {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  let nearest = INTERFACE_RADII[0];
  let minDistance = Math.abs(value - nearest);
  for (let i = 1; i < INTERFACE_RADII.length; i += 1) {
    const candidate = INTERFACE_RADII[i];
    const distance = Math.abs(value - candidate);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

export function normalizeThemeMode(
  value: string | undefined,
  fallback: ThemeMode = APPEARANCE_DEFAULTS.theme,
): ThemeMode {
  return value && isThemeMode(value) ? value : fallback;
}

export function normalizeAccentColor(
  value: string | undefined,
  fallback: AccentColor = APPEARANCE_DEFAULTS.accentColor,
): AccentColor {
  return value && isAccentColor(value) ? value : fallback;
}

export function normalizeChartColorTheme(
  value: string | undefined,
  fallback: ChartColorTheme = APPEARANCE_DEFAULTS.chartColorTheme,
): ChartColorTheme {
  return value && isChartColorTheme(value) ? value : fallback;
}

export function normalizeInterfaceRadius(
  value: string | number | undefined,
  fallback: InterfaceRadius = APPEARANCE_DEFAULTS.interfaceRadius,
): InterfaceRadius {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return normalizeToNearestInterfaceRadius(parsed, fallback);
}

export function normalizeInterfaceDensity(
  value: string | undefined,
  fallback: InterfaceDensity = APPEARANCE_DEFAULTS.interfaceDensity,
): InterfaceDensity {
  return value && isInterfaceDensity(value) ? value : fallback;
}

export function normalizeReducedMotion(
  value: string | boolean | undefined,
  fallback: boolean = APPEARANCE_DEFAULTS.reducedMotion,
): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function normalizeWindowEffect(
  value: string | undefined,
  fallback: WindowEffect = APPEARANCE_DEFAULTS.windowEffect,
): WindowEffect {
  return value && isWindowEffect(value) ? value : fallback;
}

export function normalizeLocale(
  value: string | undefined,
  fallback: Locale = APPEARANCE_DEFAULTS.locale,
): Locale {
  return value && isLocale(value) ? value : fallback;
}

export function normalizeAppearanceConfigValue(
  key: AppearanceConfigPath,
  value: string,
): string {
  switch (key) {
    case 'appearance.theme':
      return normalizeThemeMode(value);
    case 'appearance.accent_color':
      return normalizeAccentColor(value);
    case 'appearance.chart_color_theme':
      return normalizeChartColorTheme(value);
    case 'appearance.interface_radius':
      return String(normalizeInterfaceRadius(value));
    case 'appearance.interface_density':
      return normalizeInterfaceDensity(value);
    case 'appearance.reduced_motion':
      return String(normalizeReducedMotion(value));
    case 'appearance.language':
      return normalizeLocale(value);
    case 'appearance.window_effect':
      return normalizeWindowEffect(value);
    default:
      return value;
  }
}

export function parseAppearanceConfig(config: Record<string, string>): ParsedAppearanceConfig {
  const invalidKeys: AppearanceConfigKey[] = [];

  const themeValue = config[APPEARANCE_CONFIG_PATHS.theme];
  const accentColorValue = config[APPEARANCE_CONFIG_PATHS.accentColor];
  const chartColorThemeValue = config[APPEARANCE_CONFIG_PATHS.chartColorTheme];
  const interfaceRadiusValue = config[APPEARANCE_CONFIG_PATHS.interfaceRadius];
  const interfaceDensityValue = config[APPEARANCE_CONFIG_PATHS.interfaceDensity];
  const reducedMotionValue = config[APPEARANCE_CONFIG_PATHS.reducedMotion];
  const windowEffectValue = config[APPEARANCE_CONFIG_PATHS.windowEffect];
  const languageValue = config[APPEARANCE_CONFIG_PATHS.language];

  const theme = normalizeThemeMode(themeValue);
  if (themeValue !== undefined && themeValue !== theme) invalidKeys.push('theme');

  const accentColor = normalizeAccentColor(accentColorValue);
  if (accentColorValue !== undefined && accentColorValue !== accentColor) invalidKeys.push('accentColor');

  const chartColorTheme = normalizeChartColorTheme(chartColorThemeValue);
  if (chartColorThemeValue !== undefined && chartColorThemeValue !== chartColorTheme) invalidKeys.push('chartColorTheme');

  const interfaceRadius = normalizeInterfaceRadius(interfaceRadiusValue);
  if (interfaceRadiusValue !== undefined && String(interfaceRadius) !== interfaceRadiusValue) {
    invalidKeys.push('interfaceRadius');
  }

  const interfaceDensity = normalizeInterfaceDensity(interfaceDensityValue);
  if (interfaceDensityValue !== undefined && interfaceDensityValue !== interfaceDensity) {
    invalidKeys.push('interfaceDensity');
  }

  const reducedMotion = normalizeReducedMotion(reducedMotionValue);
  if (reducedMotionValue !== undefined && String(reducedMotion) !== reducedMotionValue) {
    invalidKeys.push('reducedMotion');
  }

  const windowEffect = normalizeWindowEffect(windowEffectValue);
  if (windowEffectValue !== undefined && windowEffectValue !== windowEffect) {
    invalidKeys.push('windowEffect');
  }

  const locale = normalizeLocale(languageValue);
  if (languageValue !== undefined && languageValue !== locale) invalidKeys.push('language');

  return {
    theme,
    accentColor,
    chartColorTheme,
    interfaceRadius,
    interfaceDensity,
    reducedMotion,
    windowEffect,
    locale,
    invalidKeys,
  };
}
