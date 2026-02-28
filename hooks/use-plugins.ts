import { useCallback } from 'react';
import { usePluginStore } from '@/lib/stores/plugin';
import {
  pluginList,
  pluginListAllTools,
  pluginInstall,
  pluginImportLocal,
  pluginUninstall,
  pluginEnable,
  pluginDisable,
  pluginReload,
  pluginCallTool,
  pluginGetPermissions,
  pluginGrantPermission,
  pluginRevokePermission,
  pluginGetLocales,
  pluginScaffold,
  pluginValidate,
  pluginCheckUpdate,
  pluginUpdate,
} from '@/lib/tauri';
import type { ScaffoldConfig, ScaffoldResult, ValidationResult, PluginUpdateInfo } from '@/types/plugin';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';

export function usePlugins() {
  const store = usePluginStore();

  const fetchPlugins = useCallback(async () => {
    if (!isTauri()) return;
    store.setLoading(true);
    store.setError(null);
    try {
      const [plugins, tools] = await Promise.all([
        pluginList(),
        pluginListAllTools(),
      ]);
      store.setInstalledPlugins(plugins);
      store.setPluginTools(tools);
    } catch (e) {
      store.setError((e as Error).message ?? String(e));
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const installPlugin = useCallback(async (source: string) => {
    if (!isTauri()) return;
    store.setLoading(true);
    try {
      const pluginId = await pluginInstall(source);
      toast.success(`Plugin installed: ${pluginId}`);
      await fetchPlugins();
      return pluginId;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Install failed: ${msg}`);
      store.setError(msg);
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchPlugins]);

  const importLocalPlugin = useCallback(async (path: string) => {
    if (!isTauri()) return;
    store.setLoading(true);
    try {
      const pluginId = await pluginImportLocal(path);
      toast.success(`Plugin imported: ${pluginId}`);
      await fetchPlugins();
      return pluginId;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Import failed: ${msg}`);
      store.setError(msg);
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchPlugins]);

  const uninstallPlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginUninstall(pluginId);
      store.removePlugin(pluginId);
      toast.success(`Plugin uninstalled: ${pluginId}`);
    } catch (e) {
      toast.error(`Uninstall failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [store]);

  const enablePlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginEnable(pluginId);
      store.updatePlugin(pluginId, { enabled: true });
      // Refresh tools since enabling a plugin adds its tools
      const tools = await pluginListAllTools();
      store.setPluginTools(tools);
    } catch (e) {
      toast.error(`Enable failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [store]);

  const disablePlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginDisable(pluginId);
      store.updatePlugin(pluginId, { enabled: false });
      // Refresh tools since disabling removes its tools
      const tools = await pluginListAllTools();
      store.setPluginTools(tools);
    } catch (e) {
      toast.error(`Disable failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [store]);

  const reloadPlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginReload(pluginId);
      toast.success(`Plugin reloaded: ${pluginId}`);
    } catch (e) {
      toast.error(`Reload failed: ${(e as Error).message ?? String(e)}`);
    }
  }, []);

  const callTool = useCallback(async (pluginId: string, toolEntry: string, input: string) => {
    if (!isTauri()) return '';
    try {
      return await pluginCallTool(pluginId, toolEntry, input);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Tool execution failed: ${msg}`);
      throw e;
    }
  }, []);

  const getPermissions = useCallback(async (pluginId: string) => {
    if (!isTauri()) return null;
    return pluginGetPermissions(pluginId);
  }, []);

  const grantPermission = useCallback(async (pluginId: string, permission: string) => {
    if (!isTauri()) return;
    await pluginGrantPermission(pluginId, permission);
  }, []);

  const revokePermission = useCallback(async (pluginId: string, permission: string) => {
    if (!isTauri()) return;
    await pluginRevokePermission(pluginId, permission);
  }, []);

  const getLocales = useCallback(async (pluginId: string) => {
    if (!isTauri()) return null;
    try {
      return await pluginGetLocales(pluginId);
    } catch {
      return null;
    }
  }, []);

  const translatePluginKey = useCallback(
    (
      locales: Record<string, Record<string, string>> | null,
      locale: string,
      key: string,
      params?: Record<string, string>,
    ): string => {
      if (!locales) return key;
      const strings = locales[locale] ?? locales['en'] ?? {};
      let text = strings[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, v);
        }
      }
      return text;
    },
    [],
  );

  const scaffoldPlugin = useCallback(async (config: ScaffoldConfig): Promise<ScaffoldResult | null> => {
    if (!isTauri()) return null;
    store.setLoading(true);
    try {
      const result = await pluginScaffold(config);
      toast.success(`Plugin scaffolded at: ${result.pluginDir}`);
      return result;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Scaffold failed: ${msg}`);
      store.setError(msg);
      return null;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const validatePlugin = useCallback(async (path: string): Promise<ValidationResult | null> => {
    if (!isTauri()) return null;
    try {
      return await pluginValidate(path);
    } catch (e) {
      toast.error(`Validation failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, []);

  const checkUpdate = useCallback(async (pluginId: string): Promise<PluginUpdateInfo | null> => {
    if (!isTauri()) return null;
    try {
      return await pluginCheckUpdate(pluginId);
    } catch (e) {
      toast.error(`Update check failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, []);

  const updatePlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    store.setLoading(true);
    try {
      await pluginUpdate(pluginId);
      toast.success(`Plugin updated: ${pluginId}`);
      await fetchPlugins();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Update failed: ${msg}`);
      store.setError(msg);
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchPlugins]);

  return {
    plugins: store.installedPlugins,
    pluginTools: store.pluginTools,
    loading: store.loading,
    error: store.error,
    fetchPlugins,
    installPlugin,
    importLocalPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    reloadPlugin,
    callTool,
    getPermissions,
    grantPermission,
    revokePermission,
    getLocales,
    translatePluginKey,
    scaffoldPlugin,
    validatePlugin,
    checkUpdate,
    updatePlugin,
  };
}
