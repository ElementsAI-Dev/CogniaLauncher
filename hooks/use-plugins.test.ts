import { renderHook, act } from '@testing-library/react';
import { usePlugins } from '@/hooks/use-plugins';

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
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const tauri = jest.requireMock('@/lib/tauri');

describe('usePlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
