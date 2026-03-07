import type { PackageSummary, InstalledPackage } from '@/lib/tauri';

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
