import {
  canonicalScopeToCleanType,
  canonicalScopeFromDetailType,
  canonicalScopeLabelKey,
  cleanTypeLabelKey,
  cleanTypeToCanonicalScope,
  formatCleanTypeLabel,
  isCanonicalCacheScope,
  isPreviewCapableCleanType,
  isTrashApplicableCleanType,
} from './scopes';

describe('cache scopes', () => {
  const t = (key: string) => key;

  it('maps detail route types to canonical scopes', () => {
    expect(canonicalScopeFromDetailType('download')).toBe('downloads');
    expect(canonicalScopeFromDetailType('metadata')).toBe('metadata');
    expect(canonicalScopeFromDetailType('external')).toBe('external');
  });

  it('returns stable label keys for canonical scopes', () => {
    expect(canonicalScopeLabelKey('downloads')).toBe('cache.typeDownload');
    expect(canonicalScopeLabelKey('metadata')).toBe('cache.typeMetadata');
    expect(canonicalScopeLabelKey('default_downloads')).toBe('cache.typeDefaultDownloads');
    expect(canonicalScopeLabelKey('expired')).toBe('cache.typeExpired');
    expect(canonicalScopeLabelKey('all')).toBe('cache.allTypes');
    expect(canonicalScopeLabelKey('external')).toBe('cache.externalCaches');
  });

  it('formats clean type labels for known scopes and preserves unknown strings', () => {
    expect(isCanonicalCacheScope('downloads')).toBe(true);
    expect(isCanonicalCacheScope('mystery')).toBe(false);
    expect(formatCleanTypeLabel('downloads', t)).toBe('cache.typeDownload');
    expect(formatCleanTypeLabel('unknown_scope', t)).toBe('unknown_scope');
  });

  it('maps canonical scopes to clean types and back', () => {
    expect(cleanTypeToCanonicalScope('downloads')).toBe('downloads');
    expect(cleanTypeToCanonicalScope('all')).toBe('all');
    expect(canonicalScopeToCleanType('downloads')).toBe('downloads');
    expect(canonicalScopeToCleanType('external')).toBeNull();
  });

  it('builds clean type label keys and preview/trash applicability', () => {
    expect(cleanTypeLabelKey('metadata')).toBe('cache.typeMetadata');
    expect(isPreviewCapableCleanType('downloads')).toBe(true);
    expect(isTrashApplicableCleanType('all')).toBe(true);
  });
});
