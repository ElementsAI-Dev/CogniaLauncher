import { renderHook, act } from '@testing-library/react';
import { useEnvironments } from './use-environments';

// Mock Tauri APIs
const mockEnvList = jest.fn();
const mockEnvInstall = jest.fn();
const mockEnvUninstall = jest.fn();
const mockEnvUseGlobal = jest.fn();
const mockEnvUseLocal = jest.fn();
const mockEnvGet = jest.fn();
const mockEnvAvailableVersions = jest.fn();
const mockEnvListProviders = jest.fn();
const mockEnvDetectAll = jest.fn();
const mockEnvLoadSettings = jest.fn();
const mockEnvSaveSettings = jest.fn();
const mockEnvInstallCancel = jest.fn();
const mockEnvVerifyInstall = jest.fn();
const mockEnvInstalledVersions = jest.fn();
const mockEnvCurrentVersion = jest.fn();
const mockEnvResolveAlias = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  envList: (...args: unknown[]) => mockEnvList(...args),
  envInstall: (...args: unknown[]) => mockEnvInstall(...args),
  envUninstall: (...args: unknown[]) => mockEnvUninstall(...args),
  envUseGlobal: (...args: unknown[]) => mockEnvUseGlobal(...args),
  envUseLocal: (...args: unknown[]) => mockEnvUseLocal(...args),
  envGet: (...args: unknown[]) => mockEnvGet(...args),
  envAvailableVersions: (...args: unknown[]) => mockEnvAvailableVersions(...args),
  envListProviders: (...args: unknown[]) => mockEnvListProviders(...args),
  envDetectAll: (...args: unknown[]) => mockEnvDetectAll(...args),
  envLoadSettings: (...args: unknown[]) => mockEnvLoadSettings(...args),
  envSaveSettings: (...args: unknown[]) => mockEnvSaveSettings(...args),
  envInstallCancel: (...args: unknown[]) => mockEnvInstallCancel(...args),
  envVerifyInstall: (...args: unknown[]) => mockEnvVerifyInstall(...args),
  envInstalledVersions: (...args: unknown[]) => mockEnvInstalledVersions(...args),
  envCurrentVersion: (...args: unknown[]) => mockEnvCurrentVersion(...args),
  envResolveAlias: (...args: unknown[]) => mockEnvResolveAlias(...args),
  listenEnvInstallProgress: jest.fn(() => Promise.resolve(() => {})),
}));

// Mock environment store - use actual Zustand store so selectors work correctly
const mockStoreActions = {
  setLoading: jest.fn(),
  setError: jest.fn(),
  setEnvironments: jest.fn(),
  setEnvSettings: jest.fn(),
  updateEnvironment: jest.fn(),
  setDetectedVersions: jest.fn(),
  setAvailableVersions: jest.fn(),
  setAvailableProviders: jest.fn(),
  setCurrentInstallation: jest.fn(),
  openProgressDialog: jest.fn(),
  closeProgressDialog: jest.fn(),
  updateInstallationProgress: jest.fn(),
};

const mockStoreState = {
  environments: [],
  availableProviders: [],
  currentInstallation: null as { envType: string; version: string } | null,
  loading: false,
  error: null,
  selectedEnv: null,
  detectedVersions: [],
  availableVersions: {},
  envSettings: {},
  selectedVersions: [],
  addDialogOpen: false,
  progressDialogOpen: false,
  installationProgress: null,
  versionBrowserOpen: false,
  versionBrowserEnvType: null,
  detailsPanelOpen: false,
  detailsPanelEnvType: null,
  searchQuery: '',
  statusFilter: 'all' as const,
  sortBy: 'name' as const,
};

// The hook uses both selector calls and a full store call
// We need to handle both patterns
jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: Object.assign(
    jest.fn((selector?: (state: Record<string, unknown>) => unknown) => {
      const fullState = { ...mockStoreState, ...mockStoreActions };
      if (typeof selector === 'function') {
        return selector(fullState);
      }
      return fullState;
    }),
    { getState: () => ({ ...mockStoreState, ...mockStoreActions }) },
  ),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => err instanceof Error ? err.message : String(err),
}));

jest.mock('@/lib/utils', () => ({
  formatSize: (n: number) => `${n}B`,
  formatSpeed: (n: number) => `${n}B/s`,
}));

describe('useEnvironments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.environments = [];
    mockStoreState.availableProviders = [];
    mockStoreState.currentInstallation = null;
  });

  it('should return all expected methods and state', () => {
    const { result } = renderHook(() => useEnvironments());

    expect(result.current).toHaveProperty('fetchEnvironments');
    expect(result.current).toHaveProperty('installVersion');
    expect(result.current).toHaveProperty('uninstallVersion');
    expect(result.current).toHaveProperty('setGlobalVersion');
    expect(result.current).toHaveProperty('setLocalVersion');
    expect(result.current).toHaveProperty('detectVersions');
    expect(result.current).toHaveProperty('fetchAvailableVersions');
    expect(result.current).toHaveProperty('fetchProviders');
    expect(result.current).toHaveProperty('cancelInstallation');
    expect(result.current).toHaveProperty('verifyInstall');
    expect(result.current).toHaveProperty('getInstalledVersions');
    expect(result.current).toHaveProperty('getCurrentVersion');
    expect(result.current).toHaveProperty('loadEnvSettings');
    expect(result.current).toHaveProperty('saveEnvSettings');
  });

  it('should fetch environments', async () => {
    const envs = [
      { env_type: 'python', provider_id: 'pyenv', provider: 'pyenv', current_version: '3.11.0', installed_versions: [], available: true },
      { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.0.0', installed_versions: [], available: true },
    ];
    mockEnvList.mockResolvedValue(envs);
    mockEnvLoadSettings.mockResolvedValue(null);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.fetchEnvironments();
    });

    expect(mockEnvList).toHaveBeenCalled();
    expect(mockStoreActions.setEnvironments).toHaveBeenCalledWith(envs);
    expect(mockStoreActions.setLoading).toHaveBeenCalledWith(true);
  });

  it('should handle fetch environments error', async () => {
    mockEnvList.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.fetchEnvironments();
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith('Network error');
    expect(mockStoreActions.setLoading).toHaveBeenCalledWith(false);
  });

  it('should uninstall version', async () => {
    const updatedEnv = { env_type: 'python', provider_id: 'pyenv', provider: 'pyenv', current_version: '3.11.0', installed_versions: [], available: true };
    mockEnvUninstall.mockResolvedValue(undefined);
    mockEnvGet.mockResolvedValue(updatedEnv);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.uninstallVersion('python', '3.10.0');
    });

    expect(mockEnvUninstall).toHaveBeenCalledWith('python', '3.10.0');
    expect(mockEnvGet).toHaveBeenCalledWith('python');
    expect(mockStoreActions.updateEnvironment).toHaveBeenCalledWith(updatedEnv);
  });

  it('should set global version', async () => {
    const updatedEnv = { env_type: 'python', provider_id: 'pyenv', provider: 'pyenv', current_version: '3.11.0', installed_versions: [], available: true };
    mockEnvUseGlobal.mockResolvedValue(undefined);
    mockEnvGet.mockResolvedValue(updatedEnv);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.setGlobalVersion('python', '3.11.0');
    });

    expect(mockEnvUseGlobal).toHaveBeenCalledWith('python', '3.11.0');
    expect(mockEnvGet).toHaveBeenCalledWith('python');
    expect(mockStoreActions.updateEnvironment).toHaveBeenCalledWith(updatedEnv);
  });

  it('should set local version', async () => {
    mockEnvUseLocal.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.setLocalVersion('python', '3.11.0', '/project/path');
    });

    expect(mockEnvUseLocal).toHaveBeenCalledWith('python', '3.11.0', '/project/path');
  });

  it('should detect versions', async () => {
    const detected = [
      { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: '/project/.nvmrc' },
    ];
    mockEnvDetectAll.mockResolvedValue(detected);
    const { result } = renderHook(() => useEnvironments());

    let returnedDetected;
    await act(async () => {
      returnedDetected = await result.current.detectVersions('/project');
    });

    expect(mockEnvDetectAll).toHaveBeenCalledWith('/project');
    expect(mockStoreActions.setDetectedVersions).toHaveBeenCalledWith(detected);
    expect(returnedDetected).toEqual(detected);
  });

  it('should fetch available versions', async () => {
    const versions = [
      { version: '20.10.0', release_date: '2023-11-22', deprecated: false, yanked: false },
    ];
    mockEnvAvailableVersions.mockResolvedValue(versions);
    const { result } = renderHook(() => useEnvironments());

    let returnedVersions;
    await act(async () => {
      returnedVersions = await result.current.fetchAvailableVersions('node');
    });

    expect(mockEnvAvailableVersions).toHaveBeenCalledWith('node');
    expect(mockStoreActions.setAvailableVersions).toHaveBeenCalledWith('node', versions);
    expect(returnedVersions).toEqual(versions);
  });

  it('should fetch providers', async () => {
    const providers = [
      { id: 'fnm', display_name: 'fnm', description: 'Fast Node Manager', env_type: 'node' },
    ];
    mockEnvListProviders.mockResolvedValue(providers);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.fetchProviders();
    });

    expect(mockEnvListProviders).toHaveBeenCalled();
    expect(mockStoreActions.setAvailableProviders).toHaveBeenCalledWith(providers);
  });

  it('should verify install', async () => {
    const verifyResult = { installed: true, providerAvailable: true, currentVersion: '3.12.0', requestedVersion: '3.12.0' };
    mockEnvVerifyInstall.mockResolvedValue(verifyResult);
    const { result } = renderHook(() => useEnvironments());

    let returned;
    await act(async () => {
      returned = await result.current.verifyInstall('python', '3.12.0');
    });

    expect(mockEnvVerifyInstall).toHaveBeenCalledWith('python', '3.12.0');
    expect(returned).toEqual(verifyResult);
  });

  it('should get installed versions', async () => {
    const versions = [{ version: '20.10.0', is_current: true, size: 100 }];
    mockEnvInstalledVersions.mockResolvedValue(versions);
    const { result } = renderHook(() => useEnvironments());

    let returned;
    await act(async () => {
      returned = await result.current.getInstalledVersions('node');
    });

    expect(mockEnvInstalledVersions).toHaveBeenCalledWith('node');
    expect(returned).toEqual(versions);
  });

  it('should get current version', async () => {
    mockEnvCurrentVersion.mockResolvedValue('20.10.0');
    const { result } = renderHook(() => useEnvironments());

    let returned;
    await act(async () => {
      returned = await result.current.getCurrentVersion('node');
    });

    expect(mockEnvCurrentVersion).toHaveBeenCalledWith('node');
    expect(returned).toBe('20.10.0');
  });

  it('should cancel installation when one is in progress', async () => {
    mockStoreState.currentInstallation = { envType: 'node', version: '20.10.0' };
    mockEnvInstallCancel.mockResolvedValue(true);
    const { result } = renderHook(() => useEnvironments());

    let cancelled;
    await act(async () => {
      cancelled = await result.current.cancelInstallation();
    });

    expect(mockEnvInstallCancel).toHaveBeenCalledWith('node', '20.10.0');
    expect(cancelled).toBe(true);
  });

  it('should handle set global version error', async () => {
    mockEnvUseGlobal.mockRejectedValue(new Error('Permission denied'));
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      try {
        await result.current.setGlobalVersion('python', '3.11.0');
      } catch {
        // Expected error
      }
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith('Permission denied');
  });

  it('should handle uninstall error', async () => {
    mockEnvUninstall.mockRejectedValue(new Error('Version in use'));
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      try {
        await result.current.uninstallVersion('python', '3.10.0');
      } catch {
        // Expected error
      }
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith('Version in use');
    expect(mockStoreActions.setLoading).toHaveBeenCalledWith(false);
  });
});
