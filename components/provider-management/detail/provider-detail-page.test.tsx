import { render } from "@testing-library/react";
import { ProviderDetailPageClient } from "./provider-detail-page";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/hooks/use-provider-detail", () => ({
  useProviderDetail: () => ({
    provider: null,
    isAvailable: null,
    loading: true,
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
    pinnedPackages: [],
    isToggling: false,
    isCheckingStatus: false,
    toggleProvider: jest.fn(),
    checkProviderStatus: jest.fn(),
    searchPackages: jest.fn(() => Promise.resolve([])),
    installPackage: jest.fn(() => Promise.resolve()),
    uninstallPackage: jest.fn(() => Promise.resolve()),
    refreshPackages: jest.fn(() => Promise.resolve([])),
    checkUpdates: jest.fn(() => Promise.resolve([])),
    runHealthCheck: jest.fn(() => Promise.resolve(null)),
    refreshHistory: jest.fn(() => Promise.resolve([])),
    refreshEnvironment: jest.fn(() => Promise.resolve()),
    pinPackage: jest.fn(() => Promise.resolve()),
    unpinPackage: jest.fn(() => Promise.resolve()),
    rollbackPackage: jest.fn(() => Promise.resolve()),
    batchUninstall: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(),
    initialize: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("ProviderDetailPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<ProviderDetailPageClient providerId="npm" />);
    expect(container).toBeInTheDocument();
  });
});
