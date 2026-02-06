import { parseAppearanceConfig } from './appearance';

describe('parseAppearanceConfig', () => {
  it('parses valid appearance values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'dark',
      'appearance.accent_color': 'rose',
      'appearance.chart_color_theme': 'ocean',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'zh',
    });

    expect(parsed.theme).toBe('dark');
    expect(parsed.accentColor).toBe('rose');
    expect(parsed.chartColorTheme).toBe('ocean');
    expect(parsed.reducedMotion).toBe(true);
    expect(parsed.locale).toBe('zh');
    expect(parsed.invalidKeys).toEqual([]);
  });

  it('collects invalid keys for unsupported values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'invalid',
      'appearance.accent_color': 'pink',
      'appearance.chart_color_theme': 'neon',
      'appearance.reduced_motion': 'maybe',
      'appearance.language': 'fr',
    });

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.chartColorTheme).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([
      'theme',
      'accentColor',
      'chartColorTheme',
      'reducedMotion',
      'language',
    ]);
  });

  it('returns defaults when values are missing', () => {
    const parsed = parseAppearanceConfig({});

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.chartColorTheme).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([]);
  });
});
