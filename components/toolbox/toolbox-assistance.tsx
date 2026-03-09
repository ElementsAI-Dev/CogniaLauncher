'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, EyeOff, History, Sparkles, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/use-toolbox';
import { useToolboxMarketplace } from '@/hooks/use-toolbox-marketplace';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

type AssistancePanelId = 'history' | 'featured';

const PANEL_NAME_KEYS: Record<AssistancePanelId, string> = {
  history: 'toolbox.assistance.panelHistory',
  featured: 'toolbox.assistance.panelFeatured',
};

export function ToolboxAssistance() {
  const { t } = useLocale();
  const {
    allTools,
    recentTools,
    favorites,
    excludedTools,
    assistancePanels: rawAssistancePanels,
    setCategory,
    setAssistancePanelCollapsed,
    hideAssistancePanel,
  } = useToolbox();
  const { featuredListings, continuationHint } = useToolboxMarketplace();

  const assistancePanels = rawAssistancePanels ?? {
    history: { collapsed: false, hidden: false },
    featured: { collapsed: false, hidden: false },
  };

  const recentResolved = useMemo(
    () =>
      recentTools
        .map((toolId) => allTools.find((tool) => tool.id === toolId))
        .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
        .slice(0, 3),
    [allTools, recentTools],
  );

  const hasHistory = recentResolved.length > 0 || favorites.length > 0;
  const hasVisibleHistory = !assistancePanels.history.hidden;
  const hasVisibleFeatured = !assistancePanels.featured.hidden;
  const visiblePanelCount = Number(hasVisibleHistory) + Number(hasVisibleFeatured);

  if (visiblePanelCount === 0) return null;

  return (
    <div
      data-testid="toolbox-assistance-root"
      className={visiblePanelCount > 1 ? 'grid gap-4 lg:grid-cols-[1.5fr_1fr]' : 'grid gap-4 grid-cols-1'}
    >
      {hasVisibleHistory && (
        <Card data-testid="toolbox-assistance-history">
          <CardHeader className={assistancePanels.history.collapsed ? 'py-3' : 'pb-3'}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  {continuationHint
                    ? t('toolbox.marketplace.resumeTitle')
                    : hasHistory
                      ? t('toolbox.assistance.historyTitle')
                      : t('toolbox.assistance.starterTitle')}
                </CardTitle>
                <CardDescription>
                  {continuationHint
                    ? t('toolbox.marketplace.resumeDesc')
                    : hasHistory
                      ? t('toolbox.assistance.historyDesc')
                      : t('toolbox.assistance.starterDesc')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  data-testid="toolbox-assistance-toggle-history"
                  aria-label={
                    assistancePanels.history.collapsed
                      ? t('toolbox.assistance.expandPanel', { panel: t(PANEL_NAME_KEYS.history) })
                      : t('toolbox.assistance.collapsePanel', { panel: t(PANEL_NAME_KEYS.history) })
                  }
                  title={
                    assistancePanels.history.collapsed
                      ? t('toolbox.assistance.expandPanel', { panel: t(PANEL_NAME_KEYS.history) })
                      : t('toolbox.assistance.collapsePanel', { panel: t(PANEL_NAME_KEYS.history) })
                  }
                  onClick={() =>
                    setAssistancePanelCollapsed('history', !assistancePanels.history.collapsed)
                  }
                >
                  {assistancePanels.history.collapsed ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  data-testid="toolbox-assistance-hide-history"
                  aria-label={t('toolbox.assistance.hidePanel', { panel: t(PANEL_NAME_KEYS.history) })}
                  title={t('toolbox.assistance.hidePanel', { panel: t(PANEL_NAME_KEYS.history) })}
                  onClick={() => hideAssistancePanel('history')}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <Collapsible open={!assistancePanels.history.collapsed}>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {continuationHint ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t('toolbox.marketplace.resumeBadge')}</Badge>
                    {continuationHint.toolId ? (
                      <Button size="sm" asChild>
                        <Link href={getToolboxDetailPath(continuationHint.toolId)}>
                          {t('toolbox.marketplace.openInstalledTool')}
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/toolbox/plugins">{t('toolbox.marketplace.managePlugin')}</Link>
                      </Button>
                    )}
                  </div>
                ) : hasHistory ? (
                  <div className="flex flex-wrap gap-2">
                    {recentResolved.map((tool) => (
                      <Button key={tool.id} size="sm" variant="outline" asChild>
                        <Link href={getToolboxDetailPath(tool.id)}>{tool.name}</Link>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCategory('formatters')}>
                      {t('toolbox.assistance.tryFormatters')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCategory('generators')}>
                      {t('toolbox.assistance.tryGenerators')}
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/toolbox/market">{t('toolbox.assistance.browseMarketplace')}</Link>
                    </Button>
                  </div>
                )}
                {excludedTools.length > 0 && (
                  <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-xs dark:border-amber-700/40 dark:bg-amber-950/20">
                    <p className="font-medium">{t('toolbox.assistance.remediationTitle')}</p>
                    <p className="mt-1 text-muted-foreground">{t('toolbox.assistance.remediationDesc', { count: excludedTools.length })}</p>
                    <Button size="sm" variant="link" className="px-0" asChild>
                      <Link href="/toolbox/plugins">{t('toolbox.plugin.excludedToolsOpenPlugins')}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {hasVisibleFeatured && (
        <Card data-testid="toolbox-assistance-featured">
          <CardHeader className={assistancePanels.featured.collapsed ? 'py-3' : 'pb-3'}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  {t('toolbox.marketplace.featuredTitle')}
                </CardTitle>
                <CardDescription>{t('toolbox.marketplace.featuredDesc')}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  data-testid="toolbox-assistance-toggle-featured"
                  aria-label={
                    assistancePanels.featured.collapsed
                      ? t('toolbox.assistance.expandPanel', { panel: t(PANEL_NAME_KEYS.featured) })
                      : t('toolbox.assistance.collapsePanel', { panel: t(PANEL_NAME_KEYS.featured) })
                  }
                  title={
                    assistancePanels.featured.collapsed
                      ? t('toolbox.assistance.expandPanel', { panel: t(PANEL_NAME_KEYS.featured) })
                      : t('toolbox.assistance.collapsePanel', { panel: t(PANEL_NAME_KEYS.featured) })
                  }
                  onClick={() =>
                    setAssistancePanelCollapsed('featured', !assistancePanels.featured.collapsed)
                  }
                >
                  {assistancePanels.featured.collapsed ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  data-testid="toolbox-assistance-hide-featured"
                  aria-label={t('toolbox.assistance.hidePanel', { panel: t(PANEL_NAME_KEYS.featured) })}
                  title={t('toolbox.assistance.hidePanel', { panel: t(PANEL_NAME_KEYS.featured) })}
                  onClick={() => hideAssistancePanel('featured')}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <Collapsible open={!assistancePanels.featured.collapsed}>
            <CollapsibleContent>
              <CardContent className="space-y-2 pt-0">
                {featuredListings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/toolbox/market/${encodeURIComponent(listing.id)}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{listing.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{listing.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
                <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
                  <Link href="/toolbox/market">
                    <Wrench className="h-3.5 w-3.5" />
                    {t('toolbox.assistance.browseMarketplace')}
                  </Link>
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
