import { render, screen, waitFor } from "@testing-library/react";
import { EnvironmentDetectionStep } from "./environment-detection-step";

const mockSetEnvironments = jest.fn();
const mockSetAvailableProviders = jest.fn();
const mockDetectSystemEnvironments = jest.fn().mockResolvedValue([]);
const mockBuildOnboardingDetections = jest.fn((): Record<string, unknown>[] => []);
const mockIsTauri = jest.fn(() => false);
const mockEnvList = jest.fn().mockResolvedValue([]);
const mockEnvListProviders = jest.fn().mockResolvedValue([]);
jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      environments: [],
      availableProviders: [],
      setEnvironments: mockSetEnvironments,
      setAvailableProviders: mockSetAvailableProviders,
    }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
  envList: mockEnvList,
  envListProviders: mockEnvListProviders,
}));

jest.mock("@/hooks/use-environment-detection", () => ({
  useEnvironmentDetection: () => ({
    detectSystemEnvironments: mockDetectSystemEnvironments,
    buildOnboardingDetections: mockBuildOnboardingDetections,
  }),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.envDetectionTitle": "Environment Detection",
    "onboarding.envDetectionDesc": "Detecting installed tools",
    "onboarding.envDetecting": "Detecting...",
    "onboarding.envDetectedCount": "Detected environments",
    "onboarding.envAvailable": "Available",
    "onboarding.envNotFound": "Not Found",
    "onboarding.envSourceLabel": "Source: {source}",
    "onboarding.envScopeSystem": "System",
    "onboarding.envScopeManaged": "Managed",
    "onboarding.envRescan": "Rescan",
    "onboarding.envWebModeNote": "Running in web mode",
  };
  return translations[key] || key;
};

describe("EnvironmentDetectionStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockEnvList.mockResolvedValue([]);
    mockEnvListProviders.mockResolvedValue([]);
    mockDetectSystemEnvironments.mockResolvedValue([]);
    mockBuildOnboardingDetections.mockReturnValue([]);
  });

  it("renders title", () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    expect(screen.getByText("Environment Detection")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    expect(screen.getByText("Detecting installed tools")).toBeInTheDocument();
  });

  it("shows web mode note in non-Tauri environment", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    await waitFor(() => {
      expect(screen.getByText("Running in web mode")).toBeInTheDocument();
    });
  });

  it("does not show detected count in web mode", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    await waitFor(() => {
      expect(screen.queryByText("Detected environments")).not.toBeInTheDocument();
    });
  });

  it("does not show rescan button in web mode", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    await waitFor(() => {
      expect(screen.queryByText("Rescan")).not.toBeInTheDocument();
    });
  });

  it("does not render simulated web-mode environment entries", async () => {
    render(<EnvironmentDetectionStep t={mockT} />);
    await waitFor(() => {
      expect(screen.queryByText("Node.js")).not.toBeInTheDocument();
      expect(screen.queryByText("Python")).not.toBeInTheDocument();
      expect(screen.queryByText("Rust")).not.toBeInTheDocument();
      expect(screen.queryByText("Not Found")).not.toBeInTheDocument();
    });
  });

  it("renders detection source and scope in desktop mode", async () => {
    mockIsTauri.mockReturnValue(true);
    mockEnvList.mockResolvedValue([
      {
        env_type: "node",
        provider_id: "fnm",
        provider: "fnm",
        current_version: "20.10.0",
        installed_versions: [],
        available: true,
        total_size: 0,
        version_count: 0,
      },
    ]);
    mockEnvListProviders.mockResolvedValue([
      {
        id: "fnm",
        display_name: "fnm",
        env_type: "node",
        description: "",
      },
    ]);
    mockBuildOnboardingDetections.mockReturnValue([
      {
        name: "Node.js",
        envType: "node",
        version: "20.10.0",
        available: true,
        source: "node --version",
        sourcePath: "/usr/bin/node",
        scope: "system" as const,
      },
    ]);

    render(<EnvironmentDetectionStep t={mockT} />);

    await waitFor(() => {
      expect(screen.getByText("Node.js")).toBeInTheDocument();
      expect(screen.getByText("20.10.0")).toBeInTheDocument();
      expect(screen.getByText("Source: {source}")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });
});
