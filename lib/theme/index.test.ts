import * as themeIndex from './index';
import * as appearanceModule from './appearance';
import * as appearancePresetDiffModule from './appearance-preset-diff';
import * as appearanceSyncModule from './appearance-sync';
import * as chartUtilsModule from './chart-utils';
import * as colorsModule from './colors';
import * as typesModule from './types';
import * as windowEffectsModule from './window-effects';

describe('theme/index', () => {
  it('re-exports the public theme helpers', () => {
    expect(themeIndex).toMatchObject({
      ...typesModule,
      ...colorsModule,
      ...appearanceModule,
      ...windowEffectsModule,
      ...appearancePresetDiffModule,
      ...appearanceSyncModule,
      ...chartUtilsModule,
    });
  });

  it('preserves reference equality for key exports', () => {
    expect(themeIndex.APPEARANCE_DEFAULTS).toBe(appearanceModule.APPEARANCE_DEFAULTS);
    expect(themeIndex.accentColors).toBe(colorsModule.accentColors);
    expect(themeIndex.CHART_COLOR_PALETTES).toBe(colorsModule.CHART_COLOR_PALETTES);
    expect(themeIndex.normalizeSupportedWindowEffects).toBe(
      windowEffectsModule.normalizeSupportedWindowEffects,
    );
    expect(themeIndex.getChartColor).toBe(chartUtilsModule.getChartColor);
  });
});
