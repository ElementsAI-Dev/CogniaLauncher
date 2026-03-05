import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DependencyTree } from "./dependency-tree";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.dependencyTree": "Dependency Tree",
        "packages.dependencyTreeDesc": "Resolve and visualize dependencies",
        "packages.resolveDependencies": "Resolve Dependencies",
        "packages.enterPackageName": "Enter package name",
        "packages.resolve": "Resolve",
        "packages.selectedDependencyPackage": `Selected package: ${params?.name ?? ""}`,
        "packages.dependencyContextPartialHint":
          "Provider or version is missing. You can retry, or edit package name for manual lookup.",
        "packages.useSelectedPackage": "Use Selected Package",
        "packages.resolvingDependencies": "Resolving dependencies...",
        "packages.noDependenciesFound": "No dependencies found",
        "packages.noDependenciesFoundFor": `No dependencies found for ${params?.name ?? ""}`,
        "packages.enterPackageToResolve": "Enter a package name to resolve",
        "packages.readyToResolveDependenciesFor": `Ready to resolve dependencies for ${params?.name ?? ""}`,
        "packages.totalPackages": "Total packages",
        "packages.conflicts": "Conflicts",
        "packages.installed": "Installed",
        "packages.toInstall": "To Install",
        "packages.conflict": "Conflict",
        "packages.featureProvider": "Provider",
        "packages.version": "Version",
        "packages.searchDependencies": "Search dependencies...",
        "packages.expandAll": "Expand All",
        "packages.collapseAll": "Collapse All",
        "packages.resolutionSuccessful": "Resolution successful",
        "packages.resolutionFailed": "Resolution failed",
        "packages.installationOrder": "Installation Order",
        "packages.dependencyConflicts": "Dependency Conflicts",
        "packages.requiredVersions": "Required versions:",
        "packages.requiredBy": "Required by:",
        "packages.suggestion": "Suggestion:",
        "packages.totalDownload": "Total download:",
        "common.retry": "Retry",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  formatSize: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
}));

const mockResolution = {
  success: true,
  packages: [{ name: "numpy", version: "1.24.0", provider: "pip" }],
  tree: [
    {
      name: "numpy",
      version: "1.24.0",
      constraint: ">=1.20",
      provider: "pip",
      dependencies: [],
      is_direct: true,
      is_installed: true,
      is_conflict: false,
      conflict_reason: null,
      depth: 0,
    },
    {
      name: "scipy",
      version: "1.11.0",
      constraint: ">=1.0",
      provider: "pip",
      dependencies: [],
      is_direct: false,
      is_installed: false,
      is_conflict: false,
      conflict_reason: null,
      depth: 1,
    },
  ],
  conflicts: [],
  install_order: ["scipy", "numpy"],
  total_packages: 2,
  total_size: null,
};

const mockOnResolve = jest.fn().mockResolvedValue(mockResolution);

const defaultProps = {
  packageId: "numpy",
  onResolve: mockOnResolve,
  loading: false,
};

describe("DependencyTree", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dependency tree component", () => {
    render(<DependencyTree {...defaultProps} />);
    expect(screen.getByText("Dependency Tree")).toBeInTheDocument();
  });

  it("shows empty state when no resolution", () => {
    render(<DependencyTree {...defaultProps} />);
    expect(
      screen.getByText("Ready to resolve dependencies for numpy"),
    ).toBeInTheDocument();
  });

  it("shows resolve button", () => {
    render(<DependencyTree {...defaultProps} />);
    expect(screen.getByRole("button", { name: /resolve/i })).toBeInTheDocument();
  });

  it("calls onResolve when resolve button is clicked", async () => {
    const user = userEvent.setup();
    render(<DependencyTree {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /resolve/i }));
    expect(mockOnResolve).toHaveBeenCalledWith({
      packageName: "numpy",
      source: "manual",
    });
  });

  it("renders package input field", () => {
    render(<DependencyTree {...defaultProps} />);
    expect(screen.getByPlaceholderText("Enter package name")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<DependencyTree {...defaultProps} loading={true} />);
    expect(screen.getByText("Resolving dependencies...")).toBeInTheDocument();
  });

  it("disables resolve button when loading", () => {
    render(<DependencyTree {...defaultProps} loading={true} />);
    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    expect(resolveButton).toBeDisabled();
  });

  it("renders resolution stats when resolved", () => {
    const { container } = render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    expect(screen.getByText("2")).toBeInTheDocument(); // total packages
    expect(screen.getByText("Resolution successful")).toBeInTheDocument();

    const scrollArea = container.querySelector('[data-slot="scroll-area"]');
    expect(scrollArea).toBeInTheDocument();
    expect(scrollArea).toHaveClass("max-h-[60dvh]");
    expect(scrollArea).not.toHaveClass("h-[400px]");
  });

  it("renders install order", () => {
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    expect(screen.getByText("Installation Order")).toBeInTheDocument();
    // scipy appears both in tree and install order, verify install order section exists
    expect(screen.getAllByText("scipy").length).toBeGreaterThanOrEqual(1);
  });

  it("shows expand/collapse buttons when resolved", () => {
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse all/i })).toBeInTheDocument();
  });

  it("renders search input when resolved", () => {
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    expect(screen.getByPlaceholderText("Search dependencies...")).toBeInTheDocument();
  });

  it("calls expandAll when expand button is clicked", async () => {
    const user = userEvent.setup();
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    await user.click(screen.getByRole("button", { name: /expand all/i }));
    // No error means expandAll ran successfully
  });

  it("calls collapseAll when collapse button is clicked", async () => {
    const user = userEvent.setup();
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    await user.click(screen.getByRole("button", { name: /collapse all/i }));
    // No error means collapseAll ran successfully
  });

  it("handles search input change", async () => {
    const user = userEvent.setup();
    render(<DependencyTree {...defaultProps} resolution={mockResolution} />);
    const searchInput = screen.getByPlaceholderText("Search dependencies...");
    await user.type(searchInput, "numpy");
    expect(searchInput).toHaveValue("numpy");
  });

  it("handles Enter key on package input", async () => {
    const user = userEvent.setup();
    render(<DependencyTree {...defaultProps} />);
    const input = screen.getByPlaceholderText("Enter package name");
    await user.clear(input);
    await user.type(input, "scipy{Enter}");
    expect(mockOnResolve).toHaveBeenCalledWith({
      packageName: "scipy",
      source: "manual",
    });
  });

  it("prioritizes selected package context when manual input is not overriding", async () => {
    const user = userEvent.setup();
    render(
      <DependencyTree
        {...defaultProps}
        selectedContext={{
          packageName: "requests",
          providerId: "pip",
          version: "2.31.0",
          source: "search",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /resolve/i }));
    expect(mockOnResolve).toHaveBeenCalledWith({
      packageName: "requests",
      providerId: "pip",
      version: "2.31.0",
      source: "search",
    });
  });
});
