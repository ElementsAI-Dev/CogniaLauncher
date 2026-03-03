import { useCallback, useRef } from 'react';
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
  isTauri,
} from '@/lib/tauri';
import type {
  ScaffoldConfig,
  ScaffoldResult,
  ValidationResult,
  PluginUpdateInfo,
  PluginHealth,
  PluginSettingDeclaration,
} from '@/types/plugin';
import { toast } from 'sonner';

export function usePlugins() {
  const plugins = usePluginStore((state) => state.installedPlugins);
  const pluginTools = usePluginStore((state) => state.pluginTools);
  const loading = usePluginStore((state) => state.loading);
  const error = usePluginStore((state) => state.error);
  const healthMap = usePluginStore((state) => state.healthMap);
  const pendingUpdates = usePluginStore((state) => state.pendingUpdates);

  const setInstalledPlugins = usePluginStore((state) => state.setInstalledPlugins);
  const setPluginTools = usePluginStore((state) => state.setPluginTools);
  const setLoading = usePluginStore((state) => state.setLoading);
  const setError = usePluginStore((state) => state.setError);
  const updatePluginInStore = usePluginStore((state) => state.updatePlugin);
  const removePlugin = usePluginStore((state) => state.removePlugin);
  const setHealthMap = usePluginStore((state) => state.setHealthMap);
  const setPluginHealth = usePluginStore((state) => state.setPluginHealth);
  const setPendingUpdates = usePluginStore((state) => state.setPendingUpdates);

  const fetchPluginsInFlightRef = useRef<Promise<void> | null>(null);

  const fetchPlugins = useCallback(() => {
    if (!isTauri()) return Promise.resolve();
    if (fetchPluginsInFlightRef.current) {
      return fetchPluginsInFlightRef.current;
    }

    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        const [installedPlugins, tools] = await Promise.all([
          pluginList(),
          pluginListAllTools(),
        ]);
        setInstalledPlugins(installedPlugins);
        setPluginTools(tools);
      } catch (e) {
        setError((e as Error).message ?? String(e));
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      fetchPluginsInFlightRef.current = null;
    });

    fetchPluginsInFlightRef.current = request;
    return request;
  }, [setError, setInstalledPlugins, setLoading, setPluginTools]);

  const installPlugin = useCallback(async (source: string) => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const pluginId = await pluginInstall(source);
      toast.success(`Plugin installed: ${pluginId}`);
      await fetchPlugins();
      return pluginId;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Install failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchPlugins, setError, setLoading]);

  const importLocalPlugin = useCallback(async (path: string) => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const pluginId = await pluginImportLocal(path);
      toast.success(`Plugin imported: ${pluginId}`);
      await fetchPlugins();
      return pluginId;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Import failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchPlugins, setError, setLoading]);

  const uninstallPlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginUninstall(pluginId);
      removePlugin(pluginId);
      toast.success(`Plugin uninstalled: ${pluginId}`);
    } catch (e) {
      toast.error(`Uninstall failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [removePlugin]);

  const enablePlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginEnable(pluginId);
      updatePluginInStore(pluginId, { enabled: true });
      // Refresh tools since enabling a plugin adds its tools
      const tools = await pluginListAllTools();
      setPluginTools(tools);
    } catch (e) {
      toast.error(`Enable failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [setPluginTools, updatePluginInStore]);

  const disablePlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginDisable(pluginId);
      updatePluginInStore(pluginId, { enabled: false });
      // Refresh tools since disabling removes its tools
      const tools = await pluginListAllTools();
      setPluginTools(tools);
    } catch (e) {
      toast.error(`Disable failed: ${(e as Error).message ?? String(e)}`);
    }
  }, [setPluginTools, updatePluginInStore]);

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
      const strings = locales[locale] ?? locales.en ?? {};
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
    setLoading(true);
    try {
      const result = await pluginScaffold(config);
      toast.success(`Plugin scaffolded at: ${result.pluginDir}`);
      return result;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Scaffold failed: ${msg}`);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

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
    setLoading(true);
    try {
      await pluginUpdate(pluginId);
      toast.success(`Plugin updated: ${pluginId}`);
      await fetchPlugins();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      toast.error(`Update failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchPlugins, setError, setLoading]);

  const getHealth = useCallback(async (pluginId: string): Promise<PluginHealth | null> => {
    if (!isTauri()) return null;
    try {
      const health = await pluginGetHealth(pluginId);
      setPluginHealth(pluginId, health);
      return health;
    } catch (e) {
      toast.error(`Health check failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, [setPluginHealth]);

  const getAllHealth = useCallback(async () => {
    if (!isTauri()) return null;
    try {
      const healthMapResult = await pluginGetAllHealth();
      setHealthMap(healthMapResult);
      return healthMapResult;
    } catch (e) {
      toast.error(`Health check failed: ${(e as Error).message ?? String(e)}`);
      return null;
    }
  }, [setHealthMap]);

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
    setLoading(true);
    try {
      const updates = await pluginCheckAllUpdates();
      setPendingUpdates(updates);
      return updates;
    } catch (e) {
      toast.error(`Update check failed: ${(e as Error).message ?? String(e)}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading, setPendingUpdates]);

  const updateAll = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const results = await pluginUpdateAll();
      const successes = results.filter((r) => r.Ok).length;
      const failures = results.filter((r) => r.Err).length;
      if (failures > 0) {
        toast.warning(`Updated ${successes}, failed ${failures}`);
      } else {
        toast.success(`All ${successes} plugins updated`);
      }
      setPendingUpdates([]);
      await fetchPlugins();
    } catch (e) {
      toast.error(`Batch update failed: ${(e as Error).message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchPlugins, setLoading, setPendingUpdates]);

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
    plugins,
    pluginTools,
    loading,
    error,
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
    healthMap,
    pendingUpdates,
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
