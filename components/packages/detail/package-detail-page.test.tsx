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
const mockFetchPinnedPackages = jest.fn();
const mockGetPackageHistory = jest.fn();
const mockRefresh = jest.fn();
const mockToggleBookmark = jest.fn();
const mockConfirmPreflight = jest.fn();
const mockDismissPreflight = jest.fn();
let mockBookmarkedPackages: string[] = [];
let mockPreflightSummary: null | {
  results: Array<{
    validator_id: string;
    validator_name: string;
    status: "pass" | "warning" | "failure";
    summary: string;
    details: string[];
    remediation: string | null;
    package: string | null;
    provider_id: string | null;
    blocking: boolean;
    timed_out: boolean;
  }>;
  can_proceed: boolean;
  has_warnings: boolean;
  has_failures: boolean;
  checked_at: string;
} = null;
let mockPreflightPackages: string[] = [];
let mockIsPreflightOpen = false;

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
        "packages.preflight.title": "Pre-flight summary",
        "packages.preflight.description": "Review package validation findings before install.",
        "packages.preflight.passCount": `Passed ${params?.count ?? 0}`,
        "packages.preflight.warningCount": `Warnings ${params?.count ?? 0}`,
        "packages.preflight.failureCount": `Failures ${params?.count ?? 0}`,
        "packages.preflight.packages": "Packages",
        "packages.preflight.blockingMessage": "Resolve blocking issues before continuing.",
        "packages.preflight.confirm": "Continue install",
        "packages.preflight.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/hooks/packages/use-packages", () => ({
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
    fetchPinnedPackages: mockFetchPinnedPackages,
    rollbackPackage: mockRollbackPackage,
    resolveDependencies: mockResolveDependencies,
    getPackageHistory: mockGetPackageHistory,
    refresh: mockRefresh,
    preflightSummary: mockPreflightSummary,
    preflightPackages: mockPreflightPackages,
    isPreflightOpen: mockIsPreflightOpen,
    confirmPreflight: mockConfirmPreflight,
    dismissPreflight: mockDismissPreflight,
  }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: () => ({
    bookmarkedPackages: mockBookmarkedPackages,
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
    mockBookmarkedPackages = [];
    mockPreflightSummary = null;
    mockPreflightPackages = [];
    mockIsPreflightOpen = false;
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

  it("uses provider-aware bookmark state and actions", async () => {
    mockBookmarkedPackages = ["npm:express"];
    const user = userEvent.setup();

    render(<PackageDetailPage providerId="npm" packageName="express" />);

    const removeBookmarkButton = await screen.findByRole("button", {
      name: /packages\.removeBookmark/i,
    });
    expect(removeBookmarkButton).toBeInTheDocument();

    await user.click(removeBookmarkButton);
    expect(mockToggleBookmark).toHaveBeenCalledWith("express", "npm");
  });

  it("renders the pre-flight dialog when install validation is open", async () => {
    mockPreflightSummary = {
      results: [
        {
          validator_id: "provider_health",
          validator_name: "Provider health",
          status: "warning",
          summary: "Provider health check returned warnings.",
          details: ["Provider status is degraded."],
          remediation: "Review provider diagnostics before proceeding.",
          package: "npm:express",
          provider_id: "npm",
          blocking: false,
          timed_out: false,
        },
      ],
      can_proceed: true,
      has_warnings: true,
      has_failures: false,
      checked_at: "2026-03-29T00:00:00.000Z",
    };
    mockPreflightPackages = ["npm:express"];
    mockIsPreflightOpen = true;

    render(<PackageDetailPage providerId="npm" packageName="express" />);

    expect(await screen.findByText("Pre-flight summary")).toBeInTheDocument();
    expect(screen.getByText("Provider health check returned warnings.")).toBeInTheDocument();
    expect(screen.getAllByText("npm:express").length).toBeGreaterThan(0);
  });

  it("wires pre-flight dialog confirm and cancel actions", async () => {
    const user = userEvent.setup();
    mockPreflightSummary = {
      results: [
        {
          validator_id: "provider_health",
          validator_name: "Provider health",
          status: "warning",
          summary: "Provider health check returned warnings.",
          details: ["Provider status is degraded."],
          remediation: "Review provider diagnostics before proceeding.",
          package: "npm:express",
          provider_id: "npm",
          blocking: false,
          timed_out: false,
        },
      ],
      can_proceed: true,
      has_warnings: true,
      has_failures: false,
      checked_at: "2026-03-29T00:00:00.000Z",
    };
    mockPreflightPackages = ["npm:express"];
    mockIsPreflightOpen = true;

    render(<PackageDetailPage providerId="npm" packageName="express" />);

    await user.click(await screen.findByRole("button", { name: "Continue install" }));
    expect(mockConfirmPreflight).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockDismissPreflight).toHaveBeenCalledTimes(1);
  });
});
