import { act, renderHook } from '@testing-library/react';
import { SEARCH_HISTORY_KEY } from '@/lib/constants/packages';
import { useSearchHistory } from './use-search-history';

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('loads and saves search history', () => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(['node']));
    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.searchHistory).toEqual(['node']);

    act(() => {
      result.current.saveToHistory('python');
    });

    expect(result.current.searchHistory[0]).toBe('python');
    expect(JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')[0]).toBe(
      'python',
    );
  });

  it('ignores localStorage failures without throwing', () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });

    const { result } = renderHook(() => useSearchHistory());
    expect(() => {
      act(() => {
        result.current.saveToHistory('rust');
      });
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});

