import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";
import type { AppSettings } from "@/lib/stores/settings";
import {
  applySectionReset,
  buildAppSettingsFromConfigSnapshot,
  clearSectionValidationErrors,
} from "./reset-mapping";

const appSettingsFallback: AppSettings = {
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

describe("reset-mapping", () => {
  it("resets only keys in the selected section", () => {
    const result = applySectionReset({
      sectionId: "network",
      draft: {
        "network.timeout": "10",
        "network.retries": "3",
        "general.parallel_downloads": "8",
      },
      baseline: {
        "network.timeout": "30",
        "network.retries": "5",
        "general.parallel_downloads": "4",
      },
    });

    expect(result.nextDraft["network.timeout"]).toBe("30");
    expect(result.nextDraft["network.retries"]).toBe("5");
    expect(result.nextDraft["general.parallel_downloads"]).toBe("8");
    expect(result.resetKeys).toEqual(["network.timeout", "network.retries"]);
  });

  it("clears validation errors for reset keys only", () => {
    const next = clearSectionValidationErrors({
      errors: {
        "network.timeout": "Invalid timeout",
        "general.parallel_downloads": "Invalid downloads",
      },
      resetKeys: ["network.timeout"],
    });

    expect(next["network.timeout"]).toBeNull();
    expect(next["general.parallel_downloads"]).toBe("Invalid downloads");
  });

  it("derives app settings snapshot from config", () => {
    const appSettings = buildAppSettingsFromConfigSnapshot({
      configSnapshot: {
        "updates.check_on_start": "false",
        "updates.source_mode": "mirror",
        "updates.custom_endpoints": '["https://updates.example.com/latest.json"]',
        "updates.fallback_to_official": "false",
        "tray.notification_level": "none",
      },
      currentAppSettings: appSettingsFallback,
    });

    expect(appSettings.checkUpdatesOnStart).toBe(false);
    expect(appSettings.updateSourceMode).toBe("mirror");
    expect(appSettings.updateCustomEndpoints).toEqual([
      "https://updates.example.com/latest.json",
    ]);
    expect(appSettings.updateFallbackToOfficial).toBe(false);
    expect(appSettings.trayNotificationLevel).toBe("none");
  });
});
