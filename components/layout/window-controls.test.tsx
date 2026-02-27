import { render, screen, fireEvent } from "@testing-library/react";
import { WindowControls } from "./window-controls";
import type { WindowControlsState } from "@/hooks/use-window-controls";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "titlebar.pinOnTop": "Pin on top",
        "titlebar.unpinFromTop": "Unpin from top",
        "titlebar.minimize": "Minimize",
        "titlebar.maximize": "Maximize",
        "titlebar.restore": "Restore",
        "titlebar.close": "Close",
        "titlebar.minimizeToTray": "Minimize to tray",
        "titlebar.fullscreen": "Fullscreen",
        "titlebar.centerWindow": "Center window",
        "titlebar.alwaysOnTop": "Always on top",
      };
      return translations[key] || key;
    },
  }),
}));

const mockAppSettings = { minimizeToTray: false };

jest.mock("@/lib/stores/settings", () => ({
  useSettingsStore: () => ({
    appSettings: mockAppSettings,
  }),
}));

jest.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="context-menu-trigger">{children}</div>,
  ContextMenuContent: ({
    children,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <div
      data-testid="context-menu-item"
      data-variant={variant}
      onClick={onClick}
    >
      {children}
    </div>
  ),
  ContextMenuSeparator: () => <hr data-testid="context-menu-separator" />,
  ContextMenuShortcut: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="context-menu-shortcut">{children}</span>
  ),
  ContextMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: {
    children: React.ReactNode;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <div
      data-testid="context-menu-checkbox-item"
      data-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  TooltipContent: ({
    children,
  }: {
    children: React.ReactNode;
    side?: string;
  }) => <span data-testid="tooltip-content">{children}</span>,
}));

function makeControls(
  overrides: Partial<WindowControlsState> = {},
): WindowControlsState {
  return {
    mounted: true,
    isTauriEnv: true,
    isWindows: false,
    appWindow: {} as WindowControlsState["appWindow"],
    isMaximized: false,
    isFullscreen: false,
    isFocused: true,
    isAlwaysOnTop: false,
    maximizePadding: 0,
    handleMinimize: jest.fn(),
    handleMaximize: jest.fn(),
    handleToggleFullscreen: jest.fn(),
    handleCenter: jest.fn(),
    handleToggleAlwaysOnTop: jest.fn(),
    handleClose: jest.fn(),
    handleDoubleClick: jest.fn(),
    ...overrides,
  };
}

describe("WindowControls", () => {
  beforeEach(() => {
    mockAppSettings.minimizeToTray = false;
  });

  it("renders null when isFullscreen is true", () => {
    const controls = makeControls({ isFullscreen: true });
    const { container } = render(<WindowControls controls={controls} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all four control buttons", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    expect(screen.getByLabelText("Pin on top")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimize")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximize")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("shows PinOff label when isAlwaysOnTop is true", () => {
    const controls = makeControls({ isAlwaysOnTop: true });
    render(<WindowControls controls={controls} />);

    expect(screen.getByLabelText("Unpin from top")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pin on top")).not.toBeInTheDocument();
  });

  it("shows restore label when isMaximized is true", () => {
    const controls = makeControls({ isMaximized: true });
    render(<WindowControls controls={controls} />);

    expect(screen.getByLabelText("Restore")).toBeInTheDocument();
    expect(screen.queryByLabelText("Maximize")).not.toBeInTheDocument();
  });

  it("shows 'Minimize to tray' tooltip when minimizeToTray is true", () => {
    mockAppSettings.minimizeToTray = true;
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    const tooltips = screen.getAllByTestId("tooltip-content");
    const trayTooltip = tooltips.find((el) =>
      el.textContent?.includes("Minimize to tray"),
    );
    expect(trayTooltip).toBeDefined();
  });

  it("shows 'Close' tooltip when minimizeToTray is false", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    const tooltips = screen.getAllByTestId("tooltip-content");
    const closeTooltip = tooltips.find(
      (el) =>
        el.textContent?.includes("Close") &&
        !el.textContent?.includes("Minimize"),
    );
    expect(closeTooltip).toBeDefined();
  });

  it("disables all buttons when appWindow is null", () => {
    const controls = makeControls({ appWindow: null });
    render(<WindowControls controls={controls} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("calls handleMinimize when minimize button is clicked", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    fireEvent.click(screen.getByLabelText("Minimize"));
    expect(controls.handleMinimize).toHaveBeenCalledTimes(1);
  });

  it("calls handleMaximize when maximize button is clicked", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    fireEvent.click(screen.getByLabelText("Maximize"));
    expect(controls.handleMaximize).toHaveBeenCalledTimes(1);
  });

  it("calls handleClose when close button is clicked", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    fireEvent.click(screen.getByLabelText("Close"));
    expect(controls.handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls handleToggleAlwaysOnTop when pin button is clicked", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    fireEvent.click(screen.getByLabelText("Pin on top"));
    expect(controls.handleToggleAlwaysOnTop).toHaveBeenCalledTimes(1);
  });

  it("renders context menu items", () => {
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    expect(screen.getByTestId("context-menu-content")).toBeInTheDocument();
    const menuItems = screen.getAllByTestId("context-menu-item");
    // minimize, maximize, fullscreen, center, close = 5 items
    expect(menuItems.length).toBe(5);
  });

  it("renders always-on-top checkbox in context menu", () => {
    const controls = makeControls({ isAlwaysOnTop: true });
    render(<WindowControls controls={controls} />);

    const checkboxItem = screen.getByTestId("context-menu-checkbox-item");
    expect(checkboxItem).toHaveAttribute("data-checked", "true");
  });

  it("context menu close item shows tray text when minimizeToTray is true", () => {
    mockAppSettings.minimizeToTray = true;
    const controls = makeControls();
    render(<WindowControls controls={controls} />);

    const menuItems = screen.getAllByTestId("context-menu-item");
    const closeItem = menuItems.find((el) => el.getAttribute("data-variant") === "destructive");
    expect(closeItem?.textContent).toContain("Minimize to tray");
  });

  it("applies text-primary class when isAlwaysOnTop is true", () => {
    const controls = makeControls({ isAlwaysOnTop: true });
    render(<WindowControls controls={controls} />);

    const pinButton = screen.getByLabelText("Unpin from top");
    expect(pinButton.className).toContain("text-primary");
  });
});
