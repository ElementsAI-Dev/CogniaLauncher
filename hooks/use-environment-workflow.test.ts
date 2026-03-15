import { act, renderHook } from "@testing-library/react";
import { useEnvironmentWorkflow } from "./use-environment-workflow";

const mockEnvList = jest.fn();
const mockEnvListProviders = jest.fn();
const mockEnvDetectAll = jest.fn();
const mockIsTauri = jest.fn(() => true);

const mockStoreState = {
  availableProviders: [{ id: "fnm", env_type: "node" }],
  workflowContext: null as {
    envType: string;
    origin: string;
    returnHref?: string | null;
    projectPath?: string | null;
    providerId?: string | null;
    updatedAt: number;
  } | null,
};

const mockSetWorkflowContext = jest.fn((context) => {
  mockStoreState.workflowContext = context;
});
const mockSetWorkflowAction = jest.fn();
const mockGetSelectedProvider = jest.fn((envType: string, fallbackProviderId?: string | null) =>
  fallbackProviderId ?? envType,
);
const mockSetEnvironments = jest.fn();
const mockSetAvailableProviders = jest.fn();
const mockSetDetectedVersions = jest.fn();
const mockSetLastEnvScanTimestamp = jest.fn();

jest.mock("@/lib/tauri", () => ({
  isTauri: (...args: Parameters<typeof mockIsTauri>) => mockIsTauri(...args),
  envList: (...args: Parameters<typeof mockEnvList>) => mockEnvList(...args),
  envListProviders: (...args: Parameters<typeof mockEnvListProviders>) =>
    mockEnvListProviders(...args),
  envDetectAll: (...args: Parameters<typeof mockEnvDetectAll>) => mockEnvDetectAll(...args),
}));

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: Object.assign(
    jest.fn((selector?: (state: Record<string, unknown>) => unknown) => {
      const fullState = {
        availableProviders: mockStoreState.availableProviders,
        workflowContext: mockStoreState.workflowContext,
        setWorkflowContext: mockSetWorkflowContext,
        setWorkflowAction: mockSetWorkflowAction,
        getSelectedProvider: mockGetSelectedProvider,
        setEnvironments: mockSetEnvironments,
        setAvailableProviders: mockSetAvailableProviders,
        setDetectedVersions: mockSetDetectedVersions,
        setLastEnvScanTimestamp: mockSetLastEnvScanTimestamp,
      };

      return typeof selector === "function" ? selector(fullState) : fullState;
    }),
    {
      getState: () => ({
        availableProviders: mockStoreState.availableProviders,
        workflowContext: mockStoreState.workflowContext,
        setWorkflowContext: mockSetWorkflowContext,
        setWorkflowAction: mockSetWorkflowAction,
        getSelectedProvider: mockGetSelectedProvider,
        setEnvironments: mockSetEnvironments,
        setAvailableProviders: mockSetAvailableProviders,
        setDetectedVersions: mockSetDetectedVersions,
        setLastEnvScanTimestamp: mockSetLastEnvScanTimestamp,
      }),
    },
  ),
}));

describe("useEnvironmentWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockStoreState.availableProviders = [{ id: "fnm", env_type: "node" }];
    mockStoreState.workflowContext = null;
    mockEnvList.mockResolvedValue([]);
    mockEnvListProviders.mockResolvedValue(mockStoreState.availableProviders);
    mockEnvDetectAll.mockResolvedValue([]);
  });

  it("syncs workflow context using the logical environment type", () => {
    const { result } = renderHook(() => useEnvironmentWorkflow());

    act(() => {
      result.current.syncWorkflowContext("fnm", {
        origin: "detail",
        projectPath: "/workspace/app",
        providerId: "fnm",
      });
    });

    expect(mockSetWorkflowContext).toHaveBeenCalledWith(
      expect.objectContaining({
        envType: "node",
        origin: "detail",
        projectPath: "/workspace/app",
        providerId: "fnm",
      }),
    );
  });

  it("creates a blocked workflow action when a project path is required but missing", () => {
    const { result } = renderHook(() => useEnvironmentWorkflow());

    let resolvedPath: string | null = null;
    act(() => {
      resolvedPath = result.current.requireProjectPath({
        envType: "node",
        action: "setLocal",
        providerId: "fnm",
        projectPath: null,
        reason: "Choose a project path before setting a local version.",
      });
    });

    expect(resolvedPath).toBeNull();
    expect(mockSetWorkflowAction).toHaveBeenCalledWith(
      expect.objectContaining({
        envType: "node",
        action: "setLocal",
        status: "blocked",
        providerId: "fnm",
        error: "Choose a project path before setting a local version.",
      }),
    );
  });

  it("reconciles environment, provider, and detection state after a mutation", async () => {
    const envs = [{ env_type: "node", provider_id: "fnm" }];
    const providers = [{ id: "fnm", env_type: "node" }];
    const detected = [{ env_type: "node", version: "20.0.0", source: ".nvmrc" }];
    mockEnvList.mockResolvedValue(envs);
    mockEnvListProviders.mockResolvedValue(providers);
    mockEnvDetectAll.mockResolvedValue(detected);

    const { result } = renderHook(() => useEnvironmentWorkflow());

    await act(async () => {
      await result.current.reconcileEnvironmentWorkflow({
        projectPath: "/workspace/app",
        refreshProviders: true,
      });
    });

    expect(mockEnvList).toHaveBeenCalledWith(true);
    expect(mockEnvListProviders).toHaveBeenCalledWith(true);
    expect(mockEnvDetectAll).toHaveBeenCalledWith("/workspace/app");
    expect(mockSetEnvironments).toHaveBeenCalledWith(envs);
    expect(mockSetAvailableProviders).toHaveBeenCalledWith(providers);
    expect(mockSetDetectedVersions).toHaveBeenCalledWith(detected);
  });
});
