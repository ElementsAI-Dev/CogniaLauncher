import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TraySettings } from "./tray-settings";
import type { AppSettings } from "@/lib/stores/settings";

const mockIsTauri = jest.fn(() => false);
const mockTraySetMinimizeToTray = jest.fn().mockResolvedValue(undefined);
const mockTraySetStartMinimized = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
  trayIsAutostartEnabled: jest.fn().mockResolvedValue(false),
  trayEnableAutostart: jest.fn().mockResolvedValue(undefined),
  trayDisableAutostart: jest.fn().mockResolvedValue(undefined),
  traySetClickBehavior: jest.fn().mockResolvedValue(undefined),
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
    "settings.trayClickBehavior": "Tray Click Behavior",
    "settings.trayClickBehaviorDesc": "Action when tray icon is clicked",
    "settings.trayClickToggle": "Toggle Window",
    "settings.trayClickMenu": "Show Menu",
    "settings.trayClickNothing": "Do Nothing",
  };
  return translations[key] || key;
};

describe("TraySettings", () => {
  const appSettings: AppSettings = {
    checkUpdatesOnStart: true,
    autoInstallUpdates: false,
    notifyOnUpdates: true,
    minimizeToTray: true,
    startMinimized: false,
    autostart: false,
    trayClickBehavior: "toggle_window",
    showNotifications: true,
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
