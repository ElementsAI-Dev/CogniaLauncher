import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoVersionSwitch, useProjectPath } from './use-auto-version';

const mockIsTauri = jest.fn(() => true);
const mockDetectVersions = jest.fn();
const mockSetLocalVersion = jest.fn();
const mockGetEnvSettings = jest.fn();

const mockStoreState: {
  environments: Array<{
    env_type: string;
    installed_versions: Array<{ version: string }>;
  }>;
  availableProviders: Array<{ id: string; env_type: string }>;
} = {
  environments: [],
  availableProviders: [],
};

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('./use-environments', () => ({
  useEnvironments: () => ({
    detectVersions: (...args: unknown[]) => mockDetectVersions(...args),
    setLocalVersion: (...args: unknown[]) => mockSetLocalVersion(...args),
  }),
}));

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
      const state = {
        getEnvSettings: mockGetEnvSettings,
        environments: mockStoreState.environments,
        availableProviders: mockStoreState.availableProviders,
      };
      if (typeof selector === 'function') {
        return selector(state);
      }
      return state;
    }),
    {
      getState: () => ({
        environments: mockStoreState.environments,
        availableProviders: mockStoreState.availableProviders,
      }),
    },
  ),
}));

describe('useAutoVersionSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsTauri.mockReturnValue(true);
    mockGetEnvSettings.mockReturnValue({
      autoSwitch: true,
      envVariables: [],
      detectionFiles: [],
    });
    mockSetLocalVersion.mockResolvedValue(undefined);
    mockStoreState.environments = [];
    mockStoreState.availableProviders = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses installed exact version when detected version has v-prefix', async () => {
    mockStoreState.environments = [
      {
        env_type: 'node',
        installed_versions: [{ version: '20.10.0' }],
      },
    ];
    mockDetectVersions.mockResolvedValue([
      { env_type: 'node', version: 'v20.10.0', source: '.nvmrc', source_path: null },
    ]);

    renderHook(() =>
      useAutoVersionSwitch({ projectPath: '/project', enabled: true, pollInterval: 30_000 }),
    );

    await waitFor(() => {
      expect(mockSetLocalVersion).toHaveBeenCalledWith('node', '20.10.0', '/project', undefined);
    });
  });

  it('does not treat "1" as compatible with "10.0.0"', async () => {
    mockStoreState.environments = [
      {
        env_type: 'node',
        installed_versions: [{ version: '10.0.0' }],
      },
    ];
    mockDetectVersions.mockResolvedValue([
      { env_type: 'node', version: '1', source: '.nvmrc', source_path: null },
    ]);

    renderHook(() =>
      useAutoVersionSwitch({ projectPath: '/project', enabled: true, pollInterval: 30_000 }),
    );

    await waitFor(() => {
      expect(mockDetectVersions).toHaveBeenCalledWith('/project');
    });
    expect(mockSetLocalVersion).not.toHaveBeenCalled();
  });

  it('matches detected logical env type to provider-based env type', async () => {
    mockStoreState.environments = [
      {
        env_type: 'fnm',
        installed_versions: [{ version: '20.10.0' }],
      },
    ];
    mockStoreState.availableProviders = [{ id: 'fnm', env_type: 'node' }];
    mockDetectVersions.mockResolvedValue([
      { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: null },
    ]);

    renderHook(() =>
      useAutoVersionSwitch({ projectPath: '/project', enabled: true, pollInterval: 30_000 }),
    );

    await waitFor(() => {
      expect(mockSetLocalVersion).toHaveBeenCalledWith('fnm', '20.10.0', '/project', undefined);
    });
    expect(mockGetEnvSettings).toHaveBeenCalledWith('node');
    expect(mockGetEnvSettings).toHaveBeenCalledWith('fnm');
  });

  it('falls back to provider-key auto switch settings when logical key is disabled', async () => {
    mockStoreState.environments = [
      {
        env_type: 'fnm',
        installed_versions: [{ version: '20.10.0' }],
      },
    ];
    mockStoreState.availableProviders = [{ id: 'fnm', env_type: 'node' }];
    mockDetectVersions.mockResolvedValue([
      { env_type: 'node', version: '20.10.0', source: '.nvmrc', source_path: null },
    ]);
    mockGetEnvSettings.mockImplementation((envType: string) => ({
      autoSwitch: envType === 'fnm',
      envVariables: [],
      detectionFiles: [],
    }));

    renderHook(() =>
      useAutoVersionSwitch({ projectPath: '/project', enabled: true, pollInterval: 30_000 }),
    );

    await waitFor(() => {
      expect(mockSetLocalVersion).toHaveBeenCalledWith('fnm', '20.10.0', '/project', undefined);
    });
  });

  it('does nothing when disabled', async () => {
    renderHook(() =>
      useAutoVersionSwitch({ projectPath: '/project', enabled: false, pollInterval: 30_000 }),
    );

    await act(async () => {
      jest.advanceTimersByTime(35_000);
    });

    expect(mockDetectVersions).not.toHaveBeenCalled();
    expect(mockSetLocalVersion).not.toHaveBeenCalled();
  });

  it('does nothing without project path', async () => {
    renderHook(() => useAutoVersionSwitch({ projectPath: null, enabled: true }));

    await act(async () => {
      jest.advanceTimersByTime(35_000);
    });

    expect(mockDetectVersions).not.toHaveBeenCalled();
    expect(mockSetLocalVersion).not.toHaveBeenCalled();
  });
});

describe('useProjectPath', () => {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  it('initializes from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('/saved/path');
    const { result } = renderHook(() => useProjectPath());
    expect(result.current.projectPath).toBe('/saved/path');
  });

  it('sets project path', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const { result } = renderHook(() => useProjectPath());

    act(() => {
      result.current.setProjectPath('/new/path');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('cognia-project-path', '/new/path');
    expect(result.current.projectPath).toBe('/new/path');
  });

  it('clears project path', () => {
    localStorageMock.getItem.mockReturnValue('/some/path');
    const { result } = renderHook(() => useProjectPath());

    act(() => {
      result.current.clearProjectPath();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cognia-project-path');
    expect(result.current.projectPath).toBeNull();
  });
});
