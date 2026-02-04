import { locales, type Locale } from '@/lib/i18n';
import { isAccentColor, isThemeMode, type AccentColor, type ThemeMode } from './types';

export type AppearanceConfigKey = 'theme' | 'accentColor' | 'reducedMotion' | 'language';

export interface ParsedAppearanceConfig {
  theme?: ThemeMode;
  accentColor?: AccentColor;
  reducedMotion?: boolean;
  locale?: Locale;
  invalidKeys: AppearanceConfigKey[];
}

function isLocale(value?: string): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}

function parseReducedMotion(value?: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function parseAppearanceConfig(config: Record<string, string>): ParsedAppearanceConfig {
  const invalidKeys: AppearanceConfigKey[] = [];

  const themeValue = config['appearance.theme'];
  const accentColorValue = config['appearance.accent_color'];
  const reducedMotionValue = config['appearance.reduced_motion'];
  const languageValue = config['appearance.language'];

  const theme = themeValue && isThemeMode(themeValue) ? themeValue : undefined;
  if (themeValue && !theme) invalidKeys.push('theme');

  const accentColor = accentColorValue && isAccentColor(accentColorValue) ? accentColorValue : undefined;
  if (accentColorValue && !accentColor) invalidKeys.push('accentColor');

  const reducedMotion = reducedMotionValue ? parseReducedMotion(reducedMotionValue) : undefined;
  if (reducedMotionValue && typeof reducedMotion !== 'boolean') invalidKeys.push('reducedMotion');

  const locale = languageValue && isLocale(languageValue) ? languageValue : undefined;
  if (languageValue && !locale) invalidKeys.push('language');

  return {
    theme,
    accentColor,
    reducedMotion,
    locale,
    invalidKeys,
  };
}
