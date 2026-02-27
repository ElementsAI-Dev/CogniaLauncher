import {
  compareVersions,
  isStableVersion,
  findLatestStable,
  isNodeLtsVersion,
  isLtsVersion,
  formatDate,
} from './version-utils';
import type { VersionInfo } from '@/lib/tauri';

describe('compareVersions', () => {
  it('returns 1 when a > b', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
  });

  it('returns -1 when a < b', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('handles v prefix', () => {
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
  });

  it('handles different segment counts', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });

  it('returns 0 for non-numeric segments', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(0);
  });
});

describe('isStableVersion', () => {
  it('returns true for stable versions', () => {
    expect(isStableVersion('1.0.0')).toBe(true);
    expect(isStableVersion('v20.11.0')).toBe(true);
    expect(isStableVersion('3.12.1')).toBe(true);
  });

  it('returns false for pre-release versions', () => {
    expect(isStableVersion('1.0.0-alpha')).toBe(false);
    expect(isStableVersion('1.0.0-beta.1')).toBe(false);
    expect(isStableVersion('1.0.0-rc.1')).toBe(false);
    expect(isStableVersion('1.0.0-dev')).toBe(false);
    expect(isStableVersion('1.0.0-preview')).toBe(false);
    expect(isStableVersion('1.0.0-nightly')).toBe(false);
    expect(isStableVersion('1.0.0-canary')).toBe(false);
  });
});

describe('findLatestStable', () => {
  const makeVersion = (version: string, deprecated = false, yanked = false): VersionInfo => ({
    version,
    release_date: null,
    deprecated,
    yanked,
  });

  it('returns first stable non-deprecated version', () => {
    const versions = [
      makeVersion('2.0.0-beta'),
      makeVersion('1.9.0', true),
      makeVersion('1.8.0'),
    ];
    expect(findLatestStable(versions)).toBe('1.8.0');
  });

  it('skips yanked versions', () => {
    const versions = [
      makeVersion('2.0.0', false, true),
      makeVersion('1.9.0'),
    ];
    expect(findLatestStable(versions)).toBe('1.9.0');
  });

  it('returns null if no stable version found', () => {
    const versions = [
      makeVersion('2.0.0-alpha'),
      makeVersion('1.0.0-beta'),
    ];
    expect(findLatestStable(versions)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(findLatestStable([])).toBeNull();
  });
});

describe('isNodeLtsVersion', () => {
  it('returns true for even major versions >= 4', () => {
    expect(isNodeLtsVersion('20.11.0')).toBe(true);
    expect(isNodeLtsVersion('v18.0.0')).toBe(true);
    expect(isNodeLtsVersion('4.0.0')).toBe(true);
  });

  it('returns false for odd major versions', () => {
    expect(isNodeLtsVersion('21.0.0')).toBe(false);
    expect(isNodeLtsVersion('v19.0.0')).toBe(false);
  });

  it('returns false for major versions < 4', () => {
    expect(isNodeLtsVersion('2.0.0')).toBe(false);
    expect(isNodeLtsVersion('0.12.0')).toBe(false);
  });

  it('returns false for non-numeric input', () => {
    expect(isNodeLtsVersion('abc')).toBe(false);
  });
});

describe('isLtsVersion', () => {
  it('returns true when version contains "lts"', () => {
    expect(isLtsVersion('python', 'lts')).toBe(true);
    expect(isLtsVersion('node', 'lts-hydrogen')).toBe(true);
  });

  it('delegates to isNodeLtsVersion for node', () => {
    expect(isLtsVersion('node', '20.0.0')).toBe(true);
    expect(isLtsVersion('node', '21.0.0')).toBe(false);
    expect(isLtsVersion('Node', 'v18.0.0')).toBe(true);
  });

  it('returns true for other languages (default)', () => {
    expect(isLtsVersion('python', '3.12.0')).toBe(true);
    expect(isLtsVersion('go', '1.21.0')).toBe(true);
  });
});

describe('formatDate', () => {
  it('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('formats a valid date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('returns the input for invalid date strings', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });
});
