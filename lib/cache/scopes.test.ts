import {
  canonicalScopeFromDetailType,
  canonicalScopeLabelKey,
  formatCleanTypeLabel,
  isCanonicalCacheScope,
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
    expect(formatCleanTypeLabel('downloads', t)).toBe('cache.typeDownload');
    expect(formatCleanTypeLabel('unknown_scope', t)).toBe('unknown_scope');
  });
});

