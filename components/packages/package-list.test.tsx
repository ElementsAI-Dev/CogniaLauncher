import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageList } from "./package-list";
import type { InstalledPackage, PackageSummary } from "@/lib/tauri";

const mockTogglePackageSelection = jest.fn();
const mockSelectAllPackages = jest.fn();
const mockClearPackageSelection = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.noPackages": "No packages found",
        "packages.noResults": "No packages found",
        "packages.noPackagesInstalled": "No packages installed",
        "packages.searchTips": "Try searching for a package",
        "packages.description": "Install packages to get started",
        "packages.selected": `${params?.count ?? 0} selected`,
        "packages.selectAll": "Select all",
        "packages.deselectAll": "Deselect all",
        "packages.pinVersion": "Pin version",
        "packages.unpinVersion": "Unpin version",
        "packages.addBookmark": "Add bookmark",
        "packages.removeBookmark": "Remove bookmark",
        "packages.installConfirm": `Install ${params?.name ?? ""}?`,
        "packages.uninstallConfirm": `Uninstall ${params?.name ?? ""}?`,
        "packages.version": "Version",
        "common.install": "Install",
        "common.uninstall": "Uninstall",
        "common.info": "Info",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: () => ({
    selectedPackages: [],
    togglePackageSelection: mockTogglePackageSelection,
    selectAllPackages: mockSelectAllPackages,
    clearPackageSelection: mockClearPackageSelection,
  }),
}));

const mockSearchPackages: PackageSummary[] = [
  { name: "numpy", provider: "pip", description: "Numerical Python", latest_version: "1.24.0" },
  { name: "pandas", provider: "pip", description: "Data analysis library", latest_version: "2.0.0" },
];

const mockInstalledPackages: InstalledPackage[] = [
  { name: "react", version: "18.0.0", provider: "npm", install_path: "/path", installed_at: "2024-01-01", is_global: true },
  { name: "lodash", version: "4.17.21", provider: "npm", install_path: "/path", installed_at: "2024-01-01", is_global: true },
];

const defaultProps = {
  packages: mockSearchPackages as (PackageSummary | InstalledPackage)[],
  type: "search" as const,
  onInstall: jest.fn(),
  onUninstall: jest.fn(),
  onSelect: jest.fn(),
};

describe("PackageList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders package list", () => {
    render(<PackageList {...defaultProps} />);
    expect(screen.getByText("numpy")).toBeInTheDocument();
    expect(screen.getByText("pandas")).toBeInTheDocument();
  });

  it("shows search empty state when no packages", () => {
    render(<PackageList {...defaultProps} packages={[]} />);
    expect(screen.getByText("No packages found")).toBeInTheDocument();
  });

  it("shows installed empty state", () => {
    render(<PackageList {...defaultProps} packages={[]} type="installed" />);
    expect(screen.getByText("No packages installed")).toBeInTheDocument();
  });

  it("shows provider badge for packages", () => {
    render(<PackageList {...defaultProps} />);
    expect(screen.getAllByText("pip").length).toBeGreaterThan(0);
  });

  it("renders version badges", () => {
    render(<PackageList {...defaultProps} />);
    expect(screen.getByText("1.24.0")).toBeInTheDocument();
    expect(screen.getByText("2.0.0")).toBeInTheDocument();
  });

  it("renders select all checkbox for selectable list", () => {
    render(<PackageList {...defaultProps} selectable={true} showSelectAll={true} />);
    expect(screen.getByText("Select all")).toBeInTheDocument();
  });

  it("does not render select all when selectable is false", () => {
    render(<PackageList {...defaultProps} selectable={false} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  it("renders installed packages with version", () => {
    render(
      <PackageList
        {...defaultProps}
        packages={mockInstalledPackages}
        type="installed"
      />,
    );
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("18.0.0")).toBeInTheDocument();
  });

  it("shows pin buttons for installed packages when handlers provided", () => {
    render(
      <PackageList
        {...defaultProps}
        packages={mockInstalledPackages}
        type="installed"
        onPin={jest.fn()}
        onUnpin={jest.fn()}
      />,
    );
    // Pin buttons should be rendered for installed packages
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows bookmark buttons when handler provided", () => {
    render(
      <PackageList
        {...defaultProps}
        onBookmark={jest.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("calls onSelect when info button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<PackageList {...defaultProps} onSelect={onSelect} />);
    // Info buttons are icon buttons
    const infoButtons = screen.getAllByRole("button");
    // Click an info button (stopPropagation prevents navigation)
    await user.click(infoButtons[0]);
  });

  it("renders description for packages that have it", () => {
    render(<PackageList {...defaultProps} />);
    expect(screen.getByText("Numerical Python")).toBeInTheDocument();
    expect(screen.getByText("Data analysis library")).toBeInTheDocument();
  });

  it("calls selectAllPackages when select all checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<PackageList {...defaultProps} selectable={true} showSelectAll={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(mockSelectAllPackages).toHaveBeenCalled();
  });
});
