// ============================================================================
// Platform
// ============================================================================

export interface PlatformInfo {
  os: string;
  arch: string;
  hostname: string;
  osVersion: string;
}

// ============================================================================
// Environment
// ============================================================================

export interface EnvEntry {
  id: string;
  displayName: string;
}

export interface EnvDetectResult {
  available: boolean;
  currentVersion: string | null;
  installedVersions: string[];
}

export interface EnvVersionEntry {
  version: string;
  current: boolean;
}

// ============================================================================
// Packages
// ============================================================================

export interface PackageSummary {
  name: string;
  version: string | null;
  description: string | null;
  provider: string | null;
}

export interface PackageInfo {
  name: string;
  version: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
  repository: string | null;
  author: string | null;
  publisher: string | null;
}

export interface VersionInfo {
  version: string;
  releasedAt: string | null;
  yanked: boolean | null;
}

export interface Dependency {
  name: string;
  versionReq: string | null;
  depType: string | null;
}

export interface InstalledPackage {
  name: string;
  version: string;
  provider: string | null;
}

export interface UpdateInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export interface InstallReceipt {
  name: string;
  version: string;
  provider: string;
}

// ============================================================================
// File System
// ============================================================================

export interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
}

export interface FileExistsResult {
  exists: boolean;
  isDir: boolean;
}

// ============================================================================
// HTTP
// ============================================================================

export interface HttpResponse {
  status: number;
  body: string;
}

// ============================================================================
// Process
// ============================================================================

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ============================================================================
// Cache
// ============================================================================

export interface CacheInfo {
  cacheDir: string;
  totalSize: number;
  totalSizeHuman: string;
}

// ============================================================================
// i18n
// ============================================================================

export interface LocaleInfo {
  locale: string;
  strings: Record<string, string>;
}
