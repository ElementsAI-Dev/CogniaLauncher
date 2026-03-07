import { renderHook, act, waitFor } from '@testing-library/react';
import { useHealthCheck } from './use-health-check';
import { useHealthCheckStore } from '@/lib/stores/health-check';
import type { SystemHealthResult } from '@/types/tauri';

// Mock Tauri APIs
const mockHealthCheckAll = jest.fn();
const mockHealthCheckEnvironment = jest.fn();
const mockHealthCheckFix = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  healthCheckAll: (...args: unknown[]) => mockHealthCheckAll(...args),
  healthCheckEnvironment: (...args: unknown[]) => mockHealthCheckEnvironment(...args),
  healthCheckFix: (...args: unknown[]) => mockHealthCheckFix(...args),
}));

const tauri = jest.requireMock('@/lib/tauri') as {
  isTauri: jest.Mock;
};

const createHealthData = (): SystemHealthResult => ({
  overall_status: 'healthy',
  environments: [
    { env_type: 'node', provider_id: 'fnm', status: 'healthy', issues: [], suggestions: [], checked_at: new Date().toISOString() },
  ],
  package_managers: [],
  system_issues: [],
  checked_at: new Date().toISOString(),
});

describe('useHealthCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tauri.isTauri.mockReturnValue(true);
    // Reset Zustand store between tests
    useHealthCheckStore.setState({
      systemHealth: null,
      environmentHealth: {},
      loading: false,
      error: null,
      progress: null,
      lastCheckedAt: null,
      activeRemediationId: null,
      lastRemediationResult: null,
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.systemHealth).toBeNull();
    expect(result.current.environmentHealth).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should check all system health', async () => {
    const healthData = createHealthData();
    mockHealthCheckAll.mockResolvedValue(healthData);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkAll();
    });

    await waitFor(() => {
      expect(result.current.systemHealth).toEqual(healthData);
    });
    expect(mockHealthCheckAll).toHaveBeenCalled();
  });

  it('should skip checkAll when cached health data is still fresh', async () => {
    const cached = createHealthData();
    useHealthCheckStore.setState({
      systemHealth: cached,
      lastCheckedAt: Date.now(),
    });

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkAll();
    });

    expect(mockHealthCheckAll).not.toHaveBeenCalled();
    expect(result.current.systemHealth).toEqual(cached);
  });

  it('should force checkAll even when cached health data is fresh', async () => {
    const cached = createHealthData();
    const refreshed = {
      ...createHealthData(),
      overall_status: 'warning',
    };

    useHealthCheckStore.setState({
      systemHealth: cached,
      lastCheckedAt: Date.now(),
    });
    mockHealthCheckAll.mockResolvedValue(refreshed);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkAll({ force: true });
    });

    expect(mockHealthCheckAll).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.systemHealth).toEqual(refreshed);
    });
  });

  it('should dedupe concurrent checkAll calls into one in-flight request', async () => {
    const healthData = createHealthData();
    let resolveRequest!: (value: unknown) => void;

    mockHealthCheckAll.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );

    const { result } = renderHook(() => useHealthCheck());
    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;

    act(() => {
      firstPromise = result.current.checkAll();
      secondPromise = result.current.checkAll();
    });

    expect(mockHealthCheckAll).toHaveBeenCalledTimes(1);
    expect(secondPromise).toBe(firstPromise);

    await act(async () => {
      resolveRequest(healthData);
      await firstPromise;
    });

    await waitFor(() => {
      expect(result.current.systemHealth).toEqual(healthData);
    });
  });

  it('should check environment health', async () => {
    const envHealth = {
      status: 'healthy',
      version: '3.11.0',
      path: '/usr/bin/python3',
    };
    mockHealthCheckEnvironment.mockResolvedValue(envHealth);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkEnvironment('python');
    });

    await waitFor(() => {
      expect(result.current.environmentHealth['python']).toEqual(envHealth);
    });
    expect(mockHealthCheckEnvironment).toHaveBeenCalledWith('python');
  });

  it('should handle health check error', async () => {
    const error = new Error('Health check failed');
    mockHealthCheckAll.mockRejectedValue(error);

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      try {
        await result.current.checkAll();
      } catch {
        // Expected error
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should set loading state during check', async () => {
    let resolvePromise: (value: unknown) => void;
    mockHealthCheckAll.mockImplementation(() => new Promise(resolve => { resolvePromise = resolve; }));

    const { result } = renderHook(() => useHealthCheck());

    act(() => {
      result.current.checkAll();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolvePromise!({ environments: [] });
    });
  });

  it('should keep checkAll callback stable across store updates', () => {
    const { result } = renderHook(() => useHealthCheck());
    const initialCheckAll = result.current.checkAll;

    act(() => {
      useHealthCheckStore.getState().setLoading(true);
    });

    expect(result.current.checkAll).toBe(initialCheckAll);

    act(() => {
      useHealthCheckStore.getState().setLoading(false);
    });

    expect(result.current.checkAll).toBe(initialCheckAll);
  });

  it('should return status color for healthy', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('healthy')).toBe('border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950');
  });

  it('should return status color for warning', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('warning')).toBe('border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950');
  });

  it('should return status color for error', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('error')).toBe('border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950');
  });

  it('should return status color for unknown', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('unknown')).toBe('border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950');
  });

  it('should return status icon for healthy', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('healthy')).toBe('✓');
  });

  it('should return status icon for warning', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('warning')).toBe('⚠');
  });

  it('should return status icon for error', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('error')).toBe('✗');
  });

  it('should return status icon for unknown', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('unknown')).toBe('?');
  });

  it('should check multiple environments', async () => {
    mockHealthCheckEnvironment.mockImplementation((env) => 
      Promise.resolve({ status: 'healthy', env })
    );

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkEnvironment('python');
      await result.current.checkEnvironment('node');
    });

    await waitFor(() => {
      expect(result.current.environmentHealth['python']).toBeDefined();
      expect(result.current.environmentHealth['node']).toBeDefined();
    });
  });

  it('should clear error on successful check', async () => {
    // First, cause an error
    mockHealthCheckAll.mockRejectedValueOnce(new Error('Failed'));
    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.checkAll();
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // Then succeed
    mockHealthCheckAll.mockResolvedValueOnce({ environments: [] });

    await act(async () => {
      await result.current.checkAll();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it('should preview remediation and persist the last result', async () => {
    mockHealthCheckFix.mockResolvedValue({
      remediation_id: 'install-provider:fnm',
      supported: true,
      dry_run: true,
      executed: false,
      success: true,
      manual_only: false,
      command: 'winget install Schniz.fnm',
      description: 'Install fnm',
      message: 'Preview install command for fnm',
      stdout: null,
      stderr: null,
    });

    const { result } = renderHook(() => useHealthCheck());

    await act(async () => {
      await result.current.previewRemediation({ remediation_id: 'install-provider:fnm' });
    });

    expect(mockHealthCheckFix).toHaveBeenCalledWith('install-provider:fnm', true);
    expect(result.current.lastRemediationResult?.remediation_id).toBe('install-provider:fnm');
  });
});
