import type { AppSettings } from "@/lib/stores/settings";
import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";
import {
  appSettingKeyToConfigKey,
  appSettingValueToConfigValue,
  configToAppSettings,
  readLegacyAppSettingsFromStorage,
  toConfigEntriesFromAppSettings,
} from "./app-settings-mapping";

const fallback: AppSettings = {
  checkUpdatesOnStart: true,
  autoInstallUpdates: false,
  notifyOnUpdates: true,
  updateSourceMode: "official",
  updateCustomEndpoints: [],
  updateFallbackToOfficial: true,
  minimizeToTray: true,
  startMinimized: false,
  autostart: false,
  trayClickBehavior: "toggle_window",
  showNotifications: true,
  trayNotificationLevel: "all",
  envvarDefaultScope: "all",
  envvarAutoSnapshot: false,
  envvarMaskSensitive: true,
  sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
};

describe("app-settings-mapping", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("maps config values back to AppSettings", () => {
    const mapped = configToAppSettings(
      {
        "updates.check_on_start": "false",
        "updates.auto_install": "true",
        "updates.notify": "false",
        "updates.source_mode": "custom",
        "updates.custom_endpoints":
          '["https://updates.example.com/{{target}}/{{current_version}}"]',
        "updates.fallback_to_official": "false",
        "tray.minimize_to_tray": "false",
        "tray.start_minimized": "true",
        "tray.click_behavior": "show_menu",
        "tray.show_notifications": "false",
        "tray.notification_level": "important_only",
        "envvar.default_scope": "user",
        "envvar.auto_snapshot": "true",
        "envvar.mask_sensitive": "false",
      },
      fallback,
    );

    expect(mapped.checkUpdatesOnStart).toBe(false);
    expect(mapped.autoInstallUpdates).toBe(true);
    expect(mapped.notifyOnUpdates).toBe(false);
    expect(mapped.updateSourceMode).toBe("custom");
    expect(mapped.updateCustomEndpoints).toEqual([
      "https://updates.example.com/{{target}}/{{current_version}}",
    ]);
    expect(mapped.updateFallbackToOfficial).toBe(false);
    expect(mapped.minimizeToTray).toBe(false);
    expect(mapped.startMinimized).toBe(true);
    expect(mapped.trayClickBehavior).toBe("show_menu");
    expect(mapped.showNotifications).toBe(false);
    expect(mapped.trayNotificationLevel).toBe("important_only");
    expect(mapped.envvarDefaultScope).toBe("user");
    expect(mapped.envvarAutoSnapshot).toBe(true);
    expect(mapped.envvarMaskSensitive).toBe(false);
    expect(mapped.autostart).toBe(false);
  });

  it("falls back to existing settings when serialized values are invalid", () => {
    const mapped = configToAppSettings(
      {
        "updates.check_on_start": "invalid",
        "updates.source_mode": "mystery",
        "updates.custom_endpoints": "[invalid",
        "tray.click_behavior": "mystery",
        "tray.notification_level": "mystery",
        "envvar.default_scope": "mystery",
      },
      {
        ...fallback,
        updateCustomEndpoints: ["https://fallback.example.com"],
      },
    );

    expect(mapped.checkUpdatesOnStart).toBe(true);
    expect(mapped.updateSourceMode).toBe("official");
    expect(mapped.updateCustomEndpoints).toEqual(["https://fallback.example.com"]);
    expect(mapped.trayClickBehavior).toBe("toggle_window");
    expect(mapped.trayNotificationLevel).toBe("all");
    expect(mapped.envvarDefaultScope).toBe("all");
  });

  it("normalizes custom endpoints from newline and comma separated values", () => {
    const mapped = configToAppSettings(
      {
        "updates.custom_endpoints":
          "https://one.example.com\nhttps://two.example.com, https://one.example.com",
      },
      fallback,
    );

    expect(mapped.updateCustomEndpoints).toEqual([
      "https://one.example.com",
      "https://two.example.com",
    ]);
  });

  it("returns config key for known app setting key", () => {
    expect(appSettingKeyToConfigKey("checkUpdatesOnStart")).toBe(
      "updates.check_on_start",
    );
    expect(appSettingKeyToConfigKey("autostart")).toBeUndefined();
    expect(appSettingKeyToConfigKey("sidebarItemOrder")).toBeUndefined();
  });

  it("returns null config value for autostart", () => {
    expect(appSettingValueToConfigValue("autostart", true)).toBeNull();
    expect(
      appSettingValueToConfigValue("sidebarItemOrder", [...DEFAULT_SIDEBAR_ITEM_ORDER]),
    ).toBeNull();
    expect(appSettingValueToConfigValue("notifyOnUpdates", false)).toBe("false");
    expect(appSettingValueToConfigValue("trayNotificationLevel", "none")).toBe("none");
    expect(appSettingValueToConfigValue("updateSourceMode", "mirror")).toBe("mirror");
    expect(appSettingValueToConfigValue("envvarDefaultScope", "system")).toBe("system");
    expect(
      appSettingValueToConfigValue("updateCustomEndpoints", [
        "https://updates.example.com/{{target}}/{{current_version}}",
      ]),
    ).toBe('["https://updates.example.com/{{target}}/{{current_version}}"]');
  });

  it("serializes partial AppSettings to config entries", () => {
    const entries = toConfigEntriesFromAppSettings({
      checkUpdatesOnStart: false,
      updateSourceMode: "mirror",
      updateCustomEndpoints: [
        "https://updates.example.com/{{target}}/{{current_version}}",
      ],
      trayClickBehavior: "do_nothing",
      trayNotificationLevel: "important_only",
      envvarDefaultScope: "process",
      envvarAutoSnapshot: true,
      envvarMaskSensitive: false,
    });
    expect(entries).toContainEqual(["updates.check_on_start", "false"]);
    expect(entries).toContainEqual(["updates.source_mode", "mirror"]);
    expect(entries).toContainEqual([
      "updates.custom_endpoints",
      '["https://updates.example.com/{{target}}/{{current_version}}"]',
    ]);
    expect(entries).toContainEqual(["tray.click_behavior", "do_nothing"]);
    expect(entries).toContainEqual(["tray.notification_level", "important_only"]);
    expect(entries).toContainEqual(["envvar.default_scope", "process"]);
    expect(entries).toContainEqual(["envvar.auto_snapshot", "true"]);
    expect(entries).toContainEqual(["envvar.mask_sensitive", "false"]);
  });

  it("reads legacy app settings from both persist and direct payload shapes", () => {
    window.localStorage.setItem(
      "cognia-settings",
      JSON.stringify({
        state: {
          appSettings: {
            notifyOnUpdates: false,
          },
        },
      }),
    );
    expect(readLegacyAppSettingsFromStorage()).toEqual({
      notifyOnUpdates: false,
    });

    window.localStorage.setItem(
      "cognia-settings",
      JSON.stringify({
        appSettings: {
          startMinimized: true,
        },
      }),
    );
    expect(readLegacyAppSettingsFromStorage()).toEqual({
      startMinimized: true,
    });
  });

  it("returns null for missing or invalid legacy app settings payloads", () => {
    window.localStorage.removeItem("cognia-settings");
    expect(readLegacyAppSettingsFromStorage()).toBeNull();

    window.localStorage.setItem("cognia-settings", "{invalid");
    expect(readLegacyAppSettingsFromStorage()).toBeNull();
  });
});
