import { render, screen, fireEvent } from "@testing-library/react";
import { InstalledFilterBar, useInstalledFilter } from "./installed-filter-bar";
import { renderHook, act } from "@testing-library/react";
import type { InstalledPackage, ProviderInfo } from "@/lib/tauri";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.filterInstalled": "Filter installed packages...",
        "packages.allProviders": "All Providers",
        "packages.clearFilters": "Clear Filters",
        "common.clear": "Clear",
      };
      return translations[key] || key;
    },
  }),
}));

const mockPackages: InstalledPackage[] = [
  {
    name: "react",
    version: "18.0.0",
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
    name: "requests",
    version: "2.31.0",
    provider: "pip",
    install_path: "/path",
    installed_at: "2024-01-01",
    is_global: true,
  },
];

const mockProviders: ProviderInfo[] = [
  {
    id: "npm",
    display_name: "NPM",
    capabilities: ["Search"],
    platforms: ["all"],
    priority: 1,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: "pip",
    display_name: "pip",
    capabilities: ["Search"],
    platforms: ["all"],
    priority: 2,
    is_environment_provider: false,
    enabled: true,
  },
];

describe("InstalledFilterBar", () => {
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input and provider selector", () => {
    render(
      <InstalledFilterBar
        packages={mockPackages}
        providers={mockProviders}
        filter={{ query: "", provider: null }}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(
      screen.getByPlaceholderText("Filter installed packages..."),
    ).toBeInTheDocument();
  });

  it("calls onFilterChange when search query changes", () => {
    render(
      <InstalledFilterBar
        packages={mockPackages}
        providers={mockProviders}
        filter={{ query: "", provider: null }}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const input = screen.getByPlaceholderText("Filter installed packages...");
    fireEvent.change(input, { target: { value: "react" } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      query: "react",
      provider: null,
    });
  });

  it("shows clear button when filters are active", () => {
    render(
      <InstalledFilterBar
        packages={mockPackages}
        providers={mockProviders}
        filter={{ query: "test", provider: null }}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(screen.getByText("Clear Filters")).toBeInTheDocument();
  });

  it("does not show clear button when no filters are active", () => {
    render(
      <InstalledFilterBar
        packages={mockPackages}
        providers={mockProviders}
        filter={{ query: "", provider: null }}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(screen.queryByText("Clear Filters")).not.toBeInTheDocument();
  });
});

describe("useInstalledFilter", () => {
  it("filters packages by query", () => {
    const { result } = renderHook(() => useInstalledFilter(mockPackages));

    act(() => {
      result.current.setFilter({ query: "react", provider: null });
    });

    expect(result.current.filteredPackages).toHaveLength(1);
    expect(result.current.filteredPackages[0].name).toBe("react");
  });

  it("filters packages by provider", () => {
    const { result } = renderHook(() => useInstalledFilter(mockPackages));

    act(() => {
      result.current.setFilter({ query: "", provider: "pip" });
    });

    expect(result.current.filteredPackages).toHaveLength(1);
    expect(result.current.filteredPackages[0].name).toBe("requests");
  });

  it("filters packages by both query and provider", () => {
    const { result } = renderHook(() => useInstalledFilter(mockPackages));

    act(() => {
      result.current.setFilter({ query: "lod", provider: "npm" });
    });

    expect(result.current.filteredPackages).toHaveLength(1);
    expect(result.current.filteredPackages[0].name).toBe("lodash");
  });

  it("returns all packages when no filter is applied", () => {
    const { result } = renderHook(() => useInstalledFilter(mockPackages));

    expect(result.current.filteredPackages).toHaveLength(3);
  });
});
