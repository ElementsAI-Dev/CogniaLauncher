import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageVersionList } from "./package-version-list";
import type { VersionInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.detail.availableVersions": "Available Versions",
        "packages.detail.showingVersions": `Showing ${params?.count ?? 0} of ${params?.total ?? 0}`,
        "packages.detail.allVersions": "Search versions...",
        "packages.detail.noVersionsAvailable": "No versions available",
        "packages.detail.versionCurrent": "Current",
        "packages.detail.versionLatest": "Latest",
        "packages.detail.versionDeprecated": "Deprecated",
        "packages.detail.versionYanked": "Yanked",
        "packages.detail.installThisVersion": "Install",
        "packages.detail.rollbackToVersion": "Rollback",
        "packages.detail.loadMoreVersions": "Load more",
      };
      return translations[key] || key;
    },
  }),
}));

const makeVersions = (count: number): VersionInfo[] =>
  Array.from({ length: count }, (_, i) => ({
    version: `1.${count - i}.0`,
    release_date: `2024-0${Math.min(i + 1, 9)}-01`,
    deprecated: false,
    yanked: false,
  }));

const defaultProps = {
  versions: makeVersions(3),
  currentVersion: null as string | null,
  isInstalled: false,
  isInstalling: false,
  onInstall: jest.fn().mockResolvedValue(undefined),
  onRollback: jest.fn().mockResolvedValue(undefined),
};

describe("PackageVersionList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty state when no versions", () => {
    render(<PackageVersionList {...defaultProps} versions={[]} />);
    expect(screen.getByText("No versions available")).toBeInTheDocument();
  });

  it("renders version list", () => {
    render(<PackageVersionList {...defaultProps} />);
    expect(screen.getByText("Available Versions")).toBeInTheDocument();
    expect(screen.getByText("1.3.0")).toBeInTheDocument();
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText("1.1.0")).toBeInTheDocument();
  });

  it("highlights current version with badge", () => {
    render(<PackageVersionList {...defaultProps} currentVersion="1.2.0" isInstalled={true} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows latest badge on first version when not current", () => {
    render(<PackageVersionList {...defaultProps} currentVersion="1.1.0" isInstalled={true} />);
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("shows deprecated badge", () => {
    const versions: VersionInfo[] = [
      { version: "2.0.0", release_date: null, deprecated: true, yanked: false },
    ];
    render(<PackageVersionList {...defaultProps} versions={versions} />);
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
  });

  it("shows yanked badge", () => {
    const versions: VersionInfo[] = [
      { version: "2.0.0", release_date: null, deprecated: false, yanked: true },
    ];
    render(<PackageVersionList {...defaultProps} versions={versions} />);
    expect(screen.getByText("Yanked")).toBeInTheDocument();
  });

  it("filters versions by search term", async () => {
    const user = userEvent.setup();
    render(<PackageVersionList {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Search versions...");
    await user.type(searchInput, "1.3");

    expect(screen.getByText("1.3.0")).toBeInTheDocument();
    expect(screen.queryByText("1.2.0")).not.toBeInTheDocument();
  });

  it("shows rollback button for installed packages", () => {
    render(
      <PackageVersionList
        {...defaultProps}
        currentVersion="1.2.0"
        isInstalled={true}
      />,
    );
    // Non-current versions should have rollback buttons
    const rollbackButtons = screen.getAllByText("Rollback");
    expect(rollbackButtons.length).toBeGreaterThan(0);
  });

  it("shows install button for non-installed packages", () => {
    render(<PackageVersionList {...defaultProps} isInstalled={false} />);
    const installButtons = screen.getAllByText("Install");
    expect(installButtons.length).toBeGreaterThan(0);
  });

  it("shows load more button when versions exceed page size", () => {
    const manyVersions = makeVersions(35);
    render(<PackageVersionList {...defaultProps} versions={manyVersions} />);
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("loads more versions when load more is clicked", async () => {
    const user = userEvent.setup();
    const manyVersions = makeVersions(35);
    render(<PackageVersionList {...defaultProps} versions={manyVersions} />);
    await user.click(screen.getByRole("button", { name: /load more/i }));
    // After loading more, all 35 should be visible (30+5)
  });

  it("calls onInstall when install button is clicked", async () => {
    const user = userEvent.setup();
    render(<PackageVersionList {...defaultProps} isInstalled={false} />);
    const installButtons = screen.getAllByText("Install");
    await user.click(installButtons[0]);
    expect(defaultProps.onInstall).toHaveBeenCalled();
  });

  it("calls onRollback when rollback button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PackageVersionList
        {...defaultProps}
        currentVersion="1.2.0"
        isInstalled={true}
      />,
    );
    const rollbackButtons = screen.getAllByText("Rollback");
    await user.click(rollbackButtons[0]);
    expect(defaultProps.onRollback).toHaveBeenCalled();
  });
});
