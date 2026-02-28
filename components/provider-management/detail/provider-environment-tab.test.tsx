import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderEnvironmentTab } from "./provider-environment-tab";
import type { EnvironmentInfo, EnvironmentProviderInfo, VersionInfo } from "@/types/tauri";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  envInstall: jest.fn(() => Promise.resolve()),
  envUninstall: jest.fn(() => Promise.resolve()),
  envUseGlobal: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatSize: (size: number | null, fallback: string) => (size != null ? `${size}B` : fallback),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providerDetail.environmentOverview": "Environment Overview",
    "providers.refresh": "Refresh",
    "providerDetail.noEnvironmentData": "No environment data",
    "providerDetail.envType": "Type",
    "providerDetail.envCurrentVersion": "Current Version",
    "providerDetail.installedVersionsCount": "Installed Versions",
    "providerDetail.providerName": "Provider",
    "providerDetail.none": "None",
    "providerDetail.installedVersions": "Installed Versions",
    "providerDetail.version": "Version",
    "providerDetail.installPath": "Path",
    "providerDetail.size": "Size",
    "providerDetail.installedAt": "Installed At",
    "providerDetail.actions": "Actions",
    "providerDetail.current": "Current",
    "providerDetail.setAsGlobal": "Set as Global",
    "providerDetail.uninstallVersion": "Uninstall",
    "providerDetail.availableVersions": "Available Versions",
    "providerDetail.availableVersionsDesc": "Versions available for install",
    "providerDetail.noAvailableVersions": "No available versions",
    "providerDetail.installed": "Installed",
    "providerDetail.deprecated": "Deprecated",
    "providerDetail.yanked": "Yanked",
    "providerDetail.installVersion": "Install",
    "providerDetail.releaseDate": "Release Date",
    "providerDetail.status": "Status",
    "providerDetail.filterVersions": "Filter versions...",
    "providerDetail.noMatchingVersions": "No matching versions",
  };
  return translations[key] || key;
};

const envInfo: EnvironmentInfo = {
  env_type: "node",
  provider_id: "nvm",
  provider: "Node Version Manager",
  current_version: "20.10.0",
  installed_versions: [
    { version: "20.10.0", install_path: "/home/.nvm/versions/20.10.0", size: 50000, installed_at: "2024-01-01T00:00:00Z", is_current: true },
    { version: "18.19.0", install_path: "/home/.nvm/versions/18.19.0", size: 48000, installed_at: "2024-01-02T00:00:00Z", is_current: false },
  ],
  available: true,
  total_size: 98000,
  version_count: 2,
};

const envProviderInfo: EnvironmentProviderInfo = {
  id: "nvm",
  display_name: "Node Version Manager",
  env_type: "node",
  description: "Manages Node.js versions",
};

const availableVersions: VersionInfo[] = [
  { version: "22.0.0", release_date: "2024-04-01", deprecated: false, yanked: false },
  { version: "20.10.0", release_date: "2024-01-01", deprecated: false, yanked: false },
  { version: "16.0.0", release_date: "2021-04-01", deprecated: true, yanked: false },
];

describe("ProviderEnvironmentTab", () => {
  const defaultProps = {
    providerId: "nvm",
    environmentInfo: null as EnvironmentInfo | null,
    environmentProviderInfo: null as EnvironmentProviderInfo | null,
    availableVersions: [] as VersionInfo[],
    loadingEnvironment: false,
    onRefreshEnvironment: jest.fn(() => Promise.resolve()),
    t: mockT,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    const { container } = render(<ProviderEnvironmentTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("shows no environment data when info is null", () => {
    render(<ProviderEnvironmentTab {...defaultProps} />);
    expect(screen.getByText("No environment data")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading with no data", () => {
    render(<ProviderEnvironmentTab {...defaultProps} loadingEnvironment={true} />);
    expect(screen.queryByText("No environment data")).not.toBeInTheDocument();
  });

  it("renders environment overview with env info", () => {
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} environmentProviderInfo={envProviderInfo} />);
    expect(screen.getByText("Environment Overview")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
    // "20.10.0" appears as both current_version and in installed_versions table
    expect(screen.getAllByText("20.10.0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Node Version Manager")).toBeInTheDocument();
  });

  it("shows installed versions count", () => {
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders installed versions table", () => {
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} />);
    expect(screen.getByText("18.19.0")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("renders available versions", () => {
    render(<ProviderEnvironmentTab {...defaultProps} availableVersions={availableVersions} />);
    expect(screen.getByText("22.0.0")).toBeInTheDocument();
  });

  it("shows Installed badge for already-installed versions", () => {
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} availableVersions={availableVersions} />);
    expect(screen.getAllByText("Installed").length).toBeGreaterThan(0);
  });

  it("shows Deprecated badge for deprecated versions", () => {
    render(<ProviderEnvironmentTab {...defaultProps} availableVersions={availableVersions} />);
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
  });

  it("shows no available versions message when empty", () => {
    render(<ProviderEnvironmentTab {...defaultProps} availableVersions={[]} />);
    expect(screen.getByText("No available versions")).toBeInTheDocument();
  });

  it("calls onRefreshEnvironment when refresh button clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} />);
    const refreshBtn = screen.getByText("Refresh").closest("button")!;
    await user.click(refreshBtn);
    expect(defaultProps.onRefreshEnvironment).toHaveBeenCalled();
  });

  it("renders provider description in card", () => {
    render(<ProviderEnvironmentTab {...defaultProps} environmentInfo={envInfo} environmentProviderInfo={envProviderInfo} />);
    expect(screen.getByText("Manages Node.js versions")).toBeInTheDocument();
  });
});
