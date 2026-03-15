import { render, screen, waitFor } from "@testing-library/react";
import { EnvDetailPageClient } from "./env-detail-page";

const mockFetchEnvironments = jest.fn().mockResolvedValue(undefined);
const mockFetchProviders = jest.fn().mockResolvedValue(undefined);
const mockDetectVersions = jest.fn().mockResolvedValue(undefined);
const mockIsTauri = jest.fn(() => false);
const mockGetProjectDetectedForEnv = jest.fn(() => null);
const mockCloseVersionBrowser = jest.fn();
const mockOpenVersionBrowser = jest.fn();
const mockGetSelectedProvider = jest.fn((envType: string, fallbackProviderId?: string | null) =>
  fallbackProviderId ?? envType,
);
const mockSetSelectedProvider = jest.fn();
const mockSetWorkflowContext = jest.fn();
const mockSetWorkflowAction = jest.fn();
const mockSyncWorkflowContext = jest.fn();
const mockEnvironmentStoreState = {
  workflowContext: null as
    | {
        envType: string;
        origin?: string;
        returnHref?: string | null;
      }
    | null,
};
const mockUseEnvironmentsState = {
  environments: [] as Array<{
    env_type: string;
    provider_id: string;
    provider: string;
    current_version: string | null;
    installed_versions: unknown[];
    available: boolean;
  }>,
  detectedVersions: [] as unknown[],
  availableProviders: [] as Array<{
    id: string;
    display_name: string;
    env_type: string;
  }>,
  loading: false,
};

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("@/hooks/use-environments", () => ({
  useEnvironments: () => ({
    ...mockUseEnvironmentsState,
    fetchEnvironments: mockFetchEnvironments,
    installVersion: jest.fn(),
    uninstallVersion: jest.fn(),
    setGlobalVersion: jest.fn(),
    setLocalVersion: jest.fn(),
    detectVersions: mockDetectVersions,
    fetchProviders: mockFetchProviders,
    cleanupVersions: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-environment-detection", () => ({
  useEnvironmentDetection: () => ({
    getProjectDetectedForEnv: mockGetProjectDetectedForEnv,
  }),
}));

jest.mock("@/hooks/use-environment-workflow", () => ({
  useEnvironmentWorkflow: () => ({
    syncWorkflowContext: mockSyncWorkflowContext,
    setWorkflowActionState: jest.fn(),
    requireProjectPath: jest.fn(),
    requirePathConfigured: jest.fn(),
    reconcileEnvironmentWorkflow: jest.fn(),
  }),
}));

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: Object.assign(
    () => ({
      versionBrowserOpen: false,
      closeVersionBrowser: mockCloseVersionBrowser,
      openVersionBrowser: mockOpenVersionBrowser,
      getSelectedProvider: mockGetSelectedProvider,
      setSelectedProvider: mockSetSelectedProvider,
      setWorkflowContext: mockSetWorkflowContext,
      setWorkflowAction: mockSetWorkflowAction,
    }),
    {
      getState: () => mockEnvironmentStoreState,
    },
  ),
  getLogicalEnvType: (value: string) => value,
}));

jest.mock("@/components/environments/detail", () => ({
  EnvDetailHeader: () => <div data-testid="env-detail-header" />,
  EnvDetailOverview: () => <div data-testid="env-detail-overview" />,
  EnvDetailVersions: () => <div data-testid="env-detail-versions" />,
  EnvDetailPackages: () => <div data-testid="env-detail-packages" />,
  EnvDetailSettings: () => <div data-testid="env-detail-settings" />,
  EnvDetailShell: () => <div data-testid="env-detail-shell" />,
  EnvDetailShims: () => <div data-testid="env-detail-shims" />,
  RustToolchainPanel: () => <div data-testid="rust-toolchain-panel" />,
  CondaEnvironmentPanel: () => <div data-testid="conda-environment-panel" />,
  GoToolsPanel: () => <div data-testid="go-tools-panel" />,
}));

jest.mock("@/components/environments/version-browser-panel", () => ({
  VersionBrowserPanel: () => null,
}));

jest.mock("@/components/environments/installation-progress-dialog", () => ({
  InstallationProgressDialog: () => null,
}));

jest.mock("@/components/environments/environment-workflow-banner", () => ({
  EnvironmentWorkflowBanner: () => <div data-testid="workflow-banner" />,
}));

jest.mock("@/hooks/use-auto-version", () => ({
  useAutoVersionSwitch: jest.fn(),
  useProjectPath: () => ({ projectPath: "/test/project" }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.desktopOnly": "Desktop App Required",
        "environments.desktopOnlyDescription":
          "This feature is available in desktop mode only",
      };
      return translations[key] || key;
    },
  }),
}));

describe("EnvDetailPageClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockEnvironmentStoreState.workflowContext = null;
    mockUseEnvironmentsState.environments = [];
    mockUseEnvironmentsState.availableProviders = [];
    mockUseEnvironmentsState.detectedVersions = [];
  });

  it("renders desktop-only fallback in web mode and skips fetching", () => {
    render(<EnvDetailPageClient envType="node" />);

    expect(screen.getByText("Desktop App Required")).toBeInTheDocument();
    expect(
      screen.getByText("This feature is available in desktop mode only"),
    ).toBeInTheDocument();
    expect(mockFetchEnvironments).not.toHaveBeenCalled();
    expect(mockFetchProviders).not.toHaveBeenCalled();
    expect(mockDetectVersions).not.toHaveBeenCalled();
  });

  it("syncs shared workflow context in desktop mode", async () => {
    mockIsTauri.mockReturnValue(true);
    mockUseEnvironmentsState.environments = [
      {
        env_type: "node",
        provider_id: "fnm",
        provider: "fnm",
        current_version: "20.0.0",
        installed_versions: [],
        available: true,
      },
    ];
    mockUseEnvironmentsState.availableProviders = [
      { id: "fnm", display_name: "fnm", env_type: "node" },
    ];

    render(<EnvDetailPageClient envType="node" />);

    await waitFor(() => {
      expect(mockFetchEnvironments).toHaveBeenCalled();
      expect(mockFetchProviders).toHaveBeenCalled();
      expect(mockDetectVersions).toHaveBeenCalledWith("/test/project");
      expect(mockSyncWorkflowContext).toHaveBeenCalledWith(
        "node",
        expect.objectContaining({
          returnHref: "/environments",
          projectPath: "/test/project",
          providerId: "fnm",
        }),
      );
    });
  });
});
