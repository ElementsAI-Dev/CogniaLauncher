import { CAPABILITY_COLORS, getCapabilityColor, getCapabilityLabel } from './provider-capability';

describe('CAPABILITY_COLORS', () => {
  it('has entries for known capabilities', () => {
    expect(CAPABILITY_COLORS['install']).toBeDefined();
    expect(CAPABILITY_COLORS['uninstall']).toBeDefined();
    expect(CAPABILITY_COLORS['search']).toBeDefined();
    expect(CAPABILITY_COLORS['update']).toBeDefined();
    expect(CAPABILITY_COLORS['list']).toBeDefined();
  });

  it('all values are non-empty Tailwind class strings', () => {
    Object.values(CAPABILITY_COLORS).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

describe('getCapabilityColor', () => {
  it('returns color for known capability', () => {
    expect(getCapabilityColor('install')).toContain('green');
  });

  it('returns gray fallback for unknown capability', () => {
    expect(getCapabilityColor('nonexistent')).toContain('gray');
  });
});

describe('getCapabilityLabel', () => {
  it('returns translated label when translation exists', () => {
    const t = (key: string) => key === 'providers.capability.install' ? 'Install' : key;
    expect(getCapabilityLabel('install', t)).toBe('Install');
  });

  it('falls back to formatted name when translation returns key', () => {
    const t = (key: string) => key; // returns the key itself (no translation)
    expect(getCapabilityLabel('update_index', t)).toBe('update index');
  });

  it('replaces underscores with spaces in fallback', () => {
    const t = (key: string) => key;
    expect(getCapabilityLabel('multi_version', t)).toBe('multi version');
  });
});
