import type { CleanType } from '@/types/cache';

export type CacheDetailType = 'download' | 'metadata' | 'external';

export type CanonicalCacheScope =
  | 'downloads'
  | 'metadata'
  | 'default_downloads'
  | 'external'
  | 'expired'
  | 'all';

export function isCanonicalCacheScope(value: string): value is CanonicalCacheScope {
  return (
    value === 'downloads'
    || value === 'metadata'
    || value === 'default_downloads'
    || value === 'external'
    || value === 'expired'
    || value === 'all'
  );
}

export function canonicalScopeFromDetailType(cacheType: CacheDetailType): CanonicalCacheScope {
  switch (cacheType) {
    case 'download':
      return 'downloads';
    case 'metadata':
      return 'metadata';
    case 'external':
      return 'external';
  }
}

export function cleanTypeToCanonicalScope(cleanType: CleanType): CanonicalCacheScope {
  // CleanType already matches canonical IDs for all scopes that can be cleaned from the UI.
  return cleanType;
}

export function canonicalScopeToCleanType(scope: CanonicalCacheScope): CleanType | null {
  if (scope === 'external') return null;
  return scope;
}

export function canonicalScopeLabelKey(scope: CanonicalCacheScope): string {
  switch (scope) {
    case 'downloads':
      return 'cache.typeDownload';
    case 'metadata':
      return 'cache.typeMetadata';
    case 'default_downloads':
      return 'cache.typeDefaultDownloads';
    case 'expired':
      return 'cache.typeExpired';
    case 'all':
      return 'cache.allTypes';
    case 'external':
      return 'cache.externalCaches';
  }
}

export function cleanTypeLabelKey(cleanType: CleanType): string {
  return canonicalScopeLabelKey(cleanTypeToCanonicalScope(cleanType));
}

export function formatCleanTypeLabel(
  cleanType: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (isCanonicalCacheScope(cleanType)) {
    return t(canonicalScopeLabelKey(cleanType));
  }
  return cleanType;
}

export function isPreviewCapableCleanType(cleanType: CleanType): boolean {
  // All current clean types support preview in the backend; keep centralized so UI can enforce preview-first.
  return cleanTypeToCanonicalScope(cleanType) !== 'external';
}

export function isTrashApplicableCleanType(cleanType: CleanType): boolean {
  // Enhanced clean supports trash semantics; keep centralized for future exclusions.
  return cleanTypeToCanonicalScope(cleanType) !== 'external';
}
