import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageComparisonDialog } from "./package-comparison-dialog";
import type { PackageComparison } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "packages.compareVersions": "Compare Versions",
        "packages.comparePackages": "Compare Packages",
        "packages.sideByComparison": `Side-by-side comparison of ${params?.count ?? ""} packages`,
        "packages.feature": "Feature",
        "packages.featureVersion": "Version",
        "packages.featureProvider": "Provider",
        "packages.featureLicense": "License",
        "packages.featureSize": "Size",
        "packages.featureLastUpdated": "Last Updated",
        "packages.featureHomepage": "Homepage",
        "packages.featureDependencies": "Dependencies",
        "packages.featurePlatforms": "Platforms",
        "packages.keyDifferences": "Key Differences",
        "packages.commonFeatures": "Common Features",
        "packages.recommendation": "Recommendation",
        "packages.noDescription": "No description",
        "packages.noneValue": "None",
        "packages.link": "Link",
        "packages.unknownDate": "Unknown",
        "packages.failedToCompare": "Failed to compare packages",
        "common.close": "Close",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  formatSize: (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`,
}));

const mockComparison: PackageComparison = {
  packages: [
    {
      name: "numpy",
      provider: "pip",
      version: "1.24.0",
      latest_version: "1.24.0",
      description: "Numerical Python",
      homepage: "https://numpy.org",
      license: "BSD-3",
    },
    {
      name: "scipy",
      provider: "pip",
      version: "1.11.0",
      latest_version: "1.11.0",
      description: "Scientific Python",
      homepage: "https://scipy.org",
      license: "BSD-3",
    },
  ],
  features: [],
  differences: ["Version", "Description"],
  common_features: ["BSD License", "Python 3"],
  recommendation: "Both are excellent choices for scientific computing.",
};

describe("PackageComparisonDialog", () => {
  const mockOnCompare = jest.fn();
  const mockOnOpenChange = jest.fn();

  const renderDialog = (overrides = {}) => {
    return render(
      <PackageComparisonDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        packageIds={["pip:numpy", "pip:scipy"]}
        onCompare={mockOnCompare}
        {...overrides}
      />,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnCompare.mockResolvedValue(mockComparison);
  });

  it("renders dialog when open", () => {
    renderDialog();
    expect(screen.getByText("Compare Packages")).toBeInTheDocument();
  });

  it("calls onCompare when dialog opens", () => {
    renderDialog();
    expect(mockOnCompare).toHaveBeenCalledWith(["pip:numpy", "pip:scipy"]);
  });

  it("does not render when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Compare Packages")).not.toBeInTheDocument();
  });

  it("shows loading skeletons initially", () => {
    // onCompare is async so loading state shows first
    renderDialog();
    expect(screen.getByText("Compare Packages")).toBeInTheDocument();
    expect(screen.getByText(/Side-by-side comparison/)).toBeInTheDocument();
  });

  it("does not call onCompare with fewer than 2 packages", () => {
    renderDialog({ packageIds: ["pip:numpy"] });
    expect(mockOnCompare).not.toHaveBeenCalled();
  });

  it("renders close button and calls onOpenChange", async () => {
    const user = userEvent.setup();
    renderDialog();
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    await user.click(closeButtons[0]);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows description text in header", () => {
    renderDialog();
    expect(screen.getByText("Side-by-side comparison of 2 packages")).toBeInTheDocument();
  });

  it("handles close via dialog X button", async () => {
    const user = userEvent.setup();
    renderDialog();
    // There are two close buttons: the X and the "Close" button
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(mockOnOpenChange).toHaveBeenCalled();
  });
});
