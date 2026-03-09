'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolboxMarketplace } from '@/hooks/use-toolbox-marketplace';
import { MarketplaceListingCard } from '@/components/toolbox/marketplace-listing-card';
import type { ToolboxMarketplaceFilters } from '@/types/toolbox-marketplace';

function readFilters(searchParams: URLSearchParams): ToolboxMarketplaceFilters {
  const installState = searchParams.get('state');
  const sort = searchParams.get('sort');
  return {
    query: searchParams.get('q') ?? '',
    category: searchParams.get('category') ?? 'all',
    featuredOnly: searchParams.get('featured') === '1',
    verifiedOnly: searchParams.get('verified') === '1',
    installState:
      installState === 'not-installed'
      || installState === 'installed'
      || installState === 'update-available'
      || installState === 'disabled'
      || installState === 'blocked'
        ? installState
        : 'all',
    sort:
      sort === 'name'
      || sort === 'updated'
      || sort === 'popular'
        ? sort
        : 'relevance',
  };
}

export default function ToolboxMarketplacePage() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const {
    filteredListings,
    featuredListings,
    recentlyUpdatedListings,
    categories,
    catalogSource,
    syncState,
    lastSyncedAt,
    lastError,
    lastActionError,
    lastActionProgress,
    clearMarketplaceActionError,
    refreshCatalog,
    getListingById,
    installListing,
    updateListing,
  } = useToolboxMarketplace(filters);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const setFilter = (patch: Partial<ToolboxMarketplaceFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = { ...filters, ...patch };
    if (next.query) params.set('q', next.query); else params.delete('q');
    if (next.category !== 'all') params.set('category', next.category); else params.delete('category');
    if (next.featuredOnly) params.set('featured', '1'); else params.delete('featured');
    if (next.verifiedOnly) params.set('verified', '1'); else params.delete('verified');
    if (next.installState !== 'all') params.set('state', next.installState); else params.delete('state');
    if (next.sort !== 'relevance') params.set('sort', next.sort); else params.delete('sort');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const showCollections = (
    !filters.query
    && filters.category === 'all'
    && !filters.featuredOnly
    && !filters.verifiedOnly
    && filters.installState === 'all'
    && filters.sort === 'relevance'
  );

  const retryLastAction = async () => {
    if (!lastActionError?.retryable) return;
    const listing = getListingById(lastActionError.listingId);
    if (!listing) {
      await refreshCatalog();
      return;
    }

    if (lastActionError.kind === 'marketplace-install') {
      await installListing(listing);
      return;
    }

    await updateListing(listing);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title={t('toolbox.marketplace.title')}
        description={t('toolbox.marketplace.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/toolbox">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t('toolbox.actions.backToToolbox')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshCatalog()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t('toolbox.marketplace.refresh')}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
          <Input
            value={filters.query}
            onChange={(event) => setFilter({ query: event.target.value })}
            placeholder={t('toolbox.marketplace.searchPlaceholder')}
            className="md:max-w-sm"
          />
          <select
            value={filters.category}
            onChange={(event) => setFilter({ category: event.target.value })}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t('toolbox.marketplace.filterAllCategories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={filters.installState}
            onChange={(event) => setFilter({ installState: event.target.value as ToolboxMarketplaceFilters['installState'] })}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t('toolbox.marketplace.filterAllStates')}</option>
            <option value="not-installed">{t('toolbox.marketplace.state.not-installed')}</option>
            <option value="installed">{t('toolbox.marketplace.state.installed')}</option>
            <option value="update-available">{t('toolbox.marketplace.state.update-available')}</option>
            <option value="disabled">{t('toolbox.marketplace.state.disabled')}</option>
            <option value="blocked">{t('toolbox.marketplace.state.blocked')}</option>
          </select>
          <select
            aria-label={t('toolbox.marketplace.sortLabel')}
            value={filters.sort}
            onChange={(event) => setFilter({ sort: event.target.value as ToolboxMarketplaceFilters['sort'] })}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="relevance">{t('toolbox.marketplace.sort.relevance')}</option>
            <option value="updated">{t('toolbox.marketplace.sort.updated')}</option>
            <option value="popular">{t('toolbox.marketplace.sort.popular')}</option>
            <option value="name">{t('toolbox.marketplace.sort.name')}</option>
          </select>
          <Button
            variant={filters.featuredOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter({ featuredOnly: !filters.featuredOnly })}
          >
            {t('toolbox.marketplace.featuredOnly')}
          </Button>
          <Button
            variant={filters.verifiedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter({ verifiedOnly: !filters.verifiedOnly })}
          >
            {t('toolbox.marketplace.verifiedOnly')}
          </Button>
          <div className="text-xs text-muted-foreground md:ml-auto">
            <span>{t(`toolbox.marketplace.source.${catalogSource}`)}</span>
            <span className="mx-1">·</span>
            {syncState === 'degraded' && lastError
              ? t('toolbox.marketplace.degradedState', { timestamp: lastSyncedAt ?? '—' })
              : syncState === 'error' && lastError
                ? lastError
                : t('toolbox.marketplace.lastSynced', { timestamp: lastSyncedAt ?? '—' })}
          </div>
        </CardContent>
      </Card>

      {lastActionError && (
        <Alert>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p className="text-sm">{lastActionError.message}</p>
              <div className="flex flex-wrap gap-2">
                {lastActionError.retryable && (
                  <Button size="sm" variant="outline" onClick={() => void retryLastAction()}>
                    {t('common.retry')}
                  </Button>
                )}
                {(lastActionError.category === 'source_unavailable'
                  || lastActionError.category === 'install_execution_failed') && (
                  <Button size="sm" variant="outline" onClick={() => void refreshCatalog()}>
                    {t('toolbox.marketplace.refresh')}
                  </Button>
                )}
                {(lastActionError.category === 'compatibility_blocked'
                  || lastActionError.category === 'validation_failed') && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/toolbox/market/${encodeURIComponent(lastActionError.listingId)}`}>
                      {t('toolbox.marketplace.details')}
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearMarketplaceActionError}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {lastActionProgress && lastActionProgress.phase !== 'completed' && (
        <Alert>
          <AlertTitle>{t('toolbox.marketplace.title')}</AlertTitle>
          <AlertDescription>
            {`Action: ${lastActionProgress.kind} · Phase: ${lastActionProgress.phase}${
              lastActionProgress.downloadTaskId
                ? ` · Task: ${lastActionProgress.downloadTaskId}`
                : ''
            }`}
          </AlertDescription>
        </Alert>
      )}

      {showCollections && featuredListings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t('toolbox.marketplace.featuredTitle')}</CardTitle>
            <CardDescription>{t('toolbox.marketplace.featuredDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredListings.map((listing) => (
              <MarketplaceListingCard
                key={`featured-${listing.id}`}
                listing={listing}
                busy={lastActionProgress?.listingId === listing.id && lastActionProgress.phase !== 'completed' && lastActionProgress.phase !== 'failed'}
                onInstall={installListing}
                onUpdate={updateListing}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {showCollections && recentlyUpdatedListings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t('toolbox.marketplace.recentlyUpdatedTitle')}</CardTitle>
            <CardDescription>{t('toolbox.marketplace.recentlyUpdatedDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentlyUpdatedListings.map((listing) => (
              <MarketplaceListingCard
                key={`recent-${listing.id}`}
                listing={listing}
                busy={lastActionProgress?.listingId === listing.id && lastActionProgress.phase !== 'completed' && lastActionProgress.phase !== 'failed'}
                onInstall={installListing}
                onUpdate={updateListing}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {filteredListings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('toolbox.marketplace.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredListings.map((listing) => (
            <MarketplaceListingCard
              key={listing.id}
              listing={listing}
              busy={lastActionProgress?.listingId === listing.id && lastActionProgress.phase !== 'completed' && lastActionProgress.phase !== 'failed'}
              onInstall={installListing}
              onUpdate={updateListing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
