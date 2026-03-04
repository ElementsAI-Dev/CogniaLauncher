/**
 * Centralized platform detection utilities.
 *
 * Every piece of code that needs to know "are we in Tauri?", "is this Windows?"
 * etc. should import from this module instead of doing ad-hoc navigator checks.
 *
 * Detection is synchronous and cached after first call so it can be used
 * freely during React render without side-effects.
 */

// ---------------------------------------------------------------------------
// Tauri detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` when running inside the Tauri webview (desktop mode).
 * Safe to call during SSR (returns `false`).
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ---------------------------------------------------------------------------
// OS detection  (cached)
// ---------------------------------------------------------------------------

export type PlatformOS = 'windows' | 'macos' | 'linux' | 'unknown';

let _cachedOS: PlatformOS | null = null;

interface TauriOsSyncApi {
  platform: () => string;
  arch: () => string;
  family: () => string;
  exeExtension: () => string;
  version: () => Promise<string>;
  locale: () => Promise<string | null>;
  hostname: () => Promise<string | null>;
}

let _tauriOsModule: TauriOsSyncApi | null = null;

function getTauriOs(): TauriOsSyncApi | null {
  if (_tauriOsModule) return _tauriOsModule;
  if (!isTauri()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _tauriOsModule = require('@tauri-apps/plugin-os') as TauriOsSyncApi;
    return _tauriOsModule;
  } catch {
    return null;
  }
}

function detectOS(): PlatformOS {
  const tauriOs = getTauriOs();
  if (tauriOs) {
    const p = tauriOs.platform();
    if (p === 'windows') return 'windows';
    if (p === 'macos') return 'macos';
    if (p === 'linux') return 'linux';
  }

  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent ?? '';

  // userAgent is the primary signal (works in all modern browsers + Tauri webview)
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';

  // Fallback: navigator.platform (deprecated but still present in most runtimes)
  const plat = (navigator as { platform?: string }).platform ?? '';
  if (/^Win/i.test(plat)) return 'windows';
  if (/^Mac/i.test(plat)) return 'macos';
  if (/^Linux/i.test(plat)) return 'linux';

  return 'unknown';
}

/** Returns the detected OS. Result is cached after first call. */
export function getPlatformOS(): PlatformOS {
  if (_cachedOS === null) {
    _cachedOS = detectOS();
  }
  return _cachedOS;
}

/** `true` when running on Windows (any variant). */
export function isWindows(): boolean {
  return getPlatformOS() === 'windows';
}

/** `true` when running on macOS. */
export function isMac(): boolean {
  return getPlatformOS() === 'macos';
}

/** `true` when running on Linux. */
export function isLinux(): boolean {
  return getPlatformOS() === 'linux';
}

// ---------------------------------------------------------------------------
// Extended OS info (via @tauri-apps/plugin-os)
//
// Sync functions: platform(), arch(), family() — compile-time constants
// Async functions: version(), locale(), hostname() — require IPC
//
// We expose sync getters for the compile-time ones and async getters for
// the IPC-based ones. A preload helper eagerly fetches all async values.
// ---------------------------------------------------------------------------

let _cachedArch: string | null = null;
let _cachedOsVersion: string | null = null;
let _cachedOsLocale: string | null = null;
let _cachedHostname: string | null = null;
let _cachedOsFamily: string | null = null;

/** Returns the CPU architecture (e.g. 'x86_64', 'aarch64'). Synchronous. Falls back to 'unknown'. */
export function getArch(): string {
  if (_cachedArch !== null) return _cachedArch;
  const tauriOs = getTauriOs();
  _cachedArch = tauriOs ? tauriOs.arch() : 'unknown';
  return _cachedArch;
}

/** Returns the OS family ('unix' or 'windows'). Synchronous. Falls back to ''. */
export function getOsFamily(): string {
  if (_cachedOsFamily !== null) return _cachedOsFamily;
  const tauriOs = getTauriOs();
  _cachedOsFamily = tauriOs ? tauriOs.family() : '';
  return _cachedOsFamily;
}

/** Returns a human-readable OS label (e.g. 'Windows', 'macOS', 'Linux'). */
export function getOsLabel(): string {
  const os = getPlatformOS();
  if (os === 'windows') return 'Windows';
  if (os === 'macos') return 'macOS';
  if (os === 'linux') return 'Linux';
  return 'Unknown';
}

/** Returns cached OS version, or '' if not yet loaded. Call `preloadOsInfo()` first. */
export function getOsVersion(): string {
  return _cachedOsVersion ?? '';
}

/** Returns cached system locale, or navigator.language fallback. Call `preloadOsInfo()` first. */
export function getOsLocale(): string {
  if (_cachedOsLocale !== null) return _cachedOsLocale;
  return (typeof navigator !== 'undefined' ? navigator.language : null) || 'en';
}

/** Returns cached hostname, or '' if not yet loaded. Call `preloadOsInfo()` first. */
export function getHostname(): string {
  return _cachedHostname ?? '';
}

let _preloadPromise: Promise<void> | null = null;

/**
 * Eagerly fetches async OS info (version, locale, hostname) and caches them.
 * Safe to call multiple times — only runs once. No-op outside Tauri.
 */
export function preloadOsInfo(): Promise<void> {
  if (_preloadPromise) return _preloadPromise;
  const tauriOs = getTauriOs();
  if (!tauriOs) {
    _preloadPromise = Promise.resolve();
    return _preloadPromise;
  }
  _preloadPromise = Promise.all([
    tauriOs.version().then((v) => { _cachedOsVersion = v; }),
    tauriOs.locale().then((l) => { _cachedOsLocale = l || ((typeof navigator !== 'undefined' ? navigator.language : null) || 'en'); }),
    tauriOs.hostname().then((h) => { _cachedHostname = h ?? ''; }),
  ]).then(() => {}).catch(() => {});
  return _preloadPromise;
}

// ---------------------------------------------------------------------------
// Test helpers – allow tests to override the cached OS
// ---------------------------------------------------------------------------

/** @internal Reset the cached OS value. Only for use in tests. */
export function _resetCachedOS(): void {
  _cachedOS = null;
}

/** @internal Force a specific OS value. Only for use in tests. */
export function _setCachedOS(os: PlatformOS): void {
  _cachedOS = os;
}

/** @internal Reset all cached values. Only for use in tests. */
export function _resetAllCaches(): void {
  _cachedOS = null;
  _cachedArch = null;
  _cachedOsVersion = null;
  _cachedOsLocale = null;
  _cachedHostname = null;
  _cachedOsFamily = null;
  _tauriOsModule = null;
  _preloadPromise = null;
}
