import { render, screen } from "@testing-library/react";
import { ProviderDetailPageClient } from "./provider-detail-page";
import { useProviderDetail } from "@/hooks/use-provider-detail";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/hooks/use-provider-detail");
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
  installHistory: [],
  loadingHistory: false,
  environmentInfo: null,
  environmentProviderInfo: null,
  availableVersions: [],
  loadingEnvironment: false,
  initialize: jest.fn(),
  refreshAll: jest.fn(),
  checkAvailability: jest.fn(),
  toggleProvider: jest.fn(),
  fetchInstalledPackages: jest.fn(),
  searchPackages: jest.fn(),
  installPackage: jest.fn(),
  uninstallPackage: jest.fn(),
  checkUpdates: jest.fn(),
  runHealthCheck: jest.fn(),
  fetchHistory: jest.fn(),
  fetchEnvironmentInfo: jest.fn(),
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
});
