import type { AppearancePresetConfig } from '@/lib/stores/appearance';

export function areAppearancePresetConfigsEqual(
  a: AppearancePresetConfig,
  b: AppearancePresetConfig,
): boolean {
  return (
    a.theme === b.theme
    && a.accentColor === b.accentColor
    && a.chartColorTheme === b.chartColorTheme
    && a.interfaceRadius === b.interfaceRadius
    && a.interfaceDensity === b.interfaceDensity
    && a.reducedMotion === b.reducedMotion
    && a.backgroundEnabled === b.backgroundEnabled
    && a.backgroundOpacity === b.backgroundOpacity
    && a.backgroundBlur === b.backgroundBlur
    && a.backgroundFit === b.backgroundFit
    && a.backgroundScale === b.backgroundScale
    && a.backgroundPositionX === b.backgroundPositionX
    && a.backgroundPositionY === b.backgroundPositionY
    && a.windowEffect === b.windowEffect
  );
}
