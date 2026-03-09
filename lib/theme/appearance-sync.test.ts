import { syncAppearanceConfigValue, syncAppearancePresetConfig } from './appearance-sync';

describe('syncAppearanceConfigValue', () => {
  it('normalizes write values before persisting', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.interface_radius': '0.75',
    });

    const canonical = await syncAppearanceConfigValue({
      key: 'appearance.interface_radius',
      value: '0.74',
      updateConfigValue,
      fetchConfig,
    });

    expect(updateConfigValue).toHaveBeenCalledWith('appearance.interface_radius', '0.75');
    expect(canonical).toBe('0.75');
  });

  it('writes canonical readback when backend returns non-canonical value', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.interface_radius': '0.74',
    });

    const canonical = await syncAppearanceConfigValue({
      key: 'appearance.interface_radius',
      value: '0.74',
      updateConfigValue,
      fetchConfig,
    });

    expect(updateConfigValue).toHaveBeenNthCalledWith(1, 'appearance.interface_radius', '0.75');
    expect(updateConfigValue).toHaveBeenNthCalledWith(2, 'appearance.interface_radius', '0.75');
    expect(canonical).toBe('0.75');
  });
});

describe('syncAppearancePresetConfig', () => {
  it('syncs preset values through canonical appearance config keys', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.theme': 'dark',
      'appearance.accent_color': 'rose',
      'appearance.chart_color_theme': 'ocean',
      'appearance.interface_radius': '0.75',
      'appearance.interface_density': 'compact',
      'appearance.reduced_motion': 'true',
      'appearance.window_effect': 'mica',
    });

    const canonical = await syncAppearancePresetConfig({
      preset: {
        theme: 'dark',
        accentColor: 'rose',
        chartColorTheme: 'ocean',
        interfaceRadius: 0.75,
        interfaceDensity: 'compact',
        reducedMotion: true,
        backgroundEnabled: true,
        backgroundOpacity: 35,
        backgroundBlur: 4,
        backgroundFit: 'contain',
        windowEffect: 'mica',
      },
      updateConfigValue,
      fetchConfig,
    });

    expect(canonical.theme).toBe('dark');
    expect(canonical.accentColor).toBe('rose');
    expect(canonical.chartColorTheme).toBe('ocean');
    expect(canonical.interfaceRadius).toBe(0.75);
    expect(canonical.interfaceDensity).toBe('compact');
    expect(canonical.reducedMotion).toBe(true);
    expect(canonical.windowEffect).toBe('mica');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.theme', 'dark');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.accent_color', 'rose');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.chart_color_theme', 'ocean');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.interface_radius', '0.75');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.interface_density', 'compact');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.reduced_motion', 'true');
    expect(updateConfigValue).toHaveBeenCalledWith('appearance.window_effect', 'mica');
  });

  it('normalizes invalid legacy preset fields before and after sync', async () => {
    const updateConfigValue = jest.fn().mockResolvedValue(undefined);
    const fetchConfig = jest.fn().mockResolvedValue({
      'appearance.theme': 'invalid-theme',
      'appearance.accent_color': 'invalid-color',
      'appearance.chart_color_theme': 'invalid-chart',
      'appearance.interface_radius': '0.74',
      'appearance.interface_density': 'tiny',
      'appearance.reduced_motion': 'unknown',
      'appearance.window_effect': 'glass',
    });

    const canonical = await syncAppearancePresetConfig({
      preset: {
        theme: 'invalid-theme' as never,
        accentColor: 'pink' as never,
        chartColorTheme: 'neon' as never,
        interfaceRadius: 0.74 as never,
        interfaceDensity: 'tiny' as never,
        reducedMotion: 'unknown' as never,
        backgroundEnabled: 'yes' as never,
        backgroundOpacity: 140 as never,
        backgroundBlur: -3 as never,
        backgroundFit: 'stretch' as never,
        windowEffect: 'glass' as never,
      },
      updateConfigValue,
      fetchConfig,
    });

    expect(canonical.theme).toBe('system');
    expect(canonical.accentColor).toBe('blue');
    expect(canonical.chartColorTheme).toBe('default');
    expect(canonical.interfaceRadius).toBe(0.75);
    expect(canonical.interfaceDensity).toBe('comfortable');
    expect(canonical.reducedMotion).toBe(false);
    expect(canonical.windowEffect).toBe('auto');
    expect(canonical.backgroundEnabled).toBe(false);
    expect(canonical.backgroundOpacity).toBe(100);
    expect(canonical.backgroundBlur).toBe(0);
    expect(canonical.backgroundFit).toBe('cover');
  });
});
