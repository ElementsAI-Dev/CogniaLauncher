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
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ---------------------------------------------------------------------------
// OS detection  (cached)
// ---------------------------------------------------------------------------

export type PlatformOS = 'windows' | 'macos' | 'linux' | 'unknown';

let _cachedOS: PlatformOS | null = null;

function detectOS(): PlatformOS {
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
