import type { ExternalCacheInfo } from '@/lib/tauri';
import type { GroupedCaches } from '@/types/cache';

// ============================================================================
// Constants
// ============================================================================

export const ENTRIES_PER_PAGE = 20;

export const CACHE_CATEGORY_ORDER = ['system', 'package_manager', 'devtools', 'terminal'] as const;

// ============================================================================
// Pure Helper Functions
// ============================================================================

/**
 * Returns a Tailwind text color class based on cache usage percentage.
 */
export function usageColor(percent: number): string {
  if (percent >= 90) return 'text-destructive';
  if (percent >= 70) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-green-600 dark:text-green-500';
}

/**
 * Returns a Tailwind progress bar color class based on cache usage percentage.
 */
export function progressColor(percent: number): string {
  if (percent >= 90) return '[&>div]:bg-destructive';
  if (percent >= 70) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-green-500';
}

/**
 * Returns a translated category label for external cache categories.
 */
export function getCategoryLabel(
  category: string,
  t: (key: string) => string,
): string {
  switch (category) {
    case 'system':
      return t('cache.categorySystem');
    case 'devtools':
      return t('cache.categoryDevtools');
    case 'package_manager':
      return t('cache.categoryPackageManager');
    case 'terminal':
      return t('cache.categoryTerminal');
    default:
      return category;
  }
}

/**
 * Groups external caches by their category field.
 */
export function groupCachesByCategory(
  caches: ExternalCacheInfo[],
  defaultCategory = 'package_manager',
): GroupedCaches {
  return caches.reduce<GroupedCaches>((acc, cache) => {
    const cat = cache.category || defaultCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cache);
    return acc;
  }, {});
}

/**
 * Formats a date string to locale string, with fallback for null/invalid values.
 */
export function formatCacheDate(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}
