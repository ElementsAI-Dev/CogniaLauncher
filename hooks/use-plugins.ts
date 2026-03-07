import { useCallback, useRef } from "react";
import { usePluginStore } from "@/lib/stores/plugin";
import { useToolboxStore } from "@/lib/stores/toolbox";
import {
  pluginList,
  pluginListAllTools,
  pluginInstall,
  pluginInstallMarketplace,
  pluginImportLocal,
  pluginUninstall,
  pluginEnable,
  pluginDisable,
  pluginReload,
  pluginCallTool,
  pluginGetPermissions,
  pluginGetPermissionMode,
  pluginGrantPermission,
  pluginRevokePermission,
  pluginGetLocales,
  pluginScaffold,
  pluginOpenScaffoldFolder,
  pluginOpenScaffoldInVscode,
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
} from "@/lib/tauri";
import { evaluatePluginDeprecations } from "@/lib/plugin-governance";
import { runEditorActionFlow } from "@/lib/editor-action";
import type {
  PluginInfo,
  PluginToolInfo,
  PluginToolPreview,
  PluginPermissionState,
  ScaffoldConfig,
  ScaffoldResult,
  ScaffoldOpenResult,
  ValidationResult,
  PluginUpdateInfo,
  PluginHealth,
  PluginSettingDeclaration,
} from "@/types/plugin";
import { toast } from "sonner";

// Keep card-level preview compact and deterministic for scan-friendly plugin lists.
const PLUGIN_TOOL_PREVIEW_LIMIT = 3;

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNormalizedToolName(
  tool: Pick<PluginToolInfo, "nameEn" | "toolId">,
): string {
  return normalizeOptionalText(tool.nameEn) ?? tool.toolId;
}

function comparePluginToolsForPreview(
  a: PluginToolInfo,
  b: PluginToolInfo,
): number {
  const aName = getNormalizedToolName(a).toLocaleLowerCase();
  const bName = getNormalizedToolName(b).toLocaleLowerCase();
  if (aName !== bName) return aName.localeCompare(bName);
  return a.toolId.localeCompare(b.toolId);
}

function normalizePluginTools(
  rawTools: PluginToolInfo[],
  pluginsById: Map<string, PluginInfo>,
): PluginToolInfo[] {
  return rawTools.map((tool) => {
    const normalizedName = getNormalizedToolName(tool);
    const normalizedDescription = normalizeOptionalText(tool.descriptionEn);
    const pluginMeta = pluginsById.get(tool.pluginId);
    const deprecations = evaluatePluginDeprecations(
      {
        toolContractVersion:
          pluginMeta?.toolContractVersion ?? tool.contractVersion ?? undefined,
        compatibility: tool.compatibility ?? pluginMeta?.compatibility,
      },
      [
        {
          toolId: tool.toolId,
          capabilityDeclarations: tool.capabilityDeclarations ?? [],
        },
      ],
    );

    return {
      ...tool,
      nameEn: normalizedName,
      normalizedName,
      descriptionEn: normalizedDescription ?? "",
      normalizedDescription,
      descriptionZh: normalizeOptionalText(tool.descriptionZh),
      descriptionFallbackNeeded: normalizedDescription === null,
      deprecationWarnings: deprecations.length > 0 ? deprecations : undefined,
    };
  });
}

function buildPluginToolPreview(tool: PluginToolInfo): PluginToolPreview {
  const normalizedDescription = normalizeOptionalText(tool.descriptionEn);
  return {
    toolId: tool.toolId,
    name: getNormalizedToolName(tool),
    description: normalizedDescription,
    descriptionFallbackNeeded: normalizedDescription === null,
    entry: tool.entry,
    uiMode: tool.uiMode,
  };
}

function buildPluginDescriptionState(
  description: string | null | undefined,
): Pick<
  PluginInfo,
  "description" | "normalizedDescription" | "descriptionFallbackNeeded"
> {
  const normalizedDescription = normalizeOptionalText(description);
  return {
    description: normalizedDescription ?? "",
    normalizedDescription,
    descriptionFallbackNeeded: normalizedDescription === null,
  };
}

function buildPluginPreviewLoadingState(
  toolCount: number,
): Pick<
  PluginInfo,
  | "toolPreviews"
  | "toolPreviewCount"
  | "hasMoreToolPreviews"
  | "toolPreviewLoading"
> {
  return {
    toolPreviews: [],
    toolPreviewCount: toolCount,
    hasMoreToolPreviews: false,
    toolPreviewLoading: toolCount > 0,
  };
}

function buildPluginPreviewReadyState(
  pluginTools: PluginToolInfo[],
): Pick<
  PluginInfo,
  | "toolPreviews"
  | "toolPreviewCount"
  | "hasMoreToolPreviews"
  | "toolPreviewLoading"
> {
  const previewTools = pluginTools
    .slice(0, PLUGIN_TOOL_PREVIEW_LIMIT)
    .map((tool) => buildPluginToolPreview(tool));
  return {
    toolPreviews: previewTools,
    toolPreviewCount: pluginTools.length,
    hasMoreToolPreviews: pluginTools.length > previewTools.length,
    toolPreviewLoading: false,
  };
}

export function usePlugins() {
  const plugins = usePluginStore((state) => state.installedPlugins);
  const pluginTools = usePluginStore((state) => state.pluginTools);
  const loading = usePluginStore((state) => state.loading);
  const error = usePluginStore((state) => state.error);
  const healthMap = usePluginStore((state) => state.healthMap);
  const permissionMode = usePluginStore((state) => state.permissionMode);
  const permissionStates = usePluginStore((state) => state.permissionStates);
  const pendingUpdates = usePluginStore((state) => state.pendingUpdates);
  const setContinuationHint = useToolboxStore(
    (state) => state.setContinuationHint,
  );
  const clearContinuationHint = useToolboxStore(
    (state) => state.clearContinuationHint,
  );

  const setInstalledPlugins = usePluginStore(
    (state) => state.setInstalledPlugins,
  );
  const setPluginTools = usePluginStore((state) => state.setPluginTools);
  const setLoading = usePluginStore((state) => state.setLoading);
  const setError = usePluginStore((state) => state.setError);
  const updatePluginInStore = usePluginStore((state) => state.updatePlugin);
  const removePlugin = usePluginStore((state) => state.removePlugin);
  const setHealthMap = usePluginStore((state) => state.setHealthMap);
  const setPluginHealth = usePluginStore((state) => state.setPluginHealth);
  const setPermissionMode = usePluginStore((state) => state.setPermissionMode);
  const setPermissionStates = usePluginStore(
    (state) => state.setPermissionStates,
  );
  const setPluginPermissionState = usePluginStore(
    (state) => state.setPluginPermissionState,
  );
  const setPendingUpdates = usePluginStore((state) => state.setPendingUpdates);

  const fetchPluginsInFlightRef = useRef<Promise<void> | null>(null);

  const syncMarketplaceContinuationForPlugin = useCallback(
    (pluginId: string) => {
      const state = usePluginStore.getState();
      const plugin = state.installedPlugins.find(
        (entry) => entry.id === pluginId,
      );
      if (!plugin || plugin.source.type !== "store") return;

      const primaryTool = state.pluginTools.find(
        (tool) => tool.pluginId === pluginId,
      );
      setContinuationHint({
        kind: "marketplace-update",
        listingId: plugin.source.storeId,
        pluginId,
        toolId:
          plugin.enabled === false || !primaryTool
            ? null
            : `plugin:${pluginId}:${primaryTool.toolId}`,
        timestamp: Date.now(),
      });
    },
    [setContinuationHint],
  );

  const fetchPlugins = useCallback(() => {
    if (!isTauri()) return Promise.resolve();
    if (fetchPluginsInFlightRef.current) {
      return fetchPluginsInFlightRef.current;
    }

    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        const installedPlugins = await pluginList();
        const initialPlugins = installedPlugins.map((plugin) => {
          return {
            ...plugin,
            ...buildPluginDescriptionState(plugin.description),
            ...buildPluginPreviewLoadingState(plugin.toolCount),
          };
        });
        setInstalledPlugins(initialPlugins);

        const [tools, fetchedPermissionMode] = await Promise.all([
          pluginListAllTools(),
          pluginGetPermissionMode().catch(() => "compat" as const),
        ]);

        const permissionsEntries = await Promise.all(
          installedPlugins.map(async (plugin) => {
            try {
              const state = await pluginGetPermissions(plugin.id);
              return [plugin.id, state] as const;
            } catch {
              return [plugin.id, null] as const;
            }
          }),
        );

        const permissionsByPlugin: Record<string, PluginPermissionState> = {};
        for (const [pluginId, state] of permissionsEntries) {
          if (state) permissionsByPlugin[pluginId] = state;
        }

        const pluginById = new Map<string, PluginInfo>();
        for (const plugin of installedPlugins) {
          pluginById.set(plugin.id, plugin);
        }
        const nextTools = normalizePluginTools(tools, pluginById);
        const toolsByPlugin = new Map<string, PluginToolInfo[]>();
        for (const tool of nextTools) {
          const existing = toolsByPlugin.get(tool.pluginId);
          if (existing) {
            existing.push(tool);
          } else {
            toolsByPlugin.set(tool.pluginId, [tool]);
          }
        }

        const nextPlugins = installedPlugins.map((plugin) => {
          const pluginTools = [...(toolsByPlugin.get(plugin.id) ?? [])].sort(
            comparePluginToolsForPreview,
          );
          const deprecations = evaluatePluginDeprecations(plugin, pluginTools);
          return {
            ...plugin,
            ...buildPluginDescriptionState(plugin.description),
            ...buildPluginPreviewReadyState(pluginTools),
            deprecationWarnings:
              deprecations.length > 0 ? deprecations : undefined,
          };
        });

        setPermissionMode(fetchedPermissionMode);
        setPermissionStates(permissionsByPlugin);
        setInstalledPlugins(nextPlugins);
        setPluginTools(nextTools);
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
  }, [
    setError,
    setInstalledPlugins,
    setLoading,
    setPermissionMode,
    setPermissionStates,
    setPluginTools,
  ]);

  const installPlugin = useCallback(
    async (source: string) => {
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
    },
    [fetchPlugins, setError, setLoading],
  );

  const installMarketplacePlugin = useCallback(
    async (storeId: string) => {
      if (!isTauri()) return null;
      setLoading(true);
      try {
        const pluginId = await pluginInstallMarketplace(storeId);
        toast.success(`Marketplace plugin installed: ${pluginId}`);
        await fetchPlugins();
        syncMarketplaceContinuationForPlugin(pluginId);
        return pluginId;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        toast.error(`Marketplace install failed: ${msg}`);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchPlugins, setError, setLoading, syncMarketplaceContinuationForPlugin],
  );

  const importLocalPlugin = useCallback(
    async (path: string) => {
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
    },
    [fetchPlugins, setError, setLoading],
  );

  const uninstallPlugin = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return;
      try {
        const plugin = usePluginStore
          .getState()
          .installedPlugins.find((entry) => entry.id === pluginId);
        await pluginUninstall(pluginId);
        removePlugin(pluginId);
        if (plugin?.source.type === "store") {
          clearContinuationHint();
        }
        toast.success(`Plugin uninstalled: ${pluginId}`);
      } catch (e) {
        toast.error(`Uninstall failed: ${(e as Error).message ?? String(e)}`);
      }
    },
    [clearContinuationHint, removePlugin],
  );

  const enablePlugin = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return;
      try {
        await pluginEnable(pluginId);
        updatePluginInStore(pluginId, {
          enabled: true,
          toolPreviewLoading: true,
        });
        await fetchPlugins();
        syncMarketplaceContinuationForPlugin(pluginId);
      } catch (e) {
        toast.error(`Enable failed: ${(e as Error).message ?? String(e)}`);
      }
    },
    [fetchPlugins, syncMarketplaceContinuationForPlugin, updatePluginInStore],
  );

  const disablePlugin = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return;
      try {
        await pluginDisable(pluginId);
        updatePluginInStore(pluginId, {
          enabled: false,
          toolPreviewLoading: true,
        });
        await fetchPlugins();
        syncMarketplaceContinuationForPlugin(pluginId);
      } catch (e) {
        toast.error(`Disable failed: ${(e as Error).message ?? String(e)}`);
      }
    },
    [fetchPlugins, syncMarketplaceContinuationForPlugin, updatePluginInStore],
  );

  const reloadPlugin = useCallback(async (pluginId: string) => {
    if (!isTauri()) return;
    try {
      await pluginReload(pluginId);
      toast.success(`Plugin reloaded: ${pluginId}`);
    } catch (e) {
      toast.error(`Reload failed: ${(e as Error).message ?? String(e)}`);
    }
  }, []);

  const callTool = useCallback(
    async (pluginId: string, toolEntry: string, input: string) => {
      if (!isTauri()) return "";
      try {
        return await pluginCallTool(pluginId, toolEntry, input);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        toast.error(`Tool execution failed: ${msg}`);
        throw e;
      }
    },
    [],
  );

  const getPermissions = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return null;
      const state = await pluginGetPermissions(pluginId);
      setPluginPermissionState(pluginId, state);
      return state;
    },
    [setPluginPermissionState],
  );

  const grantPermission = useCallback(
    async (pluginId: string, permission: string) => {
      if (!isTauri()) return;
      await pluginGrantPermission(pluginId, permission);
      try {
        const state = await pluginGetPermissions(pluginId);
        setPluginPermissionState(pluginId, state);
      } catch {
        // Best-effort refresh.
      }
    },
    [setPluginPermissionState],
  );

  const revokePermission = useCallback(
    async (pluginId: string, permission: string) => {
      if (!isTauri()) return;
      await pluginRevokePermission(pluginId, permission);
      try {
        const state = await pluginGetPermissions(pluginId);
        setPluginPermissionState(pluginId, state);
      } catch {
        // Best-effort refresh.
      }
    },
    [setPluginPermissionState],
  );

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

  const scaffoldPlugin = useCallback(
    async (config: ScaffoldConfig): Promise<ScaffoldResult | null> => {
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
    },
    [setError, setLoading],
  );

  const validatePlugin = useCallback(
    async (path: string): Promise<ValidationResult | null> => {
      if (!isTauri()) return null;
      try {
        return await pluginValidate(path);
      } catch (e) {
        toast.error(`Validation failed: ${(e as Error).message ?? String(e)}`);
        return null;
      }
    },
    [],
  );

  const openScaffoldFolder = useCallback(
    async (path: string): Promise<ScaffoldOpenResult | null> => {
      if (!isTauri()) return null;
      try {
        const result = await pluginOpenScaffoldFolder(path);
        toast.success(result.message);
        return result;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        toast.error(`Open folder failed: ${msg}`);
        return null;
      }
    },
    [],
  );

  const openScaffoldInVscode = useCallback(
    async (path: string): Promise<ScaffoldOpenResult | null> => {
      if (!isTauri()) return null;
      try {
        let vscodeResult: ScaffoldOpenResult | null = null;
        let folderResult: ScaffoldOpenResult | null = null;
        const flow = await runEditorActionFlow({
          probe: async () => ({
            available: true,
            reason: "ok",
            fallbackPath: path,
          }),
          open: async () => {
            try {
              const result = await pluginOpenScaffoldInVscode(path);
              vscodeResult = result;
              return {
                success: true,
                reason: result.fallbackUsed ? "editor_not_found" : "ok",
                message: result.message,
                fallbackPath: path,
                fallbackUsed: result.fallbackUsed,
              };
            } catch (error) {
              return {
                success: false,
                reason: "runtime_error",
                message: (error as Error).message ?? String(error),
                fallbackPath: path,
                fallbackUsed: false,
              };
            }
          },
          fallbackOpen: async (fallbackPath: string) => {
            const result = await pluginOpenScaffoldFolder(fallbackPath);
            folderResult = result;
          },
        });

        if (flow.status === "fallback_opened") {
          toast.info(flow.message);
        } else if (flow.status === "opened") {
          toast.success(flow.message);
        } else {
          toast.error(flow.message);
        }

        if (vscodeResult) return vscodeResult;
        if (folderResult) return folderResult;
        if (flow.status === "fallback_opened") {
          return {
            openedWith: "folder",
            fallbackUsed: true,
            message: flow.message,
          };
        }
        return null;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        toast.error(`Open in VSCode failed: ${msg}`);
        return null;
      }
    },
    [],
  );

  const checkUpdate = useCallback(
    async (pluginId: string): Promise<PluginUpdateInfo | null> => {
      if (!isTauri()) return null;
      try {
        return await pluginCheckUpdate(pluginId);
      } catch (e) {
        toast.error(
          `Update check failed: ${(e as Error).message ?? String(e)}`,
        );
        return null;
      }
    },
    [],
  );

  const updatePlugin = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return;
      setLoading(true);
      try {
        await pluginUpdate(pluginId);
        toast.success(`Plugin updated: ${pluginId}`);
        await fetchPlugins();
        syncMarketplaceContinuationForPlugin(pluginId);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        toast.error(`Update failed: ${msg}`);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [fetchPlugins, setError, setLoading, syncMarketplaceContinuationForPlugin],
  );

  const getHealth = useCallback(
    async (pluginId: string): Promise<PluginHealth | null> => {
      if (!isTauri()) return null;
      try {
        const health = await pluginGetHealth(pluginId);
        setPluginHealth(pluginId, health);
        return health;
      } catch (e) {
        toast.error(
          `Health check failed: ${(e as Error).message ?? String(e)}`,
        );
        return null;
      }
    },
    [setPluginHealth],
  );

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

  const resetHealth = useCallback(
    async (pluginId: string) => {
      if (!isTauri()) return;
      try {
        await pluginResetHealth(pluginId);
        toast.success(`Health reset: ${pluginId}`);
        await getHealth(pluginId);
      } catch (e) {
        toast.error(`Reset failed: ${(e as Error).message ?? String(e)}`);
      }
    },
    [getHealth],
  );

  const getSettingsSchema = useCallback(
    async (pluginId: string): Promise<PluginSettingDeclaration[] | null> => {
      if (!isTauri()) return null;
      try {
        return await pluginGetSettingsSchema(pluginId);
      } catch (e) {
        toast.error(
          `Failed to load settings: ${(e as Error).message ?? String(e)}`,
        );
        return null;
      }
    },
    [],
  );

  const getSettingsValues = useCallback(
    async (pluginId: string): Promise<Record<string, unknown> | null> => {
      if (!isTauri()) return null;
      try {
        return await pluginGetSettingsValues(pluginId);
      } catch (e) {
        toast.error(
          `Failed to load settings: ${(e as Error).message ?? String(e)}`,
        );
        return null;
      }
    },
    [],
  );

  const setSetting = useCallback(
    async (pluginId: string, key: string, value: unknown) => {
      if (!isTauri()) return;
      try {
        await pluginSetSetting(pluginId, key, value);
      } catch (e) {
        toast.error(
          `Failed to save setting: ${(e as Error).message ?? String(e)}`,
        );
        throw e;
      }
    },
    [],
  );

  const exportData = useCallback(
    async (pluginId: string): Promise<string | null> => {
      if (!isTauri()) return null;
      try {
        const path = await pluginExportData(pluginId);
        toast.success(`Plugin data exported: ${path}`);
        return path;
      } catch (e) {
        toast.error(`Export failed: ${(e as Error).message ?? String(e)}`);
        return null;
      }
    },
    [],
  );

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

  const dispatchEvent = useCallback(
    async (eventName: string, payload: unknown = {}) => {
      if (!isTauri()) return;
      try {
        await pluginDispatchEvent(eventName, payload);
      } catch {
        // Event dispatch is best-effort, don't show error
      }
    },
    [],
  );

  const getUiAsset = useCallback(
    async (pluginId: string, assetPath: string): Promise<number[] | null> => {
      if (!isTauri()) return null;
      try {
        return await pluginGetUiAsset(pluginId, assetPath);
      } catch {
        return null;
      }
    },
    [],
  );

  return {
    plugins,
    pluginTools,
    loading,
    error,
    fetchPlugins,
    installPlugin,
    installMarketplacePlugin,
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
    openScaffoldFolder,
    openScaffoldInVscode,
    validatePlugin,
    checkUpdate,
    updatePlugin,
    healthMap,
    pendingUpdates,
    permissionMode,
    permissionStates,
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
