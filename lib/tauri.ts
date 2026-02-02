import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Check if running in Tauri environment
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Environment installation progress event payload
export interface EnvInstallProgressEvent {
  envType: string;
  version: string;
  step: 'fetching' | 'downloading' | 'extracting' | 'configuring' | 'done' | 'error';
  progress: number;
  downloadedSize?: number;
  totalSize?: number;
  speed?: number;
  error?: string;
}

// Listen for environment install progress events
export async function listenEnvInstallProgress(
  callback: (progress: EnvInstallProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<EnvInstallProgressEvent>('env-install-progress', (event) => {
    callback(event.payload);
  });
}

// Cancel an ongoing environment installation
export const envInstallCancel = (envType: string, version: string) => 
  invoke<boolean>('env_install_cancel', { envType, version });

// Resolve a version alias (lts, latest, stable) to an actual version number
export const envResolveAlias = (envType: string, alias: string) =>
  invoke<string>('env_resolve_alias', { envType, alias });

export interface EnvironmentInfo {
  env_type: string;
  provider: string;
  current_version: string | null;
  installed_versions: InstalledVersion[];
  available: boolean;
}

export interface InstalledVersion {
  version: string;
  install_path: string;
  size: number | null;
  installed_at: string | null;
  is_current: boolean;
}

export interface DetectedEnvironment {
  env_type: string;
  version: string;
  source: string;
  source_path: string | null;
}

export interface PackageSummary {
  name: string;
  description: string | null;
  latest_version: string | null;
  provider: string;
}

export interface PackageInfo {
  name: string;
  display_name: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
  repository: string | null;
  versions: VersionInfo[];
  provider: string;
}

export interface VersionInfo {
  version: string;
  release_date: string | null;
  deprecated: boolean;
  yanked: boolean;
}

export interface InstalledPackage {
  name: string;
  version: string;
  provider: string;
  install_path: string;
  installed_at: string;
  is_global: boolean;
}

export interface ProviderInfo {
  id: string;
  display_name: string;
  capabilities: string[];
  platforms: string[];
  priority: number;
  is_environment_provider: boolean;
}

export interface CacheInfo {
  download_cache: CacheStats;
  metadata_cache: CacheStats;
  total_size: number;
  total_size_human: string;
}

export interface CacheStats {
  entry_count: number;
  size: number;
  size_human: string;
  location: string;
}

export interface PlatformInfo {
  os: string;
  arch: string;
}

// Environment commands
export const envList = () => invoke<EnvironmentInfo[]>('env_list');
export const envGet = (envType: string) => invoke<EnvironmentInfo>('env_get', { envType });
export const envInstall = (envType: string, version: string) => invoke<void>('env_install', { envType, version });
export const envUninstall = (envType: string, version: string) => invoke<void>('env_uninstall', { envType, version });
export const envUseGlobal = (envType: string, version: string) => invoke<void>('env_use_global', { envType, version });
export const envUseLocal = (envType: string, version: string, projectPath: string) => invoke<void>('env_use_local', { envType, version, projectPath });
export const envDetect = (envType: string, startPath: string) => invoke<DetectedEnvironment | null>('env_detect', { envType, startPath });
export const envDetectAll = (startPath: string) => invoke<DetectedEnvironment[]>('env_detect_all', { startPath });
export const envAvailableVersions = (envType: string) => invoke<VersionInfo[]>('env_available_versions', { envType });
export const envListProviders = () => invoke<EnvironmentProviderInfo[]>('env_list_providers');

export interface EnvironmentProviderInfo {
  id: string;
  display_name: string;
  env_type: string;
  description: string;
}

// Package commands
export const packageSearch = (query: string, provider?: string) => invoke<PackageSummary[]>('package_search', { query, provider });
export const packageInfo = (name: string, provider?: string) => invoke<PackageInfo>('package_info', { name, provider });
export const packageInstall = (packages: string[]) => invoke<string[]>('package_install', { packages });
export const packageUninstall = (packages: string[]) => invoke<void>('package_uninstall', { packages });
export const packageList = (provider?: string) => invoke<InstalledPackage[]>('package_list', { provider });
export const providerList = () => invoke<ProviderInfo[]>('provider_list');

// Config commands
export const configGet = (key: string) => invoke<string | null>('config_get', { key });
export const configSet = (key: string, value: string) => invoke<void>('config_set', { key, value });
export const configList = () => invoke<[string, string][]>('config_list');
export const configReset = () => invoke<void>('config_reset');
export const getCogniaDir = () => invoke<string>('get_cognia_dir');
export const getPlatformInfo = () => invoke<PlatformInfo>('get_platform_info');

// Cache commands
export const cacheInfo = () => invoke<CacheInfo>('cache_info');
export const cacheClean = (cleanType?: string) => invoke<{ freed_bytes: number; freed_human: string }>('cache_clean', { cleanType });
export const cacheCleanPreview = (cleanType?: string) => invoke<CleanPreview>('cache_clean_preview', { cleanType });
export const cacheCleanEnhanced = (cleanType?: string, useTrash?: boolean) => 
  invoke<EnhancedCleanResult>('cache_clean_enhanced', { cleanType, useTrash });
export const cacheVerify = () => invoke<CacheVerificationResult>('cache_verify');
export const cacheRepair = () => invoke<CacheRepairResult>('cache_repair');
export const getCacheSettings = () => invoke<CacheSettings>('get_cache_settings');
export const setCacheSettings = (settings: CacheSettings) => invoke<void>('set_cache_settings', { newSettings: settings });
export const getCleanupHistory = (limit?: number) => invoke<CleanupRecord[]>('get_cleanup_history', { limit });
export const clearCleanupHistory = () => invoke<number>('clear_cleanup_history');
export const getCleanupSummary = () => invoke<CleanupHistorySummary>('get_cleanup_summary');

export interface CacheVerificationResult {
  valid_entries: number;
  missing_files: number;
  corrupted_files: number;
  size_mismatches: number;
  is_healthy: boolean;
  details: CacheIssue[];
}

export interface CacheIssue {
  entry_key: string;
  issue_type: string;
  description: string;
}

export interface CacheRepairResult {
  removed_entries: number;
  recovered_entries: number;
  freed_bytes: number;
  freed_human: string;
}

export interface CacheSettings {
  max_size: number;
  max_age_days: number;
  auto_clean: boolean;
}

// Clean preview types
export interface CleanPreviewItem {
  path: string;
  size: number;
  size_human: string;
  entry_type: string;
  created_at: string;
}

export interface CleanPreview {
  files: CleanPreviewItem[];
  total_count: number;
  total_size: number;
  total_size_human: string;
}

// Enhanced clean result
export interface EnhancedCleanResult {
  freed_bytes: number;
  freed_human: string;
  deleted_count: number;
  use_trash: boolean;
  history_id: string;
}

// Cleanup history types
export interface CleanedFileInfo {
  path: string;
  size: number;
  size_human: string;
  entry_type: string;
}

export interface CleanupRecord {
  id: string;
  timestamp: string;
  clean_type: string;
  use_trash: boolean;
  freed_bytes: number;
  freed_human: string;
  file_count: number;
  files: CleanedFileInfo[];
  files_truncated: boolean;
}

export interface CleanupHistorySummary {
  total_cleanups: number;
  total_freed_bytes: number;
  total_freed_human: string;
  total_files_cleaned: number;
  trash_cleanups: number;
  permanent_cleanups: number;
}

// Provider management commands
export const providerEnable = (providerId: string) => invoke<void>('provider_enable', { providerId });
export const providerDisable = (providerId: string) => invoke<void>('provider_disable', { providerId });
export const providerCheck = (providerId: string) => invoke<boolean>('provider_check', { providerId });
export const providerSystemList = () => invoke<string[]>('provider_system_list');
export const providerStatusAll = () => invoke<ProviderStatusInfo[]>('provider_status_all');

export interface ProviderStatusInfo {
  id: string;
  display_name: string;
  installed: boolean;
  platforms: string[];
}

// Batch operations
export interface BatchInstallOptions {
  packages: string[];
  dryRun?: boolean;
  parallel?: boolean;
  force?: boolean;
  global?: boolean;
}

// Batch progress events
export type BatchProgress =
  | { type: 'starting'; total: number }
  | { type: 'resolving'; package: string; current: number; total: number }
  | { type: 'downloading'; package: string; progress: number; current: number; total: number }
  | { type: 'installing'; package: string; current: number; total: number }
  | { type: 'item_completed'; package: string; success: boolean; current: number; total: number }
  | { type: 'completed'; result: BatchResult };

// Listen for batch progress events
export async function listenBatchProgress(
  callback: (progress: BatchProgress) => void
): Promise<UnlistenFn> {
  return listen<BatchProgress>('batch-progress', (event) => {
    callback(event.payload);
  });
}

export interface BatchResult {
  successful: BatchItemResult[];
  failed: BatchItemError[];
  skipped: BatchItemSkipped[];
  total_time_ms: number;
}

export interface BatchItemResult {
  name: string;
  version: string;
  provider: string;
  action: string;
}

export interface BatchItemError {
  name: string;
  error: string;
  recoverable: boolean;
  suggestion: string | null;
}

export interface BatchItemSkipped {
  name: string;
  reason: string;
}

export const batchInstall = (packages: string[], options?: Partial<BatchInstallOptions>) => 
  invoke<BatchResult>('batch_install', {
    packages,
    dryRun: options?.dryRun,
    parallel: options?.parallel,
    force: options?.force,
    global: options?.global,
  });

export const batchUninstall = (packages: string[], force?: boolean) =>
  invoke<BatchResult>('batch_uninstall', { packages, force });

export const batchUpdate = (packages?: string[]) =>
  invoke<BatchResult>('batch_update', { packages });

// Update checking commands
export interface UpdateInfo {
  name: string;
  current_version: string;
  latest_version: string;
  provider: string;
  update_type?: string;
}

export const checkUpdates = (packages?: string[]) => invoke<UpdateInfo[]>('check_updates', { packages });

// Package pinning
export const packagePin = (name: string, version?: string) => 
  invoke<void>('package_pin', { name, version });
export const packageUnpin = (name: string) => 
  invoke<void>('package_unpin', { name });
export const getPinnedPackages = () => 
  invoke<[string, string | null][]>('get_pinned_packages');

// Package rollback
export const packageRollback = (name: string, toVersion: string) =>
  invoke<void>('package_rollback', { name, toVersion });

// Install history
export interface InstallHistoryEntry {
  id: string;
  name: string;
  version: string;
  action: string;
  timestamp: string;
  provider: string;
  success: boolean;
  error_message: string | null;
}

export const getInstallHistory = (limit?: number) =>
  invoke<InstallHistoryEntry[]>('get_install_history', { limit });

export const getPackageHistory = (name: string) =>
  invoke<InstallHistoryEntry[]>('get_package_history', { name });

export const clearInstallHistory = () =>
  invoke<void>('clear_install_history');

// Dependency resolution
export interface DependencyNode {
  name: string;
  version: string;
  constraint: string;
  provider: string | null;
  dependencies: DependencyNode[];
  is_direct: boolean;
  is_installed: boolean;
  is_conflict: boolean;
  conflict_reason: string | null;
  depth: number;
}

export interface ResolutionResult {
  success: boolean;
  packages: ResolvedPackage[];
  tree: DependencyNode[];
  conflicts: ConflictInfo[];
  install_order: string[];
  total_packages: number;
  total_size: number | null;
}

export interface ResolvedPackage {
  name: string;
  version: string;
  provider: string;
}

export interface ConflictInfo {
  package_name: string;
  package?: string;
  required_by: string[];
  versions: string[];
  required_versions?: RequiredVersion[];
  message?: string;
  resolution?: string;
}

export interface RequiredVersion {
  required_by: string;
  constraint: string;
}

export const resolveDependencies = (packages: string[]) =>
  invoke<ResolutionResult>('resolve_dependencies', { packages });

// Advanced search
export interface AdvancedSearchOptions {
  query: string;
  providers?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: SearchFilters;
}

export interface SearchFilters {
  hasUpdates?: boolean;
  installedOnly?: boolean;
  notInstalled?: boolean;
  license?: string[];
  minVersion?: string;
  maxVersion?: string;
}

export interface EnhancedSearchResult {
  packages: ScoredPackage[];
  total: number;
  page: number;
  page_size: number;
  facets: SearchFacets;
}

export interface ScoredPackage extends PackageSummary {
  score: number;
  match_type: string;
  is_installed: boolean;
  has_update: boolean;
}

export interface SearchFacets {
  providers: Record<string, number>;
  licenses: Record<string, number>;
}

export const advancedSearch = (options: AdvancedSearchOptions) =>
  invoke<EnhancedSearchResult>('advanced_search', { options });

export interface SearchSuggestion {
  text: string;
  suggestion_type: string;
  provider: string | null;
}

export const searchSuggestions = (query: string, limit?: number) =>
  invoke<SearchSuggestion[]>('search_suggestions', { query, limit });

// Package comparison
export interface PackageComparison {
  packages: PackageCompareItem[];
  features: FeatureComparison[];
  differences?: string[];
  common_features?: string[];
  recommendation?: string;
}

export interface PackageCompareItem {
  name: string;
  provider: string;
  version: string;
  latest_version: string | null;
  description: string | null;
  homepage: string | null;
  license: string | null;
  size?: number;
  updated_at?: string;
  dependencies?: string[];
  platforms?: string[];
  [key: string]: unknown; // Allow index access
}

export interface FeatureComparison {
  feature: string;
  values: (string | null)[];
}

export const comparePackages = (packages: [string, string | null][]) =>
  invoke<PackageComparison>('compare_packages', { packages });

// Environment creation
export const envCreate = (name: string, envType: string, version: string) => 
  invoke<void>('env_create', { name, envType, version });

// Self update
export interface SelfUpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_notes: string | null;
}

export const selfCheckUpdate = () => invoke<SelfUpdateInfo>('self_check_update');
export const selfUpdate = () => invoke<void>('self_update');

// Manifest operations
export interface ManifestInfo {
  project_name: string | null;
  project_version: string | null;
  environments: Record<string, string>;
  packages: string[];
  path: string;
}

export const manifestRead = (projectPath?: string) => invoke<ManifestInfo | null>('manifest_read', { projectPath });
export const manifestInit = (projectPath?: string) => invoke<void>('manifest_init', { projectPath });

// Log operations
export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modified: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
  lineNumber: number;
}

export interface LogQueryOptions {
  fileName?: string;
  levelFilter?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  entries: LogEntry[];
  totalCount: number;
  hasMore: boolean;
}

export const logListFiles = () => invoke<LogFileInfo[]>('log_list_files');
export const logQuery = (options: LogQueryOptions) => invoke<LogQueryResult>('log_query', { options });
export const logClear = (fileName?: string) => invoke<void>('log_clear', { fileName });
export const logGetDir = () => invoke<string>('log_get_dir');

// Command output streaming event
export interface CommandOutputEvent {
  commandId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export async function listenCommandOutput(
  callback: (event: CommandOutputEvent) => void
): Promise<UnlistenFn> {
  return listen<CommandOutputEvent>('command-output', (event) => {
    callback(event.payload);
  });
}
