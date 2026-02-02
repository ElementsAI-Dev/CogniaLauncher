import { useAppearanceStore } from './appearance';

describe('useAppearanceStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useAppearanceStore.getState().reset();
    // Clear localStorage mock
    localStorage.clear();
  });

  describe('initial state', () => {
    it('has default theme mode as system', () => {
      const { themeMode } = useAppearanceStore.getState();
      expect(themeMode).toBe('system');
    });

    it('has default accent color as blue', () => {
      const { accentColor } = useAppearanceStore.getState();
      expect(accentColor).toBe('blue');
    });

    it('has reduced motion disabled by default', () => {
      const { reducedMotion } = useAppearanceStore.getState();
      expect(reducedMotion).toBe(false);
    });
  });

  describe('setThemeMode', () => {
    it('updates theme mode to light', () => {
      useAppearanceStore.getState().setThemeMode('light');
      expect(useAppearanceStore.getState().themeMode).toBe('light');
    });

    it('updates theme mode to dark', () => {
      useAppearanceStore.getState().setThemeMode('dark');
      expect(useAppearanceStore.getState().themeMode).toBe('dark');
    });

    it('updates theme mode to system', () => {
      useAppearanceStore.getState().setThemeMode('light');
      useAppearanceStore.getState().setThemeMode('system');
      expect(useAppearanceStore.getState().themeMode).toBe('system');
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

  describe('reset', () => {
    it('resets all values to defaults', () => {
      // Change all values
      useAppearanceStore.getState().setThemeMode('dark');
      useAppearanceStore.getState().setAccentColor('rose');
      useAppearanceStore.getState().setReducedMotion(true);

      // Reset
      useAppearanceStore.getState().reset();

      // Verify defaults
      const state = useAppearanceStore.getState();
      expect(state.themeMode).toBe('system');
      expect(state.accentColor).toBe('blue');
      expect(state.reducedMotion).toBe(false);
    });
  });
});
