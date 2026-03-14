import type { AppSettings } from "@/lib/stores/settings";
import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";
import {
  appSettingKeyToConfigKey,
  appSettingValueToConfigValue,
  configToAppSettings,
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
  sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
};

describe("app-settings-mapping", () => {
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
    expect(mapped.autostart).toBe(false);
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
    });
    expect(entries).toContainEqual(["updates.check_on_start", "false"]);
    expect(entries).toContainEqual(["updates.source_mode", "mirror"]);
    expect(entries).toContainEqual([
      "updates.custom_endpoints",
      '["https://updates.example.com/{{target}}/{{current_version}}"]',
    ]);
    expect(entries).toContainEqual(["tray.click_behavior", "do_nothing"]);
    expect(entries).toContainEqual(["tray.notification_level", "important_only"]);
  });
});
