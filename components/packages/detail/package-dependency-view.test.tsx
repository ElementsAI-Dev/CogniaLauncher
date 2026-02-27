import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageDependencyView } from "./package-dependency-view";
import type { ResolutionResult } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.detail.dependencyAnalysis": "Dependency Analysis",
        "packages.detail.dependencyAnalysisDesc": "Analyze package dependencies",
        "packages.detail.analyzeDependencies": "Analyze Dependencies",
        "packages.detail.analyzing": "Analyzing...",
        "packages.detail.totalDependencies": "Total Dependencies",
        "packages.detail.conflictsFound": "Conflicts Found",
        "packages.detail.noDependencies": "Click to analyze dependencies",
        "packages.resolvingDependencies": "Resolving dependencies...",
        "packages.resolutionSuccessful": "Resolution successful",
        "packages.resolutionFailed": "Resolution failed",
        "packages.installed": "Installed",
        "packages.toInstall": "To Install",
        "packages.conflict": "Conflict",
        "packages.dependencyConflicts": "Dependency Conflicts",
        "packages.requiredVersions": "Required versions:",
        "packages.requiredBy": "Required by:",
        "packages.suggestion": "Suggestion:",
        "packages.installationOrder": "Installation Order",
        "packages.totalDownload": `Total download: ${params?.size ?? ""}`,
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  formatSize: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
}));

const makeResolution = (overrides: Partial<ResolutionResult> = {}): ResolutionResult => ({
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
  ],
  conflicts: [],
  install_order: ["numpy"],
  total_packages: 1,
  total_size: null,
  ...overrides,
});

const defaultProps = {
  resolution: null as ResolutionResult | null,
  loading: false,
  onResolve: jest.fn().mockResolvedValue(undefined),
};

describe("PackageDependencyView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty state when no resolution", () => {
    render(<PackageDependencyView {...defaultProps} />);
    expect(screen.getByText("Dependency Analysis")).toBeInTheDocument();
    expect(screen.getByText("Click to analyze dependencies")).toBeInTheDocument();
  });

  it("renders loading state with skeletons", () => {
    render(<PackageDependencyView {...defaultProps} loading={true} />);
    expect(screen.getByText("Resolving dependencies...")).toBeInTheDocument();
  });

  it("calls onResolve when analyze button is clicked", async () => {
    const user = userEvent.setup();
    render(<PackageDependencyView {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /analyze dependencies/i }));
    expect(defaultProps.onResolve).toHaveBeenCalledTimes(1);
  });

  it("disables button during loading", () => {
    render(<PackageDependencyView {...defaultProps} loading={true} />);
    expect(screen.getByRole("button", { name: /analyzing/i })).toBeDisabled();
  });

  it("renders resolution success banner", () => {
    render(<PackageDependencyView {...defaultProps} resolution={makeResolution()} />);
    expect(screen.getByText("Resolution successful")).toBeInTheDocument();
  });

  it("renders resolution failure banner", () => {
    render(
      <PackageDependencyView
        {...defaultProps}
        resolution={makeResolution({ success: false })}
      />,
    );
    expect(screen.getByText("Resolution failed")).toBeInTheDocument();
  });

  it("renders stats grid with correct counts", () => {
    const resolution = makeResolution({
      total_packages: 5,
      tree: [
        { name: "a", version: "1.0", constraint: "", provider: "pip", dependencies: [], is_direct: true, is_installed: true, is_conflict: false, conflict_reason: null, depth: 0 },
        { name: "b", version: "2.0", constraint: "", provider: "pip", dependencies: [], is_direct: false, is_installed: false, is_conflict: false, conflict_reason: null, depth: 1 },
      ],
      conflicts: [{ package_name: "c", required_by: ["a"], versions: ["1.0", "2.0"] }],
    });
    render(<PackageDependencyView {...defaultProps} resolution={resolution} />);
    expect(screen.getByText("5")).toBeInTheDocument(); // total packages
    expect(screen.getByText("Total Dependencies")).toBeInTheDocument();
    expect(screen.getByText("Conflicts Found")).toBeInTheDocument();
  });

  it("renders conflicts section", () => {
    const resolution = makeResolution({
      conflicts: [
        {
          package_name: "libfoo",
          required_by: ["numpy", "scipy"],
          versions: ["1.0", "2.0"],
          resolution: "Use version 2.0",
        },
      ],
    });
    render(<PackageDependencyView {...defaultProps} resolution={resolution} />);
    expect(screen.getByText("Dependency Conflicts")).toBeInTheDocument();
    expect(screen.getByText("libfoo")).toBeInTheDocument();
    expect(screen.getByText(/1\.0, 2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/numpy, scipy/)).toBeInTheDocument();
    expect(screen.getByText(/Use version 2\.0/)).toBeInTheDocument();
  });

  it("renders install order", () => {
    const resolution = makeResolution({
      install_order: ["dep-a", "dep-b", "numpy"],
    });
    render(<PackageDependencyView {...defaultProps} resolution={resolution} />);
    expect(screen.getByText("Installation Order")).toBeInTheDocument();
    expect(screen.getByText("dep-a")).toBeInTheDocument();
    expect(screen.getByText("dep-b")).toBeInTheDocument();
  });
});
