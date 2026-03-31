'use client';

import { useState, useMemo } from 'react';
import type { InstalledPackage } from '@/lib/tauri';
import type { InstalledFilterState } from '@/types/packages';

export function useInstalledFilter(packages: InstalledPackage[]) {
  const [filter, setFilter] = useState<InstalledFilterState>({
    query: '',
    provider: null,
  });

  const filteredPackages = useMemo(() => {
    let result = packages;

    if (filter.provider) {
      result = result.filter((pkg) => pkg.provider === filter.provider);
    }

    if (filter.query) {
      const query = filter.query.toLowerCase();
      result = result.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(query) ||
          pkg.version.toLowerCase().includes(query),
      );
    }

    return result;
  }, [packages, filter]);

  return {
    filter,
    setFilter,
    filteredPackages,
  };
}
