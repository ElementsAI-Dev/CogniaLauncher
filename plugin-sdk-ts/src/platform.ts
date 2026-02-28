import { callHostJson } from './host';
import type { CacheInfo, PlatformInfo } from './types';

/**
 * Get platform information (OS, arch, hostname, version).
 */
export function info(): PlatformInfo {
  return callHostJson<PlatformInfo>('cognia_platform_info', '');
}

/**
 * Get cache directory info and total size.
 * Requires: env_read permission.
 */
export function cacheInfo(): CacheInfo {
  return callHostJson<CacheInfo>('cognia_cache_info', '');
}
