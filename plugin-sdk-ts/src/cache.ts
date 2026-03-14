/**
 * Cache management module.
 *
 * Provides access to the cache system for inspection, statistics,
 * and cleanup operations.
 *
 * Requires: `cache_read` and/or `cache_write` permissions.
 */
import { callHostJson } from './host';
import type {
  CacheDetailInfo,
  CacheEntry,
  CacheAccessStats,
  CacheCleanupRecord,
  ExternalCache,
  ExternalCachePath,
  CacheCleanPreview,
  CacheCleanResult,
} from './types';

/** Get detailed cache info. Requires: cache_read */
export function info(): CacheDetailInfo {
  return callHostJson<CacheDetailInfo>('cognia_cache_detail_info', '');
}

/** List cache entries, optionally filtered by type. Requires: cache_read */
export function listEntries(cacheType?: string): CacheEntry[] {
  return callHostJson<CacheEntry[]>(
    'cognia_cache_list_entries',
    JSON.stringify({ cacheType: cacheType ?? null }),
  );
}

/** Get cache access statistics (hit/miss). Requires: cache_read */
export function getAccessStats(): CacheAccessStats {
  return callHostJson<CacheAccessStats>('cognia_cache_get_access_stats', '');
}

/** Get cleanup history records. Requires: cache_read */
export function getCleanupHistory(): CacheCleanupRecord[] {
  return callHostJson<CacheCleanupRecord[]>('cognia_cache_get_cleanup_history', '');
}

/** Discover external caches (system package managers). Requires: cache_read */
export function discoverExternal(): ExternalCache[] {
  return callHostJson<ExternalCache[]>('cognia_cache_discover_external', '');
}

/** Get paths for all known external caches. Requires: cache_read */
export function getExternalPaths(): ExternalCachePath[] {
  return callHostJson<ExternalCachePath[]>('cognia_cache_get_external_paths', '');
}

/** Preview what a cache clean operation would remove. Requires: cache_read */
export function cleanPreview(cacheType: string): CacheCleanPreview {
  return callHostJson<CacheCleanPreview>(
    'cognia_cache_clean_preview',
    JSON.stringify({ cacheType }),
  );
}

/** Clean cache by type. Requires: cache_write */
export function clean(cacheType: string): CacheCleanResult {
  return callHostJson<CacheCleanResult>(
    'cognia_cache_clean',
    JSON.stringify({ cacheType }),
  );
}
