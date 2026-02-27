import { useWindowStateStore } from './window-state';

describe('useWindowStateStore', () => {
  beforeEach(() => {
    useWindowStateStore.setState({
      isMaximized: false,
      isFullscreen: false,
      isFocused: true,
      titlebarHeight: '2rem',
    });
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useWindowStateStore.getState();
      expect(state.isMaximized).toBe(false);
      expect(state.isFullscreen).toBe(false);
      expect(state.isFocused).toBe(true);
      expect(state.titlebarHeight).toBe('2rem');
    });
  });

  describe('setMaximized', () => {
    it('sets isMaximized to true', () => {
      useWindowStateStore.getState().setMaximized(true);
      expect(useWindowStateStore.getState().isMaximized).toBe(true);
    });

    it('sets isMaximized back to false', () => {
      useWindowStateStore.getState().setMaximized(true);
      useWindowStateStore.getState().setMaximized(false);
      expect(useWindowStateStore.getState().isMaximized).toBe(false);
    });
  });

  describe('setFullscreen', () => {
    it('sets isFullscreen to true', () => {
      useWindowStateStore.getState().setFullscreen(true);
      expect(useWindowStateStore.getState().isFullscreen).toBe(true);
    });

    it('sets isFullscreen back to false', () => {
      useWindowStateStore.getState().setFullscreen(true);
      useWindowStateStore.getState().setFullscreen(false);
      expect(useWindowStateStore.getState().isFullscreen).toBe(false);
    });
  });

  describe('setFocused', () => {
    it('sets isFocused to false', () => {
      useWindowStateStore.getState().setFocused(false);
      expect(useWindowStateStore.getState().isFocused).toBe(false);
    });

    it('sets isFocused back to true', () => {
      useWindowStateStore.getState().setFocused(false);
      useWindowStateStore.getState().setFocused(true);
      expect(useWindowStateStore.getState().isFocused).toBe(true);
    });
  });

  describe('setTitlebarHeight', () => {
    it('updates titlebar height', () => {
      useWindowStateStore.getState().setTitlebarHeight('3rem');
      expect(useWindowStateStore.getState().titlebarHeight).toBe('3rem');
    });

    it('updates to different values', () => {
      useWindowStateStore.getState().setTitlebarHeight('40px');
      expect(useWindowStateStore.getState().titlebarHeight).toBe('40px');

      useWindowStateStore.getState().setTitlebarHeight('2rem');
      expect(useWindowStateStore.getState().titlebarHeight).toBe('2rem');
    });
  });

  describe('state independence', () => {
    it('setting one property does not affect others', () => {
      useWindowStateStore.getState().setMaximized(true);

      const state = useWindowStateStore.getState();
      expect(state.isMaximized).toBe(true);
      expect(state.isFullscreen).toBe(false);
      expect(state.isFocused).toBe(true);
      expect(state.titlebarHeight).toBe('2rem');
    });
  });
});
