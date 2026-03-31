'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageList } from '@/components/packages/package-list';
import { useLocale } from '@/components/providers/locale-provider';
import type { PackageSummary, InstalledPackage } from '@/lib/tauri';

export interface SearchRequest {
  query: string;
  providers?: string[];
  installedOnly?: boolean;
  notInstalled?: boolean;
  hasUpdates?: boolean;
  license?: string[];
  minVersion?: string;
  maxVersion?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchMeta {
  total: number;
  page: number;
  pageSize: number;
  facets: {
    providers: Record<string, number>;
    licenses: Record<string, number>;
  };
}

export interface SearchResultsTabProps {
  searchResults: PackageSummary[];
  searchMeta: SearchMeta | null;
  searchRequest: SearchRequest | null;
  activeFilterCount: number;
  loading: boolean;
  installing: string[];
  resolvingDependencyKey: string | null;
  onInstall: (name: string) => void;
  onSelect: (pkg: PackageSummary | InstalledPackage) => void;
  onResolveDependencies: (pkg: PackageSummary | InstalledPackage, source: 'installed' | 'search') => void;
  onPageChange: (page: number) => void;
}

export function SearchResultsTab({
  searchResults,
  searchMeta,
  searchRequest,
  activeFilterCount,
  loading,
  installing,
  resolvingDependencyKey,
  onInstall,
  onSelect,
  onResolveDependencies,
  onPageChange,
}: SearchResultsTabProps) {
  const { t } = useLocale();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {searchRequest ? (
        <Card data-testid="active-search-summary">
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="text-sm font-medium">
              {t('packages.activeSearchTitle')}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('packages.activeSearchDescription')}
            </div>
            <div className="text-sm">
              {t('packages.searchContextQuery', { value: searchRequest.query })}
            </div>
            {searchRequest.providers?.length ? (
              <div className="text-sm">
                {t('packages.searchContextProviders', {
                  value: searchRequest.providers.join(', '),
                })}
              </div>
            ) : null}
            {searchRequest.sortBy ? (
              <div className="text-sm">
                {t('packages.searchContextSort', { value: searchRequest.sortBy })}
              </div>
            ) : null}
            {activeFilterCount > 0 ? (
              <div className="text-sm">
                {t('packages.searchContextFilterCount', {
                  count: activeFilterCount,
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {searchMeta && searchMeta.total > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {t('packages.searchSummary', {
                  from: searchMeta.page * searchMeta.pageSize + 1,
                  to: Math.min(
                    searchMeta.total,
                    searchMeta.page * searchMeta.pageSize + searchResults.length,
                  ),
                  total: searchMeta.total,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(Math.max(0, searchMeta.page - 1))}
                  disabled={loading || searchMeta.page <= 0}
                >
                  {t('packages.searchPrevPage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(searchMeta.page + 1)}
                  disabled={
                    loading ||
                    (searchMeta.page + 1) * searchMeta.pageSize >= searchMeta.total
                  }
                >
                  {t('packages.searchNextPage')}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('packages.searchFacetProviders')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(searchMeta.facets.providers).map(([provider, count]) => (
                    <Badge key={provider} variant="secondary">
                      {provider} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('packages.searchFacetLicenses')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(searchMeta.facets.licenses).map(([license, count]) => (
                    <Badge key={license} variant="secondary">
                      {license} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <PackageList
          packages={searchResults}
          type="search"
          installing={installing}
          resolvingDependencyKey={resolvingDependencyKey}
          onInstall={onInstall}
          onSelect={onSelect}
          onResolveDependencies={onResolveDependencies}
          showSelectAll={false}
        />
      )}
    </div>
  );
}
