import {
  _resetAllCaches,
  isTauri,
  isWindows,
  isMac,
  isLinux,
  getArch,
  getHostname,
  getOsFamily,
  getOsLabel,
  getOsLocale,
  getPlatformOS,
  getOsVersion,
  preloadOsInfo,
  _resetCachedOS,
  _setCachedOS,
} from './platform';
import * as tauriOs from '@tauri-apps/plugin-os';

jest.mock('@tauri-apps/plugin-os', () => ({
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x86_64'),
  family: jest.fn(() => 'unix'),
  exeExtension: jest.fn(() => ''),
  version: jest.fn(() => Promise.resolve('1.0.0')),
  locale: jest.fn(() => Promise.resolve('en-US')),
  hostname: jest.fn(() => Promise.resolve('demo-host')),
}));

describe('Platform Detection', () => {
  const mockTauriOs = tauriOs as jest.Mocked<typeof tauriOs>;
  const originalNavigator = global.navigator;

  afterEach(() => {
    _resetCachedOS();
    _resetAllCaches();
    jest.clearAllMocks();
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    // @ts-expect-error - clearing test-only Tauri internals
    delete global.window.__TAURI_INTERNALS__;
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

    it('returns unknown when neither userAgent nor platform provide a signal', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'CustomAgent/1.0', platform: 'BrowserX' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('unknown');
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

    it('falls back to navigator.platform when the userAgent is inconclusive', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'CustomAgent/1.0', platform: 'MacIntel' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('macos');
    });

    it('prefers the tauri os plugin when desktop internals are available', () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};
      mockTauriOs.platform.mockReturnValue('windows');
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('windows');
    });

    it('falls back to browser detection when tauri platform is unknown', () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};
      mockTauriOs.platform.mockReturnValue('mystery-os');
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        writable: true,
        configurable: true,
      });

      expect(getPlatformOS()).toBe('linux');
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

    it('returns platform labels for known operating systems', () => {
      _setCachedOS('windows');
      expect(getOsLabel()).toBe('Windows');
      _setCachedOS('macos');
      expect(getOsLabel()).toBe('macOS');
      _setCachedOS('linux');
      expect(getOsLabel()).toBe('Linux');
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

  describe('extended os helpers', () => {
    it('returns fallback arch, family, label, version, locale, and hostname outside tauri', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'CustomAgent/1.0', language: 'fr-FR' },
        writable: true,
        configurable: true,
      });

      expect(getArch()).toBe('unknown');
      expect(getOsFamily()).toBe('');
      expect(getOsVersion()).toBe('');
      expect(getOsLocale()).toBe('fr-FR');
      expect(getHostname()).toBe('');

      _setCachedOS('unknown');
      expect(getOsLabel()).toBe('Unknown');
    });

    it('falls back to default locale when navigator is unavailable', () => {
      // @ts-expect-error - intentionally testing undefined case
      delete global.navigator;
      expect(getOsLocale()).toBe('en');
    });

    it('preloads async tauri os info and falls back to navigator.language when locale is null', async () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};
      mockTauriOs.platform.mockReturnValue('linux');
      mockTauriOs.arch.mockReturnValue('x86_64');
      mockTauriOs.family.mockReturnValue('unix');
      mockTauriOs.version.mockResolvedValue('6.8.0');
      mockTauriOs.locale.mockResolvedValue(null);
      mockTauriOs.hostname.mockResolvedValue('desktop-host');
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0', language: 'zh-CN' },
        writable: true,
        configurable: true,
      });

      await preloadOsInfo();

      expect(getPlatformOS()).toBe('linux');
      expect(getArch()).toBe('x86_64');
      expect(getOsFamily()).toBe('unix');
      expect(getOsLabel()).toBe('Linux');
      expect(getOsVersion()).toBe('6.8.0');
      expect(getOsLocale()).toBe('zh-CN');
      expect(getHostname()).toBe('desktop-host');
    });

    it('_resetAllCaches clears cached tauri-derived values', async () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};
      mockTauriOs.arch.mockReturnValue('x86_64');
      mockTauriOs.family.mockReturnValue('unix');
      mockTauriOs.version.mockResolvedValue('1.0.0');
      mockTauriOs.locale.mockResolvedValue('en-US');
      mockTauriOs.hostname.mockResolvedValue('alpha');

      await preloadOsInfo();
      expect(getArch()).toBe('x86_64');
      expect(getOsFamily()).toBe('unix');
      expect(getHostname()).toBe('alpha');

      mockTauriOs.arch.mockReturnValue('aarch64');
      mockTauriOs.family.mockReturnValue('windows');
      mockTauriOs.version.mockResolvedValue('2.0.0');
      mockTauriOs.locale.mockResolvedValue('ja-JP');
      mockTauriOs.hostname.mockResolvedValue('beta');

      _resetAllCaches();
      await preloadOsInfo();

      expect(getArch()).toBe('aarch64');
      expect(getOsFamily()).toBe('windows');
      expect(getOsVersion()).toBe('2.0.0');
      expect(getOsLocale()).toBe('ja-JP');
      expect(getHostname()).toBe('beta');
    });

    it('preloadOsInfo is a no-op outside tauri', async () => {
      await expect(preloadOsInfo()).resolves.toBeUndefined();
      expect(getOsVersion()).toBe('');
      expect(getHostname()).toBe('');
    });

    it('swallows preload failures from the tauri os plugin', async () => {
      // @ts-expect-error - adding __TAURI_INTERNALS__ for testing
      global.window.__TAURI_INTERNALS__ = {};
      mockTauriOs.version.mockRejectedValue(new Error('boom'));

      await expect(preloadOsInfo()).resolves.toBeUndefined();
      expect(getOsVersion()).toBe('');
    });
  });

  describe('tauri plugin load failures', () => {
    it('falls back safely when the tauri os module cannot be required', async () => {
      jest.resetModules();
      const windowBackup = global.window;
      const navigatorBackup = global.navigator;

      // @ts-expect-error - test-only Tauri runtime marker
      global.window = { __TAURI_INTERNALS__: {} };
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'CustomAgent/1.0', language: 'en-US' },
        writable: true,
        configurable: true,
      });

      jest.doMock('@tauri-apps/plugin-os', () => {
        throw new Error('load failed');
      });

      const isolatedPlatform = await import('./platform');
      isolatedPlatform._resetAllCaches();

      expect(isolatedPlatform.getArch()).toBe('unknown');
      expect(isolatedPlatform.getOsFamily()).toBe('');
      expect(isolatedPlatform.getPlatformOS()).toBe('unknown');

      jest.resetModules();
      jest.unmock('@tauri-apps/plugin-os');
      global.window = windowBackup;
      Object.defineProperty(global, 'navigator', {
        value: navigatorBackup,
        writable: true,
        configurable: true,
      });
    });
  });
});
