import { useCallback, useMemo, useRef } from "react";
import { usePluginStore } from "@/lib/stores/plugin";
import { useToolboxStore } from "@/lib/stores/toolbox";
import {
  pluginList,
  pluginListAllTools,
  pluginInstall,
  pluginInstallMarketplace,
  pluginInstallMarketplaceWithResult as pluginInstallMarketplaceWithResultCommand,
  pluginImportLocal,
  pluginUninstall,
  pluginEnable,
  pluginDisable,
  pluginReload,
  pluginCallTool,
  pluginCancelTool,
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
  pluginUpdateWithResult as pluginUpdateWithResultCommand,
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
import { resolveDeclaredSdkCapabilityCoverage } from "@/lib/plugin-sdk-usage";
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
  PluginMarketplaceActionError,
  PluginMarketplaceActionResult,
  PluginMarketplaceActionType,
} from "@/types/plugin";
import type { ToolExecutionError } from '@/types/toolbox';
import { toast } from "sonner";

// Keep card-level preview compact and deterministic for scan-friendly plugin lists.
const PLUGIN_TOOL_PREVIEW_LIMIT = 3;

function normalizeMarketplaceActionError(
  action: PluginMarketplaceActionType,
  error: unknown,
): PluginMarketplaceActionError {
  const message = (error as Error).message ?? String(error);
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("desktop runtime is required")
    || normalized.includes("requires cognialauncher")
    || normalized.includes("requires tool contract")
    || normalized.includes("incompatible")
    || normalized.includes("compatib")
  ) {
    return {
      category: "compatibility_blocked",
      message,
      retryable: false,
    };
  }

  if (
    normalized.includes("checksum")
    || normalized.includes("validation")
    || normalized.includes("plugin.toml")
    || normalized.includes("invalid")
    || normalized.includes("manifest")
  ) {
    return {
      category: "validation_failed",
      message,
      retryable: false,
    };
  }

  if (
    normalized.includes("network")
    || normalized.includes("timeout")
    || normalized.includes("dns")
    || normalized.includes("download")
    || normalized.includes("fetch")
    || normalized.includes("not found")
    || normalized.includes("404")
    || normalized.includes("unavailable")
  ) {
    return {
      category: "source_unavailable",
      message,
      retryable: true,
    };
  }

  return {
    category: "install_execution_failed",
    message,
    retryable: action === "install" || action === "update",
  };
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeToolExecutionError(error: unknown): ToolExecutionError {
  if (
    error &&
    typeof error === 'object' &&
    'kind' in error &&
    'message' in error &&
    typeof (error as { kind: unknown }).kind === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return error as ToolExecutionError;
  }

  const message = (error as Error)?.message ?? String(error);
  const normalized = message.trim().toLowerCase();
  if (normalized.includes('timeout')) {
    return { kind: 'timeout', message };
  }
  if (normalized.includes('permission')) {
    return { kind: 'permission_denied', message };
  }
  if (normalized.includes('cancel')) {
    return { kind: 'cancelled', message };
  }
  if (
    normalized.includes('invalid')
    || normalized.includes('not declared')
    || normalized.includes('not found')
  ) {
    return { kind: 'validation', message };
  }
  return { kind: 'runtime', message };
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
  permissionsByPlugin: Record<string, PluginPermissionState>,
): PluginToolInfo[] {
  const desktop = isTauri();
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
    const sdkCapabilityCoverage = resolveDeclaredSdkCapabilityCoverage({
      declarations: tool.capabilityDeclarations ?? [],
      grantedPermissions: permissionsByPlugin[tool.pluginId]?.granted ?? [],
      isDesktop: desktop,
    });

    return {
      ...tool,
      nameEn: normalizedName,
      normalizedName,
      descriptionEn: normalizedDescription ?? "",
      normalizedDescription,
      descriptionZh: normalizeOptionalText(tool.descriptionZh),
      descriptionFallbackNeeded: normalizedDescription === null,
      pluginPointId: normalizeOptionalText(tool.pluginPointId),
      exclusionReason: normalizeOptionalText(tool.exclusionReason),
      discoverable: tool.discoverable ?? true,
      deprecationWarnings: deprecations.length > 0 ? deprecations : undefined,
      sdkCapabilityCoverage:
        sdkCapabilityCoverage.length > 0 ? sdkCapabilityCoverage : undefined,
    };
  });
}

function mergePluginCapabilityCoverage(
  pluginTools: PluginToolInfo[],
): PluginInfo["sdkCapabilityCoverage"] {
  const byCapability = new Map<
    string,
    NonNullable<PluginToolInfo["sdkCapabilityCoverage"]>[number]
  >();

  for (const tool of pluginTools) {
    for (const coverage of tool.sdkCapabilityCoverage ?? []) {
      const existing = byCapability.get(coverage.capabilityId);
      if (
        !existing
        || (existing.status === "covered" && coverage.status !== "covered")
        || (existing.status === "warning" && coverage.status === "blocked")
        || (!existing.preferredWorkflow && coverage.preferredWorkflow)
        || (
          existing.preferredWorkflow?.coverage !== "builtin-primary"
          && coverage.preferredWorkflow?.coverage === "builtin-primary"
        )
      ) {
        byCapability.set(coverage.capabilityId, coverage);
      }
    }
  }

  const merged = [...byCapability.values()].sort((left, right) =>
    left.capabilityId.localeCompare(right.capabilityId),
  );
  return merged.length > 0 ? merged : undefined;
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
  const installedPlugins = usePluginStore((state) => state.installedPlugins);
  const pluginTools = usePluginStore((state) => state.pluginTools);
  const loading = usePluginStore((state) => state.loading);
  const error = usePluginStore((state) => state.error);
  const healthMap = usePluginStore((state) => state.healthMap);
  const permissionMode = usePluginStore((state) => state.permissionMode);
  const permissionStates = usePluginStore((state) => state.permissionStates);
  const pendingUpdates = usePluginStore((state) => state.pendingUpdates);
  const marketplaceAcquisitions = usePluginStore(
    (state) => state.marketplaceAcquisitions,
  );
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
  const clearMarketplaceAcquisition = usePluginStore(
    (state) => state.clearMarketplaceAcquisition,
  );

  const plugins = useMemo(
    () =>
      installedPlugins.map((plugin) => ({
        ...plugin,
        marketplaceAcquisition: marketplaceAcquisitions[plugin.id],
      })),
    [installedPlugins, marketplaceAcquisitions],
  );

  const fetchPluginsInFlightRef = useRef<Promise<void> | null>(null);

  const clearPendingUpdateForPlugin = useCallback(
    (pluginId: string) => {
      const currentUpdates = usePluginStore.getState().pendingUpdates;
      if (currentUpdates.length === 0) return;
      setPendingUpdates(
        currentUpdates.filter((update) => update.pluginId !== pluginId),
      );
    },
    [setPendingUpdates],
  );

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
        sourceLabel:
          state.marketplaceAcquisitions[pluginId]?.sourceLabel ?? "Marketplace",
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
            pluginPoints: plugin.pluginPoints ?? [],
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
        const nextTools = normalizePluginTools(
          tools,
          pluginById,
          permissionsByPlugin,
        );
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
            sdkCapabilityCoverage: mergePluginCapabilityCoverage(pluginTools),
            marketplaceAcquisition:
              usePluginStore.getState().marketplaceAcquisitions[plugin.id],
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

  const installMarketplacePluginWithResult = useCallback(
    async (storeId: string): Promise<PluginMarketplaceActionResult> => {
      if (!isTauri()) {
        return {
          ok: false,
          action: "install",
          pluginId: null,
          phase: "failed",
          downloadTaskId: null,
          error: {
            category: "source_unavailable",
            message: "Marketplace install requires desktop runtime.",
            retryable: false,
          },
        };
      }

      setLoading(true);
      try {
        let result: PluginMarketplaceActionResult;
        try {
          const commandResult =
            await pluginInstallMarketplaceWithResultCommand(storeId);
          if (!commandResult || typeof commandResult.ok !== "boolean") {
            throw new Error("invalid marketplace install result");
          }
          result = {
            ok: commandResult.ok,
            action: "install",
            pluginId: commandResult.pluginId ?? null,
            phase: commandResult.phase ?? (commandResult.ok ? "completed" : "failed"),
            downloadTaskId: commandResult.downloadTaskId ?? null,
            error: commandResult.error ?? null,
          };
        } catch (error) {
          const message = (error as Error).message ?? String(error);
          const normalized = message.toLowerCase();
          const shouldFallback =
            normalized.includes("unknown command")
            || normalized.includes("plugin_install_marketplace_with_result")
            || normalized.includes("command not found");
          if (!shouldFallback) {
            throw error;
          }

          const pluginId = await pluginInstallMarketplace(storeId);
          result = pluginId
            ? {
                ok: true,
                action: "install",
                pluginId,
                phase: "completed",
                downloadTaskId: null,
                error: null,
              }
            : {
                ok: false,
                action: "install",
                pluginId: null,
                phase: "failed",
                downloadTaskId: null,
                error: {
                  category: "install_execution_failed",
                  message: "Marketplace install failed.",
                  retryable: true,
                },
              };
        }

        if (!result.ok || !result.pluginId) {
          const normalizedError = result.error ?? {
            category: "install_execution_failed" as const,
            message: "Marketplace install failed.",
            retryable: true,
          };
          toast.error(`Marketplace install failed: ${normalizedError.message}`);
          setError(normalizedError.message);
          return {
            ...result,
            ok: false,
            action: "install",
            pluginId: result.pluginId ?? null,
            phase: result.phase ?? "failed",
            downloadTaskId: result.downloadTaskId ?? null,
            error: normalizedError,
          };
        }

        toast.success(`Marketplace plugin installed: ${result.pluginId}`);
        await fetchPlugins();
        clearPendingUpdateForPlugin(result.pluginId);
        syncMarketplaceContinuationForPlugin(result.pluginId);
        return result;
      } catch (e) {
        const normalizedError = normalizeMarketplaceActionError("install", e);
        toast.error(`Marketplace install failed: ${normalizedError.message}`);
        setError(normalizedError.message);
        return {
          ok: false,
          action: "install",
          pluginId: null,
          phase: "failed",
          downloadTaskId: null,
          error: normalizedError,
        };
      } finally {
        setLoading(false);
      }
    },
    [
      clearPendingUpdateForPlugin,
      fetchPlugins,
      setError,
      setLoading,
      syncMarketplaceContinuationForPlugin,
    ],
  );

  const installMarketplacePlugin = useCallback(
    async (storeId: string) => {
      const result = await installMarketplacePluginWithResult(storeId);
      return result.ok ? result.pluginId : null;
    },
    [installMarketplacePluginWithResult],
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
        clearMarketplaceAcquisition(pluginId);
        if (plugin?.source.type === "store") {
          clearContinuationHint();
        }
        toast.success(`Plugin uninstalled: ${pluginId}`);
      } catch (e) {
        toast.error(`Uninstall failed: ${(e as Error).message ?? String(e)}`);
      }
    },
    [clearContinuationHint, clearMarketplaceAcquisition, removePlugin],
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
    async (
      pluginId: string,
      toolEntry: string,
      input: string,
      executionId?: string,
      toolId?: string,
    ) => {
      if (!isTauri()) return "";
      try {
        return await pluginCallTool(pluginId, toolEntry, input, executionId, toolId);
      } catch (e) {
        const structured = normalizeToolExecutionError(e);
        toast.error(`Tool execution failed: ${structured.message}`);
        throw structured;
      }
    },
    [],
  );

  const cancelTool = useCallback(async (executionId: string) => {
    if (!isTauri()) return false;
    return pluginCancelTool(executionId);
  }, []);

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

  const updatePluginWithResult = useCallback(
    async (pluginId: string): Promise<PluginMarketplaceActionResult> => {
      if (!isTauri()) {
        return {
          ok: false,
          action: "update",
          pluginId,
          phase: "failed",
          downloadTaskId: null,
          error: {
            category: "source_unavailable",
            message: "Plugin update requires desktop runtime.",
            retryable: false,
          },
        };
      }

      setLoading(true);
      try {
        let result: PluginMarketplaceActionResult;
        try {
          const commandResult = await pluginUpdateWithResultCommand(pluginId);
          if (!commandResult || typeof commandResult.ok !== "boolean") {
            throw new Error("invalid marketplace update result");
          }
          result = {
            ok: commandResult.ok,
            action: "update",
            pluginId: commandResult.pluginId ?? pluginId,
            phase: commandResult.phase ?? (commandResult.ok ? "completed" : "failed"),
            downloadTaskId: commandResult.downloadTaskId ?? null,
            error: commandResult.error ?? null,
          };
        } catch (error) {
          const message = (error as Error).message ?? String(error);
          const normalized = message.toLowerCase();
          const shouldFallback =
            normalized.includes("unknown command")
            || normalized.includes("plugin_update_with_result")
            || normalized.includes("command not found");
          if (!shouldFallback) {
            throw error;
          }

          await pluginUpdate(pluginId);
          result = {
            ok: true,
            action: "update",
            pluginId,
            phase: "completed",
            downloadTaskId: null,
            error: null,
          };
        }

        if (!result.ok) {
          const normalizedError = result.error ?? {
            category: "install_execution_failed" as const,
            message: "Marketplace update failed.",
            retryable: true,
          };
          toast.error(`Update failed: ${normalizedError.message}`);
          setError(normalizedError.message);
          return {
            ...result,
            ok: false,
            action: "update",
            pluginId: result.pluginId ?? pluginId,
            phase: result.phase ?? "failed",
            downloadTaskId: result.downloadTaskId ?? null,
            error: normalizedError,
          };
        }

        toast.success(`Plugin updated: ${pluginId}`);
        await fetchPlugins();
        clearPendingUpdateForPlugin(pluginId);
        syncMarketplaceContinuationForPlugin(pluginId);
        return result;
      } catch (e) {
        const normalizedError = normalizeMarketplaceActionError("update", e);
        toast.error(`Update failed: ${normalizedError.message}`);
        setError(normalizedError.message);
        return {
          ok: false,
          action: "update",
          pluginId,
          phase: "failed",
          downloadTaskId: null,
          error: normalizedError,
        };
      } finally {
        setLoading(false);
      }
    },
    [
      clearPendingUpdateForPlugin,
      fetchPlugins,
      setError,
      setLoading,
      syncMarketplaceContinuationForPlugin,
    ],
  );

  const updatePlugin = useCallback(
    async (pluginId: string) => {
      await updatePluginWithResult(pluginId);
    },
    [updatePluginWithResult],
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
    installMarketplacePluginWithResult,
    importLocalPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    reloadPlugin,
    callTool,
    cancelTool,
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
    updatePluginWithResult,
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
