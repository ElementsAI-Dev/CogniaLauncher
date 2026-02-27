import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageOverviewCard } from "./package-overview-card";
import type { PackageInfo, InstalledPackage } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.detail.description": "Description",
        "packages.detail.noDescription": "No description available",
        "packages.detail.information": "Information",
        "packages.detail.provider": "Provider",
        "packages.detail.license": "License",
        "packages.detail.latestVersion": "Latest Version",
        "packages.detail.currentVersion": "Current Version",
        "packages.detail.installedAt": "Installed At",
        "packages.detail.installPath": "Install Path",
        "packages.detail.globalPackage": "Global",
        "packages.detail.localPackage": "Local",
        "packages.detail.homepage": "Homepage",
        "packages.detail.repository": "Repository",
        "packages.detail.quickActions": "Quick Actions",
        "packages.detail.notInstalled": "Not installed",
        "packages.detail.installLatest": "Install Latest",
        "packages.detail.updateTo": `Update to ${params?.version ?? ""}`,
        "packages.detail.uninstallPackage": "Uninstall",
        "packages.detail.uninstallConfirmTitle": `Uninstall ${params?.name ?? ""}?`,
        "packages.detail.uninstallConfirmDesc": `Are you sure you want to uninstall ${params?.name ?? ""}?`,
        "packages.detail.pinCurrentVersion": "Pin Version",
        "packages.detail.unpinCurrentVersion": "Unpin Version",
        "packages.detail.copiedToClipboard": "Copied!",
        "packages.detail.copyPackageName": "Copy Package Name",
        "packages.addBookmark": "Add Bookmark",
        "packages.removeBookmark": "Remove Bookmark",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockPackageInfo: PackageInfo = {
  name: "numpy",
  display_name: "NumPy",
  description: "Numerical Python library",
  homepage: "https://numpy.org",
  license: "BSD-3",
  repository: "https://github.com/numpy/numpy",
  versions: [{ version: "1.24.0", release_date: "2024-01-01", deprecated: false, yanked: false }],
  provider: "pip",
};

const mockInstalledPkg: InstalledPackage = {
  name: "numpy",
  version: "1.23.0",
  provider: "pip",
  install_path: "/usr/lib/python3/site-packages/numpy",
  installed_at: "2024-06-15T10:30:00Z",
  is_global: true,
};

const defaultProps = {
  packageInfo: null as PackageInfo | null,
  installedPkg: null as InstalledPackage | null,
  isInstalled: false,
  isPinned: false,
  isBookmarked: false,
  isInstalling: false,
  hasUpdate: false,
  latestVersion: null as string | null,
  onInstall: jest.fn().mockResolvedValue(undefined),
  onUninstall: jest.fn().mockResolvedValue(undefined),
  onPin: jest.fn().mockResolvedValue(undefined),
  onUnpin: jest.fn().mockResolvedValue(undefined),
  onBookmark: jest.fn(),
  onRollback: jest.fn().mockResolvedValue(undefined),
};

describe("PackageOverviewCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders no description when packageInfo is null", () => {
    render(<PackageOverviewCard {...defaultProps} />);
    expect(screen.getByText("No description available")).toBeInTheDocument();
  });

  it("renders package description when available", () => {
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);
    expect(screen.getByText("Numerical Python library")).toBeInTheDocument();
  });

  it("shows install button when not installed", () => {
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);
    expect(screen.getByRole("button", { name: /install latest/i })).toBeInTheDocument();
  });

  it("shows uninstall button when installed", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
      />,
    );
    expect(screen.getByRole("button", { name: /uninstall/i })).toBeInTheDocument();
  });

  it("shows update button when update is available", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
        hasUpdate={true}
        latestVersion="1.24.0"
      />,
    );
    expect(screen.getByRole("button", { name: /update to 1\.24\.0/i })).toBeInTheDocument();
  });

  it("shows pin/unpin button for installed packages", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
      />,
    );
    expect(screen.getByRole("button", { name: /pin version/i })).toBeInTheDocument();
  });

  it("shows unpin when already pinned", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
        isPinned={true}
      />,
    );
    expect(screen.getByRole("button", { name: /unpin version/i })).toBeInTheDocument();
  });

  it("shows bookmark button and calls onBookmark", async () => {
    const user = userEvent.setup();
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);

    await user.click(screen.getByRole("button", { name: /add bookmark/i }));
    expect(defaultProps.onBookmark).toHaveBeenCalledTimes(1);
  });

  it("renders license info", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        isInstalled={false}
      />,
    );
    expect(screen.getByText("BSD-3")).toBeInTheDocument();
  });

  it("renders homepage and repository links", () => {
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);
    expect(screen.getByText("Homepage")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
  });

  it("shows current version for installed package", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
      />,
    );
    expect(screen.getByText("1.23.0")).toBeInTheDocument();
  });

  it("calls onInstall when install button is clicked", async () => {
    const user = userEvent.setup();
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);
    await user.click(screen.getByRole("button", { name: /install latest/i }));
    expect(defaultProps.onInstall).toHaveBeenCalled();
  });

  it("calls onPin when pin button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
      />,
    );
    await user.click(screen.getByRole("button", { name: /pin version/i }));
    expect(defaultProps.onPin).toHaveBeenCalled();
  });

  it("calls onUnpin when unpin button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
        isPinned={true}
      />,
    );
    await user.click(screen.getByRole("button", { name: /unpin version/i }));
    expect(defaultProps.onUnpin).toHaveBeenCalled();
  });

  it("calls handleCopyName when copy button is clicked", async () => {
    const user = userEvent.setup();
    render(<PackageOverviewCard {...defaultProps} packageInfo={mockPackageInfo} />);
    await user.click(screen.getByRole("button", { name: /copy package name/i }));
    // writeClipboard is mocked - verify toast was called
    const { toast } = jest.requireMock("sonner");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows global badge for global packages", () => {
    render(
      <PackageOverviewCard
        {...defaultProps}
        packageInfo={mockPackageInfo}
        installedPkg={mockInstalledPkg}
        isInstalled={true}
      />,
    );
    expect(screen.getByText("Global")).toBeInTheDocument();
  });
});
