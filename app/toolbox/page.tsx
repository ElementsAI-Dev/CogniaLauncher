'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useToolbox } from '@/hooks/use-toolbox';
import { usePlugins } from '@/hooks/use-plugins';
import { useLocale } from '@/components/providers/locale-provider';
import {
  ToolGrid,
  ToolCategoryNav,
  ToolSearchBar,
  ToolDetailPanel,
  ToolEmptyState,
} from '@/components/toolbox';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, List, Plug } from 'lucide-react';
import Link from 'next/link';
import { isTauri } from '@/lib/tauri';

export default function ToolboxPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const { fetchPlugins } = usePlugins();
  const {
    filteredTools,
    allTools,
    categoryToolCounts,
    totalToolCount,
    favorites,
    recentTools,
    viewMode,
    selectedCategory,
    searchQuery,
    activeToolId,
    toggleFavorite,
    addRecent,
    setViewMode,
    setCategory,
    setSearchQuery,
    setActiveToolId,
  } = useToolbox();

  // Fetch plugins on mount (desktop only)
  useEffect(() => {
    if (isDesktop) {
      fetchPlugins();
    }
  }, [isDesktop, fetchPlugins]);

  const handleOpenTool = useCallback(
    (toolId: string) => {
      addRecent(toolId);
      setActiveToolId(toolId);
    },
    [addRecent, setActiveToolId],
  );

  const handleClosePanel = useCallback(
    (open: boolean) => {
      if (!open) setActiveToolId(null);
    },
    [setActiveToolId],
  );

  const activeTool = useMemo(
    () => (activeToolId ? allTools.find((t) => t.id === activeToolId) ?? null : null),
    [activeToolId, allTools],
  );

  const emptyType =
    selectedCategory === 'favorites'
      ? 'no-favorites'
      : selectedCategory === 'recent'
        ? 'no-recent'
        : 'no-results';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={t('toolbox.title')}
        description={t('toolbox.description')}
        actions={
          <div className="flex items-center gap-2">
            {isDesktop && (
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link href="/toolbox/plugins">
                  <Plug className="h-3.5 w-3.5" />
                  {t('toolbox.plugin.title')}
                </Link>
              </Button>
            )}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => { if (v) setViewMode(v as 'grid' | 'list'); }}
              className="bg-muted rounded-lg p-0.5"
            >
              <ToggleGroupItem value="grid" aria-label={t('toolbox.viewMode.grid')} className="h-8 w-8 p-0">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label={t('toolbox.viewMode.list')} className="h-8 w-8 p-0">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />

      <ToolSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={filteredTools.length}
      />

      <div className="flex gap-6">
        <div className="hidden md:block w-48 shrink-0">
          <ToolCategoryNav
            selectedCategory={selectedCategory}
            onSelectCategory={setCategory}
            categoryToolCounts={categoryToolCounts}
            totalToolCount={totalToolCount}
            favoritesCount={favorites.length}
            recentCount={recentTools.length}
          />
        </div>

        <div className="flex-1 min-w-0">
          {filteredTools.length > 0 ? (
            <ToolGrid
              tools={filteredTools}
              favorites={favorites}
              viewMode={viewMode}
              onToggleFavorite={toggleFavorite}
              onOpen={handleOpenTool}
            />
          ) : (
            <ToolEmptyState type={emptyType} />
          )}
        </div>
      </div>

      <ToolDetailPanel
        tool={activeTool}
        open={activeTool !== null}
        onOpenChange={handleClosePanel}
      />
    </div>
  );
}
