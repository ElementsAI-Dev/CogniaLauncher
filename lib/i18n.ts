// Re-export types from types/i18n.ts
export { locales, type Locale } from '@/types/i18n';

import type { Locale } from '@/types/i18n';
import { locales } from '@/types/i18n';

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  const locale = match?.[1];
  
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  
  return defaultLocale;
}

export function setLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
}
