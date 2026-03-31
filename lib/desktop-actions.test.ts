import {
  executeDesktopAction,
  getDesktopAction,
  getDesktopActionsForSurface,
  type DesktopActionExecutionContext,
} from "./desktop-actions";

describe("desktop-actions", () => {
  const createContext = (
    overrides: Partial<DesktopActionExecutionContext> = {},
  ): DesktopActionExecutionContext => ({
    navigate: jest.fn(),
    ensureWindowVisible: jest.fn().mockResolvedValue(undefined),
    toggleLogs: jest.fn(),
    openCommandPalette: jest.fn(),
    openQuickSearch: jest.fn(),
    openFeedback: jest.fn(),
    toggleWindow: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("exposes tray-eligible shared desktop actions", () => {
    const trayActionIds = getDesktopActionsForSurface("tray").map(
      (action) => action.id,
    );

    expect(trayActionIds).toEqual(
      expect.arrayContaining([
        "open_settings",
        "open_downloads",
        "check_updates",
        "open_command_palette",
        "open_quick_search",
        "toggle_logs",
      ]),
    );
    expect(trayActionIds).not.toContain("feature_request");
  });

  it("exposes WSL actions only on the command palette surface", () => {
    const commandPaletteIds = getDesktopActionsForSurface("command_palette").map(
      (action) => action.id,
    );
    const trayActionIds = getDesktopActionsForSurface("tray").map(
      (action) => action.id,
    );

    expect(commandPaletteIds).toEqual(
      expect.arrayContaining([
        "wsl_launch_default",
        "wsl_shutdown_all",
        "wsl_open_terminal",
      ]),
    );
    expect(trayActionIds).not.toEqual(
      expect.arrayContaining([
        "wsl_launch_default",
        "wsl_shutdown_all",
        "wsl_open_terminal",
      ]),
    );
  });

  it("marks native-only actions so unsupported surfaces can filter them", () => {
    const action = getDesktopAction("open_logs");

    expect(action.execution).toBe("native");
    expect(action.surfaces).toContain("tray");
    expect(action.surfaces).not.toContain("command_palette");
  });

  it("executes route-backed actions through navigation after surfacing the window", async () => {
    const context = createContext();

    await executeDesktopAction("open_settings", context);

    expect(context.ensureWindowVisible).toHaveBeenCalled();
    expect(context.navigate).toHaveBeenCalledWith("/settings");
  });

  it("executes callback-backed actions through the shared executor", async () => {
    const context = createContext();

    await executeDesktopAction("open_command_palette", context);
    await executeDesktopAction("toggle_logs", context);

    expect(context.openCommandPalette).toHaveBeenCalled();
    expect(context.toggleLogs).toHaveBeenCalled();
    expect(context.navigate).not.toHaveBeenCalled();
  });

  it("returns to the dashboard before opening quick search", async () => {
    const context = createContext();

    await executeDesktopAction("open_quick_search", context);

    expect(context.ensureWindowVisible).toHaveBeenCalled();
    expect(context.navigate).toHaveBeenCalledWith("/");
    expect(context.openQuickSearch).toHaveBeenCalled();
  });

  it("returns false instead of mis-executing native-only actions on the frontend", async () => {
    const context = createContext();

    const result = await executeDesktopAction("open_logs", context);

    expect(result).toBe(false);
    expect(context.navigate).not.toHaveBeenCalled();
    expect(context.ensureWindowVisible).not.toHaveBeenCalled();
  });

  it("executes WSL callback-backed actions through the shared executor context", async () => {
    const context = createContext({
      wslLaunchDefault: jest.fn().mockResolvedValue(true),
      wslShutdownAll: jest.fn().mockResolvedValue(true),
      wslOpenTerminal: jest.fn().mockResolvedValue(true),
    });

    await executeDesktopAction("wsl_launch_default", context);
    await executeDesktopAction("wsl_shutdown_all", context);
    await executeDesktopAction("wsl_open_terminal", context);

    expect(context.ensureWindowVisible).toHaveBeenCalledTimes(3);
    expect(context.wslLaunchDefault).toHaveBeenCalled();
    expect(context.wslShutdownAll).toHaveBeenCalled();
    expect(context.wslOpenTerminal).toHaveBeenCalled();
  });
});
