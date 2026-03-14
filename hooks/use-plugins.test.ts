import { renderHook, act } from '@testing-library/react';
import { usePlugins } from '@/hooks/use-plugins';
import { usePluginStore } from '@/lib/stores/plugin';
import { useToolboxStore } from '@/lib/stores/toolbox';
import type { PluginMarketplaceActionResult } from '@/types/plugin';

jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => false),
  pluginList: jest.fn(),
  pluginListAllTools: jest.fn(),
  pluginInstall: jest.fn(),
  pluginInstallMarketplace: jest.fn(),
  pluginInstallMarketplaceWithResult: jest.fn(),
  pluginImportLocal: jest.fn(),
  pluginUninstall: jest.fn(),
  pluginEnable: jest.fn(),
  pluginDisable: jest.fn(),
  pluginReload: jest.fn(),
  pluginCallTool: jest.fn(),
  pluginGetPermissions: jest.fn(),
  pluginGetPermissionMode: jest.fn(),
  pluginGrantPermission: jest.fn(),
  pluginRevokePermission: jest.fn(),
  pluginGetLocales: jest.fn(),
  pluginScaffold: jest.fn(),
  pluginOpenScaffoldFolder: jest.fn(),
  pluginOpenScaffoldInVscode: jest.fn(),
  pluginValidate: jest.fn(),
  pluginCheckUpdate: jest.fn(),
  pluginUpdate: jest.fn(),
  pluginUpdateWithResult: jest.fn(),
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
      permissionMode: 'compat',
      permissionStates: {},
      pendingUpdates: [],
    });
    useToolboxStore.setState({
      ...useToolboxStore.getState(),
      continuationHint: null,
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
    expect(typeof result.current.installMarketplacePlugin).toBe('function');
    expect(typeof result.current.installMarketplacePluginWithResult).toBe('function');
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
    expect(typeof result.current.openScaffoldFolder).toBe('function');
    expect(typeof result.current.openScaffoldInVscode).toBe('function');
    expect(typeof result.current.validatePlugin).toBe('function');
    expect(typeof result.current.checkUpdate).toBe('function');
    expect(typeof result.current.updatePlugin).toBe('function');
    expect(typeof result.current.updatePluginWithResult).toBe('function');
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
    expect(result.current.permissionMode).toBe('compat');
    expect(result.current.permissionStates).toEqual({});
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

  it('returns actionable result when marketplace install is unavailable outside desktop runtime', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());

    let actionResult: PluginMarketplaceActionResult | null = null;
    await act(async () => {
      actionResult = await result.current.installMarketplacePluginWithResult('hello-world-rust');
    });

    expect(actionResult).toEqual({
      ok: false,
      action: 'install',
      pluginId: null,
      phase: 'failed',
      downloadTaskId: null,
      error: {
        category: 'source_unavailable',
        message: 'Marketplace install requires desktop runtime.',
        retryable: false,
      },
    });
  });

  it('normalizes marketplace install errors into actionable categories', async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.pluginInstallMarketplaceWithResult.mockRejectedValue(new Error('network timeout'));
    const { result } = renderHook(() => usePlugins());

    let actionResult: PluginMarketplaceActionResult | null = null;
    await act(async () => {
      actionResult = await result.current.installMarketplacePluginWithResult('hello-world-rust');
    });

    expect(actionResult).toEqual({
      ok: false,
      action: 'install',
      pluginId: null,
      phase: 'failed',
      downloadTaskId: null,
      error: {
        category: 'source_unavailable',
        message: 'network timeout',
        retryable: true,
      },
    });
  });

  it('normalizes marketplace update errors into validation category', async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.pluginUpdateWithResult.mockRejectedValue(new Error('checksum mismatch in artifact'));
    const { result } = renderHook(() => usePlugins());

    let actionResult: PluginMarketplaceActionResult | null = null;
    await act(async () => {
      actionResult = await result.current.updatePluginWithResult('com.cognia.hello-world');
    });

    expect(actionResult).toEqual({
      ok: false,
      action: 'update',
      pluginId: 'com.cognia.hello-world',
      phase: 'failed',
      downloadTaskId: null,
      error: {
        category: 'validation_failed',
        message: 'checksum mismatch in artifact',
        retryable: false,
      },
    });
  });

  it('clears marketplace continuation after uninstalling a store plugin', async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.pluginUninstall.mockResolvedValue(undefined);

    usePluginStore.setState({
      ...usePluginStore.getState(),
      installedPlugins: [
        {
          id: 'com.example.store',
          name: 'Store Plugin',
          version: '1.0.0',
          description: 'Store plugin',
          authors: [],
          toolCount: 1,
          enabled: true,
          installedAt: '2026-03-06T00:00:00.000Z',
          updatedAt: null,
          updateUrl: null,
          source: { type: 'store', storeId: 'store-plugin' },
          builtinCandidate: false,
          builtinSyncStatus: null,
          builtinSyncMessage: null,
        },
      ],
    });
    useToolboxStore.getState().setContinuationHint({
      kind: 'marketplace-install',
      listingId: 'store-plugin',
      pluginId: 'com.example.store',
      toolId: 'plugin:com.example.store:demo',
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.uninstallPlugin('com.example.store');
    });

    expect(useToolboxStore.getState().continuationHint).toBeNull();
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
    expect(tauri.pluginListAllTools).not.toHaveBeenCalled();

    await act(async () => {
      resolvePlugins([]);
      await Promise.resolve();
    });

    expect(tauri.pluginListAllTools).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveTools([]);
      await firstPromise;
    });
  });

  it('should normalize plugin metadata and derive bounded preview metadata during fetch', async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.pluginList.mockResolvedValue([
      {
        id: 'com.example.preview',
        name: 'Preview Plugin',
        version: '1.0.0',
        description: '   ',
        authors: ['Example'],
        toolCount: 4,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/preview' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    ]);
    tauri.pluginListAllTools.mockResolvedValue([
      {
        pluginId: 'com.example.preview',
        pluginName: 'Preview Plugin',
        toolId: 't3',
        nameEn: 'Zulu',
        nameZh: null,
        descriptionEn: 'Zulu tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'zulu',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.preview',
        pluginName: 'Preview Plugin',
        toolId: 't2',
        nameEn: 'alpha',
        nameZh: null,
        descriptionEn: 'Alpha tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'alpha',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.preview',
        pluginName: 'Preview Plugin',
        toolId: 't1',
        nameEn: 'Beta',
        nameZh: null,
        descriptionEn: 'Beta tool',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'beta',
        uiMode: 'text',
      },
      {
        pluginId: 'com.example.preview',
        pluginName: 'Preview Plugin',
        toolId: 't0',
        nameEn: '  ',
        nameZh: null,
        descriptionEn: '  ',
        descriptionZh: null,
        category: 'developer',
        keywords: [],
        icon: 'Tool',
        entry: 'zero',
        uiMode: 'text',
      },
    ]);
    tauri.pluginGetPermissionMode.mockResolvedValue('strict');
    tauri.pluginGetPermissions.mockResolvedValue({
      declared: {
        uiFeedback: false,
        uiDialog: false,
        uiFilePicker: false,
        uiNavigation: false,
        fsRead: [],
        fsWrite: [],
        http: [],
        configRead: false,
        configWrite: false,
        envRead: false,
        pkgSearch: false,
        pkgInstall: false,
        clipboard: false,
        notification: false,
        processExec: false,
      },
      granted: [],
      denied: [],
    });

    const { result } = renderHook(() => usePlugins());
    await act(async () => {
      await result.current.fetchPlugins();
    });

    const state = usePluginStore.getState();
    expect(state.permissionMode).toBe('strict');
    expect(state.installedPlugins).toHaveLength(1);
    expect(state.pluginTools).toHaveLength(4);

    const plugin = state.installedPlugins[0];
    expect(plugin.description).toBe('');
    expect(plugin.descriptionFallbackNeeded).toBe(true);
    expect(plugin.toolPreviewLoading).toBe(false);
    expect(plugin.toolPreviewCount).toBe(4);
    expect(plugin.toolPreviews).toHaveLength(3);
    expect(plugin.hasMoreToolPreviews).toBe(true);
    expect(plugin.toolPreviews?.map((tool) => tool.toolId)).toEqual(['t2', 't1', 't0']);

    const normalizedTool = state.pluginTools.find((tool) => tool.toolId === 't0');
    expect(normalizedTool?.nameEn).toBe('t0');
    expect(normalizedTool?.descriptionEn).toBe('');
    expect(normalizedTool?.descriptionFallbackNeeded).toBe(true);
  });

  it('should expose explicit empty preview state after hydration when plugin has no tools', async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.pluginList.mockResolvedValue([
      {
        id: 'com.example.empty',
        name: 'Empty Plugin',
        version: '1.0.0',
        description: 'Plugin without tools',
        authors: [],
        toolCount: 0,
        enabled: true,
        installedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: null,
        updateUrl: null,
        source: { type: 'local', path: 'C:/plugins/empty' },
        builtinCandidate: false,
        builtinSyncStatus: null,
        builtinSyncMessage: null,
      },
    ]);
    tauri.pluginListAllTools.mockResolvedValue([]);
    tauri.pluginGetPermissionMode.mockResolvedValue('compat');
    tauri.pluginGetPermissions.mockResolvedValue({
      declared: {
        uiFeedback: false,
        uiDialog: false,
        uiFilePicker: false,
        uiNavigation: false,
        fsRead: [],
        fsWrite: [],
        http: [],
        configRead: false,
        configWrite: false,
        envRead: false,
        pkgSearch: false,
        pkgInstall: false,
        clipboard: false,
        notification: false,
        processExec: false,
      },
      granted: [],
      denied: [],
    });

    const { result } = renderHook(() => usePlugins());
    await act(async () => {
      await result.current.fetchPlugins();
    });

    const plugin = usePluginStore.getState().installedPlugins[0];
    expect(plugin.descriptionFallbackNeeded).toBe(false);
    expect(plugin.toolPreviews).toEqual([]);
    expect(plugin.toolPreviewCount).toBe(0);
    expect(plugin.hasMoreToolPreviews).toBe(false);
    expect(plugin.toolPreviewLoading).toBe(false);
  });

  it('should skip scaffold when not Tauri', async () => {
    tauri.isTauri.mockReturnValue(false);
    const { result } = renderHook(() => usePlugins());
    const scaffoldResult = await act(async () => {
      return result.current.scaffoldPlugin({
        name: 'Test', id: 'test', description: '', author: '', outputDir: '/tmp',
        language: 'rust', permissions: {
          uiFeedback: false, uiDialog: false, uiFilePicker: false, uiNavigation: false,
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
