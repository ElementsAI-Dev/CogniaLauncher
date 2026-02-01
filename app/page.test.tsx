import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";

// Mock the Tauri API with all required functions
jest.mock("@/lib/tauri", () => ({
  envList: jest.fn().mockResolvedValue([]),
  envGet: jest.fn().mockResolvedValue(null),
  packageSearch: jest.fn().mockResolvedValue([]),
  packageList: jest.fn().mockResolvedValue([]),
  providerList: jest.fn().mockResolvedValue([]),
  configList: jest.fn().mockResolvedValue([]),
  cacheInfo: jest.fn().mockResolvedValue({
    download_cache: { entry_count: 0, size: 0, size_human: "0 B", location: "" },
    metadata_cache: { entry_count: 0, size: 0, size_human: "0 B", location: "" },
    total_size: 0,
    total_size_human: "0 B",
  }),
  getPlatformInfo: jest.fn().mockResolvedValue({ os: "Test OS", arch: "x64" }),
  getCogniaDir: jest.fn().mockResolvedValue("/mock/cognia/dir"),
}));

// Mock messages
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
      viewAll: "View All",
    },
    common: {
      unknown: "Unknown",
      none: "None",
    },
    environments: {},
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
      expect(screen.getByText("Test OS")).toBeInTheDocument();
    });
  });
});
