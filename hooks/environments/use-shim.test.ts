import { renderHook, act } from '@testing-library/react';
import { useShim } from './use-shim';

const mockShimList = jest.fn();
const mockShimCreate = jest.fn();
const mockShimRemove = jest.fn();
const mockShimUpdate = jest.fn();
const mockShimRegenerateAll = jest.fn();
const mockPathStatus = jest.fn();
const mockPathSetup = jest.fn();
const mockPathRemove = jest.fn();
const mockPathCheck = jest.fn();
const mockPathGetAddCommand = jest.fn();

jest.mock('@/lib/tauri', () => ({
  shimList: (...args: unknown[]) => mockShimList(...args),
  shimCreate: (...args: unknown[]) => mockShimCreate(...args),
  shimRemove: (...args: unknown[]) => mockShimRemove(...args),
  shimUpdate: (...args: unknown[]) => mockShimUpdate(...args),
  shimRegenerateAll: (...args: unknown[]) => mockShimRegenerateAll(...args),
  pathStatus: (...args: unknown[]) => mockPathStatus(...args),
  pathSetup: (...args: unknown[]) => mockPathSetup(...args),
  pathRemove: (...args: unknown[]) => mockPathRemove(...args),
  pathCheck: (...args: unknown[]) => mockPathCheck(...args),
  pathGetAddCommand: (...args: unknown[]) => mockPathGetAddCommand(...args),
}));

jest.mock('@/lib/errors', () => ({
  formatError: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

describe('useShim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useShim());

    expect(result.current.shims).toEqual([]);
    expect(result.current.pathStatus).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch shims', async () => {
    const shims = [
      { binaryName: 'node', envType: 'node', version: '18.0.0', path: '/shims/node' },
      { binaryName: 'python', envType: 'python', version: '3.11', path: '/shims/python' },
    ];
    mockShimList.mockResolvedValue(shims);

    const { result } = renderHook(() => useShim());

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchShims();
    });

    expect(fetched).toEqual(shims);
    expect(result.current.shims).toEqual(shims);
    expect(result.current.loading).toBe(false);
  });

  it('should handle fetchShims error', async () => {
    mockShimList.mockRejectedValue(new Error('List failed'));

    const { result } = renderHook(() => useShim());

    await act(async () => {
      await result.current.fetchShims();
    });

    expect(result.current.error).toBe('List failed');
    expect(result.current.loading).toBe(false);
  });

  it('should create shim and refresh', async () => {
    mockShimCreate.mockResolvedValue('/shims/node');
    mockShimList.mockResolvedValue([]);

    const { result } = renderHook(() => useShim());

    let shimPath;
    await act(async () => {
      shimPath = await result.current.createShim('node', 'node', '18.0.0', '/usr/bin/node');
    });

    expect(shimPath).toBe('/shims/node');
    expect(mockShimCreate).toHaveBeenCalledWith('node', 'node', '18.0.0', '/usr/bin/node');
    expect(mockShimList).toHaveBeenCalled();
  });

  it('should handle createShim error', async () => {
    mockShimCreate.mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useShim());

    let shimPath;
    await act(async () => {
      shimPath = await result.current.createShim('node', 'node', null, '/usr/bin/node');
    });

    expect(shimPath).toBeNull();
    expect(result.current.error).toBe('Create failed');
  });

  it('should remove shim and refresh', async () => {
    mockShimRemove.mockResolvedValue(true);
    mockShimList.mockResolvedValue([]);

    const { result } = renderHook(() => useShim());

    let removed;
    await act(async () => {
      removed = await result.current.removeShim('node');
    });

    expect(removed).toBe(true);
    expect(mockShimRemove).toHaveBeenCalledWith('node');
    expect(mockShimList).toHaveBeenCalled();
  });

  it('should not refresh if remove returns false', async () => {
    mockShimRemove.mockResolvedValue(false);

    const { result } = renderHook(() => useShim());

    await act(async () => {
      await result.current.removeShim('node');
    });

    expect(mockShimList).not.toHaveBeenCalled();
  });

  it('should update shim and refresh', async () => {
    mockShimUpdate.mockResolvedValue(undefined);
    mockShimList.mockResolvedValue([]);

    const { result } = renderHook(() => useShim());

    let updated;
    await act(async () => {
      updated = await result.current.updateShim('node', '20.0.0');
    });

    expect(updated).toBe(true);
    expect(mockShimUpdate).toHaveBeenCalledWith('node', '20.0.0');
  });

  it('should handle updateShim error', async () => {
    mockShimUpdate.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useShim());

    let updated;
    await act(async () => {
      updated = await result.current.updateShim('node');
    });

    expect(updated).toBe(false);
    expect(result.current.error).toBe('Update failed');
  });

  it('should regenerate all shims', async () => {
    mockShimRegenerateAll.mockResolvedValue(undefined);
    mockShimList.mockResolvedValue([]);

    const { result } = renderHook(() => useShim());

    let ok;
    await act(async () => {
      ok = await result.current.regenerateAll();
    });

    expect(ok).toBe(true);
    expect(mockShimRegenerateAll).toHaveBeenCalled();
  });

  it('should handle regenerateAll error', async () => {
    mockShimRegenerateAll.mockRejectedValue(new Error('Regen failed'));

    const { result } = renderHook(() => useShim());

    let ok;
    await act(async () => {
      ok = await result.current.regenerateAll();
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Regen failed');
  });

  it('should fetch path status', async () => {
    const status = { isSetup: true, shimDir: '/shims', inPath: true };
    mockPathStatus.mockResolvedValue(status);

    const { result } = renderHook(() => useShim());

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchPathStatus();
    });

    expect(fetched).toEqual(status);
    expect(result.current.pathStatus).toEqual(status);
  });

  it('should setup path', async () => {
    mockPathSetup.mockResolvedValue(undefined);
    mockPathStatus.mockResolvedValue({ isSetup: true });

    const { result } = renderHook(() => useShim());

    let ok;
    await act(async () => {
      ok = await result.current.setupPath();
    });

    expect(ok).toBe(true);
    expect(mockPathSetup).toHaveBeenCalled();
  });

  it('should remove path', async () => {
    mockPathRemove.mockResolvedValue(undefined);
    mockPathStatus.mockResolvedValue({ isSetup: false });

    const { result } = renderHook(() => useShim());

    let ok;
    await act(async () => {
      ok = await result.current.removePath();
    });

    expect(ok).toBe(true);
    expect(mockPathRemove).toHaveBeenCalled();
  });

  it('should check path', async () => {
    mockPathCheck.mockResolvedValue(true);

    const { result } = renderHook(() => useShim());

    let inPath;
    await act(async () => {
      inPath = await result.current.checkPath();
    });

    expect(inPath).toBe(true);
  });

  it('should return false on checkPath error', async () => {
    mockPathCheck.mockRejectedValue(new Error('Check failed'));

    const { result } = renderHook(() => useShim());

    let inPath;
    await act(async () => {
      inPath = await result.current.checkPath();
    });

    expect(inPath).toBe(false);
  });

  it('should get add command', async () => {
    mockPathGetAddCommand.mockResolvedValue('export PATH="/shims:$PATH"');

    const { result } = renderHook(() => useShim());

    let cmd;
    await act(async () => {
      cmd = await result.current.getAddCommand();
    });

    expect(cmd).toBe('export PATH="/shims:$PATH"');
  });

  it('should handle getAddCommand error', async () => {
    mockPathGetAddCommand.mockRejectedValue(new Error('No command'));

    const { result } = renderHook(() => useShim());

    let cmd;
    await act(async () => {
      cmd = await result.current.getAddCommand();
    });

    expect(cmd).toBeNull();
    expect(result.current.error).toBe('No command');
  });
});
