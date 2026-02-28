import { callHostJson } from './host';
import type { LocaleInfo } from './types';

/**
 * Get the current application locale (e.g. "en", "zh").
 */
export function getLocale(): string {
  const result = callHostJson<{ locale: string }>(
    'cognia_get_locale',
    '',
  );
  return result.locale;
}

/**
 * Translate a key using the plugin's locale data.
 * Falls back: current locale -> "en" -> raw key.
 * Supports {param} interpolation.
 */
export function translate(
  key: string,
  params?: Record<string, string>,
): string {
  const result = callHostJson<{ text: string }>(
    'cognia_i18n_translate',
    JSON.stringify({ key, params: params ?? {} }),
  );
  return result.text;
}

/**
 * Shorthand for translate with no params.
 */
export function t(key: string): string {
  return translate(key);
}

/**
 * Get all locale strings for the current locale.
 */
export function getAll(): LocaleInfo {
  return callHostJson<LocaleInfo>('cognia_i18n_get_all', '');
}
