import { renderHook, act, waitFor } from '@testing-library/react';
import { useHealthCheck } from './use-health-check';

// Mock Tauri APIs
const mockHealthCheckAll = jest.fn();
const mockHealthCheckEnvironment = jest.fn();

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => true),
  healthCheckAll: (...args: unknown[]) => mockHealthCheckAll(...args),
  healthCheckEnvironment: (...args: unknown[]) => mockHealthCheckEnvironment(...args),
}));

describe('useHealthCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.systemHealth).toBeNull();
    expect(result.current.environmentHealth).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should check all system health', async () => {
    const healthData = {
      cpu: { status: 'healthy', value: 50 },
      memory: { status: 'healthy', value: 60 },
      disk: { status: 'warning', value: 85 },
    };
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
    mockHealthCheckAll.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 100)));

    const { result } = renderHook(() => useHealthCheck());

    let loadingDuringCheck = false;
    act(() => {
      result.current.checkAll();
      loadingDuringCheck = result.current.loading;
    });

    expect(loadingDuringCheck).toBe(true);
  });

  it('should return status color for healthy', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('healthy')).toBe('text-green-500');
  });

  it('should return status color for warning', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('warning')).toBe('text-yellow-500');
  });

  it('should return status color for error', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('error')).toBe('text-red-500');
  });

  it('should return status color for unknown', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusColor('unknown')).toBe('text-gray-500');
  });

  it('should return status icon for healthy', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('healthy')).toBe('check-circle');
  });

  it('should return status icon for warning', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('warning')).toBe('alert-triangle');
  });

  it('should return status icon for error', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('error')).toBe('x-circle');
  });

  it('should return status icon for unknown', () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.getStatusIcon('unknown')).toBe('help-circle');
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
      try {
        await result.current.checkAll();
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // Then succeed
    mockHealthCheckAll.mockResolvedValueOnce({ status: 'healthy' });

    await act(async () => {
      await result.current.checkAll();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });
});
