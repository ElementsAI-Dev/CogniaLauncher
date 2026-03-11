import { areAppearancePresetConfigsEqual } from './appearance-preset-diff';

describe('areAppearancePresetConfigsEqual', () => {
  const base = {
    theme: 'system',
    accentColor: 'blue',
    chartColorTheme: 'default',
    interfaceRadius: 0.625,
    interfaceDensity: 'comfortable',
    reducedMotion: false,
    backgroundEnabled: false,
    backgroundOpacity: 20,
    backgroundBlur: 0,
    backgroundFit: 'cover',
    windowEffect: 'auto',
  } as const;

  it('returns true when configs are identical', () => {
    expect(areAppearancePresetConfigsEqual({ ...base }, { ...base })).toBe(true);
  });

  it('returns false when theme differs', () => {
    expect(areAppearancePresetConfigsEqual({ ...base, theme: 'dark' }, { ...base })).toBe(false);
  });

  it('returns false when backgroundEnabled differs', () => {
    expect(areAppearancePresetConfigsEqual({ ...base, backgroundEnabled: true }, { ...base })).toBe(false);
  });

  it('returns false when backgroundOpacity differs', () => {
    expect(areAppearancePresetConfigsEqual({ ...base, backgroundOpacity: 60 }, { ...base })).toBe(false);
  });
});

