'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { InstalledFilterBar, useInstalledFilter } from '@/components/packages/installed-filter-bar';
import { PackageList } from '@/components/packages/package-list';
import type { InstalledPackage, PackageSummary, ProviderInfo } from '@/lib/tauri';

export interface InstalledTabProps {
  packages: InstalledPackage[];
  providers: ProviderInfo[];
  loading: boolean;
  pinnedPackages: string[];
  bookmarkedPackages: string[];
  resolvingDependencyKey: string | null;
  onUninstall: (name: string) => void;
  onSelect: (pkg: PackageSummary | InstalledPackage) => void;
  onResolveDependencies: (pkg: PackageSummary | InstalledPackage, source: 'installed' | 'search') => void;
  onPin: (name: string, version?: string, provider?: string) => void;
  onUnpin: (name: string, provider?: string) => void;
  onBookmark: (name: string, provider?: string) => void;
}

export function InstalledTab({
  packages,
  providers,
  loading,
  pinnedPackages,
  bookmarkedPackages,
  resolvingDependencyKey,
  onUninstall,
  onSelect,
  onResolveDependencies,
  onPin,
  onUnpin,
  onBookmark,
}: InstalledTabProps) {
  const { filter, setFilter, filteredPackages } = useInstalledFilter(packages);

  return (
    <>
      <InstalledFilterBar
        packages={packages}
        providers={providers}
        filter={filter}
        onFilterChange={setFilter}
      />
      {loading && packages.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <PackageList
          packages={filteredPackages}
          type="installed"
          pinnedPackages={pinnedPackages}
          bookmarkedPackages={bookmarkedPackages}
          resolvingDependencyKey={resolvingDependencyKey}
          onUninstall={onUninstall}
          onSelect={onSelect}
          onResolveDependencies={onResolveDependencies}
          onPin={onPin}
          onUnpin={onUnpin}
          onBookmark={onBookmark}
        />
      )}
    </>
  );
}
