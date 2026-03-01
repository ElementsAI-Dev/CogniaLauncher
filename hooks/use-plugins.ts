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
  pluginGetHealth,
  pluginGetAllHealth,
  pluginResetHealth,
  pluginGetSettingsSchema,
  pluginGetSettingsValues,
  pluginSetSetting,
  pluginExportData,
  pluginCheckAllUpdates,
  pluginUpdateAll,
  pluginDispatchEvent,
  pluginGetUiAsset,
} from '@/lib/tauri';
import type {
  ScaffoldConfig,
  ScaffoldResult,
  ValidationResult,
  PluginUpdateInfo,
  PluginHealth,
  PluginSettingDeclaration,
} from '@/types/plugin';
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

  const getHealth = useCallback(async (pluginId: string): Promise<PluginHealth | null> => {
    if (!isTauri()) return null;
    try {
      const health = await pluginGetHealth(pluginId);
      store.setPluginHealth(pluginId, health);
      return health;
    } catch (e) {
      toast.error(`Health check failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, [store]);

  const getAllHealth = useCallback(async () => {
    if (!isTauri()) return null;
    try {
      const healthMap = await pluginGetAllHealth();
      store.setHealthMap(healthMap);
      return healthMap;
    } catch (e) {
      toast.error(`Health check failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, [store]);

  const resetHealth = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginResetHealth(pluginId);
      toast.success(`Health reset: ${pluginId}`);
      await getHealth(pluginId);
    } catch (e) {
      toast.error(`Reset failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [getHealth]);

  const getSettingsSchema = useCallback(async (pluginId: string): Promise<PluginSettingDeclaration[] | null> => {
    if (!isTauri()) return null;
    try {
      return await pluginGetSettingsSchema(pluginId);
    } catch (e) {
      toast.error(`Failed to load settings: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, []);

  const getSettingsValues = useCallback(async (pluginId: string): Promise<Record<string, unknown> | null> => {
    if (!isTauri()) return null;
    try {
      return await pluginGetSettingsValues(pluginId);
    } catch (e) {
      toast.error(`Failed to load settings: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, []);

  const setSetting = useCallback(async (pluginId: string, key: string, value: unknown) => {
    if (!isTauri()) return;
    try {
      await pluginSetSetting(pluginId, key, value);
    } catch (e) {
      toast.error(`Failed to save setting: ${(e as Error).message ?? String(e)}`);
      throw e;
    }
  }, []);

  const exportData = useCallback(async (pluginId: string): Promise<string | null> => {
    if (!isTauri()) return null;
    try {
      const path = await pluginExportData(pluginId);
      toast.success(`Plugin data exported: ${path}`);
      return path;
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, []);

  const checkAllUpdates = useCallback(async (): Promise<PluginUpdateInfo[]> => {
    if (!isTauri()) return [];
    store.setLoading(true);
    try {
      const updates = await pluginCheckAllUpdates();
      store.setPendingUpdates(updates);
      return updates;
    } catch (e) {
      toast.error(`Update check failed: ${(e as Error).message ?? String(e)}`);
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const updateAll = useCallback(async () => {
    if (!isTauri()) return;
    store.setLoading(true);
    try {
      const results = await pluginUpdateAll();
      const successes = results.filter((r) => r.Ok).length;
      const failures = results.filter((r) => r.Err).length;
      if (failures > 0) {
        toast.warning(`Updated ${successes}, failed ${failures}`);
      } else {
        toast.success(`All ${successes} plugins updated`);
      }
      store.setPendingUpdates([]);
      await fetchPlugins();
    } catch (e) {
      toast.error(`Batch update failed: ${(e as Error).message ?? String(e)}`);
    } finally {
      store.setLoading(false);
    }
  }, [store, fetchPlugins]);

  const dispatchEvent = useCallback(async (eventName: string, payload: unknown = {}) => {
    if (!isTauri()) return;
    try {
      await pluginDispatchEvent(eventName, payload);
    } catch {
      // Event dispatch is best-effort, don't show error
    }
  }, []);

  const getUiAsset = useCallback(async (pluginId: string, assetPath: string): Promise<number[] | null> => {
    if (!isTauri()) return null;
    try {
      return await pluginGetUiAsset(pluginId, assetPath);
    } catch {
      return null;
    }
  }, []);

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
    healthMap: store.healthMap,
    pendingUpdates: store.pendingUpdates,
    getHealth,
    getAllHealth,
    resetHealth,
    getSettingsSchema,
    getSettingsValues,
    setSetting,
    exportData,
    checkAllUpdates,
    updateAll,
    dispatchEvent,
    getUiAsset,
  };
}
