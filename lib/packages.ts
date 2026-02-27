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
 * Generate a unique key for a package, combining provider and name.
 */
export function getPackageKey(pkg: PackageSummary | InstalledPackage): string {
  return pkg.provider ? `${pkg.provider}:${pkg.name}` : pkg.name;
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
