import type { TrayClickBehavior } from "@/lib/tauri";
import type { AppSettings } from "@/lib/stores/settings";

type ConfigBackedAppSettingKey = Exclude<keyof AppSettings, "autostart">;

export const APP_SETTINGS_CONFIG_KEY_MAP = {
  checkUpdatesOnStart: "updates.check_on_start",
  autoInstallUpdates: "updates.auto_install",
  notifyOnUpdates: "updates.notify",
  minimizeToTray: "tray.minimize_to_tray",
  startMinimized: "tray.start_minimized",
  trayClickBehavior: "tray.click_behavior",
  showNotifications: "tray.show_notifications",
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
  if (value === "toggle_window" || value === "show_menu" || value === "do_nothing") {
    return value;
  }
  return fallback;
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
  };
}

export function appSettingKeyToConfigKey(
  key: keyof AppSettings,
): string | undefined {
  if (key === "autostart") return undefined;
  return APP_SETTINGS_CONFIG_KEY_MAP[key as ConfigBackedAppSettingKey];
}

export function appSettingValueToConfigValue(
  key: keyof AppSettings,
  value: AppSettings[keyof AppSettings],
): string | null {
  if (key === "autostart") return null;
  if (key === "trayClickBehavior") return String(value);
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
    entries.push([configKey, String(value)]);
  }

  return entries;
}
