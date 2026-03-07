import { render, screen } from "@testing-library/react";
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
const mockEnvironmentStoreState = {
  workflowContext: null as
    | {
        envType: string;
        origin?: string;
        returnHref?: string | null;
      }
    | null,
};

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("@/hooks/use-environments", () => ({
  useEnvironments: () => ({
    environments: [],
    detectedVersions: [],
    availableProviders: [],
    loading: false,
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
});
