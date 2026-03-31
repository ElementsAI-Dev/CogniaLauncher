import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvVarSettings } from "./envvar-settings";
import type { AppSettings } from "@/lib/stores/settings";
import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.envvarDefaultScope": "Default Scope",
    "settings.envvarDefaultScopeDesc": "Choose the default envvar scope",
    "settings.envvarDefaultScopeAll": "All Scopes",
    "settings.envvarDefaultScopeProcess": "Process",
    "settings.envvarDefaultScopeUser": "User",
    "settings.envvarDefaultScopeSystem": "System",
    "settings.envvarAutoSnapshot": "Auto Snapshot",
    "settings.envvarAutoSnapshotDesc": "Create a snapshot before risky mutations",
    "settings.envvarMaskSensitive": "Mask Sensitive Values",
    "settings.envvarMaskSensitiveDesc": "Hide sensitive values by default",
  };
  return translations[key] || key;
};

describe("EnvVarSettings", () => {
  const appSettings: AppSettings = {
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

  it("renders envvar preference controls", () => {
    render(
      <EnvVarSettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Default Scope" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto Snapshot" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Mask Sensitive Values" })).toBeInTheDocument();
  });

  it("updates the default scope through the select control", async () => {
    const onValueChange = jest.fn();
    render(
      <EnvVarSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Default Scope" }));
    await userEvent.click(screen.getByRole("option", { name: "User" }));

    expect(onValueChange).toHaveBeenCalledWith("envvarDefaultScope", "user");
  });

  it("updates toggle preferences", () => {
    const onValueChange = jest.fn();
    render(
      <EnvVarSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Auto Snapshot" }));
    fireEvent.click(screen.getByRole("switch", { name: "Mask Sensitive Values" }));

    expect(onValueChange).toHaveBeenCalledWith("envvarAutoSnapshot", true);
    expect(onValueChange).toHaveBeenCalledWith("envvarMaskSensitive", false);
  });
});
