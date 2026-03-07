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
  envList: (...args: Parameters<typeof mockEnvList>) => mockEnvList(...args),
  envListProviders: (...args: Parameters<typeof mockEnvListProviders>) =>
    mockEnvListProviders(...args),
}));

jest.mock("@/hooks/use-environment-detection", () => ({
  useEnvironmentDetection: () => ({
    detectSystemEnvironments: mockDetectSystemEnvironments,
    buildOnboardingDetections: mockBuildOnboardingDetections,
    systemDetectError: null,
  }),
}));

const mockT = (key: string, params?: Record<string, string | number>) => {
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
    "onboarding.envDetectionError": "Detection failed: {message}",
    "onboarding.envDetailedPurpose": "Review existing runtimes before you change anything.",
    "onboarding.envDetailedRecommendation": "Use source and scope details to plan your next step.",
  };
  const template = translations[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(params?.[token] ?? `{${token}}`));
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
      expect(screen.getByText("Source: node --version")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  it("shows system detection failure feedback while keeping remaining detections visible", async () => {
    mockIsTauri.mockReturnValue(true);
    mockDetectSystemEnvironments.mockRejectedValue(new Error("Permission denied"));
    mockEnvList.mockResolvedValue([
      {
        env_type: "python",
        provider_id: "pyenv",
        provider: "pyenv",
        current_version: "3.12.1",
        installed_versions: [],
        available: true,
        total_size: 0,
        version_count: 0,
      },
    ]);
    mockEnvListProviders.mockResolvedValue([]);
    mockBuildOnboardingDetections.mockReturnValue([
      {
        name: "Python",
        envType: "python",
        version: "3.12.1",
        available: true,
        scope: "managed" as const,
      },
    ]);

    render(<EnvironmentDetectionStep t={mockT} />);

    await waitFor(() => {
      expect(screen.getByText("Detection failed: Permission denied")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("Managed")).toBeInTheDocument();
      expect(screen.getByText("Rescan")).toBeInTheDocument();
    });
  });

  it("shows extra onboarding guidance in detailed mode", async () => {
    render(<EnvironmentDetectionStep t={mockT} mode="detailed" />);

    await waitFor(() => {
      expect(screen.getByText("Review existing runtimes before you change anything.")).toBeInTheDocument();
      expect(screen.getByText("Use source and scope details to plan your next step.")).toBeInTheDocument();
    });
  });
});
