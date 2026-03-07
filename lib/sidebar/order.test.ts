import {
  DEFAULT_SIDEBAR_ITEM_ORDER,
  PRIMARY_SIDEBAR_ITEM_IDS,
  SECONDARY_SIDEBAR_ITEM_IDS,
  isPrimarySidebarItemId,
  isSecondarySidebarItemId,
  isSidebarItemId,
  moveSidebarItem,
  normalizeSidebarItemOrder,
  splitSidebarItemOrder,
} from './order';

describe('sidebar order constants', () => {
  it('combines primary and secondary ids into default order', () => {
    expect(DEFAULT_SIDEBAR_ITEM_ORDER).toEqual([
      ...PRIMARY_SIDEBAR_ITEM_IDS,
      ...SECONDARY_SIDEBAR_ITEM_IDS,
    ]);
  });
});

describe('sidebar id guards', () => {
  it('validates known ids and rejects unknown', () => {
    expect(isSidebarItemId('packages')).toBe(true);
    expect(isSidebarItemId('not-exist')).toBe(false);
  });

  it('detects primary and secondary id groups', () => {
    expect(isPrimarySidebarItemId('packages')).toBe(true);
    expect(isPrimarySidebarItemId('about')).toBe(false);
    expect(isSecondarySidebarItemId('about')).toBe(true);
    expect(isSecondarySidebarItemId('packages')).toBe(false);
  });
});

describe('normalizeSidebarItemOrder', () => {
  it('dedupes entries, removes invalid ids, and appends missing defaults', () => {
    const normalized = normalizeSidebarItemOrder([
      'downloads',
      'downloads',
      'not-valid',
      'about',
    ]);

    expect(normalized[0]).toBe('downloads');
    expect(normalized[1]).toBe('about');
    expect(normalized).toEqual([
      'downloads',
      'about',
      ...DEFAULT_SIDEBAR_ITEM_ORDER.filter((id) => id !== 'downloads' && id !== 'about'),
    ]);
  });

  it('falls back to default order for undefined input', () => {
    expect(normalizeSidebarItemOrder()).toEqual([...DEFAULT_SIDEBAR_ITEM_ORDER]);
  });
});

describe('splitSidebarItemOrder', () => {
  it('separates primary and secondary partitions', () => {
    const split = splitSidebarItemOrder(['about', 'packages', 'docs']);
    expect(split.primary).toContain('packages');
    expect(split.secondary.slice(0, 2)).toEqual(['about', 'docs']);
  });
});

describe('moveSidebarItem', () => {
  it('moves an item up within primary section only', () => {
    const next = moveSidebarItem(DEFAULT_SIDEBAR_ITEM_ORDER, 'providers', 'up');
    const providersIndex = next.indexOf('providers');
    const packagesIndex = next.indexOf('packages');
    expect(providersIndex).toBeLessThan(packagesIndex);
    expect(next.includes('about')).toBe(true);
  });

  it('moves an item down within secondary section only', () => {
    const next = moveSidebarItem(DEFAULT_SIDEBAR_ITEM_ORDER, 'logs', 'down');
    const logsIndex = next.indexOf('logs');
    const docsIndex = next.indexOf('docs');
    expect(logsIndex).toBeGreaterThan(docsIndex);
  });

  it('returns normalized order when movement is out of bounds', () => {
    expect(moveSidebarItem(DEFAULT_SIDEBAR_ITEM_ORDER, 'environments', 'up')).toEqual([
      ...DEFAULT_SIDEBAR_ITEM_ORDER,
    ]);
    expect(moveSidebarItem(DEFAULT_SIDEBAR_ITEM_ORDER, 'about', 'down')).toEqual([
      ...DEFAULT_SIDEBAR_ITEM_ORDER,
    ]);
  });
});
