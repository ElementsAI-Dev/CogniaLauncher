import { render, screen, waitFor } from "@testing-library/react";
import { PackageDetailsDialog } from "./package-details-dialog";
import type { PackageInfo, PackageSummary } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.noDescriptionAvailable": "No description available",
        "packages.selectVersion": "Select Version",
        "packages.selectVersionPlaceholder": "Choose a version",
        "packages.currentVersionLabel": "Current version",
        "packages.versionHistory": "Version History",
        "packages.moreVersions": `+${params?.count ?? 0} more versions`,
        "packages.loadFailed": "Failed to load package info",
        "packages.homepage": "Homepage",
        "packages.repository": "Repository",
        "packages.deprecated": "Deprecated",
        "packages.yanked": "Yanked",
        "packages.installing": "Installing...",
        "packages.installVersion": `Install ${params?.version ?? "latest"}`,
        "packages.installFailed": "Install failed",
        "packages.latest": "latest",
        "packages.rollback": "Rollback",
        "packages.rollingBack": "Rolling back...",
        "packages.rollbackSuccess": "Rollback successful",
        "packages.rollbackFailed": "Rollback failed",
        "packages.pinVersion": "Pin Version",
        "packages.pinned": "Pinned",
        "packages.pinFailed": "Pin failed",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockPkg: PackageSummary = {
  name: "numpy",
  provider: "pip",
  description: "Numerical Python library",
  latest_version: "1.24.0",
};

const mockPackageInfo: PackageInfo = {
  name: "numpy",
  display_name: "NumPy",
  description: "Numerical Python library",
  homepage: "https://numpy.org",
  license: "BSD-3",
  repository: "https://github.com/numpy/numpy",
  versions: [
    { version: "1.24.0", release_date: "2024-01-01", deprecated: false, yanked: false },
    { version: "1.23.0", release_date: "2023-06-01", deprecated: false, yanked: false },
  ],
  provider: "pip",
};

const defaultProps = {
  pkg: mockPkg,
  open: true,
  onOpenChange: jest.fn(),
  onInstall: jest.fn().mockResolvedValue(undefined),
  fetchPackageInfo: jest.fn().mockResolvedValue(mockPackageInfo),
};

describe("PackageDetailsDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.fetchPackageInfo.mockResolvedValue(mockPackageInfo);
  });

  it("renders dialog when open", () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    expect(screen.getByText("numpy")).toBeInTheDocument();
  });

  it("shows provider badge", () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    expect(screen.getByText("pip")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<PackageDetailsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("numpy")).not.toBeInTheDocument();
  });

  it("calls fetchPackageInfo when opened", async () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    await waitFor(() => {
      expect(defaultProps.fetchPackageInfo).toHaveBeenCalledWith("numpy", "pip");
    });
  });

  it("shows package info after loading", async () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Homepage")).toBeInTheDocument();
      expect(screen.getByText("Repository")).toBeInTheDocument();
      expect(screen.getByText("BSD-3")).toBeInTheDocument();
    });
  });

  it("shows version history after loading", async () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Version History")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows load failed when info is null", async () => {
    defaultProps.fetchPackageInfo.mockResolvedValue(null);
    render(<PackageDetailsDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load package info")).toBeInTheDocument();
    });
  });

  it("shows rollback button for installed packages", async () => {
    render(
      <PackageDetailsDialog
        {...defaultProps}
        isInstalled={true}
        currentVersion="1.23.0"
        onRollback={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /rollback/i })).toBeInTheDocument();
    });
  });
});
