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
const mockEnvGetDetectionSources = jest.fn();
const mockEnvInstallCancel = jest.fn();
const mockEnvVerifyInstall = jest.fn();
const mockEnvInstalledVersions = jest.fn();
const mockEnvCurrentVersion = jest.fn();
const mockEnvResolveAlias = jest.fn();
const mockPluginDispatchEvent = jest.fn(() => Promise.resolve());
const mockIsTauri = jest.fn(() => true);
const mockEmitInvalidations = jest.fn();
const mockEnsureCacheInvalidationBridge = jest.fn(() => Promise.resolve());
const mockSubscribeInvalidation = jest.fn(() => () => {});
let envInstallProgressListener: ((progress: Record<string, unknown>) => void) | null = null;

jest.mock('@/lib/tauri', () => ({
  isTauri: (...args: Parameters<typeof mockIsTauri>) => mockIsTauri(...args),
  envList: (...args: Parameters<typeof mockEnvList>) => mockEnvList(...args),
  envInstall: (...args: Parameters<typeof mockEnvInstall>) => mockEnvInstall(...args),
  envUninstall: (...args: Parameters<typeof mockEnvUninstall>) => mockEnvUninstall(...args),
  envUseGlobal: (...args: Parameters<typeof mockEnvUseGlobal>) => mockEnvUseGlobal(...args),
  envUseLocal: (...args: Parameters<typeof mockEnvUseLocal>) => mockEnvUseLocal(...args),
  envGet: (...args: Parameters<typeof mockEnvGet>) => mockEnvGet(...args),
  envAvailableVersions: (...args: Parameters<typeof mockEnvAvailableVersions>) => mockEnvAvailableVersions(...args),
  envListProviders: (...args: Parameters<typeof mockEnvListProviders>) => mockEnvListProviders(...args),
  envDetectAll: (...args: Parameters<typeof mockEnvDetectAll>) => mockEnvDetectAll(...args),
  envLoadSettings: (...args: Parameters<typeof mockEnvLoadSettings>) => mockEnvLoadSettings(...args),
  envSaveSettings: (...args: Parameters<typeof mockEnvSaveSettings>) => mockEnvSaveSettings(...args),
  envGetDetectionSources: (...args: Parameters<typeof mockEnvGetDetectionSources>) => mockEnvGetDetectionSources(...args),
  envInstallCancel: (...args: Parameters<typeof mockEnvInstallCancel>) => mockEnvInstallCancel(...args),
  envVerifyInstall: (...args: Parameters<typeof mockEnvVerifyInstall>) => mockEnvVerifyInstall(...args),
  envInstalledVersions: (...args: Parameters<typeof mockEnvInstalledVersions>) => mockEnvInstalledVersions(...args),
  envCurrentVersion: (...args: Parameters<typeof mockEnvCurrentVersion>) => mockEnvCurrentVersion(...args),
  envResolveAlias: (...args: Parameters<typeof mockEnvResolveAlias>) => mockEnvResolveAlias(...args),
  pluginDispatchEvent: (...args: Parameters<typeof mockPluginDispatchEvent>) => mockPluginDispatchEvent(...args),
  listenEnvInstallProgress: jest.fn((callback: (progress: Record<string, unknown>) => void) => {
    envInstallProgressListener = callback as (progress: Record<string, unknown>) => void;
    return Promise.resolve(() => {
      envInstallProgressListener = null;
    });
  }),
}));

// Mock environment store - use actual Zustand store so selectors work correctly
const mockStoreActions = {
  setLoading: jest.fn(),
  setError: jest.fn(),
  setEnvironments: jest.fn((envs: unknown) => {
    mockStoreState.environments = (envs as typeof mockStoreState.environments) ?? [];
  }),
  setEnvSettings: jest.fn(),
  updateEnvironment: jest.fn(),
  setDetectedVersions: jest.fn(),
  setAvailableVersions: jest.fn((envType: unknown, versions: unknown) => {
    if (typeof envType === 'string') {
      mockStoreState.availableVersions = {
        ...mockStoreState.availableVersions,
        [envType]: versions,
      };
    }
  }),
  setAvailableProviders: jest.fn((providers: unknown) => {
    mockStoreState.availableProviders = (providers as typeof mockStoreState.availableProviders) ?? [];
  }),
  setCurrentInstallation: jest.fn(),
  setLastEnvScanTimestamp: jest.fn(),
  isScanFresh: jest.fn(() => false),
  getEnvSettings: jest.fn(() => ({
    autoSwitch: false,
    envVariables: [],
    detectionFiles: [],
  })),
  openProgressDialog: jest.fn(),
  closeProgressDialog: jest.fn(),
  updateInstallationProgress: jest.fn(),
};

const mockStoreState = {
  environments: [],
  availableProviders: [] as Array<{ id: string; display_name: string; description: string; env_type: string }>,
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
  getLogicalEnvType: (
    providerEnvType: string,
    providers?: Array<{ id: string; env_type: string }>,
  ) => {
    if (providers) {
      const provider = providers.find((item) => item.id === providerEnvType);
      if (provider) return provider.env_type;
    }
    return providerEnvType;
  },
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

jest.mock('@/lib/cache/invalidation', () => ({
  emitInvalidations: (...args: unknown[]) => mockEmitInvalidations(...args),
  emitInvalidation: jest.fn(),
  ensureCacheInvalidationBridge: (...args: unknown[]) => mockEnsureCacheInvalidationBridge(...args),
  subscribeInvalidation: (...args: unknown[]) => mockSubscribeInvalidation(...args),
  withThrottle: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

jest.mock('@/lib/utils', () => ({
  formatSize: (n: number) => `${n}B`,
  formatSpeed: (n: number) => `${n}B/s`,
}));

describe('useEnvironments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockEnvGetDetectionSources.mockResolvedValue([]);
    mockEnvSaveSettings.mockResolvedValue(undefined);
    mockEnvLoadSettings.mockResolvedValue(null);
    mockStoreState.environments = [];
    mockStoreState.availableProviders = [];
    mockStoreState.currentInstallation = null;
    envInstallProgressListener = null;
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

  it('should short-circuit desktop-only calls in web mode', async () => {
    mockIsTauri.mockReturnValue(false);
    const { result } = renderHook(() => useEnvironments());

    let envs;
    let providers;
    let detected;
    await act(async () => {
      envs = await result.current.fetchEnvironments();
      providers = await result.current.fetchProviders();
      detected = await result.current.detectVersions('/project');
    });

    expect(envs).toEqual([]);
    expect(providers).toEqual([]);
    expect(detected).toEqual([]);
    expect(mockEnvList).not.toHaveBeenCalled();
    expect(mockEnvListProviders).not.toHaveBeenCalled();
    expect(mockEnvDetectAll).not.toHaveBeenCalled();
    expect(mockStoreActions.setError).not.toHaveBeenCalled();
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

  it('should surface global version verification failure from backend mutation result', async () => {
    mockEnvUseGlobal.mockResolvedValue({
      success: false,
      message: 'Global version verification failed: expected `3.11`, got `3.10`',
    });
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await expect(result.current.setGlobalVersion('python', '3.11')).rejects.toThrow(
        'Global version verification failed: expected `3.11`, got `3.10`',
      );
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith(
      'Global version verification failed: expected `3.11`, got `3.10`',
    );
    expect(mockEnvGet).not.toHaveBeenCalled();
  });

  it('should set local version and emit cache invalidation', async () => {
    mockEnvUseLocal.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.setLocalVersion('python', '3.11.0', '/project/path');
    });

    expect(mockEnvUseLocal).toHaveBeenCalledWith('python', '3.11.0', '/project/path');
    expect(mockEmitInvalidations).toHaveBeenCalledWith(
      ['environment_data', 'provider_data'],
      'environments:set-local',
    );
  });

  it('should surface local version verification failure from backend mutation result', async () => {
    mockEnvUseLocal.mockResolvedValue({
      success: false,
      message: 'Local version verification failed: expected local `21`, got `17` (manifest)',
    });
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await expect(
        result.current.setLocalVersion('java', '21', '/project/path'),
      ).rejects.toThrow(
        'Local version verification failed: expected local `21`, got `17` (manifest)',
      );
    });

    expect(mockStoreActions.setError).toHaveBeenCalledWith(
      'Local version verification failed: expected local `21`, got `17` (manifest)',
    );
    expect(mockEmitInvalidations).not.toHaveBeenCalled();
  });

  it('should not emit invalidation when set local version fails', async () => {
    mockEnvUseLocal.mockRejectedValue(new Error('Permission denied'));
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      try {
        await result.current.setLocalVersion('python', '3.11.0', '/project/path');
      } catch {
        // Expected error
      }
    });

    expect(mockEmitInvalidations).not.toHaveBeenCalled();
    expect(mockStoreActions.setError).toHaveBeenCalledWith('Permission denied');
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

  it('loads default detection settings from backend detection sources when no saved settings exist', async () => {
    mockEnvLoadSettings.mockResolvedValue(null);
    mockEnvGetDetectionSources.mockResolvedValue(['.nvmrc', '.node-version', '.tool-versions']);
    const { result } = renderHook(() => useEnvironments());

    let loaded;
    await act(async () => {
      loaded = await result.current.loadEnvSettings('node');
    });

    expect(mockEnvLoadSettings).toHaveBeenCalledWith('node');
    expect(mockEnvGetDetectionSources).toHaveBeenCalledWith('node');
    expect(loaded).toEqual({
      autoSwitch: false,
      envVariables: [],
      detectionFiles: [
        { fileName: '.nvmrc', enabled: true },
        { fileName: '.node-version', enabled: true },
        { fileName: '.tool-versions', enabled: false },
      ],
    });
    expect(mockStoreActions.setEnvSettings).toHaveBeenCalledWith('node', loaded);
  });

  it('filters stale detection files against backend authoritative sources on load', async () => {
    mockEnvLoadSettings.mockResolvedValue({
      env_type: 'java',
      env_variables: [],
      detection_files: [
        { file_name: '.java-version', enabled: true },
        { file_name: 'build.gradle.kts (sourceCompatibility)', enabled: true },
        { file_name: 'pom.xml (java.version)', enabled: true },
      ],
      auto_switch: true,
    });
    mockEnvGetDetectionSources.mockResolvedValue([
      '.java-version',
      '.sdkmanrc',
      '.tool-versions',
      'pom.xml (java.version)',
      'build.gradle (sourceCompatibility)',
      'mise.toml',
    ]);
    const { result } = renderHook(() => useEnvironments());

    let loaded;
    await act(async () => {
      loaded = await result.current.loadEnvSettings('java');
    });

    expect(mockEnvGetDetectionSources).toHaveBeenCalledWith('java');
    expect(loaded).toEqual({
      autoSwitch: true,
      envVariables: [],
      detectionFiles: [
        { fileName: '.java-version', enabled: true },
        { fileName: '.sdkmanrc', enabled: false },
        { fileName: '.tool-versions', enabled: false },
        { fileName: 'pom.xml (java.version)', enabled: true },
        { fileName: 'build.gradle (sourceCompatibility)', enabled: false },
        { fileName: 'mise.toml', enabled: false },
      ],
    });
  });

  it('normalizes provider id to logical env type when saving env settings', async () => {
    mockStoreState.availableProviders = [
      { id: 'fnm', display_name: 'fnm', description: '', env_type: 'node' },
    ];
    const { result } = renderHook(() => useEnvironments());
    const settings = {
      autoSwitch: true,
      envVariables: [],
      detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
    };

    await act(async () => {
      await result.current.saveEnvSettings('fnm', settings);
    });

    expect(mockEnvSaveSettings).toHaveBeenCalledWith({
      env_type: 'node',
      env_variables: [],
      detection_files: [{ file_name: '.nvmrc', enabled: true }],
      auto_switch: true,
    });
    expect(mockStoreActions.setEnvSettings).toHaveBeenCalledWith('node', settings);
  });

  it('invalidates detected versions cache after saving env settings', async () => {
    const detected = [{ env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: '/project/.nvmrc' }];
    mockEnvDetectAll.mockResolvedValue(detected);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.detectVersions('/project');
      await result.current.saveEnvSettings('node', {
        autoSwitch: true,
        envVariables: [],
        detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
      });
      await result.current.detectVersions('/project');
    });

    expect(mockEnvDetectAll).toHaveBeenCalledTimes(2);
  });

  it('sanitizes unknown detection files before saving settings', async () => {
    mockEnvGetDetectionSources.mockResolvedValue(['.nvmrc', '.node-version']);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.saveEnvSettings('node', {
        autoSwitch: true,
        envVariables: [],
        detectionFiles: [
          { fileName: '.nvmrc', enabled: true },
          { fileName: 'unknown-file', enabled: true },
        ],
      });
    });

    expect(mockEnvSaveSettings).toHaveBeenCalledWith({
      env_type: 'node',
      env_variables: [],
      detection_files: [
        { file_name: '.nvmrc', enabled: true },
        { file_name: '.node-version', enabled: false },
      ],
      auto_switch: true,
    });
    expect(mockStoreActions.setEnvSettings).toHaveBeenCalledWith('node', {
      autoSwitch: true,
      envVariables: [],
      detectionFiles: [
        { fileName: '.nvmrc', enabled: true },
        { fileName: '.node-version', enabled: false },
      ],
    });
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

    expect(mockEnvAvailableVersions).toHaveBeenCalledWith('node', undefined, undefined);
    expect(mockStoreActions.setAvailableVersions).toHaveBeenCalledWith('node', versions);
    expect(returnedVersions).toEqual(versions);
  });

  it('should use cached available versions when not forced', async () => {
    const versions = [
      { version: '18.0.0', release_date: null, deprecated: false, yanked: false },
    ];
    mockStoreState.availableVersions = { node: versions };
    const { result } = renderHook(() => useEnvironments());

    let returnedVersions;
    await act(async () => {
      returnedVersions = await result.current.fetchAvailableVersions('node');
    });

    expect(mockEnvAvailableVersions).not.toHaveBeenCalled();
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

  it('should cache providers between calls', async () => {
    const providers = [
      { id: 'fnm', display_name: 'fnm', description: 'Fast Node Manager', env_type: 'node' },
    ];
    mockEnvListProviders.mockResolvedValue(providers);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.fetchProviders();
      await result.current.fetchProviders();
    });

    expect(mockEnvListProviders).toHaveBeenCalledTimes(1);
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

    expect(mockEnvInstalledVersions).toHaveBeenCalledWith('node', undefined);
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

  it('maps phase-level install progress payload into store updates', async () => {
    mockStoreState.environments = [
      { env_type: 'node', provider_id: 'fnm', provider: 'fnm', current_version: '20.0.0', installed_versions: [], available: true },
    ];
    mockEnvVerifyInstall.mockResolvedValue({ installed: true });
    mockEnvGet.mockResolvedValue({
      env_type: 'node',
      provider_id: 'fnm',
      provider: 'fnm',
      current_version: '20.0.0',
      installed_versions: [],
      available: true,
    });
    mockEnvInstall.mockImplementation(async () => {
      envInstallProgressListener?.({
        envType: 'node',
        version: '20.0.0',
        step: 'downloading',
        phase: 'download',
        progress: 42,
        stageMessage: 'Starting transfer',
        artifact: {
          id: 'fnm:node@20.0.0',
          name: 'node',
          version: '20.0.0',
          provider: 'fnm',
        },
      });
      return undefined;
    });

    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.installVersion('node', '20.0.0');
    });

    expect(mockStoreActions.updateInstallationProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'downloading',
        phase: 'download',
        stageMessage: 'Starting transfer',
        provider: 'fnm',
        artifact: expect.objectContaining({
          id: 'fnm:node@20.0.0',
        }),
      }),
    );
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
