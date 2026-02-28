import { act, renderHook } from '@testing-library/react';
import { usePluginStore } from '@/lib/stores/plugin';
import type { PluginInfo, PluginToolInfo } from '@/types/plugin';

const mockPlugin: PluginInfo = {
  id: 'com.example.test',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  authors: ['Test Author'],
  toolCount: 1,
  enabled: true,
  installedAt: '2025-01-01T00:00:00Z',
  source: { type: 'builtIn' },
};

const mockTool: PluginToolInfo = {
  pluginId: 'com.example.test',
  pluginName: 'Test Plugin',
  toolId: 'tool-1',
  nameEn: 'Test Tool',
  nameZh: null,
  descriptionEn: 'A test tool',
  descriptionZh: null,
  category: 'developer',
  keywords: ['test'],
  icon: 'Wrench',
  entry: 'test_fn',
  uiMode: 'text',
};

describe('usePluginStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setInstalledPlugins([]);
      result.current.setPluginTools([]);
      result.current.setLoading(false);
      result.current.setError(null);
    });
  });

  it('should have empty initial state', () => {
    const { result } = renderHook(() => usePluginStore());
    expect(result.current.installedPlugins).toEqual([]);
    expect(result.current.pluginTools).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set installed plugins', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setInstalledPlugins([mockPlugin]);
    });
    expect(result.current.installedPlugins).toEqual([mockPlugin]);
  });

  it('should set plugin tools', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setPluginTools([mockTool]);
    });
    expect(result.current.pluginTools).toEqual([mockTool]);
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);
  });

  it('should set error state', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setError('Something failed');
    });
    expect(result.current.error).toBe('Something failed');
  });

  it('should add a plugin', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.addPlugin(mockPlugin);
    });
    expect(result.current.installedPlugins).toHaveLength(1);
    expect(result.current.installedPlugins[0].id).toBe('com.example.test');
  });

  it('should update a plugin', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setInstalledPlugins([mockPlugin]);
    });
    act(() => {
      result.current.updatePlugin('com.example.test', { enabled: false });
    });
    expect(result.current.installedPlugins[0].enabled).toBe(false);
  });

  it('should not update nonexistent plugin', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setInstalledPlugins([mockPlugin]);
    });
    act(() => {
      result.current.updatePlugin('nonexistent', { enabled: false });
    });
    expect(result.current.installedPlugins[0].enabled).toBe(true);
  });

  it('should remove a plugin and its tools', () => {
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setInstalledPlugins([mockPlugin]);
      result.current.setPluginTools([mockTool]);
    });
    act(() => {
      result.current.removePlugin('com.example.test');
    });
    expect(result.current.installedPlugins).toHaveLength(0);
    expect(result.current.pluginTools).toHaveLength(0);
  });

  it('should only remove tools for removed plugin', () => {
    const otherTool: PluginToolInfo = { ...mockTool, pluginId: 'other', toolId: 'other-tool' };
    const { result } = renderHook(() => usePluginStore());
    act(() => {
      result.current.setPluginTools([mockTool, otherTool]);
    });
    act(() => {
      result.current.removePlugin('com.example.test');
    });
    expect(result.current.pluginTools).toHaveLength(1);
    expect(result.current.pluginTools[0].pluginId).toBe('other');
  });
});
