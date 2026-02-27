/**
 * Settings field validation rules and validation function
 * Extracted from components/settings/setting-item.tsx
 */

import type { ValidationRule } from "@/types/settings";

export const VALIDATION_RULES: Record<string, ValidationRule> = {
  "general.parallel_downloads": { min: 1, max: 16 },
  "general.min_install_space_mb": { min: 10, max: 10240 },
  "general.metadata_cache_ttl": { min: 60, max: 86400 },
  "network.timeout": { min: 5, max: 300 },
  "network.retries": { min: 0, max: 10 },
  "network.proxy": {
    pattern: /^((https?|socks5?):\/\/.*)?$/,
    patternMessage: "validation.mustBeValidProxyUrlOrEmpty",
  },
  "network.no_proxy": {
    pattern: /^[a-zA-Z0-9.*,\-_: ]*$/,
    patternMessage: "validation.mustBeValidNoProxyList",
  },
  "mirrors.npm": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.pypi": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.crates": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "mirrors.go": {
    pattern: /^https?:\/\/.+$/,
    patternMessage: "validation.mustBeValidUrl",
  },
  "general.cache_max_size": { min: 104857600, max: 107374182400 },
  "general.cache_max_age_days": { min: 1, max: 365 },
  "general.cache_auto_clean_threshold": { min: 0, max: 100 },
  "general.cache_monitor_interval": { min: 0, max: 3600 },
  "general.download_speed_limit": { min: 0, max: 1073741824 },
};

export function validateField(
  key: string,
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const rules = VALIDATION_RULES[key];
  if (!rules) return null;

  if (rules.min !== undefined || rules.max !== undefined) {
    const num = Number(value);
    if (isNaN(num)) return t("validation.mustBeNumber");
    if (rules.min !== undefined && num < rules.min) {
      return t("validation.min", { min: rules.min });
    }
    if (rules.max !== undefined && num > rules.max) {
      return t("validation.max", { max: rules.max });
    }
  }

  if (rules.pattern && value && !rules.pattern.test(value)) {
    return rules.patternMessage
      ? t(rules.patternMessage)
      : t("validation.invalidFormat");
  }

  return null;
}
