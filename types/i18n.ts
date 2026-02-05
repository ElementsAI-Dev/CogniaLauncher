/**
 * Internationalization types for CogniaLauncher
 * Extracted from lib/i18n.ts for better code organization
 */

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
