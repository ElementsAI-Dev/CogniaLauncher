import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderPackagesTab } from "./provider-packages-tab";
import type { InstalledPackage, PackageSummary } from "@/types/tauri";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providerDetail.searchPackages": "Search Packages",
    "providerDetail.searchPackagesDesc": "Search for packages",
    "providerDetail.searchPlaceholder": "Search...",
    "providerDetail.search": "Search",
    "providerDetail.installedPackages": "Installed Packages",
    "providerDetail.installedPackagesDesc": "Packages installed via npm",
    "providerDetail.noInstalledPackages": "No packages installed",
    "providerDetail.noSearchResults": "No results found",
    "providerDetail.packageName": "Package",
    "providerDetail.version": "Version",
    "providerDetail.latestVersion": "Latest",
    "providerDetail.packageDescription": "Description",
    "providerDetail.actions": "Actions",
    "providerDetail.installPackage": "Install",
    "providerDetail.uninstallPackage": "Uninstall",
    "providerDetail.installed": "Installed",
    "providerDetail.installPath": "Path",
    "providerDetail.installedAt": "Installed At",
    "providers.refresh": "Refresh",
    "providerDetail.global": "Global",
    "providerDetail.filterInstalled": "Filter installed...",
    "providerDetail.confirmUninstall": "Confirm Uninstall",
    "providerDetail.cancel": "Cancel",
    "providerDetail.confirm": "Confirm",
  };
  return translations[key] || key;
};

const installedPkgs: InstalledPackage[] = [
  { name: "lodash", version: "4.17.21", provider: "npm", install_path: "/node_modules/lodash", installed_at: "2024-01-01T00:00:00Z", is_global: false },
  { name: "express", version: "4.18.2", provider: "npm", install_path: "/node_modules/express", installed_at: "2024-01-02T00:00:00Z", is_global: true },
];

const searchPkgs: PackageSummary[] = [
  { name: "axios", description: "Promise based HTTP client", latest_version: "1.6.0", provider: "npm" },
  { name: "lodash", description: "Utility library", latest_version: "4.17.21", provider: "npm" },
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
    t: mockT,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    const { container } = render(<ProviderPackagesTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("shows empty state when no installed packages", () => {
    render(<ProviderPackagesTab {...defaultProps} />);
    expect(screen.getByText("No packages installed")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading packages", () => {
    render(<ProviderPackagesTab {...defaultProps} loadingPackages={true} />);
    expect(screen.queryByText("No packages installed")).not.toBeInTheDocument();
  });

  it("renders installed packages in a table", () => {
    render(<ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />);
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("4.17.21")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
    expect(screen.getByText("4.18.2")).toBeInTheDocument();
  });

  it("shows Global badge for global packages", () => {
    render(<ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />);
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("shows installed count badge", () => {
    render(<ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders search results table", () => {
    render(<ProviderPackagesTab {...defaultProps} searchResults={searchPkgs} searchQuery="axios" />);
    expect(screen.getByText("axios")).toBeInTheDocument();
    expect(screen.getByText("Promise based HTTP client")).toBeInTheDocument();
  });

  it("marks already-installed packages in search results", () => {
    render(
      <ProviderPackagesTab
        {...defaultProps}
        installedPackages={installedPkgs}
        searchResults={searchPkgs}
        searchQuery="lodash"
      />,
    );
    // "Installed" badge in search results for lodash
    expect(screen.getAllByText("Installed").length).toBeGreaterThan(0);
  });

  it("shows no search results message", () => {
    render(<ProviderPackagesTab {...defaultProps} searchQuery="nonexistent" searchResults={[]} />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("renders search input and button", () => {
    render(<ProviderPackagesTab {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("disables search button when input is empty", () => {
    render(<ProviderPackagesTab {...defaultProps} />);
    const searchBtn = screen.getByText("Search").closest("button")!;
    expect(searchBtn).toBeDisabled();
  });

  it("calls onSearchPackages when search button clicked with input", async () => {
    const user = userEvent.setup();
    render(<ProviderPackagesTab {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "axios");
    const searchBtn = screen.getByText("Search").closest("button")!;
    await user.click(searchBtn);
    expect(defaultProps.onSearchPackages).toHaveBeenCalledWith("axios");
  });

  it("calls onRefreshPackages when refresh button clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />);
    const refreshBtn = screen.getByText("Refresh").closest("button")!;
    await user.click(refreshBtn);
    expect(defaultProps.onRefreshPackages).toHaveBeenCalled();
  });

  it("triggers search on Enter key press", async () => {
    const user = userEvent.setup();
    render(<ProviderPackagesTab {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "axios{Enter}");
    expect(defaultProps.onSearchPackages).toHaveBeenCalledWith("axios");
  });

  it("shows filter input when more than 5 installed packages", () => {
    const manyPkgs: InstalledPackage[] = Array.from({ length: 6 }, (_, i) => ({
      name: `pkg-${i}`,
      version: "1.0.0",
      provider: "npm",
      install_path: `/node_modules/pkg-${i}`,
      installed_at: "2024-01-01T00:00:00Z",
      is_global: false,
    }));
    render(<ProviderPackagesTab {...defaultProps} installedPackages={manyPkgs} />);
    expect(screen.getByPlaceholderText("Filter installed...")).toBeInTheDocument();
  });

  it("shows uninstall confirmation dialog when uninstall button clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderPackagesTab {...defaultProps} installedPackages={installedPkgs} />);
    // Click the first uninstall (trash) button via its tooltip trigger
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector(".lucide-trash-2"),
    );
    expect(trashButtons.length).toBeGreaterThan(0);
    await user.click(trashButtons[0]);
    expect(screen.getByText("Confirm Uninstall")).toBeInTheDocument();
  });

  it("shows loading search skeleton when loadingSearch is true", () => {
    render(<ProviderPackagesTab {...defaultProps} loadingSearch={true} />);
    // Search skeletons should render instead of results
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });
});
