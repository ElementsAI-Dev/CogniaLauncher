import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TrayMenuCustomizer } from "./tray-menu-customizer";

const mockTrayGetMenuConfig = jest.fn();
const mockTraySetMenuConfig = jest.fn();
const mockTrayGetAvailableMenuItems = jest.fn();
const mockTrayResetMenuConfig = jest.fn();
const mockIsTauri = jest.fn();

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
  trayGetMenuConfig: (...args: unknown[]) => mockTrayGetMenuConfig(...args),
  traySetMenuConfig: (...args: unknown[]) => mockTraySetMenuConfig(...args),
  trayGetAvailableMenuItems: (...args: unknown[]) =>
    mockTrayGetAvailableMenuItems(...args),
  trayResetMenuConfig: (...args: unknown[]) =>
    mockTrayResetMenuConfig(...args),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.trayMenuCustomize": "Customize Menu",
    "settings.trayMenuCustomizeDesc": "Drag to reorder, toggle to show/hide",
    "settings.trayMenu.showHide": "Show/Hide",
    "settings.trayMenu.quickNav": "Quick Nav",
    "settings.trayMenu.downloads": "Downloads",
    "settings.trayMenu.settings": "Settings",
    "settings.trayMenu.checkUpdates": "Check Updates",
    "settings.trayMenu.openLogs": "Open Logs",
    "settings.trayMenu.alwaysOnTop": "Always on Top",
    "settings.trayMenu.autostart": "Autostart",
    "settings.trayMenu.quit": "Quit",
    "common.reset": "Reset",
  };
  return translations[key] || key;
};

describe("TrayMenuCustomizer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockTrayGetAvailableMenuItems.mockResolvedValue([
      "show_hide",
      "settings",
      "quit",
    ]);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "quit"],
    });
    mockTraySetMenuConfig.mockResolvedValue(undefined);
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
  });

  it("renders loading skeleton initially", () => {
    const { container } = render(<TrayMenuCustomizer t={mockT} />);

    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).toBeInTheDocument();
  });

  it("renders menu items after loading", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(screen.getByText("Show/Hide")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Quit")).toBeInTheDocument();
  });

  it("renders customize title and description", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(screen.getByText("Customize Menu")).toBeInTheDocument();
    expect(
      screen.getByText("Drag to reorder, toggle to show/hide"),
    ).toBeInTheDocument();
  });

  it("renders reset button", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("renders switches for each menu item", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
  });

  it("quit switch is disabled", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const switches = screen.getAllByRole("switch");
    // quit is the last item
    const quitSwitch = switches[switches.length - 1];
    expect(quitSwitch).toBeDisabled();
  });

  it("toggling a non-quit item calls saveConfig", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const switches = screen.getAllByRole("switch");
    // Toggle first item (show_hide) OFF
    await act(async () => {
      fireEvent.click(switches[0]);
    });

    expect(mockTraySetMenuConfig).toHaveBeenCalled();
  });

  it("reset button calls trayResetMenuConfig and reloads config", async () => {
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "quit"],
    });

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Reset"));
    });

    expect(mockTrayResetMenuConfig).toHaveBeenCalled();
    // After reset, getMenuConfig is called again
    expect(mockTrayGetMenuConfig).toHaveBeenCalledTimes(2);
  });

  it("does nothing when not in Tauri", async () => {
    mockIsTauri.mockReturnValue(false);

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    // Should not have called Tauri APIs (isTauri check in useEffect prevents it)
    expect(mockTrayGetAvailableMenuItems).not.toHaveBeenCalled();
  });

  it("handles API error gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockTrayGetAvailableMenuItems.mockRejectedValue(new Error("API error"));

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    // Should not crash - loading should finish
    expect(screen.queryByText("Customize Menu")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
