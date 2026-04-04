import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DashboardPage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock the Tauri API
const mockIsTauri = jest.fn().mockReturnValue(false);
const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => {});

jest.mock("@/lib/tauri", () => ({
  isTauri: (...args: unknown[]) => mockIsTauri(...args),
}));

jest.mock("@/lib/cache/invalidation", () => ({
  ensureCacheInvalidationBridge: (...args: Parameters<typeof mockEnsureCacheInvalidationBridge>) =>
    mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (...args: Parameters<typeof mockSubscribeInvalidation>) =>
    mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const mockFetchEnvironments = jest.fn().mockResolvedValue(undefined);
const mockFetchInstalledPackages = jest.fn().mockResolvedValue(undefined);
const mockFetchProviders = jest.fn().mockResolvedValue(undefined);
const mockFetchCacheInfo = jest.fn().mockResolvedValue(undefined);
const mockFetchConfig = jest.fn().mockResolvedValue({});
const mockFetchPlatformInfo = jest.fn().mockResolvedValue(undefined);
const mockUseDashboardInsights = jest.fn(() => ({
  attentionCenter: {},
  recentActivityFeed: {},
  workspaceTrends: {},
  providerHealthMatrix: {},
  activityTimeline: {},
}));
const mockSetIsCustomizing = jest.fn();
const mockSetIsEditMode = jest.fn();
const mockSetVisualContext = jest.fn();
const mockApplyStylePreset = jest.fn();
let mockEnvsError: string | null = null;
let mockPkgsError: string | null = null;
let mockSettingsError: string | null = null;
let mockDashboardIsCustomizing = false;
let mockDashboardIsEditMode = false;
let mockDashboardVisualContext = { range: "7d" };
let mockDashboardActiveStylePresetId = "balanced-workbench";
let mockDashboardHasPresetDiverged = false;
let mockSettingsConfig: Record<string, string> = {};
let mockStartupReady = true;

// Mock hooks used by the dashboard page
jest.mock("@/hooks/desktop/use-app-init", () => ({
  useAppInit: () => ({
    phase: mockStartupReady ? "ready" : "plugins",
    progress: mockStartupReady ? 100 : 90,
    message: mockStartupReady ? "splash.ready" : "splash.loadingPlugins",
    version: "1.0.0",
    isReady: mockStartupReady,
    isDegraded: !mockStartupReady,
    timedOutPhases: mockStartupReady ? [] : ["plugins"],
    skippedPhases: [],
  }),
}));

jest.mock("@/hooks/environments/use-environments", () => ({
  useEnvironments: () => ({
    environments: [
      {
        env_type: "node",
        provider: "nvm",
        provider_id: "nvm",
        available: true,
        current_version: "20.0.0",
        installed_versions: ["18.0.0", "20.0.0"],
      },
    ],
    fetchEnvironments: (...args: Parameters<typeof mockFetchEnvironments>) =>
      mockFetchEnvironments(...args),
    loading: false,
    error: mockEnvsError,
  }),
}));

jest.mock("@/hooks/packages/use-packages", () => ({
  usePackages: () => ({
    installedPackages: [
      { name: "typescript", version: "5.0.0", provider: "npm" },
    ],
    fetchInstalledPackages: (...args: Parameters<typeof mockFetchInstalledPackages>) =>
      mockFetchInstalledPackages(...args),
    fetchProviders: (...args: Parameters<typeof mockFetchProviders>) =>
      mockFetchProviders(...args),
    providers: [{ id: "npm", display_name: "NPM" }],
    loading: false,
    error: mockPkgsError,
  }),
}));

jest.mock("@/hooks/settings/use-settings", () => ({
  useSettings: () => ({
    config: mockSettingsConfig,
    fetchConfig: (...args: Parameters<typeof mockFetchConfig>) =>
      mockFetchConfig(...args),
    cacheInfo: {
      download_cache: { entry_count: 5, size: 1024, size_human: "1 KB", location: "" },
      metadata_cache: { entry_count: 10, size: 2048, size_human: "2 KB", location: "" },
      total_size: 3072,
      total_size_human: "3 KB",
    },
    fetchCacheInfo: (...args: Parameters<typeof mockFetchCacheInfo>) =>
      mockFetchCacheInfo(...args),
    platformInfo: { os: "Test OS", arch: "x64" },
    fetchPlatformInfo: (...args: Parameters<typeof mockFetchPlatformInfo>) =>
      mockFetchPlatformInfo(...args),
    cogniaDir: "/mock/cognia/dir",
    loading: false,
    error: mockSettingsError,
  }),
}));

jest.mock("@/hooks/dashboard/use-dashboard-insights", () => ({
  useDashboardInsights: (...args: unknown[]) => mockUseDashboardInsights(...args),
}));

jest.mock("@/components/dashboard/customize-dialog", () => ({
  CustomizeDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="mock-customize-dialog" data-open={String(open)}>
      <button
        type="button"
        data-testid="mock-customize-dialog-open"
        onClick={() => onOpenChange(true)}
      >
        open
      </button>
      <button
        type="button"
        data-testid="mock-customize-dialog-close"
        onClick={() => onOpenChange(false)}
      >
        close
      </button>
    </div>
  ),
}));

jest.mock("@/lib/stores/dashboard", () => {
  const actual = jest.requireActual("@/lib/stores/dashboard");
  return {
    ...actual,
    useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isCustomizing: mockDashboardIsCustomizing,
        isEditMode: mockDashboardIsEditMode,
        visualContext: mockDashboardVisualContext,
        activeStylePresetId: mockDashboardActiveStylePresetId,
        presentation: { density: "comfortable", emphasis: "balanced" },
        setIsCustomizing: (...args: unknown[]) => mockSetIsCustomizing(...args),
        setIsEditMode: (...args: unknown[]) => mockSetIsEditMode(...args),
        setVisualContext: (...args: unknown[]) => mockSetVisualContext(...args),
        applyStylePreset: (...args: unknown[]) => mockApplyStylePreset(...args),
        restoreActiveStylePreset: jest.fn(),
        hasActiveStylePresetDiverged: () => mockDashboardHasPresetDiverged,
        widgets: [
          { id: 'w-stats', type: 'stats-overview', size: 'full', visible: true },
          { id: 'w-search', type: 'quick-search', size: 'full', visible: true },
          { id: 'w-envs', type: 'environment-list', size: 'md', visible: true },
          { id: 'w-pkgs', type: 'package-list', size: 'md', visible: true },
          { id: 'w-cache', type: 'cache-usage', size: 'md', visible: true },
          { id: 'w-system', type: 'system-info', size: 'md', visible: true },
          { id: 'w-actions', type: 'quick-actions', size: 'full', visible: true },
        ],
        layout: [],
        reorderWidgets: jest.fn(),
        removeWidget: jest.fn(),
        toggleWidgetVisibility: jest.fn(),
        updateWidget: jest.fn(),
      };
      return selector(state);
    },
    DASHBOARD_STYLE_PRESETS: {
      "balanced-workbench": {
        id: "balanced-workbench",
        titleKey: "dashboard.stylePresets.balancedWorkbench.title",
        descriptionKey: "dashboard.stylePresets.balancedWorkbench.description",
      },
      "focus-flow": {
        id: "focus-flow",
        titleKey: "dashboard.stylePresets.focusFlow.title",
        descriptionKey: "dashboard.stylePresets.focusFlow.description",
      },
      "analytics-deck": {
        id: "analytics-deck",
        titleKey: "dashboard.stylePresets.analyticsDeck.title",
        descriptionKey: "dashboard.stylePresets.analyticsDeck.description",
      },
    },
  };
});

// Mock messages with new dashboard translations
const mockMessages = {
  en: {
    dashboard: {
      title: "Dashboard",
      description: "Overview of your development environment",
      environments: "Environments",
      versionsInstalled: "{count} versions installed",
      packages: "Packages",
      fromProviders: "from {count} providers",
      cache: "Cache",
      cachedItems: "{count} cached items",
      platform: "Platform",
      activeEnvironments: "Active Environments",
      activeEnvironmentsDesc: "Currently available environment managers",
      noEnvironments: "No environments detected",
      recentPackages: "Recent Packages",
      recentPackagesDesc: "Recently installed packages",
      noPackages: "No packages installed",
      quickSearch: {
        placeholder: "Search environments, packages...",
        hint: "Press / to focus",
        noResults: "No results found",
        environments: "Environments",
        packages: "Packages",
        actions: "Quick Actions",
        recentSearches: "Recent Searches",
        clearRecent: "Clear recent",
        viewAll: "View all results",
      },
      quickActions: {
        title: "Quick Actions",
        description: "Common actions and shortcuts",
        addEnvironment: "Add Environment",
        installPackage: "Install Package",
        clearCache: "Clear Cache",
        manageCache: "Manage Cache",
        refreshAll: "Refresh All",
        openSettings: "Settings",
        viewLogs: "View Logs",
      },
      stylePresets: {
        triggerLabel: "Style preset",
        currentLabel: "Current style",
        diverged: "Modified from preset",
        customizeShortcut: "Customize layout",
        balancedWorkbench: {
          title: "Balanced Workbench",
          description: "Balanced dashboard layout",
        },
        focusFlow: {
          title: "Focus Flow",
          description: "Focus on actions and follow-ups",
        },
        analyticsDeck: {
          title: "Analytics Deck",
          description: "Analytics-first dashboard",
        },
        custom: {
          title: "Custom layout",
          description: "User-customized homepage",
        },
      },
      environmentList: {
        title: "Environments",
        filter: "Filter",
        all: "All",
        available: "Available",
        unavailable: "Unavailable",
        switchVersion: "Switch version",
        viewDetails: "View details",
        noResults: "No environments match the filter",
        showMore: "Show more",
        showLess: "Show less",
      },
      packageList: {
        title: "Installed Packages",
        searchPlaceholder: "Search packages...",
        viewAll: "View All",
        noResults: "No packages match the search",
        update: "Update",
        uninstall: "Uninstall",
        updateAvailable: "Update available",
        showMore: "Show {count} more",
      },
      overview: {
        readyTitle: "Homepage overview is ready",
        readyDesc: "{ready}/{total} sections are up to date.",
        loadingTitle: "{count} section(s) are still loading",
        loadingDesc: "Ready widgets stay interactive while the remaining sections finish loading.",
        attentionTitle: "{count} section(s) need attention",
        attentionDesc: "You can keep using the homepage and refresh or open the affected surfaces.",
        sections: {
          environments: "Environments",
          packages: "Packages",
          system: "System",
        },
      },
      stats: {
        clickToView: "Click to view details",
      },
    },
    common: {
      unknown: "Unknown",
      none: "None",
      clear: "Clear",
      refresh: "Refresh",
      close: "Close",
    },
    environments: {
      details: {
        versions: "versions",
      },
    },
    packages: {},
  },
  zh: {
    dashboard: {
      title: "仪表板",
      description: "开发环境概览",
    },
    common: {},
    environments: {},
    packages: {},
  },
};

// Wrapper component with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>
      {children}
    </LocaleProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockEnvsError = null;
    mockPkgsError = null;
    mockSettingsError = null;
    mockDashboardIsCustomizing = false;
    mockDashboardIsEditMode = false;
    mockDashboardVisualContext = { range: "7d" };
    mockDashboardActiveStylePresetId = "balanced-workbench";
    mockDashboardHasPresetDiverged = false;
    mockSettingsConfig = {};
    mockStartupReady = true;
  });

  it("renders the dashboard title", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });
  });

  it("renders the dashboard description", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/overview of your development environment/i)).toBeInTheDocument();
    });
  });

  it("renders stats cards section", async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });
    
    // Check for the stats grid
    const statsGrid = container.querySelector(".grid");
    expect(statsGrid).toBeInTheDocument();
  });

  it("renders workspace status summary", async () => {
    renderWithProviders(<DashboardPage />);

    const status = await screen.findByTestId("dashboard-workspace-status");
    expect(within(status).getByText("Homepage overview is ready")).toBeInTheDocument();
    expect(within(status).getAllByText("Environments").length).toBeGreaterThan(0);
    expect(within(status).getAllByText("Packages").length).toBeGreaterThan(0);
    expect(within(status).getByText("System")).toBeInTheDocument();
  });

  it("displays platform information", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      const matches = screen.getAllByText("Test OS");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders quick search input", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search environments, packages/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  it("renders quick actions buttons", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add environment/i })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /refresh all/i }).length).toBeGreaterThan(0);
    });
  });

  it("renders environment list with data", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("nvm")).toBeInTheDocument();
    });
  });

  it("renders package list with data", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
      expect(screen.getByText("5.0.0")).toBeInTheDocument();
    });
  });

  it("quick search filters results when typing", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search environments, packages/i);
      expect(searchInput).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search environments, packages/i);
    fireEvent.change(searchInput, { target: { value: "node" } });
    fireEvent.focus(searchInput);

    await waitFor(() => {
      // Should show filtered results in dropdown
      expect(searchInput).toHaveValue("node");
    });
  });

  it("displays cache information in stats card", async () => {
    renderWithProviders(<DashboardPage />);
    
    await waitFor(() => {
      const matches = screen.getAllByText("3 KB");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("refreshes cache info on invalidation events with throttling", async () => {
    mockIsTauri.mockReturnValue(true);
    const dispose = jest.fn();
    let callback: (() => void) | undefined;
    mockSubscribeInvalidation.mockImplementation((...args: unknown[]) => {
      callback = args[1] as (() => void) | undefined;
      return dispose;
    });

    const { unmount } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockSubscribeInvalidation).toHaveBeenCalledTimes(1);
    });

    jest.useFakeTimers();
    try {
      mockFetchCacheInfo.mockClear();

      act(() => {
        callback?.();
        callback?.();
        callback?.();
      });

      expect(mockFetchCacheInfo).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockFetchCacheInfo).toHaveBeenCalledTimes(1);
      });
    } finally {
      jest.useRealTimers();
    }

    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it("exposes an always-available header refresh button", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-header-refresh")).toBeInTheDocument();
    });
  });

  it("runs full refresh flow when header refresh is clicked", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchEnvironments).toHaveBeenCalled();
      expect(mockFetchInstalledPackages).toHaveBeenCalled();
      expect(mockFetchProviders).toHaveBeenCalled();
      expect(mockFetchCacheInfo).toHaveBeenCalled();
      expect(mockFetchPlatformInfo).toHaveBeenCalled();
    });

    mockFetchEnvironments.mockClear();
    mockFetchInstalledPackages.mockClear();
    mockFetchProviders.mockClear();
    mockFetchCacheInfo.mockClear();
    mockFetchPlatformInfo.mockClear();

    fireEvent.click(screen.getByTestId("dashboard-header-refresh"));

    await waitFor(() => {
      expect(mockFetchEnvironments).toHaveBeenCalledWith(true);
      expect(mockFetchInstalledPackages).toHaveBeenCalledWith(undefined, true);
      expect(mockFetchProviders).toHaveBeenCalled();
      expect(mockFetchCacheInfo).toHaveBeenCalled();
      expect(mockFetchPlatformInfo).toHaveBeenCalled();
    });
  });

  it("opens customize flow and enables edit mode from header button", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-header-customize")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("dashboard-header-customize"));

    expect(mockSetIsEditMode).toHaveBeenCalledWith(true);
    expect(mockSetIsCustomizing).toHaveBeenCalledWith(true);
  });

  it("enables edit mode when customize dialog requests opening while not editing", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-customize-dialog-open")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("mock-customize-dialog-open"));

    expect(mockSetIsEditMode).toHaveBeenCalledWith(true);
    expect(mockSetIsCustomizing).toHaveBeenCalledWith(true);
  });

  it("updates shared analytics range from the dashboard header controls", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-analytics-range-30d")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("dashboard-analytics-range-30d"));

    expect(mockSetVisualContext).toHaveBeenCalledWith({ range: "30d" });
  });

  it("renders the active dashboard style preset in the header", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-style-preset-trigger")).toBeInTheDocument();
    });

    expect(screen.getByText("Balanced Workbench")).toBeInTheDocument();
  });

  it("applies a dashboard style preset from the quick switch menu", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-style-preset-trigger")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("dashboard-style-preset-trigger"));
    await user.click(
      await screen.findByTestId("dashboard-style-preset-option-analytics-deck"),
    );

    expect(mockApplyStylePreset).toHaveBeenCalledWith("analytics-deck");
  });

  it("shows a preset divergence badge when the dashboard differs from the active preset", async () => {
    mockDashboardHasPresetDiverged = true;
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Modified from preset")).toBeInTheDocument();
    });
  });

  it("closes customize dialog when turning off edit mode", async () => {
    mockDashboardIsCustomizing = true;
    mockDashboardIsEditMode = true;
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-header-edit-mode")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("dashboard-header-edit-mode"));

    expect(mockSetIsEditMode).toHaveBeenCalledWith(false);
    expect(mockSetIsCustomizing).toHaveBeenCalledWith(false);
  });

  it("clears any pending cache refresh timeout during cleanup", async () => {
    mockIsTauri.mockReturnValue(true);
    const dispose = jest.fn();
    let callback: (() => void) | undefined;
    mockSubscribeInvalidation.mockImplementation((...args: unknown[]) => {
      callback = args[1] as (() => void) | undefined;
      return dispose;
    });

    const { unmount } = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockSubscribeInvalidation).toHaveBeenCalledTimes(1);
    });

    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    try {
      mockFetchCacheInfo.mockClear();

      act(() => {
        callback?.();
      });

      expect(mockFetchCacheInfo).not.toHaveBeenCalled();

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(dispose).toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(mockFetchCacheInfo).not.toHaveBeenCalled();
    } finally {
      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it("shows new errors after a previously dismissed error", async () => {
    mockEnvsError = "Environment fetch failed";
    const view = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Environment fetch failed").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByLabelText(/close/i));

    await waitFor(() => {
      expect(screen.getAllByText("Environment fetch failed")).toHaveLength(1);
    });

    mockEnvsError = null;
    mockPkgsError = "Package fetch failed";
    view.rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Package fetch failed").length).toBeGreaterThan(0);
    });
  });

  it("skips heavy startup scans when startup config disables them", async () => {
    mockSettingsConfig = {
      "startup.scan_environments": "false",
      "startup.scan_packages": "false",
    };

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchProviders).toHaveBeenCalledTimes(1);
      expect(mockFetchPlatformInfo).toHaveBeenCalledTimes(1);
      expect(mockFetchCacheInfo).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchConfig).not.toHaveBeenCalled();
    expect(mockFetchEnvironments).not.toHaveBeenCalled();
    expect(mockFetchInstalledPackages).not.toHaveBeenCalled();
  });

  it("runs heavy startup scans sequentially after startup config loads", async () => {
    const configDeferred = createDeferred<Record<string, string>>();
    const envDeferred = createDeferred<void>();

    mockFetchConfig.mockImplementation(() => configDeferred.promise);
    mockFetchEnvironments.mockImplementation(() => envDeferred.promise);
    mockFetchInstalledPackages.mockResolvedValue(undefined);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchProviders).toHaveBeenCalledTimes(1);
      expect(mockFetchPlatformInfo).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchEnvironments).not.toHaveBeenCalled();
    expect(mockFetchInstalledPackages).not.toHaveBeenCalled();

    await act(async () => {
      configDeferred.resolve({
        "startup.scan_environments": "true",
        "startup.scan_packages": "true",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchEnvironments).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchInstalledPackages).not.toHaveBeenCalled();

    await act(async () => {
      envDeferred.resolve(undefined);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchInstalledPackages).toHaveBeenCalledTimes(1);
    });
  });

  it("waits until desktop startup is interactive before beginning heavy startup scans", async () => {
    mockStartupReady = false;
    mockSettingsConfig = {
      "startup.scan_environments": "true",
      "startup.scan_packages": "true",
    };

    const view = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchProviders).toHaveBeenCalledTimes(1);
      expect(mockFetchPlatformInfo).toHaveBeenCalledTimes(1);
      expect(mockFetchCacheInfo).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchEnvironments).not.toHaveBeenCalled();
    expect(mockFetchInstalledPackages).not.toHaveBeenCalled();

    mockStartupReady = true;
    view.rerender(<DashboardPage />);

    await waitFor(() => {
      expect(mockFetchEnvironments).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps homepage startup sections in loading feedback while heavy scans are gated by startup readiness", async () => {
    mockStartupReady = false;
    mockSettingsConfig = {
      "startup.scan_environments": "true",
      "startup.scan_packages": "true",
    };

    renderWithProviders(<DashboardPage />);

    const status = await screen.findByTestId("dashboard-workspace-status");
    expect(within(status).getByText("2 section(s) are still loading")).toBeInTheDocument();
    expect(within(status).getByText("Ready widgets stay interactive while the remaining sections finish loading.")).toBeInTheDocument();
  });

  it("keeps unaffected sections usable when one startup section degrades", async () => {
    mockEnvsError = "Environment fetch failed";

    renderWithProviders(<DashboardPage />);

    const status = await screen.findByTestId("dashboard-workspace-status");
    expect(within(status).getByText("1 section(s) need attention")).toBeInTheDocument();
    expect(within(status).getByText("Packages")).toBeInTheDocument();
    expect(within(status).getByText("System")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header-refresh")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });
});
