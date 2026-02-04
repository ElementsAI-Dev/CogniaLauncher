'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Package, Search, X, ChevronRight, ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import type { InstalledPackage } from '@/lib/tauri';

interface PackageListProps {
  packages: InstalledPackage[];
  className?: string;
  initialLimit?: number;
}

export function PackageList({ 
  packages, 
  className,
  initialLimit = 5 
}: PackageListProps) {
  const router = useRouter();
  const { t } = useLocale();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) return packages;
    
    const query = searchQuery.toLowerCase();
    return packages.filter(pkg => 
      pkg.name.toLowerCase().includes(query) ||
      pkg.provider.toLowerCase().includes(query) ||
      pkg.version.toLowerCase().includes(query)
    );
  }, [packages, searchQuery]);

  const displayedPackages = useMemo(() => {
    if (expanded) return filteredPackages;
    return filteredPackages.slice(0, initialLimit);
  }, [filteredPackages, expanded, initialLimit]);

  const remainingCount = filteredPackages.length - initialLimit;
  const hasMore = remainingCount > 0;

  const handlePackageClick = useCallback((pkg: InstalledPackage) => {
    router.push(`/packages?provider=${encodeURIComponent(pkg.provider)}&package=${encodeURIComponent(pkg.name)}`);
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.push('/packages');
  }, [router]);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">
              {t('dashboard.packageList.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.recentPackagesDesc')}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleViewAll}
            className="gap-1"
          >
            {t('dashboard.packageList.viewAll')}
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Input */}
        {packages.length > 3 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('dashboard.packageList.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('common.clear')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Package List */}
        {filteredPackages.length === 0 ? (
          <div className="py-6 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {packages.length === 0 
                ? t('dashboard.noPackages')
                : t('dashboard.packageList.noResults')
              }
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {displayedPackages.map((pkg) => (
                <PackageItem
                  key={`${pkg.provider}-${pkg.name}-${pkg.version}`}
                  package={pkg}
                  onClick={() => handlePackageClick(pkg)}
                />
              ))}
            </div>

            {hasMore && !expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="mt-3 w-full gap-1"
              >
                <ChevronDown className="h-4 w-4" />
                {t('dashboard.packageList.showMore').replace('{count}', String(remainingCount))}
              </Button>
            )}

            {expanded && hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="mt-3 w-full gap-1"
              >
                {t('dashboard.environmentList.showLess')}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface PackageItemProps {
  package: InstalledPackage;
  onClick: () => void;
}

function PackageItem({ package: pkg, onClick }: PackageItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg border p-3',
        'transition-colors hover:bg-accent/50',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-left">
          <div className="font-medium">{pkg.name}</div>
          <div className="text-xs text-muted-foreground">{pkg.provider}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono text-xs">
          {pkg.version}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}
