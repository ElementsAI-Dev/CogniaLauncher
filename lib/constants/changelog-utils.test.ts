import { getTypeColor, getTypeLabel, compareSemver } from './changelog-utils';

describe('getTypeColor', () => {
  it('returns green classes for added', () => {
    expect(getTypeColor('added')).toContain('green');
  });

  it('returns blue classes for changed', () => {
    expect(getTypeColor('changed')).toContain('blue');
  });

  it('returns yellow classes for fixed', () => {
    expect(getTypeColor('fixed')).toContain('yellow');
  });

  it('returns red classes for removed', () => {
    expect(getTypeColor('removed')).toContain('red');
  });

  it('returns orange classes for deprecated', () => {
    expect(getTypeColor('deprecated')).toContain('orange');
  });

  it('returns purple classes for security', () => {
    expect(getTypeColor('security')).toContain('purple');
  });

  it('returns cyan classes for performance', () => {
    expect(getTypeColor('performance')).toContain('cyan');
  });

  it('returns red classes for breaking', () => {
    expect(getTypeColor('breaking')).toContain('red');
  });

  it('returns gray classes for unknown type', () => {
    expect(getTypeColor('unknown')).toContain('gray');
  });

  it('returns tailwind bg- and text- classes', () => {
    const result = getTypeColor('added');
    expect(result).toMatch(/bg-/);
    expect(result).toMatch(/text-/);
    expect(result).toMatch(/dark:/);
  });
});

describe('getTypeLabel', () => {
  const mockT = (key: string) => `translated:${key}`;

  it('returns translated label for known type', () => {
    expect(getTypeLabel('added', mockT)).toBe('translated:about.changelogAdded');
  });

  it('returns translated label for all known types', () => {
    const knownTypes = ['added', 'changed', 'fixed', 'removed', 'deprecated', 'security', 'performance', 'breaking'];
    knownTypes.forEach((type) => {
      const result = getTypeLabel(type, mockT);
      expect(result).toMatch(/^translated:about\.changelog/);
    });
  });

  it('returns raw type string for unknown type', () => {
    expect(getTypeLabel('custom-type', mockT)).toBe('custom-type');
  });

  it('returns raw type for empty string', () => {
    expect(getTypeLabel('', mockT)).toBe('');
  });
});

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns positive when a > b (major)', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0);
  });

  it('returns negative when a < b (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('compares minor versions correctly', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('compares patch versions correctly', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('handles missing parts as zero', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1', '1.0.0')).toBe(0);
  });

  it('handles complex version comparisons', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('0.1.0', '0.0.99')).toBeGreaterThan(0);
  });
});
