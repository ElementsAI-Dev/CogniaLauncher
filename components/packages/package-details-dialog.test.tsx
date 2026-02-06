import { render, screen } from "@testing-library/react";
import { PackageDetailsDialog } from "./package-details-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.details": "Package Details",
        "packages.version": "Version",
        "packages.provider": "Provider",
        "packages.description": "Description",
        "packages.dependencies": "Dependencies",
        "packages.close": "Close",
      };
      return translations[key] || key;
    },
  }),
}));

const mockPackage = {
  name: "numpy",
  version: "1.24.0",
  provider: "pip",
  description: "Numerical Python library",
};

const defaultProps = {
  pkg: mockPackage as unknown as Parameters<
    typeof PackageDetailsDialog
  >[0]["pkg"],
  open: true,
  onOpenChange: jest.fn(),
  onInstall: jest.fn().mockResolvedValue(undefined),
  fetchPackageInfo: jest.fn().mockResolvedValue(null),
};

describe("PackageDetailsDialog", () => {
  it("renders dialog when open", () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    // Component uses package name as title
    expect(screen.getByText("numpy")).toBeInTheDocument();
  });

  it("shows package name", () => {
    render(<PackageDetailsDialog {...defaultProps} />);
    expect(screen.getByText("numpy")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<PackageDetailsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Package Details")).not.toBeInTheDocument();
  });
});
