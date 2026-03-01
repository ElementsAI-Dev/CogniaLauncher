import { useMemo } from 'react';
import { useToolboxStore } from '@/lib/stores/toolbox';
import { usePluginStore } from '@/lib/stores/plugin';
import { TOOL_REGISTRY, TOOL_CATEGORIES } from '@/lib/constants/toolbox';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import type { ToolCategory, ToolCategoryMeta, ToolDefinitionWithMeta } from '@/types/toolbox';
import type { PluginToolInfo } from '@/types/plugin';

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
  /** Only for built-in tools */
  builtInDef?: ToolDefinitionWithMeta;
  /** Only for plugin tools */
  pluginTool?: PluginToolInfo;
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
    builtInDef: tool,
  };
}

function pluginToolToUnified(tool: PluginToolInfo, locale: string): UnifiedTool {
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
    pluginTool: tool,
  };
}

export function useToolbox() {
  const store = useToolboxStore();
  const pluginStore = usePluginStore();
  const { t, locale } = useLocale();
  const isDesktop = isTauri();

  // Merge built-in tools + plugin tools into unified list
  const allTools = useMemo(() => {
    const builtIn: UnifiedTool[] = TOOL_REGISTRY
      .filter((tool) => isDesktop || !tool.requiresTauri)
      .map((tool) => builtInToUnified(tool, t));

    const plugins: UnifiedTool[] = pluginStore.pluginTools
      .map((tool) => pluginToolToUnified(tool, locale))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...builtIn, ...plugins];
  }, [isDesktop, t, locale, pluginStore.pluginTools]);

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
    toggleFavorite: store.toggleFavorite,
    addRecent: store.addRecent,
    setViewMode: store.setViewMode,
    setCategory: store.setCategory,
    setSearchQuery: store.setSearchQuery,
    setActiveToolId: store.setActiveToolId,
  };
}
