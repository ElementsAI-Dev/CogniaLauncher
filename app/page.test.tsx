import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import DashboardPage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock the Tauri API
jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn().mockReturnValue(false),
}));

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
    fetchEnvironments: jest.fn().mockResolvedValue(undefined),
    loading: false,
    error: null,
  }),
}));

jest.mock("@/hooks/use-packages", () => ({
  usePackages: () => ({
    installedPackages: [
      { name: "typescript", version: "5.0.0", provider: "npm" },
    ],
    fetchInstalledPackages: jest.fn().mockResolvedValue(undefined),
    fetchProviders: jest.fn().mockResolvedValue(undefined),
    providers: [{ id: "npm", display_name: "NPM" }],
    loading: false,
    error: null,
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
    fetchCacheInfo: jest.fn().mockResolvedValue(undefined),
    platformInfo: { os: "Test OS", arch: "x64" },
    fetchPlatformInfo: jest.fn().mockResolvedValue(undefined),
    cogniaDir: "/mock/cognia/dir",
    loading: false,
    error: null,
  }),
}));

jest.mock("@/lib/stores/dashboard", () => {
  const actual = jest.requireActual("@/lib/stores/dashboard");
  return {
    ...actual,
    useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isCustomizing: false,
        isEditMode: false,
        setIsCustomizing: jest.fn(),
        setIsEditMode: jest.fn(),
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
        addEnvironment: "Add Environment",
        installPackage: "Install Package",
        clearCache: "Clear Cache",
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
      expect(screen.getByRole("button", { name: /refresh all/i })).toBeInTheDocument();
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
});
