import { act, renderHook } from '@testing-library/react';
import { useToolPreferences } from './use-tool-preferences';
import { useToolboxStore } from '@/lib/stores/toolbox';

describe('useToolPreferences', () => {
  beforeEach(() => {
    useToolboxStore.setState({
      favorites: [],
      recentTools: [],
      toolUseCounts: {},
      toolPreferences: {},
      viewMode: 'grid',
      selectedCategory: 'all',
      searchQuery: '',
      activeToolId: null,
    });
  });

  it('returns default preferences when no saved data exists', () => {
    const { result } = renderHook(() =>
      useToolPreferences('json-formatter', { indent: '2', sortKeys: false }),
    );

    expect(result.current.preferences).toEqual({ indent: '2', sortKeys: false });
  });

  it('persists and returns updated preferences', () => {
    const { result } = renderHook(() =>
      useToolPreferences('json-formatter', { indent: '2', sortKeys: false }),
    );

    act(() => {
      result.current.setPreferences({ indent: '4' });
      result.current.setPreferences({ sortKeys: true });
    });

    expect(result.current.preferences).toEqual({ indent: '4', sortKeys: true });
  });

  it('falls back to defaults when persisted value type mismatches', () => {
    useToolboxStore.setState({
      toolPreferences: {
        'json-formatter': { indent: 4 as unknown as string, sortKeys: true },
      },
    });

    const { result } = renderHook(() =>
      useToolPreferences('json-formatter', { indent: '2', sortKeys: false }),
    );

    expect(result.current.preferences).toEqual({ indent: '2', sortKeys: true });
  });
});

