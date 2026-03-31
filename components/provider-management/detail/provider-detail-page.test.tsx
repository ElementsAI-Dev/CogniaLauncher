import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderDetailPageClient } from "./provider-detail-page";
import { useProviderDetail } from "@/hooks/providers/use-provider-detail";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("@/hooks/providers/use-provider-detail");
const mockUseProviderDetail = useProviderDetail as jest.MockedFunction<typeof useProviderDetail>;

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

// Polyfill ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const baseHookReturn = {
  provider: null,
  isAvailable: null,
  loading: false,
  error: null,
  installedPackages: [],
  loadingPackages: false,
  searchResults: [],
  searchQuery: "",
  loadingSearch: false,
  availableUpdates: [],
  loadingUpdates: false,
  healthResult: null,
  loadingHealth: false,
  activeRemediationId: null,
  installHistory: [],
  loadingHistory: false,
  historyError: null,
  environmentInfo: null,
  environmentProviderInfo: null,
  availableVersions: [],
  loadingEnvironment: false,
  pinnedPackages: [],
  preflightSummary: null,
  preflightPackages: [],
  isPreflightOpen: false,
  initialize: jest.fn(),
  refreshAll: jest.fn(),
  refreshPackageSurface: jest.fn(),
  checkAvailability: jest.fn(),
  toggleProvider: jest.fn(),
  setProviderPriority: jest.fn(),
  fetchInstalledPackages: jest.fn(),
  searchPackages: jest.fn(),
  installPackage: jest.fn(),
  uninstallPackage: jest.fn(),
  batchUninstallPackages: jest.fn(),
  fetchPackageHistory: jest.fn(),
  pinPackage: jest.fn(),
  unpinPackage: jest.fn(),
  rollbackPackage: jest.fn(),
  rollbackToLastVersion: jest.fn(),
  checkUpdates: jest.fn(),
  updatePackage: jest.fn(),
  updateAllPackages: jest.fn(),
  runHealthCheck: jest.fn(),
  previewHealthRemediation: jest.fn(),
  applyHealthRemediation: jest.fn(),
  fetchHistory: jest.fn(),
  fetchEnvironmentInfo: jest.fn(),
  confirmPreflight: jest.fn(),
  dismissPreflight: jest.fn(),
};

const loadedProvider = {
  id: "npm",
  display_name: "npm",
  capabilities: ["install", "search"],
  enabled: true,
  priority: 50,
  platforms: ["windows", "linux"],
  is_environment_provider: false,
};

describe("ProviderDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeleton when loading with no provider", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      loading: true,
      provider: null,
    } as never);
    const { container } = render(<ProviderDetailPageClient providerId="npm" />);
    expect(container).toBeInTheDocument();
  });

  it("renders error alert when error with no provider", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      error: "Failed to load provider",
      provider: null,
    } as never);
    render(<ProviderDetailPageClient providerId="npm" />);
    expect(screen.getByText("Failed to load provider")).toBeInTheDocument();
  });

  it("renders null when no provider and no error and no loading", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: null,
    } as never);
    const { container } = render(<ProviderDetailPageClient providerId="npm" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders tabs when provider is loaded", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: loadedProvider,
      isAvailable: true,
    } as never);
    render(<ProviderDetailPageClient providerId="npm" />);
    expect(screen.getByText("providerDetail.tabOverview")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.tabPackages")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.tabUpdates")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.tabHealth")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.tabHistory")).toBeInTheDocument();
  });

  it("does not render environment tab for non-environment provider", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: loadedProvider,
    } as never);
    render(<ProviderDetailPageClient providerId="npm" />);
    expect(screen.queryByText("providerDetail.tabEnvironment")).not.toBeInTheDocument();
  });

  it("renders environment tab for environment provider", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: { ...loadedProvider, is_environment_provider: true },
    } as never);
    render(<ProviderDetailPageClient providerId="nvm" />);
    expect(screen.getByText("providerDetail.tabEnvironment")).toBeInTheDocument();
  });

  it("calls initialize on mount", () => {
    const initialize = jest.fn();
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: loadedProvider,
      initialize,
    } as never);
    render(<ProviderDetailPageClient providerId="npm" />);
    expect(initialize).toHaveBeenCalled();
  });

  it("shows inline error alert when provider exists with error", () => {
    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: loadedProvider,
      error: "Some error occurred",
    } as never);
    render(<ProviderDetailPageClient providerId="npm" />);
    expect(screen.getByText("Some error occurred")).toBeInTheDocument();
    // Also has the tabs (provider still rendered)
    expect(screen.getByText("providerDetail.tabOverview")).toBeInTheDocument();
  });

  it("wires shared package panel and pre-flight state into the packages tab", async () => {
    const user = userEvent.setup();

    mockUseProviderDetail.mockReturnValue({
      ...baseHookReturn,
      provider: loadedProvider,
      installedPackages: [
        {
          name: "lodash",
          version: "4.17.21",
          provider: "npm",
          install_path: "/node_modules/lodash",
          installed_at: "2024-01-01T00:00:00Z",
          is_global: false,
        },
      ],
      pinnedPackages: [["lodash", "4.17.21"]],
      preflightSummary: {
        results: [
          {
            validator_id: "provider_health",
            validator_name: "Provider health",
            status: "warning",
            summary: "Provider health check returned warnings.",
            details: ["Provider status is degraded."],
            remediation: "Review provider diagnostics before proceeding.",
            package: "npm:lodash",
            provider_id: "npm",
            blocking: false,
            timed_out: false,
          },
        ],
        can_proceed: true,
        has_warnings: true,
        has_failures: false,
        checked_at: "2026-03-29T00:00:00.000Z",
      },
      preflightPackages: ["npm:lodash"],
      isPreflightOpen: true,
    } as never);

    render(<ProviderDetailPageClient providerId="npm" />);
    await user.click(screen.getByRole("tab", { name: /providerDetail\.tabPackages/ }));

    expect(screen.getByText("providerDetail.searchPackages")).toBeInTheDocument();
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("packages.preflight.title")).toBeInTheDocument();
    expect(screen.getByText("Provider health check returned warnings.")).toBeInTheDocument();
  });
});
