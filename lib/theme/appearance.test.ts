import { parseAppearanceConfig } from './appearance';

describe('parseAppearanceConfig', () => {
  it('parses valid appearance values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'dark',
      'appearance.accent_color': 'rose',
      'appearance.chart_color_theme': 'ocean',
      'appearance.interface_radius': '0.75',
      'appearance.interface_density': 'compact',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'zh',
    });

    expect(parsed.theme).toBe('dark');
    expect(parsed.accentColor).toBe('rose');
    expect(parsed.chartColorTheme).toBe('ocean');
    expect(parsed.interfaceRadius).toBe(0.75);
    expect(parsed.interfaceDensity).toBe('compact');
    expect(parsed.reducedMotion).toBe(true);
    expect(parsed.locale).toBe('zh');
    expect(parsed.invalidKeys).toEqual([]);
  });

  it('collects invalid keys for unsupported values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'invalid',
      'appearance.accent_color': 'pink',
      'appearance.chart_color_theme': 'neon',
      'appearance.interface_radius': '0.4',
      'appearance.interface_density': 'tiny',
      'appearance.reduced_motion': 'maybe',
      'appearance.language': 'fr',
    });

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.chartColorTheme).toBeUndefined();
    expect(parsed.interfaceRadius).toBeUndefined();
    expect(parsed.interfaceDensity).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([
      'theme',
      'accentColor',
      'chartColorTheme',
      'interfaceRadius',
      'interfaceDensity',
      'reducedMotion',
      'language',
    ]);
  });

  it('returns defaults when values are missing', () => {
    const parsed = parseAppearanceConfig({});

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.chartColorTheme).toBeUndefined();
    expect(parsed.interfaceRadius).toBeUndefined();
    expect(parsed.interfaceDensity).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([]);
  });

  it('parses interface_radius with valid numeric strings', () => {
    const parsed = parseAppearanceConfig({
      'appearance.interface_radius': '0',
    });
    expect(parsed.interfaceRadius).toBe(0);
    expect(parsed.invalidKeys).toEqual([]);
  });

  it('rejects non-numeric interface_radius', () => {
    const parsed = parseAppearanceConfig({
      'appearance.interface_radius': 'abc',
    });
    expect(parsed.interfaceRadius).toBeUndefined();
    expect(parsed.invalidKeys).toContain('interfaceRadius');
  });
});
