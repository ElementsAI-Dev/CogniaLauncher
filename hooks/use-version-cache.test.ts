import { renderHook, act } from '@testing-library/react';
import { useVersionCache, useAvailableVersionsCache } from './use-version-cache';

// Mock the environment store
const mockSetAvailableVersions = jest.fn();
jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(() => ({
    availableVersions: {},
    setAvailableVersions: mockSetAvailableVersions,
  })),
}));

describe('useVersionCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return null for cache miss', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    expect(result.current.get('non-existent')).toBeNull();
  });

  it('should store and retrieve cached values', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    act(() => {
      result.current.set('key1', 'value1');
    });

    expect(result.current.get('key1')).toBe('value1');
  });

  it('should return cached value before expiry', () => {
    const { result } = renderHook(() => useVersionCache<string>({ expiryMs: 5000 }));

    act(() => {
      result.current.set('key1', 'value1');
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.get('key1')).toBe('value1');
  });

  it('should return null after cache expiry', () => {
    const { result } = renderHook(() => useVersionCache<string>({ expiryMs: 5000 }));

    act(() => {
      result.current.set('key1', 'value1');
    });

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.get('key1')).toBeNull();
  });

  it('should invalidate specific cache entry', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    act(() => {
      result.current.set('key1', 'value1');
      result.current.set('key2', 'value2');
    });

    act(() => {
      result.current.invalidate('key1');
    });

    expect(result.current.get('key1')).toBeNull();
    expect(result.current.get('key2')).toBe('value2');
  });

  it('should invalidate all cache entries', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    act(() => {
      result.current.set('key1', 'value1');
      result.current.set('key2', 'value2');
      result.current.set('key3', 'value3');
    });

    act(() => {
      result.current.invalidateAll();
    });

    expect(result.current.get('key1')).toBeNull();
    expect(result.current.get('key2')).toBeNull();
    expect(result.current.get('key3')).toBeNull();
  });

  it('should check if cache entry isValid', () => {
    const { result } = renderHook(() => useVersionCache<string>({ expiryMs: 5000 }));

    expect(result.current.isValid('key1')).toBe(false);

    act(() => {
      result.current.set('key1', 'value1');
    });

    expect(result.current.isValid('key1')).toBe(true);

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.isValid('key1')).toBe(false);
  });

  it('should update existing cache entry', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    act(() => {
      result.current.set('key1', 'value1');
    });

    expect(result.current.get('key1')).toBe('value1');

    act(() => {
      result.current.set('key1', 'updated');
    });

    expect(result.current.get('key1')).toBe('updated');
  });

  it('should handle complex data types', () => {
    const { result } = renderHook(() => useVersionCache<{ versions: string[] }>());

    const data = { versions: ['1.0.0', '2.0.0', '3.0.0'] };

    act(() => {
      result.current.set('python', data);
    });

    expect(result.current.get('python')).toEqual(data);
  });

  it('should use default expiry when not specified', () => {
    const { result } = renderHook(() => useVersionCache<string>());

    act(() => {
      result.current.set('key1', 'value1');
    });

    // Default is 5 minutes (300000ms)
    act(() => {
      jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    });

    expect(result.current.get('key1')).toBe('value1');

    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (total 6)
    });

    expect(result.current.get('key1')).toBeNull();
  });
});

describe('useAvailableVersionsCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return cache methods', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());

    expect(result.current).toHaveProperty('getCachedVersions');
    expect(result.current).toHaveProperty('setCachedVersions');
    expect(result.current).toHaveProperty('isCacheValid');
    expect(result.current).toHaveProperty('invalidateCache');
  });

  it('should sync with environment store on setCachedVersions', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());
    const versions = [{ version: '3.9' }, { version: '3.10' }];

    act(() => {
      result.current.setCachedVersions('python', versions as never);
    });

    expect(mockSetAvailableVersions).toHaveBeenCalledWith('python', versions);
  });

  it('should return null for invalid cache', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());

    expect(result.current.getCachedVersions('python')).toBeNull();
  });

  it('should report cache as invalid before set', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());

    expect(result.current.isCacheValid('python')).toBe(false);
  });

  it('should invalidate specific environment cache', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());

    act(() => {
      result.current.setCachedVersions('python', [] as never);
    });

    expect(result.current.isCacheValid('python')).toBe(true);

    act(() => {
      result.current.invalidateCache('python');
    });

    expect(result.current.isCacheValid('python')).toBe(false);
  });

  it('should invalidate all caches', () => {
    const { result } = renderHook(() => useAvailableVersionsCache());

    act(() => {
      result.current.setCachedVersions('python', [] as never);
      result.current.setCachedVersions('node', [] as never);
    });

    act(() => {
      result.current.invalidateCache();
    });

    expect(result.current.isCacheValid('python')).toBe(false);
    expect(result.current.isCacheValid('node')).toBe(false);
  });
});
