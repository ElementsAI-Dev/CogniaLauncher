import { render, screen } from "@testing-library/react";
import { ProviderOverviewTab } from "./provider-overview-tab";
import type { ProviderInfo, PackageManagerHealthResult, EnvironmentProviderInfo } from "@/types/tauri";

jest.mock("../provider-icon", () => ({
  PlatformIcon: ({ platform }: { platform: string }) => (
    <span data-testid={`platform-icon-${platform}`} />
  ),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "providerDetail.quickStats": "providerDetail.quickStats",
        "providerDetail.noSystemInfo": "providerDetail.noSystemInfo",
        "providers.capabilities": "providers.capabilities",
        "providers.platforms": "providers.platforms",
        "providers.priority": "providers.priority",
      };
      return translations[key] ?? key;
    },
  }),
}));

const baseProvider: ProviderInfo = {
  id: "npm",
  display_name: "npm",
  capabilities: ["install", "uninstall", "search"],
  platforms: ["windows", "linux", "macos"],
  priority: 100,
  is_environment_provider: false,
  enabled: true,
};

describe("ProviderOverviewTab", () => {
  const defaultProps = {
    provider: baseProvider,
    isAvailable: true as boolean | null,
    healthResult: null as PackageManagerHealthResult | null,
    environmentProviderInfo: null as EnvironmentProviderInfo | null,
    installedCount: 0,
    updatesCount: 0,
    isSavingPriority: false,
    onPrioritySave: jest.fn(),
  };

  it("renders without crashing", () => {
    const { container } = render(<ProviderOverviewTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("renders quick stats with installed and update counts", () => {
    render(<ProviderOverviewTab {...defaultProps} installedCount={15} updatesCount={3} />);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.quickStats")).toBeInTheDocument();
  });

  it("renders provider priority in stats", () => {
    render(<ProviderOverviewTab {...defaultProps} />);
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("shows check icon when available", () => {
    render(<ProviderOverviewTab {...defaultProps} isAvailable={true} />);
    expect(screen.getByText("providerDetail.status")).toBeInTheDocument();
  });

  it("shows dash when availability is null", () => {
    render(<ProviderOverviewTab {...defaultProps} isAvailable={null} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders system info with version and path from health result", () => {
    const healthResult: PackageManagerHealthResult = {
      provider_id: "npm",
      display_name: "npm",
      status: "healthy",
      version: "10.2.0",
      executable_path: "/usr/bin/npm",
      issues: [],
      install_instructions: null,
      checked_at: new Date().toISOString(),
    };
    render(<ProviderOverviewTab {...defaultProps} healthResult={healthResult} />);
    expect(screen.getByText("10.2.0")).toBeInTheDocument();
    expect(screen.getByText("/usr/bin/npm")).toBeInTheDocument();
  });

  it("shows no system info message when health result is null", () => {
    render(<ProviderOverviewTab {...defaultProps} healthResult={null} />);
    expect(screen.getByText("providerDetail.noSystemInfo")).toBeInTheDocument();
  });

  it("shows install instructions when unavailable and health result has instructions", () => {
    const healthResult: PackageManagerHealthResult = {
      provider_id: "npm",
      display_name: "npm",
      status: "error",
      version: null,
      executable_path: null,
      issues: [],
      install_instructions: "npm install -g npm",
      checked_at: new Date().toISOString(),
    };
    render(<ProviderOverviewTab {...defaultProps} isAvailable={false} healthResult={healthResult} />);
    expect(screen.getByText("npm install -g npm")).toBeInTheDocument();
  });

  it("renders capabilities as badges", () => {
    render(<ProviderOverviewTab {...defaultProps} />);
    expect(screen.getByText("providers.capabilities")).toBeInTheDocument();
  });

  it("renders platform icons", () => {
    render(<ProviderOverviewTab {...defaultProps} />);
    expect(screen.getByText("providers.platforms")).toBeInTheDocument();
    expect(screen.getByText("windows")).toBeInTheDocument();
    expect(screen.getByText("linux")).toBeInTheDocument();
    expect(screen.getByText("macos")).toBeInTheDocument();
  });

  it("does not render environment info when null", () => {
    render(<ProviderOverviewTab {...defaultProps} environmentProviderInfo={null} />);
    expect(screen.queryByText("providerDetail.environmentInfo")).not.toBeInTheDocument();
  });

  it("renders environment info when provided", () => {
    const envInfo: EnvironmentProviderInfo = {
      id: "nvm",
      display_name: "Node Version Manager",
      env_type: "node",
      description: "Manages Node.js versions",
    };
    render(<ProviderOverviewTab {...defaultProps} environmentProviderInfo={envInfo} />);
    expect(screen.getByText("providerDetail.environmentInfo")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("Manages Node.js versions")).toBeInTheDocument();
  });
});
