/**
 * Path validation utilities for settings path inputs
 * Extracted from components/settings/paths-settings.tsx
 */

export const MAX_PATH_LENGTH = 4096;

export const DANGEROUS_CHARS_RE = /[\0`${}|><;]/;
export const SHELL_INJECTION_RE = /\$\(|&&|\|\|/;

/** Quick client-side check before hitting the backend */
export function preValidatePath(
  value: string,
  t: (key: string) => string,
): { ok: boolean; error?: string } {
  if (!value.trim()) return { ok: true }; // empty = default

  if (value.length > MAX_PATH_LENGTH) {
    return { ok: false, error: t("settings.pathValidation.tooLong") };
  }

  if (DANGEROUS_CHARS_RE.test(value) || SHELL_INJECTION_RE.test(value)) {
    return {
      ok: false,
      error: t("settings.pathValidation.dangerousChars"),
    };
  }

  // Basic absolute-path check (cross-platform)
  const isAbsolute =
    /^[a-zA-Z]:[\\/]/.test(value) || // Windows: C:\, D:/
    value.startsWith("/"); // Unix: /home/...
  if (!isAbsolute) {
    return {
      ok: false,
      error: t("settings.pathValidation.mustBeAbsolute"),
    };
  }

  return { ok: true };
}
