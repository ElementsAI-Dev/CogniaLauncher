import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppShell } from "./app-shell";
import { DESKTOP_ACTION_EVENT } from "@/lib/desktop-actions";

const mockToggleDrawer = jest.fn();
const mockFetchConfig = jest.fn();
const mockRequestDashboardQuickSearchFocus = jest.fn();
const mockUseAppInit = jest.fn();
let mockPlatformIsTauri = false;
let mockSettingsConfig: Record<string, string> = {};
let mockSidebarShouldSuspend = false;
const mockSidebarSuspensePromise = Promise.resolve();

jest.mock("@/hooks/desktop/use-desktop-action-executor", () => ({
  useDesktopActionExecutor:
    (options: {
      openCommandPalette?: () => void;
      openQuickSearch?: () => void;
      toggleWindow?: () => Promise<void>;
    }) =>
    async (actionId: string) => {
      if (actionId === "open_command_palette") {
        options.openCommandPalette?.();
      }
      if (actionId === "open_quick_search") {
        options.openQuickSearch?.();
      }
      if (actionId === "toggle_window") {
        await options.toggleWindow?.();
      }
      return true;
    },
}));

jest.mock("@/lib/dashboard-quick-search-focus", () => ({
  requestDashboardQuickSearchFocus: () =>
    mockRequestDashboardQuickSearchFocus(),
}));

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

jest.mock("@/hooks/settings/use-settings", () => ({
  useSettings: () => ({
    config: mockSettingsConfig,
    fetchConfig: mockFetchConfig,
  }),
}));

jest.mock("@/hooks/settings/use-appearance-config-sync", () => ({
  useAppearanceConfigSync: jest.fn(),
}));

jest.mock("@/hooks/desktop/use-global-shortcuts", () => ({
  useGlobalShortcuts: jest.fn(),
}));

jest.mock("@/lib/stores/appearance", () => ({
  useAppearanceStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector({ windowEffect: "auto" }) : { windowEffect: "auto" },
}));

jest.mock("@/lib/platform", () => ({
  isTauri: () => mockPlatformIsTauri,
  isWindows: () => false,
}));

jest.mock("@/hooks/desktop/use-app-init", () => ({
  useAppInit: () => mockUseAppInit(),
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
  AppSidebar: () => {
    if (mockSidebarShouldSuspend) {
      throw mockSidebarSuspensePromise;
    }
    return <div data-testid="app-sidebar">Sidebar</div>;
  },
}));

jest.mock("@/components/layout/window-controls", () => ({
  WindowControls: () => <div data-testid="window-controls">WindowControls</div>,
}));

const mockWindowControls = {
  mounted: true,
  isTauriEnv: false,
  isWindows: false,
  appWindow: null,
  isMaximized: false,
  isFullscreen: false,
  isFocused: true,
  isAlwaysOnTop: false,
  maximizeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  maximizePadding: 0,
  handleMinimize: jest.fn(),
  handleMaximize: jest.fn(),
  handleToggleFullscreen: jest.fn(),
  handleCenter: jest.fn(),
  handleToggleAlwaysOnTop: jest.fn(),
  handleClose: jest.fn(),
  handleDoubleClick: jest.fn(),
};

jest.mock("@/hooks/desktop/use-window-controls", () => ({
  useWindowControls: () => mockWindowControls,
}));

const mockWindowState = {
  isMaximized: false,
  isFullscreen: false,
  isFocused: true,
  titlebarHeight: "2rem",
  setMaximized: jest.fn(),
  setFullscreen: jest.fn(),
  setFocused: jest.fn(),
  setTitlebarHeight: jest.fn(),
};

jest.mock("@/lib/stores/window-state", () => ({
  useWindowStateStore: (selector?: (s: typeof mockWindowState) => unknown) =>
    selector ? selector(mockWindowState) : mockWindowState,
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

jest.mock("@/components/feedback", () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog">FeedbackDialog</div>,
}));

jest.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

jest.mock("@/components/language-toggle", () => ({
  LanguageToggle: () => <button data-testid="language-toggle">Language</button>,
}));

const mockOnboarding = {
  isHydrated: true,
  shouldShowWizard: false,
  mode: null,
  sessionState: 'idle',
  canResume: false,
  sessionSummary: {
    mode: null,
    locale: null,
    theme: null,
    mirrorPreset: 'default',
    detectedCount: 0,
    primaryEnvironment: null,
    manageableEnvironments: [],
    shellType: null,
    shellConfigured: null,
  },
  nextActions: [],
  isCompleted: false,
  isSkipped: false,
  currentStep: 0,
  currentStepId: 'mode-selection',
  stepIds: ['mode-selection'],
  totalSteps: 1,
  progress: 0,
  isFirstStep: true,
  isLastStep: false,
  wizardOpen: false,
  tourActive: false,
  tourCompleted: false,
  tourStep: 0,
  openWizard: jest.fn(),
  closeWizard: jest.fn(),
  selectMode: jest.fn(),
  updateSummary: jest.fn(),
  next: jest.fn(),
  prev: jest.fn(),
  goTo: jest.fn(),
  complete: jest.fn(),
  skip: jest.fn(),
  reset: jest.fn(),
  startTour: jest.fn(),
  nextTourStep: jest.fn(),
  prevTourStep: jest.fn(),
  completeTour: jest.fn(),
  stopTour: jest.fn(),
};

jest.mock("@/hooks/onboarding/use-onboarding", () => ({
  useOnboarding: () => mockOnboarding,
}));

jest.mock("@/components/onboarding", () => ({
  OnboardingWizard: ({ open }: { open: boolean }) => (
    <div data-testid="onboarding-wizard" data-open={String(open)}>
      OnboardingWizard
    </div>
  ),
  TourOverlay: ({ active }: { active: boolean }) => (
    <div data-testid="tour-overlay" data-active={String(active)}>
      TourOverlay
    </div>
  ),
  BubbleHintLayer: () => <div data-testid="bubble-hints">BubbleHints</div>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformIsTauri = false;
    mockSettingsConfig = {};
    mockSidebarShouldSuspend = false;
    mockUseAppInit.mockReturnValue({
      phase: "ready",
      progress: 100,
      message: "splash.ready",
      version: "1.0.0",
      isReady: true,
      isDegraded: false,
      timedOutPhases: [],
      skippedPhases: [],
    });
    mockWindowControls.maximizeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    mockWindowControls.maximizePadding = 0;
    document.documentElement.removeAttribute("data-window-effect");
    mockOnboarding.isHydrated = true;
    mockOnboarding.shouldShowWizard = false;
    mockOnboarding.tourActive = false;
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

  it("renders a sidebar fallback when the sidebar suspends", () => {
    mockSidebarShouldSuspend = true;

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-sidebar-fallback")).toBeInTheDocument();
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

  it("does not set native window transparency attribute in web mode", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(
      document.documentElement.hasAttribute("data-window-effect"),
    ).toBe(false);
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

  it("keeps desktop quick-search actions out of the command palette flow", async () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    window.dispatchEvent(
      new CustomEvent(DESKTOP_ACTION_EVENT, {
        detail: "open_quick_search",
      }),
    );

    await waitFor(() => {
      expect(mockRequestDashboardQuickSearchFocus).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("does not apply content padding when maximize insets are all zero", () => {
    mockWindowControls.maximizeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const contentContainer = container.querySelector(
      "div.flex.flex-1.overflow-hidden",
    ) as HTMLDivElement;

    expect(contentContainer.style.paddingTop).toBe("");
    expect(contentContainer.style.paddingRight).toBe("");
    expect(contentContainer.style.paddingBottom).toBe("");
    expect(contentContainer.style.paddingLeft).toBe("");
  });

  it("applies per-edge maximize insets to the content container", () => {
    mockWindowControls.maximizeInsets = { top: 8, right: 6, bottom: 4, left: 2 };

    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const contentContainer = container.querySelector(
      "div.flex.flex-1.overflow-hidden",
    ) as HTMLDivElement;

    expect(contentContainer).toHaveStyle({
      paddingTop: "8px",
      paddingRight: "6px",
      paddingBottom: "4px",
      paddingLeft: "2px",
    });
  });

  it("renders onboarding surfaces when hydration is ready", () => {
    mockOnboarding.shouldShowWizard = true;
    mockOnboarding.tourActive = true;

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("onboarding-wizard")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("tour-overlay")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("bubble-hints")).toBeInTheDocument();
  });

  it("does not render onboarding surfaces before hydration completes", () => {
    mockOnboarding.isHydrated = false;
    mockOnboarding.shouldShowWizard = true;
    mockOnboarding.tourActive = true;

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tour-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bubble-hints")).not.toBeInTheDocument();
  });

  it("dismisses splash after startup becomes interactive even when the reported phase is still degraded", async () => {
    jest.useFakeTimers();
    mockPlatformIsTauri = true;
    mockUseAppInit.mockReturnValue({
      phase: "plugins",
      progress: 90,
      message: "splash.loadingPlugins",
      version: "1.0.0",
      isReady: true,
      isDegraded: true,
      timedOutPhases: ["plugins"],
      skippedPhases: [],
    });

    try {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>,
      );

      expect(screen.getByText("splash.loadingPlugins")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(900);
      });

      await waitFor(() => {
        expect(screen.queryByText("splash.loadingPlugins")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Content")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
