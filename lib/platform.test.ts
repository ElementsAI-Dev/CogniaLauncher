import {
  isTauri,
  isWindows,
  isMac,
  isLinux,
  getPlatformOS,
  _resetCachedOS,
  _setCachedOS,
} from './platform';

describe('Platform Detection', () => {
  afterEach(() => {
    _resetCachedOS();
  });

  describe('isTauri', () => {
    it('returns false when window is undefined', () => {
      const windowBackup = global.window;
      // @ts-expect-error - intentionally testing undefined case
      delete global.window;

      expect(isTauri()).toBe(false);

      global.window = windowBackup;
    });

    it('returns false when __TAURI_INTERNALS__ is not in window', () => {
      expect(isTauri()).toBe(false);
    });

    it('returns true when __TAURI_INTERNALS__ is in window', () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};

      expect(isTauri()).toBe(true);

      // @ts-expect-error - removing __TAURI_INTERNALS__ after testing
      delete global.window.__TAURI_INTERNALS__;
    });
  });

  describe('getPlatformOS', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      _resetCachedOS();
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('returns "unknown" when navigator is undefined', () => {
      const nav = global.navigator;
      // @ts-expect-error - intentionally testing undefined case
      delete global.navigator;

      const os = getPlatformOS();
      expect(os).toBe('unknown');

      Object.defineProperty(global, 'navigator', {
        value: nav,
        writable: true,
        configurable: true,
      });
    });

    it('detects Windows from userAgent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('windows');
    });

    it('detects macOS from userAgent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('macos');
    });

    it('detects Linux from userAgent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('linux');
    });

    it('caches the result after first call', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('windows');

      // Change navigator - should still return cached value
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('windows');
    });
  });

  describe('isWindows / isMac / isLinux', () => {
    afterEach(() => {
      _resetCachedOS();
    });

    it('isWindows returns true for windows', () => {
      _setCachedOS('windows');
      expect(isWindows()).toBe(true);
      expect(isMac()).toBe(false);
      expect(isLinux()).toBe(false);
    });

    it('isMac returns true for macos', () => {
      _setCachedOS('macos');
      expect(isWindows()).toBe(false);
      expect(isMac()).toBe(true);
      expect(isLinux()).toBe(false);
    });

    it('isLinux returns true for linux', () => {
      _setCachedOS('linux');
      expect(isWindows()).toBe(false);
      expect(isMac()).toBe(false);
      expect(isLinux()).toBe(true);
    });

    it('all return false for unknown', () => {
      _setCachedOS('unknown');
      expect(isWindows()).toBe(false);
      expect(isMac()).toBe(false);
      expect(isLinux()).toBe(false);
    });
  });

  describe('_resetCachedOS / _setCachedOS', () => {
    it('_resetCachedOS clears the cache', () => {
      _setCachedOS('windows');
      expect(isWindows()).toBe(true);

      _resetCachedOS();

      // After reset, it re-detects from navigator (jsdom default = unknown-ish)
      // Just verify the reset didn't throw and returns a valid PlatformOS
      const os = getPlatformOS();
      expect(['windows', 'macos', 'linux', 'unknown']).toContain(os);
    });

    it('_setCachedOS overrides detection', () => {
      _setCachedOS('macos');
      expect(getPlatformOS()).toBe('macos');
      expect(isMac()).toBe(true);
    });
  });
});
