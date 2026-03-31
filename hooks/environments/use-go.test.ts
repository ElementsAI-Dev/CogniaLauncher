import { act, renderHook } from '@testing-library/react';
import { useGo } from './use-go';

const mockGoEnvInfo = jest.fn();
const mockGoModTidy = jest.fn();
const mockGoModDownload = jest.fn();
const mockGoCleanCache = jest.fn();
const mockGoCacheInfo = jest.fn();

jest.mock('@/lib/tauri', () => ({
  goEnvInfo: (...args: unknown[]) => mockGoEnvInfo(...args),
  goModTidy: (...args: unknown[]) => mockGoModTidy(...args),
  goModDownload: (...args: unknown[]) => mockGoModDownload(...args),
  goCleanCache: (...args: unknown[]) => mockGoCleanCache(...args),
  goCacheInfo: (...args: unknown[]) => mockGoCacheInfo(...args),
}));

describe('useGo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and stores go environment information', async () => {
    const envInfo = { goroot: '/usr/local/go', goversion: 'go1.23.0' };
    mockGoEnvInfo.mockResolvedValue(envInfo);

    const { result } = renderHook(() => useGo());

    let fetched;
    await act(async () => {
      fetched = await result.current.fetchEnvInfo();
    });

    expect(fetched).toEqual(envInfo);
    expect(result.current.envInfo).toEqual(envInfo);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures command failures and keeps loading false afterwards', async () => {
    mockGoModTidy.mockRejectedValue(new Error('go.mod missing'));

    const { result } = renderHook(() => useGo());

    let message = '';
    await act(async () => {
      try {
        await result.current.modTidy('/workspace/project');
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
    });

    expect(message).toBe('go.mod missing');
    expect(result.current.error).toBe('go.mod missing');
    expect(result.current.loading).toBe(false);
  });

  it('forwards cache and module commands to the backend helpers', async () => {
    const cacheInfo = { gocache: '/tmp/go-build', gomodcache: '/tmp/pkg/mod' };
    mockGoCacheInfo.mockResolvedValue(cacheInfo);
    mockGoModDownload.mockResolvedValue('downloaded');
    mockGoCleanCache.mockResolvedValue('cache cleaned');

    const { result } = renderHook(() => useGo());

    let fetchedCache;
    let downloadResult;
    let cleanResult;
    await act(async () => {
      fetchedCache = await result.current.fetchCacheInfo();
      downloadResult = await result.current.modDownload('/workspace/project');
      cleanResult = await result.current.cleanCache('module');
    });

    expect(fetchedCache).toEqual(cacheInfo);
    expect(result.current.cacheInfo).toEqual(cacheInfo);
    expect(mockGoModDownload).toHaveBeenCalledWith('/workspace/project');
    expect(downloadResult).toBe('downloaded');
    expect(mockGoCleanCache).toHaveBeenCalledWith('module');
    expect(cleanResult).toBe('cache cleaned');
  });

  it('refreshes both env and cache state in one pass', async () => {
    const envInfo = { goroot: '/usr/local/go', goversion: 'go1.23.0' };
    const cacheInfo = { gocache: '/tmp/go-build', gomodcache: '/tmp/pkg/mod' };
    mockGoEnvInfo.mockResolvedValue(envInfo);
    mockGoCacheInfo.mockResolvedValue(cacheInfo);

    const { result } = renderHook(() => useGo());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.envInfo).toEqual(envInfo);
    expect(result.current.cacheInfo).toEqual(cacheInfo);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('surfaces refresh failures without leaving the hook stuck in loading state', async () => {
    mockGoEnvInfo.mockRejectedValue(new Error('go not installed'));

    const { result } = renderHook(() => useGo());

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.error).toBe('go not installed');
    expect(result.current.loading).toBe(false);
    expect(result.current.envInfo).toBeNull();
    expect(result.current.cacheInfo).toBeNull();
  });
});
