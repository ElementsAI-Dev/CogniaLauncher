import { renderHook, act } from '@testing-library/react';
import { usePlugins } from '@/hooks/use-plugins';
import { usePluginStore } from '@/lib/stores/plugin';

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => false),
  pluginList: jest.fn(),
  pluginListAllTools: jest.fn(),
  pluginInstall: jest.fn(),
  pluginImportLocal: jest.fn(),
  pluginUninstall: jest.fn(),
  pluginEnable: jest.fn(),
  pluginDisable: jest.fn(),
  pluginReload: jest.fn(),
  pluginCallTool: jest.fn(),
  pluginGetPermissions: jest.fn(),
  pluginGrantPermission: jest.fn(),
  pluginRevokePermission: jest.fn(),
  pluginGetLocales: jest.fn(),
  pluginScaffold: jest.fn(),
  pluginValidate: jest.fn(),
  pluginCheckUpdate: jest.fn(),
  pluginUpdate: jest.fn(),
  pluginGetHealth: jest.fn(),
  pluginGetAllHealth: jest.fn(),
  pluginResetHealth: jest.fn(),
  pluginGetSettingsSchema: jest.fn(),
  pluginGetSettingsValues: jest.fn(),
  pluginSetSetting: jest.fn(),
  pluginExportData: jest.fn(),
  pluginCheckAllUpdates: jest.fn(),
  pluginUpdateAll: jest.fn(),
  pluginDispatchEvent: jest.fn(),
  pluginGetUiAsset: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const tauri = jest.requireMock('@/lib/tauri');

describe('usePlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePluginStore.setState({
      installedPlugins: [],
      pluginTools: [],
      loading: false,
      error: null,
      healthMap: {},
      pendingUpdates: [],
    });
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => usePlugins());
    expect(result.current.plugins).toBeDefined();
    expect(result.current.pluginTools).toBeDefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should expose all actions', () => {
    const { result } = renderHook(() => usePlugins());
    expect(typeof result.current.fetchPlugins).toBe('function');
    expect(typeof result.current.installPlugin).toBe('function');
    expect(typeof result.current.importLocalPlugin).toBe('function');
    expect(typeof result.current.uninstallPlugin).toBe('function');
    expect(typeof result.current.enablePlugin).toBe('function');
    expect(typeof result.current.disablePlugin).toBe('function');
    expect(typeof result.current.reloadPlugin).toBe('function');
    expect(typeof result.current.callTool).toBe('function');
    expect(typeof result.current.getPermissions).toBe('function');
    expect(typeof result.current.grantPermission).toBe('function');
    expect(typeof result.current.revokePermission).toBe('function');
    expect(typeof result.current.getLocales).toBe('function');
    expect(typeof result.current.translatePluginKey).toBe('function');
    expect(typeof result.current.scaffoldPlugin).toBe('function');
    expect(typeof result.current.validatePlugin).toBe('function');
    expect(typeof result.current.checkUpdate).toBe('function');
    expect(typeof result.current.updatePlugin).toBe('function');
    expect(typeof result.current.getHealth).toBe('function');
    expect(typeof result.current.getAllHealth).toBe('function');
    expect(typeof result.current.resetHealth).toBe('function');
    expect(typeof result.current.getSettingsSchema).toBe('function');
    expect(typeof result.current.getSettingsValues).toBe('function');
    expect(typeof result.current.setSetting).toBe('function');
    expect(typeof result.current.exportData).toBe('function');
    expect(typeof result.current.checkAllUpdates).toBe('function');
    expect(typeof result.current.updateAll).toBe('function');
    expect(typeof result.current.dispatchEvent).toBe('function');
    expect(typeof result.current.getUiAsset).toBe('function');
  });

  it('should expose healthMap and pendingUpdates state', () => {
    const { result } = renderHook(() => usePlugins());
    expect(result.current.healthMap).toEqual({});
    expect(result.current.pendingUpdates).toEqual([]);
  });

  it('should skip fetch when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => {
      await result.current.fetchPlugins();
    });
    expect(tauri.pluginList).not.toHaveBeenCalled();
  });

  it('should skip install when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => {
      await result.current.installPlugin('https://example.com/plugin.zip');
    });
    expect(tauri.pluginInstall).not.toHaveBeenCalled();
  });

  it('should keep fetchPlugins callback stable across store updates', () => {
    const { result } = renderHook(() => usePlugins());
    const initialFetchPlugins = result.current.fetchPlugins;

    act(() => {
      usePluginStore.getState().setLoading(true);
    });
    expect(result.current.fetchPlugins).toBe(initialFetchPlugins);

    act(() => {
      usePluginStore.getState().setError('test error');
    });
    expect(result.current.fetchPlugins).toBe(initialFetchPlugins);
  });

  it('should dedupe concurrent fetchPlugins calls in desktop mode', async () => {
    tauri.isTauri.mockReturnValue(true);

    let resolvePlugins!: (value: unknown[]) => void;
    let resolveTools!: (value: unknown[]) => void;

    tauri.pluginList.mockImplementation(
      () => new Promise((resolve) => { resolvePlugins = resolve; }),
    );
    tauri.pluginListAllTools.mockImplementation(
      () => new Promise((resolve) => { resolveTools = resolve; }),
    );

    const { result } = renderHook(() => usePlugins());
    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;

    act(() => {
      firstPromise = result.current.fetchPlugins() as Promise<void>;
      secondPromise = result.current.fetchPlugins() as Promise<void>;
    });

    expect(firstPromise).toBe(secondPromise);
    expect(tauri.pluginList).toHaveBeenCalledTimes(1);
    expect(tauri.pluginListAllTools).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePlugins([]);
      resolveTools([]);
      await firstPromise;
    });
  });

  it('should skip scaffold when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const scaffoldResult = await act(async () => {
      return result.current.scaffoldPlugin({
        name: 'Test', id: 'test', description: '', author: '', outputDir: '/tmp',
        language: 'rust', permissions: {
          configRead: true, envRead: true, pkgSearch: false,
          clipboard: false, notification: false, processExec: false,
          fsRead: false, fsWrite: false, http: [],
        },
      });
    });
    expect(scaffoldResult).toBeNull();
    expect(tauri.pluginScaffold).not.toHaveBeenCalled();
  });

  it('should skip validate when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const validateResult = await act(async () => {
      return result.current.validatePlugin('/some/path');
    });
    expect(validateResult).toBeNull();
  });

  it('should skip getLocales when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const locales = await act(async () => {
      return result.current.getLocales('test-plugin');
    });
    expect(locales).toBeNull();
  });

  it('should translate plugin key with locales', () => {
    const { result } = renderHook(() => usePlugins());
    const locales = {
      en: { greeting: 'Hello, {name}!' },
      zh: { greeting: '你好，{name}！' },
    };

    const enResult = result.current.translatePluginKey(locales, 'en', 'greeting', { name: 'World' });
    expect(enResult).toBe('Hello, World!');

    const zhResult = result.current.translatePluginKey(locales, 'zh', 'greeting', { name: 'World' });
    expect(zhResult).toBe('你好，World！');
  });

  it('should fallback to en locale when requested locale missing', () => {
    const { result } = renderHook(() => usePlugins());
    const locales = {
      en: { greeting: 'Hello' },
    };

    const result2 = result.current.translatePluginKey(locales, 'fr', 'greeting');
    expect(result2).toBe('Hello');
  });

  it('should fallback to raw key when no locale match', () => {
    const { result } = renderHook(() => usePlugins());
    const locales = {
      en: { other: 'Other' },
    };

    const result2 = result.current.translatePluginKey(locales, 'en', 'missing_key');
    expect(result2).toBe('missing_key');
  });

  it('should return key when locales is null', () => {
    const { result } = renderHook(() => usePlugins());
    const result2 = result.current.translatePluginKey(null, 'en', 'some_key');
    expect(result2).toBe('some_key');
  });

  // --- New actions: skip when not Tauri ---

  it('should skip getHealth when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const health = await act(async () => result.current.getHealth('test'));
    expect(health).toBeNull();
    expect(tauri.pluginGetHealth).not.toHaveBeenCalled();
  });

  it('should skip getAllHealth when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const map = await act(async () => result.current.getAllHealth());
    expect(map).toBeNull();
    expect(tauri.pluginGetAllHealth).not.toHaveBeenCalled();
  });

  it('should skip resetHealth when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => result.current.resetHealth('test'));
    expect(tauri.pluginResetHealth).not.toHaveBeenCalled();
  });

  it('should skip getSettingsSchema when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const schema = await act(async () => result.current.getSettingsSchema('test'));
    expect(schema).toBeNull();
    expect(tauri.pluginGetSettingsSchema).not.toHaveBeenCalled();
  });

  it('should skip getSettingsValues when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const values = await act(async () => result.current.getSettingsValues('test'));
    expect(values).toBeNull();
    expect(tauri.pluginGetSettingsValues).not.toHaveBeenCalled();
  });

  it('should skip setSetting when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => result.current.setSetting('test', 'key', 'value'));
    expect(tauri.pluginSetSetting).not.toHaveBeenCalled();
  });

  it('should skip exportData when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const path = await act(async () => result.current.exportData('test'));
    expect(path).toBeNull();
    expect(tauri.pluginExportData).not.toHaveBeenCalled();
  });

  it('should skip checkAllUpdates when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const updates = await act(async () => result.current.checkAllUpdates());
    expect(updates).toEqual([]);
    expect(tauri.pluginCheckAllUpdates).not.toHaveBeenCalled();
  });

  it('should skip updateAll when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => result.current.updateAll());
    expect(tauri.pluginUpdateAll).not.toHaveBeenCalled();
  });

  it('should skip dispatchEvent when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    await act(async () => result.current.dispatchEvent('test_event', { foo: 'bar' }));
    expect(tauri.pluginDispatchEvent).not.toHaveBeenCalled();
  });

  it('should skip getUiAsset when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const asset = await act(async () => result.current.getUiAsset('test', 'index.html'));
    expect(asset).toBeNull();
    expect(tauri.pluginGetUiAsset).not.toHaveBeenCalled();
  });
});
