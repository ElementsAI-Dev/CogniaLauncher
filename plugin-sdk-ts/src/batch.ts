/**
 * Batch operations module.
 *
 * Provides batch install, uninstall, and update operations
 * as well as package history and pinning.
 *
 * Reuses existing `pkg_search` and `pkg_install` permissions.
 */
import { callHostJson } from './host';
import type {
  BatchItem,
  BatchResult,
  PackageHistoryEntry,
  PinnedPackage,
  UpdateInfo,
} from './types';

/** Batch install packages. Requires: pkg_install */
export function batchInstall(items: BatchItem[]): BatchResult {
  return callHostJson<BatchResult>(
    'cognia_batch_install',
    JSON.stringify({ items }),
  );
}

/** Batch uninstall packages. Requires: pkg_install */
export function batchUninstall(items: BatchItem[]): BatchResult {
  return callHostJson<BatchResult>(
    'cognia_batch_uninstall',
    JSON.stringify({ items }),
  );
}

/** Batch update packages. Requires: pkg_install */
export function batchUpdate(items: BatchItem[]): BatchResult {
  return callHostJson<BatchResult>(
    'cognia_batch_update',
    JSON.stringify({ items }),
  );
}

/** Check for updates across packages. Requires: pkg_search */
export function checkUpdates(packages: string[], provider: string): UpdateInfo[] {
  return callHostJson<UpdateInfo[]>(
    'cognia_batch_check_updates',
    JSON.stringify({ packages, provider }),
  );
}

/** Get package operation history. Requires: pkg_search */
export function getHistory(limit?: number): PackageHistoryEntry[] {
  return callHostJson<PackageHistoryEntry[]>(
    'cognia_batch_get_history',
    JSON.stringify({ limit: limit ?? null }),
  );
}

/** Get list of pinned packages. Requires: pkg_search */
export function getPinnedPackages(): PinnedPackage[] {
  return callHostJson<PinnedPackage[]>('cognia_batch_get_pinned', '');
}
