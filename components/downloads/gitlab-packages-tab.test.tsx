import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitLabPackagesTab } from "./gitlab-packages-tab";
import type { GitLabPackageInfo, GitLabPackageFileInfo } from "@/types/gitlab";

const mockUseAssetMatcher = jest.fn();

jest.mock("@/hooks/downloads/use-asset-matcher", () => ({
  useAssetMatcher: () => mockUseAssetMatcher(),
  getPlatformLabel: (platform: string) =>
    ({
      windows: "Windows",
      linux: "Linux",
      macos: "macOS",
    }[platform] ?? ""),
  getArchLabel: (arch: string) =>
    ({
      x64: "x64",
      arm64: "ARM64",
      x86: "x86",
      universal: "Universal",
    }[arch] ?? ""),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("GitLabPackagesTab", () => {
  const packages: GitLabPackageInfo[] = [
    {
      id: 301,
      name: "cli-bundle",
      version: "1.2.3",
      packageType: "generic",
      createdAt: null,
    },
  ];

  const packageFiles: GitLabPackageFileInfo[] = [
    {
      id: 401,
      fileName: "cli-linux-x64.tar.gz",
      size: 2048,
      fileSha256: null,
      createdAt: null,
    },
  ];

  const defaultProps = {
    packages,
    selectedPackageId: null as number | null,
    onSelectPackage: jest.fn(),
    packageFiles,
    selectedPackageFileIds: new Set<number>(),
    onToggleFile: jest.fn(),
    packageFilesLoading: false,
    packageTypeFilter: "",
    onFilterChange: jest.fn(),
    onApplyFilter: jest.fn(),
    onClearFilter: jest.fn(),
    onFilterKeyDown: jest.fn(),
    t: (key: string) => key,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssetMatcher.mockReturnValue({
      currentPlatform: "linux",
      currentArch: "x64",
    });
  });

  it("renders empty packages message", () => {
    render(
      <GitLabPackagesTab
        {...defaultProps}
        packages={[]}
      />,
    );

    expect(screen.getByText("downloads.gitlab.noPackages")).toBeInTheDocument();
  });

  it("handles filter input change and enter key", async () => {
    const onFilterChange = jest.fn();
    const onFilterKeyDown = jest.fn();
    render(
      <GitLabPackagesTab
        {...defaultProps}
        onFilterChange={onFilterChange}
        onFilterKeyDown={onFilterKeyDown}
      />,
    );

    const input = screen.getByPlaceholderText(
      "downloads.gitlab.packageTypePlaceholder",
    );
    await userEvent.type(input, "generic{enter}");

    expect(onFilterChange).toHaveBeenCalled();
    expect(onFilterKeyDown).toHaveBeenCalled();
  });

  it("calls apply filter from refresh and apply buttons", async () => {
    const onApplyFilter = jest.fn();
    render(
      <GitLabPackagesTab
        {...defaultProps}
        onApplyFilter={onApplyFilter}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "common.refresh" }));
    await userEvent.click(
      screen.getByRole("button", { name: "downloads.gitlab.applyPackageType" }),
    );

    expect(onApplyFilter).toHaveBeenCalledTimes(2);
  });

  it("respects clear filter enabled state and callback", async () => {
    const onClearFilter = jest.fn();
    const { rerender } = render(
      <GitLabPackagesTab
        {...defaultProps}
        packageTypeFilter=""
        onClearFilter={onClearFilter}
      />,
    );

    expect(screen.getByRole("button", { name: "common.clear" })).toBeDisabled();

    rerender(
      <GitLabPackagesTab
        {...defaultProps}
        packageTypeFilter="generic"
        onClearFilter={onClearFilter}
      />,
    );

    const clearButton = screen.getByRole("button", { name: "common.clear" });
    expect(clearButton).not.toBeDisabled();
    await userEvent.click(clearButton);
    expect(onClearFilter).toHaveBeenCalled();
  });

  it("calls onSelectPackage and marks selected package row", async () => {
    const onSelectPackage = jest.fn();
    const { rerender } = render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={null}
        onSelectPackage={onSelectPackage}
      />,
    );

    const packageButton = screen.getByRole("button", { name: /cli-bundle/i });
    expect(packageButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(packageButton);
    expect(onSelectPackage).toHaveBeenCalledWith(301);

    rerender(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={301}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(screen.getByRole("button", { name: /cli-bundle/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows package file loading skeletons", () => {
    const { container } = render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={301}
        packageFilesLoading={true}
      />,
    );

    expect(container.querySelectorAll(".h-10").length).toBeGreaterThanOrEqual(3);
  });

  it("shows package selection hint before package is selected", () => {
    render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={null}
      />,
    );

    expect(screen.getByText("downloads.gitlab.selectPackage")).toBeInTheDocument();
  });

  it("shows no package files message for selected package", () => {
    render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={301}
        packageFiles={[]}
      />,
    );

    expect(screen.getByText("downloads.gitlab.noPackageFiles")).toBeInTheDocument();
  });

  it("renders package files and toggles file selection callback", async () => {
    const onToggleFile = jest.fn();
    render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={301}
        onToggleFile={onToggleFile}
      />,
    );

    expect(screen.getByText("cli-linux-x64.tar.gz")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);
    expect(onToggleFile).toHaveBeenCalledWith(401);
  });

  it("shows recommended platform cues for matching package files", () => {
    render(
      <GitLabPackagesTab
        {...defaultProps}
        selectedPackageId={301}
      />,
    );

    expect(screen.getByText("downloads.gitlab.recommended")).toBeInTheDocument();
    expect(screen.getByText("Linux")).toBeInTheDocument();
    expect(screen.getAllByText("x64").length).toBeGreaterThan(0);
  });
});
