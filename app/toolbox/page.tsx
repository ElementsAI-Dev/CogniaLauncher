'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { useToolbox } from '@/hooks/use-toolbox';
import { usePlugins } from '@/hooks/use-plugins';
import { useLocale } from '@/components/providers/locale-provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  ToolGrid,
  ToolCategoryNav,
  ToolSearchBar,
  ToolEmptyState,
} from '@/components/toolbox';
import { ToolMobileCategoryNav } from '@/components/toolbox/tool-mobile-category-nav';
import { ToolboxAssistance } from '@/components/toolbox/toolbox-assistance';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ToolbarCluster, ToolbarRow, denseToolbarControl } from '@/components/ui/toolbar';
import { LayoutGrid, List, Plug, ShieldAlert, Store } from 'lucide-react';
import Link from 'next/link';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

export default function ToolboxPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { fetchPlugins } = usePlugins();
  const {
    filteredTools,
    excludedTools,
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
    assistancePanels,
    toggleFavorite,
    setViewMode,
    setCategory,
    setSearchQuery,
    restoreAssistancePanel,
    restoreAllAssistancePanels,
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
      router.push(getToolboxDetailPath(toolId));
    },
    [router],
  );

  const emptyType =
    selectedCategory === 'favorites'
      ? 'no-favorites'
      : selectedCategory === 'recent'
        ? 'no-recent'
        : 'no-results';

  const showAssistanceSection = selectedCategory === 'all' && searchQuery.trim().length === 0;
  const hiddenAssistancePanels = [
    {
      id: 'history' as const,
      hidden: assistancePanels.history.hidden,
      label: t('toolbox.assistance.panelHistory'),
    },
    {
      id: 'featured' as const,
      hidden: assistancePanels.featured.hidden,
      label: t('toolbox.assistance.panelFeatured'),
    },
  ].filter((panel) => panel.hidden);
  const hasVisibleAssistancePanels =
    !assistancePanels.history.hidden || !assistancePanels.featured.hidden;

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
            <ToolbarRow
              role="toolbar"
              aria-label={t('toolbox.title')}
              className="justify-end"
              data-testid="toolbox-header-toolbar"
            >
              {isDesktop && (
                <ToolbarCluster data-testid="toolbox-header-market-group">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${denseToolbarControl.button} gap-1.5`}
                    asChild
                  >
                    <Link href="/toolbox/market">
                      <Store className="h-3.5 w-3.5" />
                      {t('toolbox.marketplace.title')}
                    </Link>
                  </Button>
                </ToolbarCluster>
              )}
              {isDesktop && (
                <ToolbarCluster data-testid="toolbox-header-plugins-group">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${denseToolbarControl.button} gap-1.5`}
                    asChild
                  >
                    <Link href="/toolbox/plugins">
                      <Plug className="h-3.5 w-3.5" />
                      {t('toolbox.plugin.title')}
                    </Link>
                  </Button>
                </ToolbarCluster>
              )}
              <ToolbarCluster data-testid="toolbox-header-view-group" compact>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => { if (v) setViewMode(v as 'grid' | 'list'); }}
                  size="default"
                  spacing={0}
                  className="bg-transparent"
                >
                  <ToggleGroupItem
                    value="grid"
                    aria-label={t('toolbox.viewMode.grid')}
                    className={denseToolbarControl.toggleIconItem}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="list"
                    aria-label={t('toolbox.viewMode.list')}
                    className={denseToolbarControl.toggleIconItem}
                  >
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </ToolbarCluster>
            </ToolbarRow>
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

        {excludedTools.length > 0 && selectedCategory === 'all' && searchQuery.trim().length === 0 && (
          <Alert className="shrink-0 border-amber-300/60 bg-amber-50/70 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{t('toolbox.plugin.excludedToolsTitle')}</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <p>{t('toolbox.plugin.excludedToolsDesc', { count: excludedTools.length })}</p>
              <div className="space-y-1">
                {excludedTools.slice(0, 3).map((item) => (
                  <p key={item.toolId} className="font-mono break-all">
                    {item.name}: {item.reason}
                  </p>
                ))}
              </div>
              <div>
                <Link href="/toolbox/plugins" className="underline underline-offset-4">
                  {t('toolbox.plugin.excludedToolsOpenPlugins')}
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showAssistanceSection && (
          <div className="shrink-0 space-y-2">
            {hiddenAssistancePanels.length > 0 && (
              <div
                data-testid="toolbox-assistance-restore-strip"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">
                  {t('toolbox.assistance.hiddenPanelsHint', {
                    count: hiddenAssistancePanels.length,
                  })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {hiddenAssistancePanels.map((panel) => (
                    <Button
                      key={panel.id}
                      size="sm"
                      variant="outline"
                      data-testid={`toolbox-assistance-restore-${panel.id}`}
                      onClick={() => restoreAssistancePanel(panel.id)}
                    >
                      {t('toolbox.assistance.restorePanel', { panel: panel.label })}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    data-testid="toolbox-assistance-restore-all"
                    onClick={restoreAllAssistancePanels}
                  >
                    {t('toolbox.assistance.restoreAll')}
                  </Button>
                </div>
              </div>
            )}
            {hasVisibleAssistancePanels && <ToolboxAssistance />}
          </div>
        )}

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
              <ToolEmptyState
                type={emptyType}
                actions={
                  <>
                    {searchQuery.trim().length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
                        {t('toolbox.marketplace.clearSearch')}
                      </Button>
                    )}
                    {isDesktop && (
                      <Button size="sm" asChild>
                        <Link href="/toolbox/market">{t('toolbox.assistance.browseMarketplace')}</Link>
                      </Button>
                    )}
                    {excludedTools.length > 0 && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/toolbox/plugins">{t('toolbox.plugin.excludedToolsOpenPlugins')}</Link>
                      </Button>
                    )}
                  </>
                }
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
