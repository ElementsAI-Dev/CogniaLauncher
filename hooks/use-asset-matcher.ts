import { useState, useEffect, useCallback, useMemo } from 'react';
import { isTauri } from '@/lib/tauri';
import type { GitHubAssetInfo } from '@/types/github';

export type DetectedPlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type DetectedArch = 'x64' | 'arm64' | 'x86' | 'universal' | 'unknown';

export interface ParsedAsset {
  asset: GitHubAssetInfo;
  platform: DetectedPlatform;
  arch: DetectedArch;
  score: number;
  isRecommended: boolean;
  isFallback: boolean;
}

const PLATFORM_PATTERNS: Record<Exclude<DetectedPlatform, 'unknown'>, RegExp> = {
  windows: /(?:\b|[_-])(win(?:dows)?|windows)(?:\b|[_-]|32|64)/i,
  macos: /(?:\b|[_-])(darwin|macos|osx|apple)(?:\b|[_-])/i,
  linux: /(?:\b|[_-])(linux)(?:\b|[_-]|32|64)/i,
};

const ARCH_PATTERNS: Record<Exclude<DetectedArch, 'unknown'>, RegExp> = {
  x64: /(?:\b|[_-])(x86[_-]?64|x64|amd64)(?:\b|[_-])/i,
  arm64: /(?:\b|[_-])(aarch64|arm64)(?:\b|[_-])/i,
  x86: /(?:\b|[_-])(i[3-6]86|x86[_-]?32|386)(?:\b|[_-])/i,
  universal: /(?:\b|[_-])(universal|all)(?:\b|[_-])/i,
};

const EXCLUDE_PATTERN = /\.(sha256|sha512|sha1|md5|sig|asc|gpg|minisig|sbom)$/i;

export function detectPlatform(name: string): DetectedPlatform {
  if (PLATFORM_PATTERNS.windows.test(name)) return 'windows';
  if (PLATFORM_PATTERNS.macos.test(name)) return 'macos';
  if (PLATFORM_PATTERNS.linux.test(name)) return 'linux';
  return 'unknown';
}

export function detectArch(name: string): DetectedArch {
  if (ARCH_PATTERNS.arm64.test(name)) return 'arm64';
  if (ARCH_PATTERNS.x64.test(name)) return 'x64';
  if (ARCH_PATTERNS.x86.test(name)) return 'x86';
  if (ARCH_PATTERNS.universal.test(name)) return 'universal';
  return 'unknown';
}

export function useAssetMatcher() {
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [currentArch, setCurrentArch] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPlatformInfo() {
      if (isTauri()) {
        try {
          const tauri = await import('@/lib/tauri');
          const info = await tauri.getPlatformInfo();
          setCurrentPlatform(info.os);
          setCurrentArch(info.arch);
        } catch (error) {
          console.error('Failed to get platform info:', error);
        }
      }
      setIsLoading(false);
    }
    loadPlatformInfo();
  }, []);

  const normalizedPlatform = useMemo((): DetectedPlatform => {
    if (!currentPlatform) return 'unknown';
    const p = currentPlatform.toLowerCase();
    if (p === 'windows') return 'windows';
    if (p === 'macos') return 'macos';
    if (p === 'linux') return 'linux';
    return 'unknown';
  }, [currentPlatform]);

  const normalizedArch = useMemo((): DetectedArch => {
    if (!currentArch) return 'unknown';
    const a = currentArch.toLowerCase();
    if (a === 'x86_64' || a === 'amd64' || a === 'x64') return 'x64';
    if (a === 'aarch64' || a === 'arm64') return 'arm64';
    if (a === 'x86' || a === 'i686' || a === 'i386') return 'x86';
    return 'unknown';
  }, [currentArch]);

  const scoreAsset = useCallback(
    (name: string): { score: number; isFallback: boolean } => {
      const platform = detectPlatform(name);
      const arch = detectArch(name);
      let score = 0;
      let isFallback = false;

      // Platform matching
      if (platform === normalizedPlatform && platform !== 'unknown') {
        score += 100;
      } else if (platform === 'unknown') {
        score += 10; // Unknown platform might be universal
      } else if (
        normalizedPlatform === 'macos' &&
        normalizedArch === 'arm64' &&
        platform === 'macos'
      ) {
        // macOS ARM can use x64 via Rosetta 2
        if (arch === 'x64') {
          score += 50;
          isFallback = true;
        }
      } else {
        return { score: 0, isFallback: false }; // Platform mismatch
      }

      // Architecture matching
      if (arch === normalizedArch && arch !== 'unknown') {
        score += 50;
      } else if (arch === 'universal') {
        score += 40;
      } else if (arch === 'unknown') {
        score += 5; // Unknown arch might be universal
      } else if (
        normalizedPlatform === 'macos' &&
        normalizedArch === 'arm64' &&
        arch === 'x64'
      ) {
        // Already handled above
        score += 30;
      } else {
        return { score: 0, isFallback: false }; // Arch mismatch
      }

      // Format preference bonus
      const lower = name.toLowerCase();
      if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        score += 10;
      } else if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) {
        score += 9;
      } else if (lower.endsWith('.zip')) {
        score += 8;
      } else if (lower.endsWith('.exe') || lower.endsWith('.msi')) {
        score += 7;
      } else if (lower.endsWith('.dmg') || lower.endsWith('.pkg')) {
        score += 7;
      }

      return { score, isFallback };
    },
    [normalizedPlatform, normalizedArch]
  );

  const parseAssets = useCallback(
    (assets: GitHubAssetInfo[]): ParsedAsset[] => {
      return assets
        .filter((a) => !EXCLUDE_PATTERN.test(a.name))
        .map((asset) => {
          const platform = detectPlatform(asset.name);
          const arch = detectArch(asset.name);
          const { score, isFallback } = scoreAsset(asset.name);

          return {
            asset,
            platform,
            arch,
            score,
            isRecommended: score >= 140, // Platform (100) + Arch (50) - some buffer
            isFallback,
          };
        })
        .sort((a, b) => b.score - a.score);
    },
    [scoreAsset]
  );

  const getRecommendedAsset = useCallback(
    (assets: GitHubAssetInfo[]): GitHubAssetInfo | null => {
      const parsed = parseAssets(assets);
      const recommended = parsed.find((p) => p.isRecommended);
      return recommended?.asset ?? null;
    },
    [parseAssets]
  );

  return {
    currentPlatform: normalizedPlatform,
    currentArch: normalizedArch,
    isLoading,
    parseAssets,
    getRecommendedAsset,
    detectPlatform,
    detectArch,
  };
}

export function getPlatformLabel(platform: DetectedPlatform): string {
  switch (platform) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return '';
  }
}

export function getArchLabel(arch: DetectedArch): string {
  switch (arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'ARM64';
    case 'x86':
      return 'x86';
    case 'universal':
      return 'Universal';
    default:
      return '';
  }
}
