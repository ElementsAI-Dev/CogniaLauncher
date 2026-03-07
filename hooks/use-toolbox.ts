import { useMemo } from 'react';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { usePluginStore } from '@/lib/stores/plugin';
import { TOOL_REGISTRY, TOOL_CATEGORIES } from '@/lib/constants/toolbox';
import {
  buildBuiltInCompatibility,
  buildBuiltInToolContractMetadata,
  buildPluginCompatibility,
  buildPluginToolContractMetadata,
} from '@/lib/toolbox/tool-contract-adapters';
import {
  evaluatePluginHealthStatus,
  getDiscoverabilityDiagnostic,
  type PluginHealthStatus,
} from '@/lib/plugin-governance';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import type { ToolCompatibility, ToolContractMetadata } from '@/types/tool-contract';
import type { ToolCategory, ToolCategoryMeta, ToolDefinitionWithMeta } from '@/types/toolbox';
import type { PluginDeprecationNotice, PluginToolInfo } from '@/types/plugin';

/** Unified tool item that can be either a built-in tool or a plugin tool */
export interface UnifiedTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  keywords: string[];
  isBuiltIn: boolean;
  isNew: boolean;
  isBeta: boolean;
  contractMetadata?: ToolContractMetadata;
  compatibility?: ToolCompatibility;
  pluginHealthStatus?: PluginHealthStatus;
  deprecationWarnings?: PluginDeprecationNotice[];
  /** Only for built-in tools */
  builtInDef?: ToolDefinitionWithMeta;
  /** Only for plugin tools */
  pluginTool?: PluginToolInfo;
}

export interface ExcludedToolDiagnostic {
  toolId: string;
  pluginId: string;
  name: string;
  reason: string;
}

function builtInToUnified(tool: ToolDefinitionWithMeta, t: (key: string) => string): UnifiedTool {
  return {
    id: `builtin:${tool.id}`,
    name: t(tool.nameKey),
    description: t(tool.descriptionKey),
    icon: tool.icon,
    category: tool.category,
    keywords: tool.keywords,
    isBuiltIn: true,
    isNew: tool.isNew,
    isBeta: tool.isBeta ?? false,
    contractMetadata: buildBuiltInToolContractMetadata(tool),
    compatibility: buildBuiltInCompatibility(),
    builtInDef: tool,
  };
}

function pluginToolToUnified(
  tool: PluginToolInfo,
  locale: string,
  options?: {
    pluginHealthStatus?: PluginHealthStatus;
    deprecationWarnings?: PluginDeprecationNotice[];
  },
): UnifiedTool {
  return {
    id: `plugin:${tool.pluginId}:${tool.toolId}`,
    name: locale === 'zh' && tool.nameZh ? tool.nameZh : tool.nameEn,
    description: locale === 'zh' && tool.descriptionZh ? tool.descriptionZh : tool.descriptionEn,
    icon: tool.icon,
    category: tool.category,
    keywords: tool.keywords,
    isBuiltIn: false,
    isNew: false,
    isBeta: false,
    contractMetadata: buildPluginToolContractMetadata(tool),
    compatibility: buildPluginCompatibility(tool),
    pluginHealthStatus: options?.pluginHealthStatus,
    deprecationWarnings: options?.deprecationWarnings,
    pluginTool: tool,
  };
}

export function useToolbox() {
  const store = useToolboxStore();
  const pluginStore = usePluginStore();
  const { t, locale } = useLocale();
  const isDesktop = isTauri();

  // Merge built-in tools + plugin tools into unified list and capture exclusions.
  const { allTools, excludedTools } = useMemo(() => {
    const builtIn: UnifiedTool[] = TOOL_REGISTRY
      .filter((tool) => isDesktop || !tool.requiresTauri)
      .map((tool) => builtInToUnified(tool, t));

    const pluginById = new Map(pluginStore.installedPlugins.map((plugin) => [plugin.id, plugin]));
    const discoverablePlugins: UnifiedTool[] = [];
    const excluded: ExcludedToolDiagnostic[] = [];
    for (const tool of pluginStore.pluginTools) {
      const plugin = pluginById.get(tool.pluginId);
      const health = pluginStore.healthMap[tool.pluginId];
      const permissionState = pluginStore.permissionStates[tool.pluginId];
      const discoverability = getDiscoverabilityDiagnostic(tool, health, {
        pluginEnabled: plugin?.enabled ?? true,
        permissionMode: pluginStore.permissionMode,
        grantedPermissions: permissionState ? [...permissionState.granted] : [],
      });
      const displayName = locale === 'zh' && tool.nameZh ? tool.nameZh : tool.nameEn;
      const deprecationWarnings = dedupeDeprecationWarnings([
        ...(plugin?.deprecationWarnings ?? []),
        ...(tool.deprecationWarnings ?? []),
      ]);
      const pluginHealthStatus = evaluatePluginHealthStatus(health, plugin?.enabled ?? true);

      if (!discoverability.discoverable) {
        excluded.push({
          toolId: `plugin:${tool.pluginId}:${tool.toolId}`,
          pluginId: tool.pluginId,
          name: displayName,
          reason: discoverability.reason ?? 'Excluded by governance policy.',
        });
        continue;
      }

      discoverablePlugins.push(
        pluginToolToUnified(tool, locale, {
          pluginHealthStatus,
          deprecationWarnings: deprecationWarnings.length > 0 ? deprecationWarnings : undefined,
        }),
      );
    }

    discoverablePlugins.sort((a, b) => a.name.localeCompare(b.name));
    excluded.sort((a, b) => a.name.localeCompare(b.name));

    return {
      allTools: [...builtIn, ...discoverablePlugins],
      excludedTools: excluded,
    };
  }, [
    isDesktop,
    t,
    locale,
    pluginStore.healthMap,
    pluginStore.installedPlugins,
    pluginStore.permissionMode,
    pluginStore.permissionStates,
    pluginStore.pluginTools,
  ]);

  const filteredTools = useMemo(() => {
    let tools = allTools;

    // Category filter
    if (store.selectedCategory === 'favorites') {
      tools = tools.filter((tool) => store.favorites.includes(tool.id));
    } else if (store.selectedCategory === 'recent') {
      const recentSet = new Set(store.recentTools);
      tools = tools
        .filter((tool) => recentSet.has(tool.id))
        .sort((a, b) => store.recentTools.indexOf(a.id) - store.recentTools.indexOf(b.id));
    } else if (store.selectedCategory === 'most-used') {
      tools = tools
        .filter((tool) => (store.toolUseCounts[tool.id] ?? 0) > 0)
        .sort((a, b) => (store.toolUseCounts[b.id] ?? 0) - (store.toolUseCounts[a.id] ?? 0));
    } else if (store.selectedCategory !== 'all') {
      tools = tools.filter((tool) => tool.category === store.selectedCategory);
    }

    // Search filter (3-tier: name > keywords > description)
    const q = store.searchQuery.trim().toLowerCase();
    if (q) {
      const scored: { tool: UnifiedTool; score: number }[] = [];
      for (const tool of tools) {
        const name = tool.name.toLowerCase();
        const desc = tool.description.toLowerCase();
        const nameMatch = name.includes(q);
        const kwMatch = tool.keywords.some((kw) => kw.includes(q));
        const descMatch = desc.includes(q);

        if (nameMatch || kwMatch || descMatch) {
          const score = (nameMatch ? 3 : 0) + (kwMatch ? 2 : 0) + (descMatch ? 1 : 0);
          scored.push({ tool, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      tools = scored.map((s) => s.tool);
    }

    return tools;
  }, [allTools, store.selectedCategory, store.searchQuery, store.favorites, store.recentTools, store.toolUseCounts]);

  const knownCategoryIds = useMemo(() => new Set<string>(TOOL_CATEGORIES.map((c) => c.id)), []);

  const dynamicCategories = useMemo(() => {
    const seen = new Set<string>();
    const result: ToolCategoryMeta[] = [];
    for (const tool of allTools) {
      if (!knownCategoryIds.has(tool.category) && !seen.has(tool.category)) {
        seen.add(tool.category);
        result.push({
          id: tool.category as ToolCategory,
          nameKey: tool.category,
          descriptionKey: '',
          icon: 'Plug',
          color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
        });
      }
    }
    return result;
  }, [allTools, knownCategoryIds]);

  const categoryToolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cat of TOOL_CATEGORIES) {
      counts.set(cat.id, allTools.filter((t) => t.category === cat.id).length);
    }
    for (const cat of dynamicCategories) {
      counts.set(cat.id, allTools.filter((t) => t.category === cat.id).length);
    }
    return counts;
  }, [allTools, dynamicCategories]);

  const totalToolCount = allTools.length;

  return {
    filteredTools,
    allTools,
    excludedTools,
    categoryToolCounts,
    totalToolCount,
    dynamicCategories,
    isDesktop,
    favorites: store.favorites,
    recentTools: store.recentTools,
    toolUseCounts: store.toolUseCounts,
    mostUsedCount: Object.values(store.toolUseCounts).filter((c) => c > 0).length,
    viewMode: store.viewMode,
    selectedCategory: store.selectedCategory,
    searchQuery: store.searchQuery,
    activeToolId: store.activeToolId,
    toolLifecycles: store.toolLifecycles,
    toggleFavorite: store.toggleFavorite,
    addRecent: store.addRecent,
    setViewMode: store.setViewMode,
    setCategory: store.setCategory,
    setSearchQuery: store.setSearchQuery,
    setActiveToolId: store.setActiveToolId,
    setToolLifecycle: store.setToolLifecycle,
    clearToolLifecycle: store.clearToolLifecycle,
  };
}

function dedupeDeprecationWarnings(
  warnings: PluginDeprecationNotice[],
): PluginDeprecationNotice[] {
  const seen = new Set<string>();
  const deduped: PluginDeprecationNotice[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${warning.message}:${warning.guidance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(warning);
  }
  return deduped;
}
