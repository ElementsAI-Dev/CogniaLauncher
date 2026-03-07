import { act, renderHook } from '@testing-library/react';
import { useToolboxStore } from '@/lib/stores/toolbox';

describe('useToolboxStore', () => {
  beforeEach(() => {
    // Reset store to clean defaults
    useToolboxStore.setState({
      favorites: [],
      recentTools: [],
      toolUseCounts: {},
      toolPreferences: {},
      viewMode: 'grid',
      toolLifecycles: {},
      continuationHint: null,
      selectedCategory: 'all',
      searchQuery: '',
      activeToolId: null,
    });
  });

  // --- Initial state ---

  it('should have correct default state', () => {
    const { result } = renderHook(() => useToolboxStore());
    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.searchQuery).toBe('');
    expect(result.current.activeToolId).toBeNull();
    expect(result.current.viewMode).toBe('grid');
  });

  // --- Favorites ---

  it('should toggle a tool as favorite', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.toggleFavorite('builtin:json-formatter');
    });
    expect(result.current.favorites).toContain('builtin:json-formatter');
  });

  it('should remove a favorite on second toggle', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.toggleFavorite('builtin:json-formatter');
    });
    act(() => {
      result.current.toggleFavorite('builtin:json-formatter');
    });
    expect(result.current.favorites).not.toContain('builtin:json-formatter');
  });

  it('should support multiple favorites', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.toggleFavorite('builtin:json-formatter');
      result.current.toggleFavorite('builtin:uuid-generator');
    });
    expect(result.current.favorites).toHaveLength(2);
  });

  // --- Recent tools ---

  it('should add a tool to recent list', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.addRecent('builtin:json-formatter');
    });
    expect(result.current.recentTools[0]).toBe('builtin:json-formatter');
  });

  it('should move duplicates to front of recent list', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.addRecent('tool-a');
      result.current.addRecent('tool-b');
      result.current.addRecent('tool-a');
    });
    expect(result.current.recentTools[0]).toBe('tool-a');
    expect(result.current.recentTools[1]).toBe('tool-b');
    expect(result.current.recentTools).toHaveLength(2);
  });

  it('should limit recent tools to 10', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.addRecent(`tool-${i}`);
      }
    });
    expect(result.current.recentTools).toHaveLength(10);
    expect(result.current.recentTools[0]).toBe('tool-14');
  });

  // --- Tool usage counts ---

  it('should increment toolUseCounts on addRecent', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.addRecent('tool-a');
      result.current.addRecent('tool-b');
      result.current.addRecent('tool-a');
    });
    expect(result.current.toolUseCounts['tool-a']).toBe(2);
    expect(result.current.toolUseCounts['tool-b']).toBe(1);
  });

  it('should start toolUseCounts at 0 for new tools', () => {
    const { result } = renderHook(() => useToolboxStore());
    expect(result.current.toolUseCounts).toEqual({});
    act(() => {
      result.current.addRecent('new-tool');
    });
    expect(result.current.toolUseCounts['new-tool']).toBe(1);
  });

  // --- View mode ---

  it('should toggle view mode to list', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setViewMode('list');
    });
    expect(result.current.viewMode).toBe('list');
  });

  it('should toggle view mode back to grid', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setViewMode('list');
    });
    act(() => {
      result.current.setViewMode('grid');
    });
    expect(result.current.viewMode).toBe('grid');
  });

  // --- Category ---

  it('should set selected category', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setCategory('formatters');
    });
    expect(result.current.selectedCategory).toBe('formatters');
  });

  it('should support special categories', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setCategory('favorites');
    });
    expect(result.current.selectedCategory).toBe('favorites');
    act(() => {
      result.current.setCategory('recent');
    });
    expect(result.current.selectedCategory).toBe('recent');
  });

  // --- Search ---

  it('should set search query', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setSearchQuery('json');
    });
    expect(result.current.searchQuery).toBe('json');
  });

  // --- Active tool ---

  it('should set active tool ID', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setActiveToolId('builtin:json-formatter');
    });
    expect(result.current.activeToolId).toBe('builtin:json-formatter');
  });

  it('should clear active tool ID', () => {
    const { result } = renderHook(() => useToolboxStore());
    act(() => {
      result.current.setActiveToolId('some-tool');
    });
    act(() => {
      result.current.setActiveToolId(null);
    });
    expect(result.current.activeToolId).toBeNull();
  });

  describe('tool preferences', () => {
    it('should merge tool preferences by toolId', () => {
      const { result } = renderHook(() => useToolboxStore());
      act(() => {
        result.current.setToolPreferences('json-formatter', { indent: '4', sortKeys: true });
      });
      act(() => {
        result.current.setToolPreferences('json-formatter', { escapeUnicode: true });
      });

      const preferences = result.current.getToolPreferences('json-formatter', {
        indent: '2',
        sortKeys: false,
        escapeUnicode: false,
      });

      expect(preferences.indent).toBe('4');
      expect(preferences.sortKeys).toBe(true);
      expect(preferences.escapeUnicode).toBe(true);
    });

    it('should fallback to defaults for mismatched types', () => {
      const { result } = renderHook(() => useToolboxStore());
      act(() => {
        result.current.setToolPreferences('json-formatter', { indent: 4 as unknown as string });
      });

      const preferences = result.current.getToolPreferences('json-formatter', {
        indent: '2',
        sortKeys: false,
      });

      expect(preferences.indent).toBe('2');
      expect(preferences.sortKeys).toBe(false);
    });
  });

  describe('tool lifecycle', () => {
    it('sets tool lifecycle phase', () => {
      const { result } = renderHook(() => useToolboxStore());
      act(() => {
        result.current.setToolLifecycle('plugin:test:tool', 'execute');
      });
      expect(result.current.toolLifecycles['plugin:test:tool']?.phase).toBe('execute');
    });

    it('clears tool lifecycle phase', () => {
      const { result } = renderHook(() => useToolboxStore());
      act(() => {
        result.current.setToolLifecycle('plugin:test:tool', 'failure', 'boom');
      });
      act(() => {
        result.current.clearToolLifecycle('plugin:test:tool');
      });
      expect(result.current.toolLifecycles['plugin:test:tool']).toBeUndefined();
    });
  });

  describe('continuation hint', () => {
    it('stores latest marketplace continuation hint', () => {
      const { result } = renderHook(() => useToolboxStore());

      act(() => {
        result.current.setContinuationHint({
          kind: 'marketplace-install',
          listingId: 'hello-world-rust',
          pluginId: 'com.cognia.hello-world',
          toolId: 'plugin:com.cognia.hello-world:hello',
          timestamp: 1234,
        });
      });

      expect(result.current.continuationHint).toEqual({
        kind: 'marketplace-install',
        listingId: 'hello-world-rust',
        pluginId: 'com.cognia.hello-world',
        toolId: 'plugin:com.cognia.hello-world:hello',
        timestamp: 1234,
      });
    });

    it('clears continuation hint', () => {
      const { result } = renderHook(() => useToolboxStore());

      act(() => {
        result.current.setContinuationHint({
          kind: 'marketplace-update',
          listingId: 'hello-world-rust',
          pluginId: 'com.cognia.hello-world',
          toolId: null,
          timestamp: 5678,
        });
      });

      act(() => {
        result.current.clearContinuationHint();
      });

      expect(result.current.continuationHint).toBeNull();
    });
  });

  describe('persist migration', () => {
    const getPersistConfig = () =>
      (useToolboxStore as unknown as {
        persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } };
      }).persist.getOptions();

    it('sanitizes malformed persisted state', () => {
      const migrated = getPersistConfig().migrate(
        {
          favorites: ['a', 123, 'b'],
          recentTools: ['x', 'y'],
          toolUseCounts: { ok: 2, bad: -1, weird: 'x' },
          toolPreferences: {
            'json-formatter': { indent: '2', sortKeys: true, invalid: { nested: true } },
            invalid: 'value',
          },
          viewMode: 'invalid',
        },
        2,
      ) as Record<string, unknown>;

      expect(migrated.favorites).toEqual(['a', 'b']);
      expect(migrated.recentTools).toEqual(['x', 'y']);
      expect(migrated.toolUseCounts).toEqual({ ok: 2 });
      expect(migrated.viewMode).toBe('grid');
      expect(migrated.toolPreferences).toEqual({
        'json-formatter': { indent: '2', sortKeys: true },
        invalid: {},
      });
    });
  });
});
