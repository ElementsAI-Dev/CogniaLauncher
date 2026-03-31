'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolboxMarketplace } from '@/hooks/toolbox/use-toolbox-marketplace';
import { getToolboxDetailPath } from '@/lib/toolbox-route';

export function MarketplaceDetailPageClient({ listingId }: { listingId: string }) {
  const { t } = useLocale();
  const {
    getListingById,
    refreshCatalog,
    installListing,
    updateListing,
    lastActionProgress,
  } = useToolboxMarketplace();

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const listing = getListingById(listingId);

  if (!listing) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title={t('toolbox.marketplace.title')}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/toolbox/market">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t('toolbox.actions.backToToolbox')}
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('toolbox.marketplace.notFound')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryToolHref = listing.tools[0]
    ? getToolboxDetailPath(`plugin:${listing.pluginId}:${listing.tools[0].toolId}`)
    : null;
  const busy = lastActionProgress?.listingId === listing.id
    && lastActionProgress.phase !== 'completed'
    && lastActionProgress.phase !== 'failed';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title={listing.name}
        description={listing.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/toolbox/market">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t('toolbox.marketplace.backToMarket')}
              </Link>
            </Button>
            {listing.installState === 'blocked' ? (
              <Button size="sm" disabled>{t('toolbox.marketplace.unavailable')}</Button>
            ) : listing.installState === 'disabled' ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/toolbox/plugins">{t('toolbox.marketplace.managePlugin')}</Link>
              </Button>
            ) : listing.installState === 'update-available' ? (
              <Button size="sm" disabled={busy} onClick={() => void updateListing(listing)}>
                {busy ? 'Working...' : t('toolbox.marketplace.update')}
              </Button>
            ) : listing.installState === 'installed' ? (
              primaryToolHref ? (
                <Button size="sm" asChild>
                  <Link href={primaryToolHref}>{t('toolbox.marketplace.openInstalledTool')}</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/toolbox/plugins">{t('toolbox.marketplace.managePlugin')}</Link>
                </Button>
              )
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void installListing(listing)}>
                {busy ? 'Working...' : t('toolbox.marketplace.install')}
              </Button>
            )}
          </div>
        }
      />

      {lastActionProgress && lastActionProgress.listingId === listing.id && (
        <Card>
          <CardContent className="py-3 text-xs text-muted-foreground">
            {`Action: ${lastActionProgress.kind} · Phase: ${lastActionProgress.phase}${
              lastActionProgress.downloadTaskId
                ? ` · Task: ${lastActionProgress.downloadTaskId}`
                : ''
            }`}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              {t('toolbox.marketplace.trustAndCompatibility')}
            </CardTitle>
            <CardDescription>{t('toolbox.marketplace.trustAndCompatibilityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">v{listing.version}</Badge>
              <Badge variant="secondary">{listing.category}</Badge>
              <Badge variant="secondary">{t(`toolbox.marketplace.state.${listing.installState}`)}</Badge>
              <Badge variant="outline">{listing.source.storeId}</Badge>
              {listing.publisher && <Badge variant="outline">{listing.publisher.name}</Badge>}
              {listing.publisher?.verified && (
                <Badge variant="secondary">{t('toolbox.marketplace.verifiedPublisher')}</Badge>
              )}
            </div>
            {listing.blockedReason && (
              <p className="rounded-md border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200">
                {listing.blockedReason}
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="font-medium">{t('toolbox.marketplace.permissions')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.permissions.length > 0 ? listing.permissions.join(', ') : t('toolbox.marketplace.none')}
                </p>
              </div>
              <div>
                <p className="font-medium">{t('toolbox.marketplace.capabilities')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.capabilities.length > 0 ? listing.capabilities.join(', ') : t('toolbox.marketplace.none')}
                </p>
              </div>
              {listing.installCount !== null && (
                <div>
                  <p className="font-medium">{t('toolbox.marketplace.installCountLabel')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('toolbox.marketplace.installCount', { count: String(listing.installCount) })}
                  </p>
                </div>
              )}
              {listing.updatedAt && (
                <div>
                  <p className="font-medium">{t('toolbox.marketplace.updatedAtLabel')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('toolbox.marketplace.updatedAt', { date: listing.updatedAt.slice(0, 10) })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              {t('toolbox.marketplace.toolPreview')}
            </CardTitle>
            <CardDescription>{t('toolbox.marketplace.toolPreviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {listing.tools.map((tool) => (
              <div key={tool.toolId} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{tool.name}</p>
                  <Badge variant="outline">{tool.uiMode}</Badge>
                </div>
                {tool.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(listing.support.homepageUrl || listing.support.documentationUrl || listing.support.issuesUrl) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('toolbox.marketplace.supportLinks')}</CardTitle>
            <CardDescription>{t('toolbox.marketplace.supportLinksDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            {listing.support.homepageUrl && (
              <a href={listing.support.homepageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {t('toolbox.marketplace.support.homepage')}
              </a>
            )}
            {listing.support.documentationUrl && (
              <a href={listing.support.documentationUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {t('toolbox.marketplace.support.documentation')}
              </a>
            )}
            {listing.support.issuesUrl && (
              <a href={listing.support.issuesUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {t('toolbox.marketplace.support.issues')}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {(listing.highlights.length > 0 || listing.releaseNotes || listing.gallery.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('toolbox.marketplace.releaseNotes')}</CardTitle>
            <CardDescription>{t('toolbox.marketplace.releaseNotesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {listing.highlights.length > 0 && (
              <div>
                <p className="font-medium">{t('toolbox.marketplace.highlights')}</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  {listing.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            {listing.releaseNotes && (
              <p className="text-xs text-muted-foreground">{listing.releaseNotes}</p>
            )}
            {listing.gallery.length > 0 && (
              <div>
                <p className="font-medium">{t('toolbox.marketplace.gallery')}</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {listing.gallery.map((asset) => (
                    <li key={asset.url}>
                      <a href={asset.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {asset.alt}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
