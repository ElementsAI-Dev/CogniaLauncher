import { render, screen } from "@testing-library/react";
import { EnvDetailPageClient } from "./env-detail-page";

const mockFetchEnvironments = jest.fn().mockResolvedValue(undefined);
const mockFetchProviders = jest.fn().mockResolvedValue(undefined);
const mockDetectVersions = jest.fn().mockResolvedValue(undefined);
const mockIsTauri = jest.fn(() => false);
const mockGetProjectDetectedForEnv = jest.fn(() => null);

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
  useEnvironmentStore: () => ({
    versionBrowserOpen: false,
    closeVersionBrowser: jest.fn(),
    openVersionBrowser: jest.fn(),
  }),
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
