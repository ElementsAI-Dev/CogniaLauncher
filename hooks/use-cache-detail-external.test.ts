import { renderHook } from '@testing-library/react';
import { useCacheDetailExternal } from './use-cache-detail-external';

const mockUseExternalCache = jest.fn();

jest.mock('@/hooks/use-external-cache', () => ({
  useExternalCache: (...args: unknown[]) => mockUseExternalCache(...args),
}));

describe('useCacheDetailExternal', () => {
  it('forwards expected options to useExternalCache', () => {
    mockUseExternalCache.mockReturnValue({ ok: true });
    const t = (k: string) => k;

    const { result } = renderHook(() => useCacheDetailExternal({ t }));

    expect(mockUseExternalCache).toHaveBeenCalledWith({
      t,
      includePathInfos: true,
      autoFetch: true,
      defaultUseTrash: true,
    });
    expect(result.current).toEqual({ ok: true });
  });
});

