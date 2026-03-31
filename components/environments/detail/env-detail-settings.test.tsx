import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailSettings } from "./env-detail-settings";

const mockLoadEnvSettings = jest.fn();
const mockSaveEnvSettings = jest.fn();
const mockDetectVersions = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockGetEnvSettings = jest.fn();

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/environments/use-environments", () => ({
  useEnvironments: () => ({
    loadEnvSettings: (...args: Parameters<typeof mockLoadEnvSettings>) => mockLoadEnvSettings(...args),
    saveEnvSettings: (...args: Parameters<typeof mockSaveEnvSettings>) => mockSaveEnvSettings(...args),
    detectVersions: (...args: Parameters<typeof mockDetectVersions>) => mockDetectVersions(...args),
  }),
}));

jest.mock("@/hooks/environments/use-auto-version", () => ({
  useProjectPath: () => ({ projectPath: "/workspace/app" }),
}));

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: () => ({
    getEnvSettings: mockGetEnvSettings,
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: (...args: Parameters<typeof mockToastSuccess>) => mockToastSuccess(...args),
    error: (...args: Parameters<typeof mockToastError>) => mockToastError(...args),
  },
}));

jest.mock("@/components/environments/shared/auto-switch-toggle", () => ({
  AutoSwitchToggle: ({
    enabled,
    onToggle,
  }: {
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  }) => (
    <button type="button" data-testid="toggle-auto-switch" onClick={() => void onToggle(!enabled)}>
      toggle-auto-switch
    </button>
  ),
}));

jest.mock("@/components/environments/shared/env-vars-editor", () => ({
  EnvVarsEditor: ({
    onAdd,
  }: {
    onAdd: (variable: { key: string; value: string; enabled: boolean }) => Promise<void>;
  }) => (
    <button
      type="button"
      data-testid="add-env-var"
      onClick={() => void onAdd({ key: "PATH", value: "/tool/bin", enabled: true })}
    >
      add-env-var
    </button>
  ),
}));

jest.mock("@/components/environments/shared/detection-files-list", () => ({
  DetectionFilesList: ({
    files,
    onToggle,
  }: {
    files: Array<{ fileName: string; enabled: boolean }>;
    onToggle: (fileName: string, enabled: boolean) => Promise<void>;
  }) => (
    <button
      type="button"
      data-testid="toggle-detection-file"
      onClick={() => void onToggle(files[0]?.fileName ?? ".nvmrc", !(files[0]?.enabled ?? false))}
    >
      toggle-detection-file
    </button>
  ),
}));

const defaultSettings = {
  autoSwitch: false,
  envVariables: [{ key: "NODE_ENV", value: "development", enabled: true }],
  detectionFiles: [
    { fileName: ".nvmrc", enabled: true },
    { fileName: ".node-version", enabled: false },
  ],
};

const defaultProps = {
  envType: "node",
  t: (key: string) => key,
};

describe("EnvDetailSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnvSettings.mockReturnValue(defaultSettings);
    mockLoadEnvSettings.mockResolvedValue(null);
    mockSaveEnvSettings.mockResolvedValue(undefined);
    mockDetectVersions.mockResolvedValue([]);
  });

  it("loads environment settings on mount", async () => {
    render(<EnvDetailSettings {...defaultProps} />);

    await waitFor(() => {
      expect(mockLoadEnvSettings).toHaveBeenCalledWith("node");
    });
  });

  it("refreshes detected versions after saving auto-switch changes", async () => {
    const user = userEvent.setup();
    render(<EnvDetailSettings {...defaultProps} />);

    await user.click(screen.getByTestId("toggle-auto-switch"));

    expect(mockSaveEnvSettings).toHaveBeenCalledWith("node", {
      ...defaultSettings,
      autoSwitch: true,
    });
    expect(mockDetectVersions).toHaveBeenCalledWith("/workspace/app");
  });

  it("persists newly added environment variables and shows success feedback", async () => {
    const user = userEvent.setup();
    render(<EnvDetailSettings {...defaultProps} />);

    await user.click(screen.getByTestId("add-env-var"));

    expect(mockSaveEnvSettings).toHaveBeenCalledWith("node", {
      ...defaultSettings,
      envVariables: [
        ...defaultSettings.envVariables,
        { key: "PATH", value: "/tool/bin", enabled: true },
      ],
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("environments.details.envVarAdded");
    expect(mockDetectVersions).toHaveBeenCalledWith("/workspace/app");
  });

  it("shows error feedback and skips refresh when saving settings fails", async () => {
    const user = userEvent.setup();
    mockSaveEnvSettings.mockRejectedValueOnce(new Error("save failed"));
    render(<EnvDetailSettings {...defaultProps} />);

    await user.click(screen.getByTestId("toggle-detection-file"));

    expect(mockToastError).toHaveBeenCalledWith("Error: save failed");
    expect(mockDetectVersions).not.toHaveBeenCalled();
  });
});
