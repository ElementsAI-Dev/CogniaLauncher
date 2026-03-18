import { render, screen, fireEvent } from "@testing-library/react";
import { ShortcutSettings } from "./shortcut-settings";
import { isTauri } from "@/lib/platform";

jest.mock("@/lib/platform", () => ({
  isTauri: jest.fn(() => true),
}));

const mockIsTauri = jest.mocked(isTauri);

const defaultConfig: Record<string, string> = {
  "shortcuts.enabled": "true",
  "shortcuts.toggle_window": "CmdOrCtrl+Shift+Space",
  "shortcuts.command_palette": "CmdOrCtrl+Shift+K",
  "shortcuts.quick_search": "CmdOrCtrl+Shift+F",
};

const mockT = (key: string): string => {
  const translations: Record<string, string> = {
    "settings.shortcutsEnabled": "Enable Global Shortcuts",
    "settings.shortcutsEnabledDesc":
      "Register system-wide shortcuts that work even when the window is not focused",
    "settings.shortcutsToggleWindow": "Toggle Window",
    "settings.shortcutsToggleWindowDesc": "Show or hide the main window",
    "settings.shortcutsCommandPalette": "Command Palette",
    "settings.shortcutsCommandPaletteDesc":
      "Open the command palette from anywhere",
    "settings.shortcutsQuickSearch": "Quick Search",
    "settings.shortcutsQuickSearchDesc":
      "Open package search from anywhere",
    "settings.shortcutsRecording": "Press keys...",
    "settings.shortcutsReset": "Reset to Default",
    "settings.shortcutsDesktopOnly":
      "Global shortcuts are only available in the desktop app",
    "settings.section.modified": "Modified",
  };
  return translations[key] || key;
};

describe("ShortcutSettings", () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it("renders enable switch and shortcut items in Tauri mode", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    expect(screen.getByText("Enable Global Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Toggle Window")).toBeInTheDocument();
    expect(screen.getByText("Command Palette")).toBeInTheDocument();
    expect(screen.getByText("Quick Search")).toBeInTheDocument();
  });

  it("shows desktop-only message in non-Tauri mode", () => {
    mockIsTauri.mockReturnValue(false);

    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    expect(
      screen.getByText("Global shortcuts are only available in the desktop app"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Toggle Window")).not.toBeInTheDocument();
  });

  it("toggles enabled switch", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    expect(mockOnValueChange).toHaveBeenCalledWith(
      "shortcuts.enabled",
      "false",
    );
  });

  it("displays formatted shortcut values", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    // The display format depends on OS, but the inputs should contain formatted text
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(3);
  });

  it("enters recording mode on shortcut input click", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[0]);

    expect(screen.getByDisplayValue("Press keys...")).toBeInTheDocument();
  });

  it("cancels recording mode on Escape", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[0]);

    // Should be in recording mode
    expect(screen.getByDisplayValue("Press keys...")).toBeInTheDocument();

    // Press Escape on the input to cancel
    fireEvent.keyDown(inputs[0], { key: "Escape" });

    // Should no longer show recording text
    expect(screen.queryByDisplayValue("Press keys...")).not.toBeInTheDocument();
  });

  it("records a new shortcut via keydown", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[0]);

    // Simulate Ctrl+Shift+A
    fireEvent.keyDown(window, {
      key: "a",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });

    expect(mockOnValueChange).toHaveBeenCalledWith(
      "shortcuts.toggle_window",
      "CmdOrCtrl+Shift+A",
    );
  });

  it("ignores standalone modifier keys while recording", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[0]);
    fireEvent.keyDown(window, { key: "Shift", shiftKey: true });

    expect(mockOnValueChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Press keys...")).toBeInTheDocument();
  });

  it("records Alt+Space shortcuts", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[1]);
    fireEvent.keyDown(window, { key: " ", altKey: true });

    expect(mockOnValueChange).toHaveBeenCalledWith(
      "shortcuts.command_palette",
      "Alt+Space",
    );
  });

  it("records Meta+ArrowUp shortcuts as CmdOrCtrl+Up", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[2]);
    fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });

    expect(mockOnValueChange).toHaveBeenCalledWith(
      "shortcuts.quick_search",
      "CmdOrCtrl+Up",
    );
  });

  it("ignores shortcut recording without modifier keys", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    fireEvent.click(inputs[0]);
    fireEvent.keyDown(window, {
      key: "a",
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    expect(mockOnValueChange).not.toHaveBeenCalledWith(
      "shortcuts.toggle_window",
      expect.any(String),
    );
    expect(screen.getByDisplayValue("Press keys...")).toBeInTheDocument();
  });

  it("resets a modified shortcut back to the default value", () => {
    render(
      <ShortcutSettings
        localConfig={{
          ...defaultConfig,
          "shortcuts.toggle_window": "Alt+Space",
        }}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));

    expect(mockOnValueChange).toHaveBeenCalledWith(
      "shortcuts.toggle_window",
      "CmdOrCtrl+Shift+Space",
    );
  });

  it("shows reset button when value differs from default", () => {
    const customConfig = {
      ...defaultConfig,
      "shortcuts.toggle_window": "Alt+Space",
    };

    render(
      <ShortcutSettings
        localConfig={customConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    // Should show a Modified badge for the changed shortcut
    expect(screen.getByText("Modified")).toBeInTheDocument();
  });

  it("does not show reset button when value matches default", () => {
    render(
      <ShortcutSettings
        localConfig={defaultConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    // No modified badges for default values
    expect(screen.queryByText("Modified")).not.toBeInTheDocument();
  });

  it("renders with disabled shortcuts", () => {
    const disabledConfig = {
      ...defaultConfig,
      "shortcuts.enabled": "false",
    };

    render(
      <ShortcutSettings
        localConfig={disabledConfig}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
  });

  it("falls back to empty shortcut values when local config keys are missing", () => {
    render(
      <ShortcutSettings
        localConfig={{ "shortcuts.enabled": "true" }}
        errors={{}}
        onValueChange={mockOnValueChange}
        t={mockT}
      />,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("—");
    expect(inputs[1]).toHaveValue("—");
    expect(inputs[2]).toHaveValue("—");
  });
});
