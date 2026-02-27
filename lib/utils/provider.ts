/**
 * Provider-related utility functions
 * Extracted from components/settings/provider-settings.tsx
 */

/** Normalize a provider list value from JSON array or comma-separated string */
export function normalizeProviderList(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(", ");
      }
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}
