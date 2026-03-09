import type { SettingsSection } from "@/lib/constants/settings-registry";
import { getAffectedSections, SETTINGS_SECTION_IDS } from "@/lib/settings/section-utils";

export interface SettingsImportPayloadV1 {
  version?: "1.0";
  settings: Record<string, string>;
  appSettings?: unknown;
  appearancePresets?: unknown;
  appearanceActivePresetId?: unknown;
}

export interface SettingsImportPayloadV2 {
  version: "2.0";
  backendConfig: string;
  appSettings?: unknown;
  appearancePresets?: unknown;
  appearanceActivePresetId?: unknown;
}

export type SettingsImportPayload = SettingsImportPayloadV1 | SettingsImportPayloadV2;

export interface ImportValidationIssue {
  code:
    | "json_parse_failed"
    | "invalid_root"
    | "unsupported_version"
    | "desktop_required"
    | "invalid_settings_shape"
    | "invalid_setting_value";
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  payload?: SettingsImportPayload;
  issues: ImportValidationIssue[];
}

export interface ImportDiffSummary {
  changedKeys: string[];
  affectedSections: SettingsSection[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateV1Settings(
  settings: Record<string, unknown>,
): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value !== "string") {
      issues.push({
        code: "invalid_setting_value",
        message: `Setting "${key}" must be a string`,
      });
    }
  }
  return issues;
}

export function validateImportPayload(
  content: string,
  options?: { isTauri: boolean },
): ImportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      valid: false,
      issues: [{ code: "json_parse_failed", message: "Invalid JSON payload" }],
    };
  }

  if (!isObject(parsed)) {
    return {
      valid: false,
      issues: [{ code: "invalid_root", message: "Import payload must be an object" }],
    };
  }

  if (parsed.version === "2.0") {
    if (typeof parsed.backendConfig !== "string" || parsed.backendConfig.length === 0) {
      return {
        valid: false,
        issues: [{
          code: "invalid_settings_shape",
          message: "v2.0 import requires non-empty backendConfig",
        }],
      };
    }

    if (!options?.isTauri) {
      return {
        valid: false,
        issues: [{
          code: "desktop_required",
          message: "v2.0 import is only supported in desktop mode",
        }],
      };
    }

    return {
      valid: true,
      payload: {
        version: "2.0",
        backendConfig: parsed.backendConfig,
        appSettings: parsed.appSettings,
        appearancePresets: parsed.appearancePresets,
        appearanceActivePresetId: parsed.appearanceActivePresetId,
      },
      issues: [],
    };
  }

  const rawVersion = parsed.version;
  if (rawVersion && rawVersion !== "1.0") {
    return {
      valid: false,
      issues: [{
        code: "unsupported_version",
        message: `Unsupported import version "${String(rawVersion)}"`,
      }],
    };
  }

  if (!isObject(parsed.settings)) {
    return {
      valid: false,
      issues: [{
        code: "invalid_settings_shape",
        message: "Import payload must include a settings object",
      }],
    };
  }

  const validationIssues = validateV1Settings(parsed.settings);
  if (validationIssues.length > 0) {
    return {
      valid: false,
      issues: validationIssues,
    };
  }

  const settings = Object.fromEntries(
    Object.entries(parsed.settings).map(([key, value]) => [key, value as string]),
  );

  return {
    valid: true,
    payload: {
      version: "1.0",
      settings,
      appSettings: parsed.appSettings,
      appearancePresets: parsed.appearancePresets,
      appearanceActivePresetId: parsed.appearanceActivePresetId,
    },
    issues: [],
  };
}

export function buildImportDiffSummary(
  payload: SettingsImportPayload,
  baseline: Record<string, string>,
): ImportDiffSummary {
  if ("version" in payload && payload.version === "2.0") {
    return {
      changedKeys: [],
      affectedSections: SETTINGS_SECTION_IDS.filter((sectionId) => sectionId !== "system"),
    };
  }

  const changedKeys = Object.entries(payload.settings)
    .filter(([key, value]) => (baseline[key] ?? "") !== value)
    .map(([key]) => key)
    .sort();

  return {
    changedKeys,
    affectedSections: getAffectedSections(changedKeys),
  };
}
