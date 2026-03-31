import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { PackageOperationPanel } from "./package-operation-panel";
import {
  PackageOperationProvider,
  type PackageOperationContextValue,
} from "./package-operation-context";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.installed": "Installed",
        "packages.searchResults": "Search Results",
        "packages.updates": "Updates",
        "packages.dependencies": "Dependencies",
        "packages.history": "History",
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock("@/components/packages/search-bar", () => ({
  SearchBar: ({ onSearch }: { onSearch: (query: string, options: Record<string, unknown>) => void }) => (
    <button
      data-testid="shared-search-bar"
      onClick={() => onSearch("vite", { providers: ["npm"] })}
    >
      Search
    </button>
  ),
}));

jest.mock("@/components/packages/package-list", () => ({
  PackageList: ({ type }: { type: string }) => (
    <div data-testid={`package-list-${type}`}>{type}</div>
  ),
}));

jest.mock("@/components/packages/update-manager", () => ({
  UpdateManager: () => <div data-testid="update-manager">updates</div>,
}));

jest.mock("@/components/packages/installed-filter-bar", () => ({
  InstalledFilterBar: () => <div data-testid="installed-filter-bar">filter</div>,
  useInstalledFilter: (packages: unknown[]) => ({
    filter: {},
    setFilter: jest.fn(),
    filteredPackages: packages,
  }),
}));

function renderWithProvider(
  ui: ReactNode,
  overrides: Partial<PackageOperationContextValue> = {},
) {
  const value: PackageOperationContextValue = {
    mode: "full",
    features: {},
    providers: [
      {
        id: "npm",
        display_name: "npm",
        capabilities: ["Search", "Install"],
        platforms: ["Windows"],
        priority: 1,
        is_environment_provider: false,
        enabled: true,
      },
    ],
    installedPackages: [
      {
        name: "typescript",
        version: "5.0.0",
        provider: "npm",
        install_path: "/tmp/typescript",
        installed_at: "2026-01-01T00:00:00.000Z",
        is_global: true,
      },
    ],
    searchResults: [
      {
        name: "vite",
        description: "Build tool",
        latest_version: "6.0.0",
        provider: "npm",
      },
    ],
    availableUpdates: [],
    selectedPackages: [],
    installing: [],
    pinnedPackages: [],
    bookmarkedPackages: [],
    loading: false,
    error: null,
    onSearch: jest.fn(),
    onGetSuggestions: jest.fn().mockResolvedValue([]),
    onInstall: jest.fn(),
    onUninstall: jest.fn(),
    onUpdateSelected: jest.fn().mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
      total_time_ms: 0,
    }),
    onUpdateAll: jest.fn().mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
      total_time_ms: 0,
    }),
    onClearSelection: jest.fn(),
    ...overrides,
  };

  return {
    value,
    ...render(
      <PackageOperationProvider value={value}>{ui}</PackageOperationProvider>,
    ),
  };
}

describe("PackageOperationPanel", () => {
  it("renders full mode default tabs", () => {
    renderWithProvider(<PackageOperationPanel mode="full" />);

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("Search Results")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("renders environment mode defaults without dependency and history tabs", () => {
    renderWithProvider(<PackageOperationPanel mode="environment" />, {
      mode: "environment",
    });

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("Search Results")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.queryByText("Dependencies")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });

  it("honors feature flags when a mode disables updates", () => {
    renderWithProvider(
      <PackageOperationPanel mode="provider" features={{ updates: false }} />,
      {
        mode: "provider",
      },
    );

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.getByText("Search Results")).toBeInTheDocument();
    expect(screen.queryByText("Updates")).not.toBeInTheDocument();
  });

  it("wires search callbacks through the shared context", async () => {
    const user = userEvent.setup();
    const { value } = renderWithProvider(<PackageOperationPanel mode="full" />);

    await user.click(screen.getByRole("tab", { name: "Search Results" }));
    await user.click(screen.getByTestId("shared-search-bar"));

    expect(value.onSearch).toHaveBeenCalledWith("vite", { providers: ["npm"] });
  });
});
