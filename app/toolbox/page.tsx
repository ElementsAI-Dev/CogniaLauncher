'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useToolbox } from '@/hooks/use-toolbox';
import { usePlugins } from '@/hooks/use-plugins';
import { useLocale } from '@/components/providers/locale-provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  ToolGrid,
  ToolCategoryNav,
  ToolSearchBar,
  ToolDetailPanel,
  ToolEmptyState,
} from '@/components/toolbox';
import { ToolMobileCategoryNav } from '@/components/toolbox/tool-mobile-category-nav';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, List, Plug } from 'lucide-react';
import Link from 'next/link';

export default function ToolboxPage() {
  const { t } = useLocale();
  const { fetchPlugins } = usePlugins();
  const {
    filteredTools,
    allTools,
    categoryToolCounts,
    totalToolCount,
    dynamicCategories,
    isDesktop,
    favorites,
    recentTools,
    mostUsedCount,
    toolUseCounts,
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

  const searchRef = useRef<import('@/components/toolbox/tool-search-bar').ToolSearchBarRef>(null);
  const hasFetchedPluginsRef = useRef(false);

  useKeyboardShortcuts({
    shortcuts: [
      { key: '/', action: () => searchRef.current?.focus(), description: 'Focus search' },
    ],
  });

  // Fetch plugins on mount (desktop only)
  useEffect(() => {
    if (!isDesktop || hasFetchedPluginsRef.current) return;
    hasFetchedPluginsRef.current = true;
    fetchPlugins();
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

  useEffect(() => {
    if (activeToolId && !activeTool) {
      setActiveToolId(null);
    }
  }, [activeToolId, activeTool, setActiveToolId]);

  const emptyType =
    selectedCategory === 'favorites'
      ? 'no-favorites'
      : selectedCategory === 'recent'
        ? 'no-recent'
        : 'no-results';

  return (
    <div
      data-testid="toolbox-page-root"
      className="h-full min-h-0 overflow-hidden p-4 md:p-6"
    >
      <div className="flex h-full min-h-0 flex-col gap-6">
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

        <div className="flex shrink-0 items-center gap-2">
          <ToolMobileCategoryNav
            selectedCategory={selectedCategory}
            onSelectCategory={setCategory}
            categoryToolCounts={categoryToolCounts}
            totalToolCount={totalToolCount}
            favoritesCount={favorites.length}
            recentCount={recentTools.length}
            mostUsedCount={mostUsedCount}
            dynamicCategories={dynamicCategories}
          />
          <ToolSearchBar
            ref={searchRef}
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={filteredTools.length}
            className="flex-1"
          />
        </div>

        <div
          data-testid="toolbox-content-shell"
          className="flex min-h-0 flex-1 gap-6 overflow-hidden"
        >
          <div className="hidden w-48 min-h-0 shrink-0 overflow-hidden md:flex md:flex-col">
            <ToolCategoryNav
              selectedCategory={selectedCategory}
              onSelectCategory={setCategory}
              categoryToolCounts={categoryToolCounts}
              totalToolCount={totalToolCount}
              favoritesCount={favorites.length}
              recentCount={recentTools.length}
              mostUsedCount={mostUsedCount}
              dynamicCategories={dynamicCategories}
            />
          </div>

          <div
            data-testid="toolbox-list-scroll-area"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
          >
            {filteredTools.length > 0 ? (
              <ToolGrid
                tools={filteredTools}
                favorites={favorites}
                viewMode={viewMode}
                onToggleFavorite={toggleFavorite}
                onOpen={handleOpenTool}
                toolUseCounts={toolUseCounts}
              />
            ) : (
              <ToolEmptyState type={emptyType} />
            )}
          </div>
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
