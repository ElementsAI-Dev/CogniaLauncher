import { callHost, callHostJson } from './host';
import type {
  Dependency,
  InstallReceipt,
  InstalledPackage,
  PackageInfo,
  PackageSummary,
  UpdateInfo,
  VersionInfo,
} from './types';

/**
 * Search for packages.
 * Requires: pkg_search permission.
 */
export function search(
  query: string,
  provider?: string | null,
): PackageSummary[] {
  return callHostJson<PackageSummary[]>(
    'cognia_pkg_search',
    JSON.stringify({ query, provider: provider ?? null }),
  );
}

/**
 * Get detailed package info.
 * Requires: pkg_search permission.
 */
export function info(
  name: string,
  provider?: string | null,
): PackageInfo {
  return callHostJson<PackageInfo>(
    'cognia_pkg_info',
    JSON.stringify({ name, provider: provider ?? null }),
  );
}

/**
 * Get available versions for a package.
 * Requires: pkg_search permission.
 */
export function versions(
  name: string,
  provider?: string | null,
): VersionInfo[] {
  return callHostJson<VersionInfo[]>(
    'cognia_pkg_versions',
    JSON.stringify({ name, provider: provider ?? null }),
  );
}

/**
 * Get dependencies for a specific package version.
 * Requires: pkg_search permission.
 */
export function dependencies(
  name: string,
  version: string,
  provider?: string | null,
): Dependency[] {
  return callHostJson<Dependency[]>(
    'cognia_pkg_dependencies',
    JSON.stringify({ name, version, provider: provider ?? null }),
  );
}

/**
 * List installed packages.
 * Requires: pkg_search permission.
 */
export function listInstalled(
  provider?: string | null,
): InstalledPackage[] {
  return callHostJson<InstalledPackage[]>(
    'cognia_pkg_list_installed',
    JSON.stringify({ provider: provider ?? null }),
  );
}

/**
 * Check for package updates.
 * Requires: pkg_search permission.
 */
export function checkUpdates(
  packages: string[],
  provider: string,
): UpdateInfo[] {
  return callHostJson<UpdateInfo[]>(
    'cognia_pkg_check_updates',
    JSON.stringify({ packages, provider }),
  );
}

/**
 * Install a package.
 * Requires: pkg_install permission.
 */
export function install(
  name: string,
  version?: string | null,
  provider?: string | null,
): InstallReceipt {
  return callHostJson<InstallReceipt>(
    'cognia_pkg_install',
    JSON.stringify({
      name,
      version: version ?? null,
      provider: provider ?? null,
    }),
  );
}

/**
 * Uninstall a package.
 * Requires: pkg_install permission.
 */
export function uninstall(
  name: string,
  version?: string | null,
  provider?: string | null,
): void {
  callHost(
    'cognia_pkg_uninstall',
    JSON.stringify({
      name,
      version: version ?? null,
      provider: provider ?? null,
    }),
  );
}
