import { renderHook, act } from '@testing-library/react';
import { useEnvironments } from './use-environments';

// Mock Tauri APIs
const mockEnvList = jest.fn();
const mockEnvInstall = jest.fn();
const mockEnvUninstall = jest.fn();
const mockEnvSetGlobal = jest.fn();
const mockEnvSetLocal = jest.fn();
const mockEnvAvailableVersions = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  envList: (...args: unknown[]) => mockEnvList(...args),
  envInstall: (...args: unknown[]) => mockEnvInstall(...args),
  envUninstall: (...args: unknown[]) => mockEnvUninstall(...args),
  envSetGlobal: (...args: unknown[]) => mockEnvSetGlobal(...args),
  envSetLocal: (...args: unknown[]) => mockEnvSetLocal(...args),
  envAvailableVersions: (...args: unknown[]) => mockEnvAvailableVersions(...args),
  listenEnvInstallProgress: jest.fn(() => Promise.resolve(() => {})),
}));

// Mock environment store
const mockSetEnvironments = jest.fn();
const mockSetLoading = jest.fn();
const mockSetError = jest.fn();
const mockUpdateEnvironment = jest.fn();

jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(() => ({
    environments: [],
    isLoading: false,
    error: null,
    setEnvironments: mockSetEnvironments,
    setLoading: mockSetLoading,
    setError: mockSetError,
    updateEnvironment: mockUpdateEnvironment,
  })),
}));

describe('useEnvironments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return environment methods', () => {
    const { result } = renderHook(() => useEnvironments());

    expect(result.current).toHaveProperty('fetchEnvironments');
    expect(result.current).toHaveProperty('installVersion');
    expect(result.current).toHaveProperty('uninstallVersion');
    expect(result.current).toHaveProperty('setGlobalVersion');
    expect(result.current).toHaveProperty('setLocalVersion');
  });

  it('should fetch environments', async () => {
    const envs = [
      { type: 'python', versions: ['3.11.0', '3.10.0'] },
      { type: 'node', versions: ['18.0.0', '20.0.0'] },
    ];
    mockEnvList.mockResolvedValue(envs);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.fetchEnvironments();
    });

    expect(mockEnvList).toHaveBeenCalled();
    expect(mockSetEnvironments).toHaveBeenCalledWith(envs);
  });

  it('should install version', async () => {
    mockEnvInstall.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.installVersion('python', '3.12.0');
    });

    expect(mockEnvInstall).toHaveBeenCalledWith('python', '3.12.0');
  });

  it('should uninstall version', async () => {
    mockEnvUninstall.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.uninstallVersion('python', '3.10.0');
    });

    expect(mockEnvUninstall).toHaveBeenCalledWith('python', '3.10.0');
  });

  it('should set global version', async () => {
    mockEnvSetGlobal.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.setGlobalVersion('python', '3.11.0');
    });

    expect(mockEnvSetGlobal).toHaveBeenCalledWith('python', '3.11.0');
  });

  it('should set local version', async () => {
    mockEnvSetLocal.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.setLocalVersion('python', '3.11.0', '/project/path');
    });

    expect(mockEnvSetLocal).toHaveBeenCalledWith('python', '3.11.0', '/project/path');
  });

  it('should handle install error', async () => {
    const error = new Error('Install failed');
    mockEnvInstall.mockRejectedValue(error);
    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      try {
        await result.current.installVersion('python', '3.12.0');
      } catch {
        // Expected error
      }
    });

    expect(mockSetError).toHaveBeenCalled();
  });

  it('should return store state', () => {
    const { result } = renderHook(() => useEnvironments());

    expect(result.current).toHaveProperty('environments');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });
});
