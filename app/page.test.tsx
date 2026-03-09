import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";

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
const mockFetchPlatformInfo = jest.fn().mockResolvedValue(undefined);
const mockSetIsCustomizing = jest.fn();
const mockSetIsEditMode = jest.fn();
let mockEnvsError: string | null = null;
let mockPkgsError: string | null = null;
let mockSettingsError: string | null = null;
let mockDashboardIsCustomizing = false;
let mockDashboardIsEditMode = false;

// Mock hooks used by the dashboard page
jest.mock("@/hooks/use-environments", () => ({
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

jest.mock("@/hooks/use-packages", () => ({
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

jest.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
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

jest.mock("@/lib/stores/dashboard", () => {
  const actual = jest.requireActual("@/lib/stores/dashboard");
  return {
    ...actual,
    useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isCustomizing: mockDashboardIsCustomizing,
        isEditMode: mockDashboardIsEditMode,
        setIsCustomizing: (...args: unknown[]) => mockSetIsCustomizing(...args),
        setIsEditMode: (...args: unknown[]) => mockSetIsEditMode(...args),
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

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockEnvsError = null;
    mockPkgsError = null;
    mockSettingsError = null;
    mockDashboardIsCustomizing = false;
    mockDashboardIsEditMode = false;
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

  it("shows new errors after a previously dismissed error", async () => {
    mockEnvsError = "Environment fetch failed";
    const view = renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Environment fetch failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/close/i));

    await waitFor(() => {
      expect(screen.queryByText("Environment fetch failed")).not.toBeInTheDocument();
    });

    mockEnvsError = null;
    mockPkgsError = "Package fetch failed";
    view.rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Package fetch failed")).toBeInTheDocument();
    });
  });
});
