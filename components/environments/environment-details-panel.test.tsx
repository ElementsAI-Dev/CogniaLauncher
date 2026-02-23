import { render, screen, fireEvent } from "@testing-library/react";
import { EnvironmentDetailsPanel } from "./environment-details-panel";
import { useEnvironmentStore } from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/use-environments";

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: jest.fn(),
}));

jest.mock("@/hooks/use-environments", () => ({
  useEnvironments: jest.fn(),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "environments.details.subtitle": "Managed by {provider}",
        "environments.details.status": "Status",
        "environments.details.currentVersion": "Current Version",
        "environments.details.installedCount": "Installed",
        "environments.details.versions": "versions",
        "environments.details.totalSize": "Total Size",
        "environments.details.provider": "Provider",
        "environments.details.noVersionsInstalled": "No versions installed",
        "environments.details.versionPinning": "Version Pinning",
        "environments.details.versionPinningDesc":
          "Set global and local versions",
        "environments.details.globalVersion": "Global Version",
        "environments.details.globalVersionDesc":
          "Default version for all projects",
        "environments.details.localVersion": "Local Version",
        "environments.details.localVersionDesc":
          "Version for specific projects",
        "environments.details.envVariables": "Environment Variables",
        "environments.details.envVariablesDesc":
          "Configure environment variables",
        "environments.details.varKey": "Key",
        "environments.details.varValue": "Value",
        "environments.details.projectDetection": "Project Detection",
        "environments.details.projectDetectionDesc":
          "Configure version file detection",
        "environments.details.autoSwitch": "Auto Switch",
        "environments.details.autoSwitchDesc": "Automatically switch versions",
        "environments.details.globalVersionSet":
          "Global version set to {version}",
        "environments.details.localVersionSet": "Local version set",
        "environments.details.envVarAdded": "Environment variable added",
        "environments.detected": "Detected",
        "environments.installedVersions": "Installed Versions",
        "environments.currentVersion": "Current Version",
        "environments.selectVersion": "Select Version",
        "environments.projectPath": "Project path",
        "environments.setLocal": "Set Local",
        "environments.setGlobal": "Set as Global",
        "common.close": "Close",
        "common.none": "None",
        "common.add": "Add",
        "common.confirm": "Confirm",
        "common.cancel": "Cancel",
        "common.uninstall": "Uninstall",
      };
      let value = translations[key] || key;
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replaceAll(`{${paramKey}}`, String(paramValue));
        }
      }
      return value;
    },
  }),
}));

const mockUseEnvironmentStore = useEnvironmentStore as unknown as jest.Mock;
const mockUseEnvironments = useEnvironments as unknown as jest.Mock;

describe("EnvironmentDetailsPanel", () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSetGlobal = jest.fn();
  const mockOnSetLocal = jest.fn();
  const mockLoadEnvSettings = jest.fn();
  const mockSaveEnvSettings = jest.fn();

  const defaultEnv = {
    env_type: "Node",
    provider: "fnm",
    provider_id: "fnm",
    available: true,
    current_version: "18.0.0",
    installed_versions: [
      {
        version: "18.0.0",
        install_path: "/usr/local/node/18.0.0",
        size: 50000000,
        is_current: true,
        installed_at: "2024-01-01",
      },
      {
        version: "20.0.0",
        install_path: "/usr/local/node/20.0.0",
        size: 60000000,
        is_current: false,
        installed_at: "2024-02-01",
      },
    ],
  };

  const defaultEnvSettings = {
    autoSwitch: true,
    envVariables: [{ key: "NODE_ENV", value: "development", enabled: true }],
    detectionFiles: [{ fileName: ".nvmrc", enabled: true }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentStore.mockReturnValue({
      getEnvSettings: jest.fn(() => defaultEnvSettings),
    });
    mockUseEnvironments.mockReturnValue({
      loadEnvSettings: mockLoadEnvSettings,
      saveEnvSettings: mockSaveEnvSettings,
    });
    mockOnSetGlobal.mockResolvedValue(undefined);
    mockOnSetLocal.mockResolvedValue(undefined);
  });

  it("returns null when env is null", () => {
    const { container } = render(
      <EnvironmentDetailsPanel
        env={null}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders environment type as title", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("Node")).toBeInTheDocument();
  });

  it("renders provider subtitle", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("Managed by fnm")).toBeInTheDocument();
  });

  it("renders current version in status section", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    // Version appears multiple times in the panel
    expect(screen.getAllByText("18.0.0").length).toBeGreaterThan(0);
  });

  it("renders installed versions count", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("2 versions")).toBeInTheDocument();
  });

  it("renders detected version when provided", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={{
          env_type: "Node",
          version: "18.0.0",
          source: "nvmrc",
          source_path: "/project/.nvmrc",
        }}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText(/Detected.*18\.0\.0/)).toBeInTheDocument();
  });

  it("renders no versions message when empty", () => {
    render(
      <EnvironmentDetailsPanel
        env={{ ...defaultEnv, installed_versions: [] }}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("No versions installed")).toBeInTheDocument();
  });

  it("renders version pinning section", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("Version Pinning")).toBeInTheDocument();
  });

  it("renders environment variables section", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("Environment Variables")).toBeInTheDocument();
  });

  it("renders project detection section", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("Project Detection")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    // Multiple Close elements may exist (button + sr-only)
    const closeElements = screen.getAllByText("Close");
    expect(closeElements.length).toBeGreaterThan(0);
  });

  it("calls onOpenChange when close button is clicked", async () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );

    // Use getAllByText since there may be multiple Close buttons/elements
    const closeButtons = screen.getAllByText("Close");
    fireEvent.click(closeButtons[0]);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("loads env settings when panel opens", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(mockLoadEnvSettings).toHaveBeenCalledWith("Node");
  });

  it("renders existing environment variables", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText("NODE_ENV")).toBeInTheDocument();
  });

  it("renders detection files", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );
    expect(screen.getByText(".nvmrc")).toBeInTheDocument();
  });

  it("calls onSetGlobal when version is selected", async () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );

    // Find set global button for non-current version
    const setGlobalButton = screen.getByText("Set as Global");
    fireEvent.click(setGlobalButton);

    expect(mockOnSetGlobal).toHaveBeenCalled();
  });

  it("renders set global button", () => {
    render(
      <EnvironmentDetailsPanel
        env={defaultEnv}
        detectedVersion={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSetGlobal={mockOnSetGlobal}
        onSetLocal={mockOnSetLocal}
      />,
    );

    expect(screen.getByText("Set as Global")).toBeInTheDocument();
  });
});
