import { renderHook } from '@testing-library/react';
import {
  useAssetMatcher,
  detectPlatform,
  detectArch,
  getPlatformLabel,
  getArchLabel,
} from './use-asset-matcher';
import type { GitHubAssetInfo } from '@/types/github';

// Mock Tauri
jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => false),
  getPlatformInfo: jest.fn(),
}));

function makeAsset(name: string, overrides?: Partial<GitHubAssetInfo>): GitHubAssetInfo {
  return {
    id: 1,
    name,
    size: 1024,
    sizeHuman: '1 KB',
    downloadUrl: `https://example.com/${name}`,
    contentType: null,
    downloadCount: null,
    ...overrides,
  };
}

describe('detectPlatform', () => {
  it('should detect Windows', () => {
    expect(detectPlatform('app-win-x64.zip')).toBe('windows');
    expect(detectPlatform('app-windows-x64.exe')).toBe('windows');
  });

  it('should detect macOS', () => {
    expect(detectPlatform('app-darwin-arm64.tar.gz')).toBe('macos');
    expect(detectPlatform('app-macos-x64.dmg')).toBe('macos');
    expect(detectPlatform('app-osx-universal.pkg')).toBe('macos');
  });

  it('should detect Linux', () => {
    expect(detectPlatform('app-linux-x64.tar.gz')).toBe('linux');
    expect(detectPlatform('app-linux64.AppImage')).toBe('linux');
  });

  it('should return unknown for unrecognized names', () => {
    expect(detectPlatform('app.tar.gz')).toBe('unknown');
    expect(detectPlatform('README.md')).toBe('unknown');
  });
});

describe('detectArch', () => {
  it('should detect x64', () => {
    expect(detectArch('app-x86_64.tar.gz')).toBe('x64');
    expect(detectArch('app-x64.zip')).toBe('x64');
    expect(detectArch('app-amd64.deb')).toBe('x64');
  });

  it('should detect arm64', () => {
    expect(detectArch('app-aarch64.tar.gz')).toBe('arm64');
    expect(detectArch('app-arm64.dmg')).toBe('arm64');
  });

  it('should detect x86', () => {
    expect(detectArch('app-i686.tar.gz')).toBe('x86');
    expect(detectArch('app-i386.deb')).toBe('x86');
    expect(detectArch('app-386.exe')).toBe('x86');
  });

  it('should detect universal', () => {
    expect(detectArch('app-universal.dmg')).toBe('universal');
  });

  it('should return unknown for unrecognized arch', () => {
    expect(detectArch('app.tar.gz')).toBe('unknown');
  });
});

describe('getPlatformLabel', () => {
  it('should return correct labels', () => {
    expect(getPlatformLabel('windows')).toBe('Windows');
    expect(getPlatformLabel('macos')).toBe('macOS');
    expect(getPlatformLabel('linux')).toBe('Linux');
    expect(getPlatformLabel('unknown')).toBe('');
  });
});

describe('getArchLabel', () => {
  it('should return correct labels', () => {
    expect(getArchLabel('x64')).toBe('x64');
    expect(getArchLabel('arm64')).toBe('ARM64');
    expect(getArchLabel('x86')).toBe('x86');
    expect(getArchLabel('universal')).toBe('Universal');
    expect(getArchLabel('unknown')).toBe('');
  });
});

describe('useAssetMatcher', () => {
  it('should return default state in web mode', () => {
    const { result } = renderHook(() => useAssetMatcher());

    expect(result.current.currentPlatform).toBe('unknown');
    expect(result.current.currentArch).toBe('unknown');
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.parseAssets).toBe('function');
    expect(typeof result.current.getRecommendedAsset).toBe('function');
  });

  it('should filter out checksum/signature files', () => {
    const { result } = renderHook(() => useAssetMatcher());

    const assets = [
      makeAsset('app-linux-x64.tar.gz'),
      makeAsset('app-linux-x64.tar.gz.sha256'),
      makeAsset('app-linux-x64.tar.gz.sig'),
      makeAsset('app-linux-x64.tar.gz.asc'),
    ];

    const parsed = result.current.parseAssets(assets);

    // Should filter out .sha256, .sig, .asc
    expect(parsed.length).toBe(1);
    expect(parsed[0].asset.name).toBe('app-linux-x64.tar.gz');
  });

  it('should parse assets with platform and arch detection', () => {
    const { result } = renderHook(() => useAssetMatcher());

    const assets = [
      makeAsset('app-windows-x64.zip'),
      makeAsset('app-linux-arm64.tar.gz'),
      makeAsset('app-macos-universal.dmg'),
    ];

    const parsed = result.current.parseAssets(assets);

    expect(parsed.length).toBe(3);

    const winAsset = parsed.find((p) => p.platform === 'windows');
    expect(winAsset).toBeDefined();
    expect(winAsset?.arch).toBe('x64');

    const linuxAsset = parsed.find((p) => p.platform === 'linux');
    expect(linuxAsset).toBeDefined();
    expect(linuxAsset?.arch).toBe('arm64');

    const macAsset = parsed.find((p) => p.platform === 'macos');
    expect(macAsset).toBeDefined();
    expect(macAsset?.arch).toBe('universal');
  });

  it('should sort assets by score descending', () => {
    const { result } = renderHook(() => useAssetMatcher());

    const assets = [
      makeAsset('app-windows-x64.zip'),
      makeAsset('app-linux-x64.tar.gz'),
      makeAsset('README.md'),
    ];

    const parsed = result.current.parseAssets(assets);

    // Scores should be in descending order
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i - 1].score).toBeGreaterThanOrEqual(parsed[i].score);
    }
  });

  it('should return null when no recommended asset', () => {
    const { result } = renderHook(() => useAssetMatcher());

    // In web mode (unknown platform), no asset should be recommended
    const assets = [
      makeAsset('app-windows-x64.zip'),
      makeAsset('app-linux-x64.tar.gz'),
    ];

    const recommended = result.current.getRecommendedAsset(assets);
    // With unknown platform, scores won't reach 140 threshold
    // unless there's a platform match, which there isn't in web mode
    expect(recommended).toBeNull();
  });

  it('should return empty array for empty assets', () => {
    const { result } = renderHook(() => useAssetMatcher());

    const parsed = result.current.parseAssets([]);
    expect(parsed).toEqual([]);
  });
});
