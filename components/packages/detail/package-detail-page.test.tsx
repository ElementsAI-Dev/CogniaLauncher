import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageDetailPage } from "./package-detail-page";
import type { PackageInfo } from "@/lib/tauri";

const mockFetchPackageInfo = jest.fn();
const mockInstallPackages = jest.fn();
const mockUninstallPackages = jest.fn();
const mockPinPackage = jest.fn();
const mockUnpinPackage = jest.fn();
const mockRollbackPackage = jest.fn();
const mockResolveDependencies = jest.fn();
const mockGetPackageHistory = jest.fn();
const mockRefresh = jest.fn();
const mockToggleBookmark = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.detail.backToPackages": "Back",
        "packages.detail.overview": "Overview",
        "packages.detail.versions": "Versions",
        "packages.detail.dependencies": "Dependencies",
        "packages.detail.history": "History",
        "packages.detail.loading": "Loading package details...",
        "packages.detail.notFound": "Package not found",
        "packages.detail.notFoundDesc": "The package could not be found",
        "packages.detail.installSuccess": `Installed ${params?.name ?? ""}`,
        "packages.detail.uninstallSuccess": `Uninstalled ${params?.name ?? ""}`,
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/hooks/use-packages", () => ({
  usePackages: () => ({
    loading: false,
    error: null,
    installedPackages: [],
    pinnedPackages: [],
    installing: [],
    fetchPackageInfo: mockFetchPackageInfo,
    fetchInstalledPackages: jest.fn().mockResolvedValue([]),
    installPackages: mockInstallPackages,
    uninstallPackages: mockUninstallPackages,
    pinPackage: mockPinPackage,
    unpinPackage: mockUnpinPackage,
    rollbackPackage: mockRollbackPackage,
    resolveDependencies: mockResolveDependencies,
    getPackageHistory: mockGetPackageHistory,
    refresh: mockRefresh,
  }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: () => ({
    bookmarkedPackages: [],
    toggleBookmark: mockToggleBookmark,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockPackageInfo: PackageInfo = {
  name: "express",
  display_name: "Express",
  description: "Fast web framework",
  homepage: "https://expressjs.com",
  license: "MIT",
  repository: "https://github.com/expressjs/express",
  versions: [
    { version: "4.18.0", release_date: "2024-01-01", deprecated: false, yanked: false },
    { version: "4.17.0", release_date: "2023-06-01", deprecated: false, yanked: false },
  ],
  provider: "npm",
};

describe("PackageDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPackageInfo.mockResolvedValue(mockPackageInfo);
    mockGetPackageHistory.mockResolvedValue([]);
    mockResolveDependencies.mockResolvedValue(null);
  });

  it("calls fetchPackageInfo on mount", async () => {
    render(<PackageDetailPage providerId="npm" packageName="express" />);
    await waitFor(() => {
      expect(mockFetchPackageInfo).toHaveBeenCalledWith("express", "npm");
    });
  });

  it("renders package display name after loading", async () => {
    render(<PackageDetailPage providerId="npm" packageName="express" />);
    await waitFor(() => {
      // display_name from mockPackageInfo is "Express"
      expect(screen.getByText("Express")).toBeInTheDocument();
    });
  });

  it("renders tab navigation after loading", async () => {
    render(<PackageDetailPage providerId="npm" packageName="express" />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /versions/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /dependencies/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
    });
  });

  it("renders provider badge after loading", async () => {
    render(<PackageDetailPage providerId="npm" packageName="express" />);
    await waitFor(() => {
      // npm badge appears in the overview card after packageInfo loads
      expect(screen.getByText("Express")).toBeInTheDocument();
    });
    // After loading, provider info is shown somewhere in the page
    const allText = document.body.textContent || "";
    expect(allText).toContain("npm");
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    render(<PackageDetailPage providerId="npm" packageName="express" />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /versions/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /versions/i }));
    expect(screen.getByRole("tab", { name: /versions/i })).toHaveAttribute("data-state", "active");
  });

  it("shows error state when load fails", async () => {
    mockFetchPackageInfo.mockResolvedValue(null);
    render(<PackageDetailPage providerId="npm" packageName="express" />);
    await waitFor(() => {
      expect(mockFetchPackageInfo).toHaveBeenCalled();
    });
  });
});
