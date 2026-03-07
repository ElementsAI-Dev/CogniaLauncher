'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, History, Sparkles, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolbox } from '@/hooks/use-toolbox';
import { useToolboxMarketplace } from '@/hooks/use-toolbox-marketplace';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

export function ToolboxAssistance() {
  const { t } = useLocale();
  const { allTools, recentTools, favorites, excludedTools, setCategory } = useToolbox();
  const { featuredListings, continuationHint } = useToolboxMarketplace();

  const recentResolved = useMemo(
    () =>
      recentTools
        .map((toolId) => allTools.find((tool) => tool.id === toolId))
        .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
        .slice(0, 3),
    [allTools, recentTools],
  );

  const hasHistory = recentResolved.length > 0 || favorites.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader className="pb-3">
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
        </CardHeader>
        <CardContent className="space-y-3">
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
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('toolbox.marketplace.featuredTitle')}
          </CardTitle>
          <CardDescription>{t('toolbox.marketplace.featuredDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
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
      </Card>
    </div>
  );
}
