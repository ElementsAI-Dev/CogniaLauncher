import {
  parsePackageSpec,
  getPackageKey,
  getHighlightClass,
  getPackageKeyFromParts,
  isPackagePinned,
} from './packages';

describe('parsePackageSpec', () => {
  it('parses "provider:name" format', () => {
    expect(parsePackageSpec('npm:lodash')).toEqual({ provider: 'npm', name: 'lodash' });
  });

  it('parses "pip:requests" format', () => {
    expect(parsePackageSpec('pip:requests')).toEqual({ provider: 'pip', name: 'requests' });
  });

  it('returns null provider for plain name', () => {
    expect(parsePackageSpec('lodash')).toEqual({ provider: null, name: 'lodash' });
  });

  it('returns null provider for scoped npm package', () => {
    // "@types/node" has @ before colon position
    expect(parsePackageSpec('@types/node')).toEqual({ provider: null, name: '@types/node' });
  });

  it('handles empty string', () => {
    expect(parsePackageSpec('')).toEqual({ provider: null, name: '' });
  });

  it('handles colon at start (no provider)', () => {
    expect(parsePackageSpec(':name')).toEqual({ provider: null, name: ':name' });
  });
});

describe('getPackageKey', () => {
  it('returns "provider:name" when provider exists', () => {
    expect(getPackageKey({ provider: 'npm', name: 'lodash' } as never)).toBe('npm:lodash');
  });

  it('returns just name when no provider', () => {
    expect(getPackageKey({ provider: null, name: 'lodash' } as never)).toBe('lodash');
    expect(getPackageKey({ provider: '', name: 'lodash' } as never)).toBe('lodash');
  });
});

describe('getPackageKeyFromParts', () => {
  it('builds canonical provider-scoped keys', () => {
    expect(getPackageKeyFromParts('lodash', 'npm')).toBe('npm:lodash');
  });

  it('falls back to plain name when provider is missing', () => {
    expect(getPackageKeyFromParts('lodash', null)).toBe('lodash');
    expect(getPackageKeyFromParts('lodash', undefined)).toBe('lodash');
  });
});

describe('isPackagePinned', () => {
  it('matches canonical provider-scoped pin entries', () => {
    expect(isPackagePinned(['npm:lodash'], 'lodash', 'npm')).toBe(true);
    expect(isPackagePinned(['npm:lodash'], 'lodash', 'pip')).toBe(false);
  });

  it('falls back to legacy unscoped pin entries', () => {
    expect(isPackagePinned(['lodash'], 'lodash', 'npm')).toBe(true);
  });
});

describe('getHighlightClass', () => {
  it('returns highlight class when values differ', () => {
    expect(getHighlightClass('version', '1.0', ['1.0', '2.0'])).toBe('bg-yellow-500/5');
  });

  it('returns empty string when all values are same', () => {
    expect(getHighlightClass('version', '1.0', ['1.0', '1.0'])).toBe('');
  });

  it('returns empty string for single value', () => {
    expect(getHighlightClass('version', '1.0', ['1.0'])).toBe('');
  });

  it('handles complex values via JSON.stringify', () => {
    expect(getHighlightClass('deps', ['a'], [['a'], ['b']])).toBe('bg-yellow-500/5');
    expect(getHighlightClass('deps', ['a'], [['a'], ['a']])).toBe('');
  });
});
