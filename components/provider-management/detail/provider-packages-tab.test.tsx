import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderPackagesTab } from "./provider-packages-tab";
import type { InstalledPackage, PackageSummary } from "@/types/tauri";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockClearPackageSelection = jest.fn();
const mockPackageStoreState = {
  selectedPackages: [] as string[],
  clearPackageSelection: mockClearPackageSelection,
  togglePackageSelection: jest.fn(),
  selectAllPackages: jest.fn(),
};

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: (
    selector?: (state: typeof mockPackageStoreState) => unknown,
  ) => (selector ? selector(mockPackageStoreState) : mockPackageStoreState),
}));

const installedPkgs: InstalledPackage[] = [
  {
    name: "lodash",
    version: "4.17.21",
    provider: "npm",
    install_path: "/node_modules/lodash",
    installed_at: "2024-01-01T00:00:00Z",
    is_global: false,
  },
  {
    name: "express",
    version: "4.18.2",
    provider: "npm",
    install_path: "/node_modules/express",
    installed_at: "2024-01-02T00:00:00Z",
    is_global: true,
  },
];

const searchPkgs: PackageSummary[] = [
  {
    name: "axios",
    description: "Promise based HTTP client",
    latest_version: "1.6.0",
    provider: "npm",
  },
];

describe("ProviderPackagesTab", () => {
  const defaultProps = {
    providerId: "npm",
    installedPackages: [] as InstalledPackage[],
    searchResults: [] as PackageSummary[],
    searchQuery: "",
    loadingPackages: false,
    loadingSearch: false,
    onSearchPackages: jest.fn(() => Promise.resolve([] as PackageSummary[])),
    onInstallPackage: jest.fn(() => Promise.resolve()),
    onUninstallPackage: jest.fn(() => Promise.resolve()),
    onRefreshPackages: jest.fn(() => Promise.resolve([] as InstalledPackage[])),
    onConfirmPreflight: jest.fn(),
    onDismissPreflight: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPackageStoreState.selectedPackages = [];
  });

  it("renders the provider package header and shared panel tabs", () => {
    render(<ProviderPackagesTab {...defaultProps} />);

    expect(screen.getByText("providerDetail.searchPackages")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "packages.installed" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "packages.searchResults" })).toBeInTheDocument();
  });

  it("shows shared installed empty state when no packages are installed", () => {
    render(<ProviderPackagesTab {...defaultProps} />);

    expect(screen.getByText("packages.noPackagesInstalled")).toBeInTheDocument();
  });

  it("renders installed packages through the shared panel", () => {
    render(
      <ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />,
    );

    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("4.17.21")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
  });

  it("shows the installed filter when the provider has many installed packages", async () => {
    const manyPkgs: InstalledPackage[] = Array.from({ length: 6 }, (_, index) => ({
      name: `pkg-${index}`,
      version: "1.0.0",
      provider: "npm",
      install_path: `/node_modules/pkg-${index}`,
      installed_at: "2024-01-01T00:00:00Z",
      is_global: false,
    }));

    render(
      <ProviderPackagesTab {...defaultProps} installedPackages={manyPkgs} />,
    );

    expect(screen.getByPlaceholderText("packages.filterInstalled")).toBeInTheDocument();
  });

  it("refreshes installed packages from the shared header action", async () => {
    const user = userEvent.setup();
    render(
      <ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />,
    );

    await user.click(screen.getByRole("button", { name: "providers.refresh" }));

    expect(defaultProps.onRefreshPackages).toHaveBeenCalled();
  });

  it("runs provider-scoped search from the shared search tab", async () => {
    const user = userEvent.setup();
    render(<ProviderPackagesTab {...defaultProps} />);

    await user.click(screen.getByRole("tab", { name: "packages.searchResults" }));
    await user.type(
      screen.getByPlaceholderText("packages.searchPlaceholder"),
      "axios{Enter}",
    );

    await waitFor(() => {
      expect(defaultProps.onSearchPackages).toHaveBeenCalledWith("axios");
    });
  });

  it("renders provider search results inside the shared search surface", async () => {
    const user = userEvent.setup();
    render(
      <ProviderPackagesTab
        {...defaultProps}
        searchResults={searchPkgs}
        searchQuery="axios"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "packages.searchResults" }));

    expect(screen.getByText("axios")).toBeInTheDocument();
    expect(screen.getByText("Promise based HTTP client")).toBeInTheDocument();
  });

  it("renders pre-flight dialog when validation warnings are open", () => {
    render(
      <ProviderPackagesTab
        {...defaultProps}
        preflightSummary={{
          results: [
            {
              validator_id: "provider_health",
              validator_name: "Provider health",
              status: "warning",
              summary: "Provider health check returned warnings.",
              details: ["Provider status is degraded."],
              remediation: "Review provider diagnostics before proceeding.",
              package: "npm:axios",
              provider_id: "npm",
              blocking: false,
              timed_out: false,
            },
          ],
          can_proceed: true,
          has_warnings: true,
          has_failures: false,
          checked_at: "2026-03-29T00:00:00.000Z",
        }}
        preflightPackages={["npm:axios"]}
        isPreflightOpen={true}
      />,
    );

    expect(screen.getByText("packages.preflight.title")).toBeInTheDocument();
    expect(screen.getByText("Provider health check returned warnings.")).toBeInTheDocument();
    expect(screen.getAllByText("npm:axios").length).toBeGreaterThan(0);
  });

  it("wires provider pre-flight dialog confirm and cancel actions", async () => {
    const user = userEvent.setup();

    render(
      <ProviderPackagesTab
        {...defaultProps}
        preflightSummary={{
          results: [
            {
              validator_id: "provider_health",
              validator_name: "Provider health",
              status: "warning",
              summary: "Provider health check returned warnings.",
              details: ["Provider status is degraded."],
              remediation: "Review provider diagnostics before proceeding.",
              package: "npm:axios",
              provider_id: "npm",
              blocking: false,
              timed_out: false,
            },
          ],
          can_proceed: true,
          has_warnings: true,
          has_failures: false,
          checked_at: "2026-03-29T00:00:00.000Z",
        }}
        preflightPackages={["npm:axios"]}
        isPreflightOpen={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: "packages.preflight.confirm" }));
    expect(defaultProps.onConfirmPreflight).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "packages.preflight.cancel" }));
    expect(defaultProps.onDismissPreflight).toHaveBeenCalledTimes(1);
  });
});
