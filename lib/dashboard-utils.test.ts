import { getSearchHistory, saveSearchHistory, clearSearchHistory, nextWidgetSize, prevWidgetSize } from './dashboard-utils';

describe('getSearchHistory', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when no history saved', () => {
    expect(getSearchHistory()).toEqual([]);
  });

  it('returns saved history', () => {
    localStorage.setItem('cognia-dashboard-search-history', JSON.stringify(['a', 'b']));
    expect(getSearchHistory()).toEqual(['a', 'b']);
  });

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem('cognia-dashboard-search-history', 'not-json');
    expect(getSearchHistory()).toEqual([]);
  });
});

describe('saveSearchHistory', () => {
  beforeEach(() => localStorage.clear());

  it('adds new query to front', () => {
    const result = saveSearchHistory([], 'hello');
    expect(result).toEqual(['hello']);
  });

  it('deduplicates existing query', () => {
    const result = saveSearchHistory(['hello', 'world'], 'hello');
    expect(result[0]).toBe('hello');
    expect(result.filter((h) => h === 'hello')).toHaveLength(1);
  });

  it('limits to MAX_HISTORY items', () => {
    const history = ['a', 'b', 'c', 'd', 'e'];
    const result = saveSearchHistory(history, 'new');
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]).toBe('new');
  });

  it('ignores empty/whitespace queries', () => {
    const history = ['a'];
    expect(saveSearchHistory(history, '')).toEqual(['a']);
    expect(saveSearchHistory(history, '  ')).toEqual(['a']);
  });

  it('persists to localStorage', () => {
    saveSearchHistory([], 'test');
    const stored = JSON.parse(localStorage.getItem('cognia-dashboard-search-history')!);
    expect(stored).toContain('test');
  });
});

describe('clearSearchHistory', () => {
  it('removes history from localStorage', () => {
    localStorage.setItem('cognia-dashboard-search-history', '["a"]');
    clearSearchHistory();
    expect(localStorage.getItem('cognia-dashboard-search-history')).toBeNull();
  });
});

describe('nextWidgetSize', () => {
  it('cycles sm → md', () => expect(nextWidgetSize('sm')).toBe('md'));
  it('cycles md → lg', () => expect(nextWidgetSize('md')).toBe('lg'));
  it('cycles lg → full', () => expect(nextWidgetSize('lg')).toBe('full'));
  it('cycles full → sm', () => expect(nextWidgetSize('full')).toBe('sm'));
});

describe('prevWidgetSize', () => {
  it('cycles sm → full', () => expect(prevWidgetSize('sm')).toBe('full'));
  it('cycles md → sm', () => expect(prevWidgetSize('md')).toBe('sm'));
  it('cycles lg → md', () => expect(prevWidgetSize('lg')).toBe('md'));
  it('cycles full → lg', () => expect(prevWidgetSize('full')).toBe('lg'));
});
