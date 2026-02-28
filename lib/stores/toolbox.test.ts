import { act, renderHook } from '@testing-library/react';
import { useToolboxStore } from '@/lib/stores/toolbox';

describe('useToolboxStore', () => {
  beforeEach(() => {
    // Reset store to clean defaults
    useToolboxStore.setState({
      favorites: [],
      recentTools: [],
      viewMode: 'grid',
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
});
