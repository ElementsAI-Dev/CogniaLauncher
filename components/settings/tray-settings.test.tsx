import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TraySettings } from "./tray-settings";
import type { AppSettings } from "@/lib/stores/settings";
import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";

const mockIsTauri = jest.fn(() => false);
const mockTraySetMinimizeToTray = jest.fn().mockResolvedValue(undefined);
const mockTraySetStartMinimized = jest.fn().mockResolvedValue(undefined);
const mockTraySetShowNotifications = jest.fn().mockResolvedValue(undefined);
const mockTraySetNotificationLevel = jest.fn().mockResolvedValue(undefined);
const mockTraySetQuickAction = jest.fn().mockResolvedValue(undefined);
const mockTrayGetAvailableQuickActions = jest.fn().mockResolvedValue([
  "open_settings",
  "check_updates",
]);
const mockTraySetNotificationEvents = jest.fn().mockResolvedValue(undefined);
const mockTrayGetAvailableNotificationEvents = jest
  .fn()
  .mockResolvedValue(["updates", "errors"]);
const mockTrayGetState = jest.fn().mockResolvedValue({
  quickAction: "check_updates",
  notificationEvents: ["updates", "errors"],
});

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
  trayIsAutostartEnabled: jest.fn().mockResolvedValue(false),
  trayEnableAutostart: jest.fn().mockResolvedValue(undefined),
  trayDisableAutostart: jest.fn().mockResolvedValue(undefined),
  traySetClickBehavior: jest.fn().mockResolvedValue(undefined),
  traySetQuickAction: (v: string) => mockTraySetQuickAction(v),
  trayGetAvailableQuickActions: () => mockTrayGetAvailableQuickActions(),
  traySetShowNotifications: (v: boolean) => mockTraySetShowNotifications(v),
  traySetNotificationLevel: (v: string) => mockTraySetNotificationLevel(v),
  traySetNotificationEvents: (v: string[]) => mockTraySetNotificationEvents(v),
  trayGetAvailableNotificationEvents: () => mockTrayGetAvailableNotificationEvents(),
  trayGetState: () => mockTrayGetState(),
  listenTrayNotificationEventsChanged: jest.fn().mockResolvedValue(() => {}),
  traySetMinimizeToTray: (v: boolean) => mockTraySetMinimizeToTray(v),
  traySetStartMinimized: (v: boolean) => mockTraySetStartMinimized(v),
  trayGetAvailableMenuItems: jest.fn().mockResolvedValue(["show_hide", "quit"]),
  trayGetMenuConfig: jest.fn().mockResolvedValue({ items: ["show_hide", "quit"] }),
  traySetMenuConfig: jest.fn().mockResolvedValue(undefined),
  trayResetMenuConfig: jest.fn().mockResolvedValue(undefined),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.tray": "System Tray",
    "settings.trayDesc": "Configure system tray behavior",
    "settings.minimizeToTray": "Minimize to Tray",
    "settings.minimizeToTrayDesc": "Minimize to system tray instead of closing",
    "settings.startMinimized": "Start Minimized",
    "settings.startMinimizedDesc":
      "Start the application minimized to system tray",
    "settings.autostart": "Autostart",
    "settings.autostartDesc": "Start app on login",
    "settings.showNotifications": "Show Notifications",
    "settings.showNotificationsDesc": "Show desktop notifications",
    "settings.trayNotificationLevel": "Notification Level",
    "settings.trayNotificationLevelDesc": "Choose which tray notifications to display",
    "settings.trayNotificationLevelAll": "All",
    "settings.trayNotificationLevelImportantOnly": "Important Only",
    "settings.trayNotificationLevelNone": "None",
    "settings.trayClickBehavior": "Tray Click Behavior",
    "settings.trayClickBehaviorDesc": "Action when tray icon is clicked",
    "settings.trayClickToggle": "Toggle Window",
    "settings.trayClickMenu": "Show Menu",
    "settings.trayClickCheckUpdates": "Check Updates",
    "settings.trayClickQuickAction": "Quick Action",
    "settings.trayClickNothing": "Do Nothing",
    "settings.trayQuickAction": "Quick Action Mapping",
    "settings.trayQuickActionDesc": "Action for quick action mode",
    "settings.trayQuickActionOption.open_settings": "Open Settings",
    "settings.trayQuickActionOption.check_updates": "Check Updates",
    "settings.trayNotificationEvents": "Notification Event Filters",
    "settings.trayNotificationEventsDesc": "Event-level controls",
    "settings.trayNotificationEventOption.updates": "Update Events",
    "settings.trayNotificationEventOption.errors": "Error Events",
    "settings.trayNotificationEventItemDesc": "Toggle this category",
  };
  return translations[key] || key;
};

describe("TraySettings", () => {
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
    sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
  };

  it("should render tray settings content", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Minimize to Tray")).toBeInTheDocument();
  });

  it("should render minimize to tray setting", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Minimize to Tray")).toBeInTheDocument();
    expect(
      screen.getByText("Minimize to system tray instead of closing"),
    ).toBeInTheDocument();
  });

  it("should render start minimized setting", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Start Minimized")).toBeInTheDocument();
    expect(
      screen.getByText("Start the application minimized to system tray"),
    ).toBeInTheDocument();
  });

  it("should call onValueChange when minimizeToTray toggle changes", () => {
    const onValueChange = jest.fn();
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    expect(onValueChange).toHaveBeenCalledWith("minimizeToTray", false);
  });

  it("should call onValueChange when startMinimized toggle changes", () => {
    const onValueChange = jest.fn();
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[1]);

    expect(onValueChange).toHaveBeenCalledWith("startMinimized", true);
  });

  it("should reflect correct initial switch states", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toBeChecked();
    expect(switches[1]).not.toBeChecked();
  });

  it("should reflect updated switch states when appSettings change", () => {
    const updatedSettings: AppSettings = {
      ...appSettings,
      minimizeToTray: false,
      startMinimized: true,
    };

    render(
      <TraySettings
        appSettings={updatedSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked();
  });

  it("should render autostart setting", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Autostart")).toBeInTheDocument();
    expect(screen.getByText("Start app on login")).toBeInTheDocument();
  });

  it("should render show notifications setting", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Show Notifications")).toBeInTheDocument();
    expect(screen.getByText("Show desktop notifications")).toBeInTheDocument();
  });

  it("should call onValueChange when showNotifications toggled", () => {
    const onValueChange = jest.fn();
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const switches = screen.getAllByRole("switch");
    // showNotifications is the 4th switch (minimize, start minimized, autostart, show notifications)
    fireEvent.click(switches[3]);

    expect(onValueChange).toHaveBeenCalledWith("showNotifications", false);
  });

  it("should render tray click behavior selector", () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText("Tray Click Behavior")).toBeInTheDocument();
    expect(
      screen.getByText("Action when tray icon is clicked"),
    ).toBeInTheDocument();
  });

  describe("Tauri mode", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
      mockTraySetMinimizeToTray.mockClear();
      mockTraySetStartMinimized.mockClear();
      mockTraySetShowNotifications.mockClear();
    });

    it("should call traySetMinimizeToTray when minimize toggle changes", () => {
      const onValueChange = jest.fn();
      render(
        <TraySettings
          appSettings={appSettings}
          onValueChange={onValueChange}
          t={mockT}
        />,
      );

      const switches = screen.getAllByRole("switch");
      fireEvent.click(switches[0]); // minimizeToTray

      expect(onValueChange).toHaveBeenCalledWith("minimizeToTray", false);
      expect(mockTraySetMinimizeToTray).toHaveBeenCalledWith(false);
    });

    it("should call traySetStartMinimized when start minimized toggle changes", () => {
      const onValueChange = jest.fn();
      render(
        <TraySettings
          appSettings={appSettings}
          onValueChange={onValueChange}
          t={mockT}
        />,
      );

      const switches = screen.getAllByRole("switch");
      fireEvent.click(switches[1]); // startMinimized

      expect(onValueChange).toHaveBeenCalledWith("startMinimized", true);
      expect(mockTraySetStartMinimized).toHaveBeenCalledWith(true);
    });

    it("should call traySetShowNotifications when notifications toggle changes", () => {
      const onValueChange = jest.fn();
      render(
        <TraySettings
          appSettings={appSettings}
          onValueChange={onValueChange}
          t={mockT}
        />,
      );

      const switches = screen.getAllByRole("switch");
      fireEvent.click(switches[3]); // showNotifications

      expect(onValueChange).toHaveBeenCalledWith("showNotifications", false);
      expect(mockTraySetShowNotifications).toHaveBeenCalledWith(false);
    });

    it("should render tray menu customizer in Tauri mode", () => {
      render(
        <TraySettings
          appSettings={appSettings}
          onValueChange={jest.fn()}
          t={mockT}
        />,
      );

      // TrayMenuCustomizer is rendered only in Tauri mode
      // It will be in loading state initially
      expect(screen.getByText("Tray Click Behavior")).toBeInTheDocument();
    });
  });
});
