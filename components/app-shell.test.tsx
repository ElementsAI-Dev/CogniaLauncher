import { render, screen, fireEvent } from "@testing-library/react";
import { AppShell } from "./app-shell";

const mockToggleDrawer = jest.fn();
const mockFetchConfig = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "commandPalette.buttonLabel": "Search",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({
    toggleDrawer: mockToggleDrawer,
    getLogStats: () => ({
      total: 0,
      byLevel: { error: 0, warn: 0, info: 0, debug: 0, trace: 0 },
      byTarget: {},
    }),
  }),
}));

jest.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
    config: null,
    fetchConfig: mockFetchConfig,
  }),
}));

jest.mock("@/hooks/use-appearance-config-sync", () => ({
  useAppearanceConfigSync: jest.fn(),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("@/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
}));

jest.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

jest.mock("@/components/layout/titlebar", () => ({
  Titlebar: () => null,
}));

jest.mock("@/lib/stores/window-state", () => ({
  useWindowStateStore: () => ({
    isMaximized: false,
    isFullscreen: false,
    isDesktopMode: false,
    isFocused: true,
    isWindows: false,
    setMaximized: jest.fn(),
    setFullscreen: jest.fn(),
    setDesktopMode: jest.fn(),
    setFocused: jest.fn(),
    setWindows: jest.fn(),
  }),
}));

jest.mock("@/components/log/log-drawer", () => ({
  LogDrawer: () => <div data-testid="log-drawer">LogDrawer</div>,
}));

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

jest.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb">Breadcrumb</div>,
}));

jest.mock("@/components/command-palette", () => ({
  CommandPalette: ({ open }: { open: boolean }) =>
    open ? <div data-testid="command-palette">Command Palette</div> : null,
}));

describe("AppShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children content", () => {
    render(
      <AppShell>
        <div data-testid="child-content">Child Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders sidebar components", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
  });

  it("renders breadcrumb in header", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
  });

  it("renders log drawer", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("log-drawer")).toBeInTheDocument();
  });

  it("toggles log drawer on Ctrl+Shift+L", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "L", ctrlKey: true, shiftKey: true });

    expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
  });

  it("has search button that opens command palette", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const searchButton = container.querySelector('[data-tour="command-palette-btn"]');
    expect(searchButton).toBeInTheDocument();
  });
});
