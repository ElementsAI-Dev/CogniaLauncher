import { TOOL_REGISTRY } from '@/lib/constants/toolbox';
import { getDiscoverabilityDiagnostic } from '@/lib/plugin-governance';
import { getPluginMarketplaceHref } from '@/lib/plugin-source';
import { getBuiltInIdFromToolId, toBuiltInUnifiedToolId } from '@/lib/toolbox-route';
import type { PluginDeprecationNotice, PluginHealth, PluginInfo, PluginPermissionMode, PluginPermissionState, PluginToolInfo } from '@/types/plugin';
import type { ToolDefinitionWithMeta } from '@/types/toolbox';

export interface ToolDetailRuntimeTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  keywords: string[];
  isBuiltIn: boolean;
  isNew: boolean;
  isBeta: boolean;
  builtInDef?: ToolDefinitionWithMeta;
  pluginTool?: PluginToolInfo;
  deprecationWarnings?: PluginDeprecationNotice[];
}

export interface ToolDetailRecoveryState {
  kind: 'blocked' | 'unsupported' | 'unknown';
  title: string;
  description: string;
  manageHref?: string;
  marketHref?: string | null;
}

interface ResolveToolDetailRuntimeOptions {
  toolId: string;
  allTools: ToolDetailRuntimeTool[];
  pluginTools: PluginToolInfo[];
  installedPlugins: PluginInfo[];
  healthMap: Record<string, PluginHealth>;
  permissionMode: PluginPermissionMode;
  permissionStates: Record<string, PluginPermissionState>;
  isDesktop: boolean;
  t: (key: string) => string;
}

export interface ToolDetailRuntimeContext {
  tool?: ToolDetailRuntimeTool;
  canonicalToolId: string | null;
  recoveryState: ToolDetailRecoveryState | null;
}

function buildBuiltInRuntimeTool(
  tool: ToolDefinitionWithMeta,
  t: (key: string) => string,
): ToolDetailRuntimeTool {
  return {
    id: toBuiltInUnifiedToolId(tool.id),
    name: t(tool.nameKey),
    description: t(tool.descriptionKey),
    icon: tool.icon,
    category: tool.category,
    keywords: tool.keywords,
    isBuiltIn: true,
    isNew: tool.isNew,
    isBeta: tool.isBeta ?? false,
    builtInDef: tool,
  };
}

export function resolveToolDetailRuntimeContext({
  toolId,
  allTools,
  pluginTools,
  installedPlugins,
  healthMap,
  permissionMode,
  permissionStates,
  isDesktop,
  t,
}: ResolveToolDetailRuntimeOptions): ToolDetailRuntimeContext {
  if (!toolId) {
    return {
      canonicalToolId: null,
      recoveryState: {
        kind: 'unknown',
        title: t('toolbox.search.noResults'),
        description: t('toolbox.empty.noResultsDesc'),
      },
    };
  }

  const exactTool = allTools.find((candidate) => candidate.id === toolId)
    ?? allTools.find((candidate) => candidate.isBuiltIn && candidate.builtInDef?.id === toolId);

  if (exactTool) {
    if (!isDesktop && (exactTool.pluginTool || exactTool.builtInDef?.requiresTauri)) {
      const pluginInfo = exactTool.pluginTool
        ? installedPlugins.find((plugin) => plugin.id === exactTool.pluginTool?.pluginId)
        : null;

      return {
        tool: exactTool,
        canonicalToolId: exactTool.id,
        recoveryState: {
          kind: 'unsupported',
          title: exactTool.name,
          description: t('toolbox.runtime.desktopRequiredDescription'),
          manageHref: exactTool.pluginTool ? '/toolbox/plugins' : undefined,
          marketHref: pluginInfo?.source ? getPluginMarketplaceHref(pluginInfo.source) : null,
        },
      };
    }

    return {
      tool: exactTool,
      canonicalToolId: exactTool.id,
      recoveryState: null,
    };
  }

  const builtInId = getBuiltInIdFromToolId(toolId);
  if (builtInId) {
    const builtInTool = TOOL_REGISTRY.find((candidate) => candidate.id === builtInId);
    if (builtInTool) {
      const runtimeTool = buildBuiltInRuntimeTool(builtInTool, t);
      return {
        tool: runtimeTool,
        canonicalToolId: runtimeTool.id,
        recoveryState: !isDesktop && builtInTool.requiresTauri
          ? {
              kind: 'unsupported',
              title: runtimeTool.name,
              description: t('toolbox.runtime.desktopRequiredDescription'),
            }
          : null,
      };
    }
  }

  if (toolId.startsWith('plugin:')) {
    const [, pluginId, pluginToolId] = toolId.split(':');
    if (pluginId && pluginToolId) {
      const rawTool = pluginTools.find(
        (candidate) => candidate.pluginId === pluginId && candidate.toolId === pluginToolId,
      );

      if (rawTool) {
        const pluginInfo = installedPlugins.find((plugin) => plugin.id === pluginId);
        const permissionState = permissionStates[pluginId];
        const discoverability = getDiscoverabilityDiagnostic(rawTool, healthMap[pluginId], {
          pluginEnabled: pluginInfo?.enabled ?? true,
          permissionMode,
          grantedPermissions: permissionState ? [...permissionState.granted] : [],
        });

        return {
          canonicalToolId: toolId,
          recoveryState: {
            kind: 'blocked',
            title: rawTool.nameZh ?? rawTool.nameEn,
            description: discoverability.reason ?? t('toolbox.marketplace.unavailable'),
            manageHref: '/toolbox/plugins',
            marketHref: pluginInfo?.source ? getPluginMarketplaceHref(pluginInfo.source) : null,
          },
        };
      }
    }
  }

  return {
    canonicalToolId: null,
    recoveryState: {
      kind: 'unknown',
      title: t('toolbox.search.noResults'),
      description: t('toolbox.empty.noResultsDesc'),
    },
  };
}
