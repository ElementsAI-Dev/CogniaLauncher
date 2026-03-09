import type { SettingsSection } from "@/lib/constants/settings-registry";
import type { AppSettings } from "@/lib/stores/settings";
import { configToAppSettings } from "@/lib/settings/app-settings-mapping";
import { pickSectionKeys } from "@/lib/settings/section-utils";

export interface SectionResetResult {
  nextDraft: Record<string, string>;
  resetKeys: string[];
}

export function applySectionReset({
  sectionId,
  draft,
  baseline,
}: {
  sectionId: SettingsSection;
  draft: Record<string, string>;
  baseline: Record<string, string>;
}): SectionResetResult {
  const resetKeys = pickSectionKeys(draft, sectionId);
  if (resetKeys.length === 0) {
    return { nextDraft: draft, resetKeys };
  }

  const nextDraft = { ...draft };
  for (const key of resetKeys) {
    nextDraft[key] = baseline[key] ?? "";
  }
  return { nextDraft, resetKeys };
}

export function clearSectionValidationErrors({
  errors,
  resetKeys,
}: {
  errors: Record<string, string | null>;
  resetKeys: string[];
}): Record<string, string | null> {
  if (resetKeys.length === 0) {
    return errors;
  }
  const next = { ...errors };
  for (const key of resetKeys) {
    if (key in next) {
      next[key] = null;
    }
  }
  return next;
}

export function buildAppSettingsFromConfigSnapshot({
  configSnapshot,
  currentAppSettings,
}: {
  configSnapshot: Record<string, string>;
  currentAppSettings: AppSettings;
}): AppSettings {
  return configToAppSettings(configSnapshot, currentAppSettings);
}
