import type { PackageSummary, InstalledPackage } from '@/lib/tauri';

interface PackageIdentityLike {
  name: string;
  provider?: string | null;
}

/**
 * Parse a package spec string like "provider:name" into its components.
 */
export function parsePackageSpec(pkg: string) {
  const colonIndex = pkg.indexOf(':');
  if (colonIndex > 0 && !pkg.slice(0, colonIndex).includes('@')) {
    return {
      provider: pkg.slice(0, colonIndex),
      name: pkg.slice(colonIndex + 1),
    };
  }
  return { provider: null, name: pkg };
}

/**
 * Generate a canonical package key from explicit name/provider parts.
 */
export function getPackageKeyFromParts(name: string, provider?: string | null): string {
  return provider ? `${provider}:${name}` : name;
}

/**
 * Generate a unique key for a package, combining provider and name.
 */
export function getPackageKey(pkg: PackageSummary | InstalledPackage): string {
  return getPackageKeyFromParts(pkg.name, pkg.provider);
}

/**
 * Determine whether a package is pinned, supporting legacy unscoped keys.
 */
export function isPackagePinned(
  pinnedPackages: string[],
  name: string,
  provider?: string | null,
): boolean {
  const scopedKey = getPackageKeyFromParts(name, provider);
  return pinnedPackages.includes(scopedKey) || pinnedPackages.includes(name);
}

function getProviderBookmarkMatches(
  name: string,
  packageContexts: PackageIdentityLike[],
): string[] {
  const matches = new Set<string>();
  for (const pkg of packageContexts) {
    if (pkg.name !== name || !pkg.provider) {
      continue;
    }
    matches.add(getPackageKeyFromParts(name, pkg.provider));
  }
  return Array.from(matches);
}

export function isPackageBookmarked(
  bookmarkedPackages: string[],
  name: string,
  provider?: string | null,
): boolean {
  const scopedKey = getPackageKeyFromParts(name, provider);
  return bookmarkedPackages.includes(scopedKey) || bookmarkedPackages.includes(name);
}

export function addPackageBookmark(
  bookmarkedPackages: string[],
  name: string,
  provider?: string | null,
): string[] {
  const scopedKey = getPackageKeyFromParts(name, provider);
  return [...bookmarkedPackages.filter((entry) => entry !== scopedKey && entry !== name), scopedKey];
}

export function togglePackageBookmark(
  bookmarkedPackages: string[],
  name: string,
  provider?: string | null,
): string[] {
  if (isPackageBookmarked(bookmarkedPackages, name, provider)) {
    const scopedKey = getPackageKeyFromParts(name, provider);
    return bookmarkedPackages.filter((entry) => entry !== scopedKey && entry !== name);
  }

  return addPackageBookmark(bookmarkedPackages, name, provider);
}

export function normalizeBookmarkedPackages(
  bookmarkedPackages: string[],
  packageContexts: PackageIdentityLike[] = [],
  options?: { expandLegacyMatches?: boolean },
): string[] {
  const normalized: string[] = [];

  for (const entry of bookmarkedPackages) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const { provider, name } = parsePackageSpec(trimmed);
    if (provider) {
      const scopedKey = getPackageKeyFromParts(name, provider);
      if (!normalized.includes(scopedKey)) {
        normalized.push(scopedKey);
      }
      continue;
    }

    const providerMatches = getProviderBookmarkMatches(name, packageContexts);
    if (providerMatches.length === 1) {
      if (!normalized.includes(providerMatches[0])) {
        normalized.push(providerMatches[0]);
      }
      continue;
    }

    if (options?.expandLegacyMatches && providerMatches.length > 1) {
      for (const providerMatch of providerMatches) {
        if (!normalized.includes(providerMatch)) {
          normalized.push(providerMatch);
        }
      }
      continue;
    }

    if (!normalized.includes(name)) {
      normalized.push(name);
    }
  }

  return normalized;
}

/**
 * Determine highlight class for comparison table cells based on value differences.
 */
export function getHighlightClass(
  _featureKey: string,
  _value: unknown,
  allValues: unknown[],
): string {
  const uniqueValues = new Set(allValues.map((v) => JSON.stringify(v)));
  if (uniqueValues.size > 1) {
    return 'bg-yellow-500/5';
  }
  return '';
}
