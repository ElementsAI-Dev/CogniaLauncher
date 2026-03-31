import type { TrayClickBehavior, TrayNotificationLevel } from "@/lib/tauri";
import type { AppSettings } from "@/lib/stores/settings";

type ConfigBackedAppSettingKey = Exclude<
  keyof AppSettings,
  "autostart" | "sidebarItemOrder"
>;

export const APP_SETTINGS_CONFIG_KEY_MAP = {
  checkUpdatesOnStart: "updates.check_on_start",
  autoInstallUpdates: "updates.auto_install",
  notifyOnUpdates: "updates.notify",
  updateSourceMode: "updates.source_mode",
  updateCustomEndpoints: "updates.custom_endpoints",
  updateFallbackToOfficial: "updates.fallback_to_official",
  minimizeToTray: "tray.minimize_to_tray",
  startMinimized: "tray.start_minimized",
  trayClickBehavior: "tray.click_behavior",
  showNotifications: "tray.show_notifications",
  trayNotificationLevel: "tray.notification_level",
  envvarDefaultScope: "envvar.default_scope",
  envvarAutoSnapshot: "envvar.auto_snapshot",
  envvarMaskSensitive: "envvar.mask_sensitive",
} as const satisfies Record<ConfigBackedAppSettingKey, string>;

export const CONFIG_KEY_TO_APP_SETTING = Object.fromEntries(
  Object.entries(APP_SETTINGS_CONFIG_KEY_MAP).map(([appKey, configKey]) => [configKey, appKey]),
) as Record<string, keyof typeof APP_SETTINGS_CONFIG_KEY_MAP>;

export const DESKTOP_APP_SETTINGS_MIGRATION_FLAG = "cognia-settings-desktop-migrated-v1";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseTrayClickBehavior(
  value: string | undefined,
  fallback: TrayClickBehavior,
): TrayClickBehavior {
  if (!value) return fallback;
  if (
    value === "toggle_window"
    || value === "show_menu"
    || value === "check_updates"
    || value === "quick_action"
    || value === "do_nothing"
  ) {
    return value;
  }
  return fallback;
}

function parseTrayNotificationLevel(
  value: string | undefined,
  fallback: TrayNotificationLevel,
): TrayNotificationLevel {
  if (!value) return fallback;
  if (value === "all" || value === "important_only" || value === "none") {
    return value;
  }
  return fallback;
}

function parseUpdateSourceMode(
  value: string | undefined,
  fallback: AppSettings["updateSourceMode"],
): AppSettings["updateSourceMode"] {
  if (!value) return fallback;
  if (value === "official" || value === "mirror" || value === "custom") {
    return value;
  }
  return fallback;
}

function parseEnvvarDefaultScope(
  value: string | undefined,
  fallback: AppSettings["envvarDefaultScope"],
): AppSettings["envvarDefaultScope"] {
  if (!value) return fallback;
  if (value === "all" || value === "process" || value === "user" || value === "system") {
    return value;
  }
  return fallback;
}

function parseUpdateCustomEndpoints(
  value: string | undefined,
  fallback: string[],
): string[] {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return [];

  const rawItems = (() => {
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === "string");
        }
      } catch {
        return fallback;
      }
    }

    return trimmed
      .replace(/\r/g, "")
      .replace(/\n/g, ",")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  })();

  const deduped: string[] = [];
  for (const item of rawItems) {
    const normalized = item.trim();
    if (!normalized || deduped.includes(normalized)) continue;
    deduped.push(normalized);
  }
  return deduped;
}

export function configToAppSettings(
  config: Record<string, string>,
  fallback: AppSettings,
): AppSettings {
  return {
    ...fallback,
    checkUpdatesOnStart: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.checkUpdatesOnStart],
      fallback.checkUpdatesOnStart,
    ),
    autoInstallUpdates: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.autoInstallUpdates],
      fallback.autoInstallUpdates,
    ),
    notifyOnUpdates: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.notifyOnUpdates],
      fallback.notifyOnUpdates,
    ),
    updateSourceMode: parseUpdateSourceMode(
      config[APP_SETTINGS_CONFIG_KEY_MAP.updateSourceMode],
      fallback.updateSourceMode,
    ),
    updateCustomEndpoints: parseUpdateCustomEndpoints(
      config[APP_SETTINGS_CONFIG_KEY_MAP.updateCustomEndpoints],
      fallback.updateCustomEndpoints,
    ),
    updateFallbackToOfficial: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.updateFallbackToOfficial],
      fallback.updateFallbackToOfficial,
    ),
    minimizeToTray: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.minimizeToTray],
      fallback.minimizeToTray,
    ),
    startMinimized: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.startMinimized],
      fallback.startMinimized,
    ),
    trayClickBehavior: parseTrayClickBehavior(
      config[APP_SETTINGS_CONFIG_KEY_MAP.trayClickBehavior],
      fallback.trayClickBehavior,
    ),
    showNotifications: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.showNotifications],
      fallback.showNotifications,
    ),
    trayNotificationLevel: parseTrayNotificationLevel(
      config[APP_SETTINGS_CONFIG_KEY_MAP.trayNotificationLevel],
      fallback.trayNotificationLevel,
    ),
    envvarDefaultScope: parseEnvvarDefaultScope(
      config[APP_SETTINGS_CONFIG_KEY_MAP.envvarDefaultScope],
      fallback.envvarDefaultScope,
    ),
    envvarAutoSnapshot: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.envvarAutoSnapshot],
      fallback.envvarAutoSnapshot,
    ),
    envvarMaskSensitive: parseBoolean(
      config[APP_SETTINGS_CONFIG_KEY_MAP.envvarMaskSensitive],
      fallback.envvarMaskSensitive,
    ),
  };
}

export function appSettingKeyToConfigKey(
  key: keyof AppSettings,
): string | undefined {
  if (key === "autostart" || key === "sidebarItemOrder") return undefined;
  return APP_SETTINGS_CONFIG_KEY_MAP[key as ConfigBackedAppSettingKey];
}

export function appSettingValueToConfigValue(
  key: keyof AppSettings,
  value: AppSettings[keyof AppSettings],
): string | null {
  if (key === "autostart" || key === "sidebarItemOrder") return null;
  if (key === "updateSourceMode") return String(value);
  if (key === "updateCustomEndpoints") {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }
  if (key === "envvarDefaultScope") return String(value);
  if (key === "trayClickBehavior") return String(value);
  if (key === "trayNotificationLevel") return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

export function readLegacyAppSettingsFromStorage(): Partial<AppSettings> | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem("cognia-settings");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      state?: { appSettings?: Partial<AppSettings> };
      appSettings?: Partial<AppSettings>;
    };

    if (parsed?.state?.appSettings && typeof parsed.state.appSettings === "object") {
      return parsed.state.appSettings;
    }

    if (parsed?.appSettings && typeof parsed.appSettings === "object") {
      return parsed.appSettings;
    }
  } catch {
    return null;
  }

  return null;
}

export function toConfigEntriesFromAppSettings(
  appSettings: Partial<AppSettings>,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const [appKey, configKey] of Object.entries(APP_SETTINGS_CONFIG_KEY_MAP)) {
    const key = appKey as ConfigBackedAppSettingKey;
    const value = appSettings[key];
    if (value === undefined) continue;
    const configValue = appSettingValueToConfigValue(key, value as AppSettings[typeof key]);
    if (configValue === null) continue;
    entries.push([configKey, configValue]);
  }

  return entries;
}
