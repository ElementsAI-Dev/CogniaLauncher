import { parseAppearanceConfig } from './appearance';

describe('parseAppearanceConfig', () => {
  it('parses valid appearance values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'dark',
      'appearance.accent_color': 'rose',
      'appearance.reduced_motion': 'true',
      'appearance.language': 'zh',
    });

    expect(parsed.theme).toBe('dark');
    expect(parsed.accentColor).toBe('rose');
    expect(parsed.reducedMotion).toBe(true);
    expect(parsed.locale).toBe('zh');
    expect(parsed.invalidKeys).toEqual([]);
  });

  it('collects invalid keys for unsupported values', () => {
    const parsed = parseAppearanceConfig({
      'appearance.theme': 'invalid',
      'appearance.accent_color': 'pink',
      'appearance.reduced_motion': 'maybe',
      'appearance.language': 'fr',
    });

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([
      'theme',
      'accentColor',
      'reducedMotion',
      'language',
    ]);
  });

  it('returns defaults when values are missing', () => {
    const parsed = parseAppearanceConfig({});

    expect(parsed.theme).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
    expect(parsed.locale).toBeUndefined();
    expect(parsed.invalidKeys).toEqual([]);
  });
});
