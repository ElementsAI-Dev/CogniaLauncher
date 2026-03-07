import { useAppearanceStore } from './appearance';

describe('useAppearanceStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useAppearanceStore.getState().reset();
    // Clear localStorage mock
    localStorage.clear();
  });

  describe('initial state', () => {
    it('has default accent color as blue', () => {
      const { accentColor } = useAppearanceStore.getState();
      expect(accentColor).toBe('blue');
    });

    it('has default chart color theme as default', () => {
      const { chartColorTheme } = useAppearanceStore.getState();
      expect(chartColorTheme).toBe('default');
    });

    it('has default interface radius as 0.625', () => {
      const { interfaceRadius } = useAppearanceStore.getState();
      expect(interfaceRadius).toBe(0.625);
    });

    it('has default interface density as comfortable', () => {
      const { interfaceDensity } = useAppearanceStore.getState();
      expect(interfaceDensity).toBe('comfortable');
    });

    it('has reduced motion disabled by default', () => {
      const { reducedMotion } = useAppearanceStore.getState();
      expect(reducedMotion).toBe(false);
    });

    it('has default window effect as auto', () => {
      const { windowEffect } = useAppearanceStore.getState();
      expect(windowEffect).toBe('auto');
    });
  });

  describe('setAccentColor', () => {
    it('updates accent color to zinc', () => {
      useAppearanceStore.getState().setAccentColor('zinc');
      expect(useAppearanceStore.getState().accentColor).toBe('zinc');
    });

    it('updates accent color to green', () => {
      useAppearanceStore.getState().setAccentColor('green');
      expect(useAppearanceStore.getState().accentColor).toBe('green');
    });

    it('updates accent color to purple', () => {
      useAppearanceStore.getState().setAccentColor('purple');
      expect(useAppearanceStore.getState().accentColor).toBe('purple');
    });

    it('updates accent color to orange', () => {
      useAppearanceStore.getState().setAccentColor('orange');
      expect(useAppearanceStore.getState().accentColor).toBe('orange');
    });

    it('updates accent color to rose', () => {
      useAppearanceStore.getState().setAccentColor('rose');
      expect(useAppearanceStore.getState().accentColor).toBe('rose');
    });
  });

  describe('setChartColorTheme', () => {
    it('updates chart color theme to ocean', () => {
      useAppearanceStore.getState().setChartColorTheme('ocean');
      expect(useAppearanceStore.getState().chartColorTheme).toBe('ocean');
    });

    it('updates chart color theme to monochrome', () => {
      useAppearanceStore.getState().setChartColorTheme('monochrome');
      expect(useAppearanceStore.getState().chartColorTheme).toBe('monochrome');
    });
  });

  describe('setInterfaceRadius', () => {
    it('updates interface radius to 0', () => {
      useAppearanceStore.getState().setInterfaceRadius(0);
      expect(useAppearanceStore.getState().interfaceRadius).toBe(0);
    });

    it('updates interface radius to 1.0', () => {
      useAppearanceStore.getState().setInterfaceRadius(1.0);
      expect(useAppearanceStore.getState().interfaceRadius).toBe(1.0);
    });
  });

  describe('setInterfaceDensity', () => {
    it('updates interface density to compact', () => {
      useAppearanceStore.getState().setInterfaceDensity('compact');
      expect(useAppearanceStore.getState().interfaceDensity).toBe('compact');
    });

    it('updates interface density to spacious', () => {
      useAppearanceStore.getState().setInterfaceDensity('spacious');
      expect(useAppearanceStore.getState().interfaceDensity).toBe('spacious');
    });
  });

  describe('setReducedMotion', () => {
    it('enables reduced motion', () => {
      useAppearanceStore.getState().setReducedMotion(true);
      expect(useAppearanceStore.getState().reducedMotion).toBe(true);
    });

    it('disables reduced motion', () => {
      useAppearanceStore.getState().setReducedMotion(true);
      useAppearanceStore.getState().setReducedMotion(false);
      expect(useAppearanceStore.getState().reducedMotion).toBe(false);
    });
  });

  describe('setWindowEffect', () => {
    it('updates window effect to mica', () => {
      useAppearanceStore.getState().setWindowEffect('mica');
      expect(useAppearanceStore.getState().windowEffect).toBe('mica');
    });

    it('updates window effect to vibrancy', () => {
      useAppearanceStore.getState().setWindowEffect('vibrancy');
      expect(useAppearanceStore.getState().windowEffect).toBe('vibrancy');
    });

    it('updates window effect to none', () => {
      useAppearanceStore.getState().setWindowEffect('none');
      expect(useAppearanceStore.getState().windowEffect).toBe('none');
    });
  });

  describe('background settings', () => {
    it('has background disabled by default', () => {
      const state = useAppearanceStore.getState();
      expect(state.backgroundEnabled).toBe(false);
      expect(state.backgroundOpacity).toBe(20);
      expect(state.backgroundBlur).toBe(0);
      expect(state.backgroundFit).toBe('cover');
    });

    it('updates backgroundEnabled', () => {
      useAppearanceStore.getState().setBackgroundEnabled(true);
      expect(useAppearanceStore.getState().backgroundEnabled).toBe(true);
    });

    it('updates backgroundOpacity', () => {
      useAppearanceStore.getState().setBackgroundOpacity(75);
      expect(useAppearanceStore.getState().backgroundOpacity).toBe(75);
    });

    it('updates backgroundBlur', () => {
      useAppearanceStore.getState().setBackgroundBlur(10);
      expect(useAppearanceStore.getState().backgroundBlur).toBe(10);
    });

    it('updates backgroundFit', () => {
      useAppearanceStore.getState().setBackgroundFit('tile');
      expect(useAppearanceStore.getState().backgroundFit).toBe('tile');
    });

    it('clamps out-of-range background opacity and blur values', () => {
      useAppearanceStore.getState().setBackgroundOpacity(200);
      useAppearanceStore.getState().setBackgroundBlur(-2);

      const state = useAppearanceStore.getState();
      expect(state.backgroundOpacity).toBe(100);
      expect(state.backgroundBlur).toBe(0);
    });

    it('clearBackground resets background fields', () => {
      useAppearanceStore.getState().setBackgroundEnabled(true);
      useAppearanceStore.getState().setBackgroundOpacity(80);
      useAppearanceStore.getState().setBackgroundBlur(5);
      useAppearanceStore.getState().setBackgroundFit('contain');

      useAppearanceStore.getState().clearBackground();

      const state = useAppearanceStore.getState();
      expect(state.backgroundEnabled).toBe(false);
      expect(state.backgroundOpacity).toBe(20);
      expect(state.backgroundBlur).toBe(0);
      expect(state.backgroundFit).toBe('cover');
    });
  });

  describe('persist migration', () => {
    // Access the persist config to test migration function
    const getPersistConfig = () =>
      (useAppearanceStore as unknown as { persist: { getOptions: () => { migrate: (state: unknown, version: number) => unknown } } }).persist.getOptions();

    it('v1 → v7: adds all missing fields', () => {
      const v1State = { accentColor: 'rose' };
      const migrated = getPersistConfig().migrate(v1State, 1) as Record<string, unknown>;

      expect(migrated.reducedMotion).toBe(false);
      expect(migrated.chartColorTheme).toBe('default');
      expect(migrated.interfaceRadius).toBe(0.625);
      expect(migrated.interfaceDensity).toBe('comfortable');
      expect(migrated.backgroundEnabled).toBe(false);
      expect(migrated.backgroundOpacity).toBe(20);
      expect(migrated.backgroundBlur).toBe(0);
      expect(migrated.backgroundFit).toBe('cover');
      expect(migrated.windowEffect).toBe('auto');
      // Preserves existing fields
      expect(migrated.accentColor).toBe('rose');
    });

    it('v2 → v7: skips reducedMotion, adds rest', () => {
      const v2State = { accentColor: 'blue', reducedMotion: true };
      const migrated = getPersistConfig().migrate(v2State, 2) as Record<string, unknown>;

      expect(migrated.reducedMotion).toBe(true); // Preserved
      expect(migrated.chartColorTheme).toBe('default');
      expect(migrated.interfaceRadius).toBe(0.625);
      expect(migrated.interfaceDensity).toBe('comfortable');
      expect(migrated.backgroundEnabled).toBe(false);
      expect(migrated.windowEffect).toBe('auto');
    });

    it('v3 → v6: skips chartColorTheme, adds rest', () => {
      const v3State = { chartColorTheme: 'ocean', reducedMotion: false };
      const migrated = getPersistConfig().migrate(v3State, 3) as Record<string, unknown>;

      expect(migrated.chartColorTheme).toBe('ocean'); // Preserved
      expect(migrated.interfaceRadius).toBe(0.625);
      expect(migrated.interfaceDensity).toBe('comfortable');
      expect(migrated.backgroundEnabled).toBe(false);
    });

    it('v4 → v6: skips interfaceRadius, adds rest', () => {
      const v4State = { interfaceRadius: 1.0 };
      const migrated = getPersistConfig().migrate(v4State, 4) as Record<string, unknown>;

      expect(migrated.interfaceRadius).toBe(1.0); // Preserved
      expect(migrated.interfaceDensity).toBe('comfortable');
      expect(migrated.backgroundEnabled).toBe(false);
    });

    it('v5 → v6: adds only background fields', () => {
      const v5State = { interfaceDensity: 'compact' };
      const migrated = getPersistConfig().migrate(v5State, 5) as Record<string, unknown>;

      expect(migrated.interfaceDensity).toBe('compact'); // Preserved
      expect(migrated.backgroundEnabled).toBe(false);
      expect(migrated.backgroundOpacity).toBe(20);
      expect(migrated.backgroundBlur).toBe(0);
      expect(migrated.backgroundFit).toBe('cover');
    });

    it('v6 → v7: adds only windowEffect', () => {
      const v6State = { accentColor: 'green', backgroundEnabled: true };
      const migrated = getPersistConfig().migrate(v6State, 6) as Record<string, unknown>;

      expect(migrated.accentColor).toBe('green');
      expect(migrated.backgroundEnabled).toBe(true);
      expect(migrated.windowEffect).toBe('auto');
    });

    it('v7: no migration needed', () => {
      const v7State = { accentColor: 'green', windowEffect: 'mica' };
      const migrated = getPersistConfig().migrate(v7State, 7) as Record<string, unknown>;

      expect(migrated.accentColor).toBe('green');
      expect(migrated.windowEffect).toBe('mica');
    });

    it('does not overwrite existing fields during migration', () => {
      const state = {
        reducedMotion: true,
        chartColorTheme: 'vibrant',
        interfaceRadius: 0,
        interfaceDensity: 'spacious',
        backgroundEnabled: true,
        backgroundOpacity: 50,
        backgroundBlur: 5,
        backgroundFit: 'tile',
      };
      const migrated = getPersistConfig().migrate(state, 1) as Record<string, unknown>;

      expect(migrated.reducedMotion).toBe(true);
      expect(migrated.chartColorTheme).toBe('vibrant');
      expect(migrated.interfaceRadius).toBe(0);
      expect(migrated.interfaceDensity).toBe('spacious');
      expect(migrated.backgroundEnabled).toBe(true);
      expect(migrated.backgroundOpacity).toBe(50);
      expect(migrated.backgroundBlur).toBe(5);
      expect(migrated.backgroundFit).toBe('tile');
      expect(migrated.windowEffect).toBe('auto');
    });

    it('normalizes invalid persisted values during migration', () => {
      const invalid = {
        accentColor: 'pink',
        chartColorTheme: 'neon',
        interfaceRadius: 0.92,
        interfaceDensity: 'tiny',
        reducedMotion: 'unknown',
        backgroundEnabled: 'maybe',
        backgroundOpacity: 150,
        backgroundBlur: -9,
        backgroundFit: 'stretch',
        windowEffect: 'glass',
      };
      const migrated = getPersistConfig().migrate(invalid, 7) as Record<string, unknown>;

      expect(migrated.accentColor).toBe('blue');
      expect(migrated.chartColorTheme).toBe('default');
      expect(migrated.interfaceRadius).toBe(1);
      expect(migrated.interfaceDensity).toBe('comfortable');
      expect(migrated.reducedMotion).toBe(false);
      expect(migrated.backgroundEnabled).toBe(false);
      expect(migrated.backgroundOpacity).toBe(100);
      expect(migrated.backgroundBlur).toBe(0);
      expect(migrated.backgroundFit).toBe('cover');
      expect(migrated.windowEffect).toBe('auto');
    });
  });

  describe('reset', () => {
    it('resets all values to defaults', () => {
      // Change all values
      useAppearanceStore.getState().setAccentColor('rose');
      useAppearanceStore.getState().setChartColorTheme('ocean');
      useAppearanceStore.getState().setInterfaceRadius(0);
      useAppearanceStore.getState().setInterfaceDensity('compact');
      useAppearanceStore.getState().setReducedMotion(true);
      useAppearanceStore.getState().setBackgroundEnabled(true);
      useAppearanceStore.getState().setBackgroundOpacity(50);
      useAppearanceStore.getState().setBackgroundBlur(8);
      useAppearanceStore.getState().setBackgroundFit('tile');
      useAppearanceStore.getState().setWindowEffect('mica');

      // Reset
      useAppearanceStore.getState().reset();

      // Verify defaults
      const state = useAppearanceStore.getState();
      expect(state.accentColor).toBe('blue');
      expect(state.chartColorTheme).toBe('default');
      expect(state.interfaceRadius).toBe(0.625);
      expect(state.interfaceDensity).toBe('comfortable');
      expect(state.reducedMotion).toBe(false);
      expect(state.backgroundEnabled).toBe(false);
      expect(state.backgroundOpacity).toBe(20);
      expect(state.backgroundBlur).toBe(0);
      expect(state.backgroundFit).toBe('cover');
      expect(state.windowEffect).toBe('auto');
    });
  });
});
