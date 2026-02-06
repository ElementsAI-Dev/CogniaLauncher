import { render, screen, fireEvent } from "@testing-library/react";
import { PackageList } from "./package-list";
import type { InstalledPackage } from "@/lib/tauri";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock locale provider
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "dashboard.packageList.title": "Installed Packages",
        "dashboard.packageList.searchPlaceholder": "Search packages...",
        "dashboard.packageList.viewAll": "View All",
        "dashboard.packageList.noResults": "No packages match the search",
        "dashboard.packageList.showMore": "Show {count} more",
        "dashboard.recentPackagesDesc": "Recently installed packages",
        "dashboard.noPackages": "No packages installed",
        "dashboard.environmentList.showLess": "Show less",
        "common.clear": "Clear",
      };
      return translations[key] || key;
    },
  }),
}));

const mockPackages: InstalledPackage[] = [
  {
    name: "typescript",
    version: "5.0.0",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
  {
    name: "react",
    version: "18.2.0",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
  {
    name: "vue",
    version: "3.3.0",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
  {
    name: "lodash",
    version: "4.17.21",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
  {
    name: "axios",
    version: "1.4.0",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
  {
    name: "express",
    version: "4.18.2",
    provider: "npm",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
];

describe("PackageList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders package list title", () => {
    render(<PackageList packages={mockPackages} />);

    expect(screen.getByText("Installed Packages")).toBeInTheDocument();
  });

  it("renders packages", () => {
    render(<PackageList packages={mockPackages} />);

    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("5.0.0")).toBeInTheDocument();
  });

  it("shows empty state when no packages", () => {
    render(<PackageList packages={[]} />);

    expect(screen.getByText("No packages installed")).toBeInTheDocument();
  });

  it("renders search input when there are many packages", () => {
    render(<PackageList packages={mockPackages} />);

    expect(
      screen.getByPlaceholderText("Search packages..."),
    ).toBeInTheDocument();
  });

  it("filters packages when searching", () => {
    render(<PackageList packages={mockPackages} />);

    const searchInput = screen.getByPlaceholderText("Search packages...");
    fireEvent.change(searchInput, { target: { value: "type" } });

    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.queryByText("react")).not.toBeInTheDocument();
  });

  it("shows no results message when search has no matches", () => {
    render(<PackageList packages={mockPackages} />);

    const searchInput = screen.getByPlaceholderText("Search packages...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(
      screen.getByText("No packages match the search"),
    ).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    render(<PackageList packages={mockPackages} />);

    const searchInput = screen.getByPlaceholderText(
      "Search packages...",
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "test" } });

    expect(searchInput.value).toBe("test");

    const clearButton = screen.getByLabelText("Clear");
    fireEvent.click(clearButton);

    expect(searchInput.value).toBe("");
  });

  it("navigates to package details when clicked", () => {
    render(<PackageList packages={mockPackages} />);

    const pkgItem = screen.getByText("typescript").closest("button");
    if (pkgItem) {
      fireEvent.click(pkgItem);
    }

    expect(mockPush).toHaveBeenCalledWith(
      "/packages?provider=npm&package=typescript",
    );
  });

  it("limits displayed packages based on initialLimit", () => {
    render(<PackageList packages={mockPackages} initialLimit={3} />);

    // Should show only 3 packages initially
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("vue")).toBeInTheDocument();

    // Should not show the rest
    expect(screen.queryByText("lodash")).not.toBeInTheDocument();
  });

  it("expands list when Show more is clicked", () => {
    render(<PackageList packages={mockPackages} initialLimit={3} />);

    // Find and click the show more button (it contains the count)
    const showMoreButton = screen.getByRole("button", { name: /show.*more/i });
    fireEvent.click(showMoreButton);

    // Should now show all packages
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("axios")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
  });

  it("navigates to packages page when View All is clicked", () => {
    render(<PackageList packages={mockPackages} />);

    const viewAllButton = screen.getByText("View All");
    fireEvent.click(viewAllButton);

    expect(mockPush).toHaveBeenCalledWith("/packages");
  });

  it("shows version badge for each package", () => {
    render(<PackageList packages={mockPackages} initialLimit={2} />);

    expect(screen.getByText("5.0.0")).toBeInTheDocument();
    expect(screen.getByText("18.2.0")).toBeInTheDocument();
  });
});
