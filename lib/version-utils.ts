/**
 * Version comparison, classification, and formatting utilities.
 * Pure functions with no React or side-effect dependencies.
 */

import type { VersionInfo } from '@/lib/tauri';

/**
 * Compare two semver-like version strings numerically.
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, '').split('.').map(Number);
  const bParts = b.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (isNaN(aVal) || isNaN(bVal)) return 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}

/**
 * Check if a version string represents a stable release.
 * Returns false for alpha, beta, rc, dev, preview, nightly, canary.
 */
export function isStableVersion(version: string): boolean {
  const lower = version.toLowerCase();
  return (
    !lower.includes('alpha') &&
    !lower.includes('beta') &&
    !lower.includes('rc') &&
    !lower.includes('dev') &&
    !lower.includes('preview') &&
    !lower.includes('nightly') &&
    !lower.includes('canary')
  );
}

/**
 * Find the latest stable version from an array of VersionInfo.
 * Skips deprecated and yanked versions.
 */
export function findLatestStable(versions: VersionInfo[]): string | null {
  for (const v of versions) {
    if (!v.deprecated && !v.yanked && isStableVersion(v.version)) {
      return v.version;
    }
  }
  return null;
}

/**
 * Check if a Node.js version is LTS (even major versions >= 4).
 */
export function isNodeLtsVersion(version: string): boolean {
  const match = version.match(/^v?(\d+)/);
  if (!match) return false;
  const majorVersion = parseInt(match[1], 10);
  // Node.js LTS versions are even-numbered major versions >= 4
  return majorVersion >= 4 && majorVersion % 2 === 0;
}

/**
 * Check if a version is LTS for a given environment type.
 */
export function isLtsVersion(envType: string, version: string): boolean {
  // Check if version string explicitly contains 'lts'
  if (version.toLowerCase().includes('lts')) return true;

  // For Node.js, LTS versions are even major versions
  if (envType.toLowerCase() === 'node') {
    return isNodeLtsVersion(version);
  }

  // For Python, LTS-like versions are typically x.x.0 releases with extended support
  // For now, treat all stable versions as potentially LTS for other languages
  return true;
}

/**
 * Safely format a date string to locale date string.
 * Returns null if the input is null or invalid.
 */
export function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
