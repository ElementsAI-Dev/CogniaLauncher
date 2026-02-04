import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Check if running in Tauri environment
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function getAppVersion(): Promise<string | null> {
  if (typeof window === 'undefined' || !isTauri()) {
    return null;
  }

  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch (error) {
    console.error('Failed to get app version:', error);
    return null;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open external link:', error);
  }
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
  provider_id: string;
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
  enabled: boolean;
}

export interface CacheInfo {
  download_cache: CacheStats;
  metadata_cache: CacheStats;
  total_size: number;
  total_size_human: string;
  max_size?: number;
  max_size_human?: string;
  usage_percent?: number;
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
export const envInstall = (envType: string, version: string, providerId?: string) => invoke<void>('env_install', { envType, version, providerId });
export const envUninstall = (envType: string, version: string) => invoke<void>('env_uninstall', { envType, version });
export const envUseGlobal = (envType: string, version: string) => invoke<void>('env_use_global', { envType, version });
export const envUseLocal = (envType: string, version: string, projectPath: string) => invoke<void>('env_use_local', { envType, version, projectPath });
export const envDetect = (envType: string, startPath: string) => invoke<DetectedEnvironment | null>('env_detect', { envType, startPath });
export const envDetectAll = (startPath: string) => invoke<DetectedEnvironment[]>('env_detect_all', { startPath });
export const envAvailableVersions = (envType: string) => invoke<VersionInfo[]>('env_available_versions', { envType });
export const envListProviders = () => invoke<EnvironmentProviderInfo[]>('env_list_providers');

// Environment settings commands
export interface EnvVariableConfig {
  key: string;
  value: string;
  enabled: boolean;
}

export interface DetectionFileConfig {
  file_name: string;
  enabled: boolean;
}

export interface EnvironmentSettingsConfig {
  env_type: string;
  env_variables: EnvVariableConfig[];
  detection_files: DetectionFileConfig[];
  auto_switch: boolean;
}

export const envSaveSettings = (settings: EnvironmentSettingsConfig) => 
  invoke<void>('env_save_settings', { settings });

export const envLoadSettings = (envType: string) => 
  invoke<EnvironmentSettingsConfig | null>('env_load_settings', { envType });

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

// Cache access stats
export const getCacheAccessStats = () => invoke<CacheAccessStats>('get_cache_access_stats');
export const resetCacheAccessStats = () => invoke<void>('reset_cache_access_stats');

// Cache entry browser
export const listCacheEntries = (options?: {
  entryType?: string;
  search?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}) => invoke<CacheEntryList>('list_cache_entries', options ?? {});
export const deleteCacheEntry = (key: string, useTrash?: boolean) => 
  invoke<boolean>('delete_cache_entry', { key, useTrash });
export const deleteCacheEntries = (keys: string[], useTrash?: boolean) => 
  invoke<number>('delete_cache_entries', { keys, useTrash });

// Hot files (top accessed)
export const getTopAccessedEntries = (limit?: number) => 
  invoke<CacheEntryItem[]>('get_top_accessed_entries', { limit });

// Cache access stats types
export interface CacheAccessStats {
  hits: number;
  misses: number;
  hit_rate: number;
  total_requests: number;
  last_reset: string | null;
}

// Cache entry browser types
export interface CacheEntryItem {
  key: string;
  file_path: string;
  size: number;
  size_human: string;
  checksum: string;
  entry_type: string;
  created_at: string;
  last_accessed: string | null;
  hit_count: number;
}

export interface CacheEntryList {
  entries: CacheEntryItem[];
  total_count: number;
  has_more: boolean;
}

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
  metadata_cache_ttl: number;
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

// Self update
export interface SelfUpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_notes: string | null;
}

export interface SelfUpdateProgressEvent {
  progress: number | null;
  status: 'downloading' | 'installing' | 'done' | 'error';
}

export const selfCheckUpdate = () => invoke<SelfUpdateInfo>('self_check_update');
export const selfUpdate = () => invoke<void>('self_update');

export async function listenSelfUpdateProgress(
  callback: (progress: SelfUpdateProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<SelfUpdateProgressEvent>('self-update-progress', (event) => {
    callback(event.payload);
  });
}

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
  useRegex?: boolean;
  startTime?: number | null;
  endTime?: number | null;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  entries: LogEntry[];
  totalCount: number;
  hasMore: boolean;
}

export interface LogExportOptions {
  fileName?: string;
  levelFilter?: string[];
  search?: string;
  useRegex?: boolean;
  startTime?: number | null;
  endTime?: number | null;
  format?: 'txt' | 'json';
}

export interface LogExportResult {
  content: string;
  fileName: string;
}

export const logListFiles = () => invoke<LogFileInfo[]>('log_list_files');
export const logQuery = (options: LogQueryOptions) => invoke<LogQueryResult>('log_query', { options });
export const logClear = (fileName?: string) => invoke<void>('log_clear', { fileName });
export const logGetDir = () => invoke<string>('log_get_dir');
export const logExport = (options: LogExportOptions) => invoke<LogExportResult>('log_export', { options });

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

// ===== Download Manager Types and Commands =====

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number;
  speedHuman: string;
  percent: number;
  etaSecs: number | null;
  etaHuman: string | null;
  downloadedHuman: string;
  totalHuman: string | null;
}

export interface DownloadTask {
  id: string;
  url: string;
  name: string;
  destination: string;
  state: 'queued' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'failed';
  progress: DownloadProgress;
  error: string | null;
  provider: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DownloadQueueStats {
  totalTasks: number;
  queued: number;
  downloading: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalBytes: number;
  downloadedBytes: number;
  totalHuman: string;
  downloadedHuman: string;
  overallProgress: number;
}

export interface DownloadHistoryRecord {
  id: string;
  url: string;
  filename: string;
  destination: string;
  size: number;
  sizeHuman: string;
  checksum: string | null;
  startedAt: string;
  completedAt: string;
  durationSecs: number;
  durationHuman: string;
  averageSpeed: number;
  speedHuman: string;
  status: 'completed' | 'failed' | 'cancelled';
  error: string | null;
  provider: string | null;
}

export interface DownloadHistoryStats {
  totalCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  totalBytes: number;
  totalBytesHuman: string;
  averageSpeed: number;
  averageSpeedHuman: string;
  successRate: number;
}

export interface DiskSpaceInfo {
  total: number;
  available: number;
  used: number;
  usagePercent: number;
  totalHuman: string;
  availableHuman: string;
  usedHuman: string;
}

export interface DownloadRequest {
  url: string;
  destination: string;
  name: string;
  checksum?: string;
  priority?: number;
  provider?: string;
}

// Download event types
export type DownloadEvent =
  | { type: 'task_added'; task_id: string }
  | { type: 'task_started'; task_id: string }
  | { type: 'task_progress'; task_id: string; progress: DownloadProgress }
  | { type: 'task_completed'; task_id: string }
  | { type: 'task_failed'; task_id: string; error: string }
  | { type: 'task_paused'; task_id: string }
  | { type: 'task_resumed'; task_id: string }
  | { type: 'task_cancelled'; task_id: string }
  | { type: 'queue_updated'; stats: DownloadQueueStats };

// Download commands
export const downloadAdd = (request: DownloadRequest) =>
  invoke<string>('download_add', { request });

export const downloadGet = (taskId: string) =>
  invoke<DownloadTask | null>('download_get', { taskId });

export const downloadList = () =>
  invoke<DownloadTask[]>('download_list');

export const downloadStats = () =>
  invoke<DownloadQueueStats>('download_stats');

export const downloadPause = (taskId: string) =>
  invoke<void>('download_pause', { taskId });

export const downloadResume = (taskId: string) =>
  invoke<void>('download_resume', { taskId });

export const downloadCancel = (taskId: string) =>
  invoke<void>('download_cancel', { taskId });

export const downloadRemove = (taskId: string) =>
  invoke<boolean>('download_remove', { taskId });

export const downloadPauseAll = () =>
  invoke<number>('download_pause_all');

export const downloadResumeAll = () =>
  invoke<number>('download_resume_all');

export const downloadCancelAll = () =>
  invoke<number>('download_cancel_all');

export const downloadClearFinished = () =>
  invoke<number>('download_clear_finished');

export const downloadRetryFailed = () =>
  invoke<number>('download_retry_failed');

export const downloadSetSpeedLimit = (bytesPerSecond: number) =>
  invoke<void>('download_set_speed_limit', { bytesPerSecond });

export const downloadGetSpeedLimit = () =>
  invoke<number>('download_get_speed_limit');

export const downloadSetMaxConcurrent = (max: number) =>
  invoke<void>('download_set_max_concurrent', { max });

// Download history commands
export const downloadHistoryList = (limit?: number) =>
  invoke<DownloadHistoryRecord[]>('download_history_list', { limit });

export const downloadHistorySearch = (query: string) =>
  invoke<DownloadHistoryRecord[]>('download_history_search', { query });

export const downloadHistoryStats = () =>
  invoke<DownloadHistoryStats>('download_history_stats');

export const downloadHistoryClear = (days?: number) =>
  invoke<number>('download_history_clear', { days });

export const downloadHistoryRemove = (id: string) =>
  invoke<boolean>('download_history_remove', { id });

// Disk space commands
export const diskSpaceGet = (path: string) =>
  invoke<DiskSpaceInfo>('disk_space_get', { path });

export const diskSpaceCheck = (path: string, required: number) =>
  invoke<boolean>('disk_space_check', { path, required });

// Download event listeners
export async function listenDownloadTaskAdded(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-added', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskStarted(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-started', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskProgress(
  callback: (taskId: string, progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string; progress: DownloadProgress }>(
    'download-task-progress',
    (event) => {
      callback(event.payload.task_id, event.payload.progress);
    }
  );
}

export async function listenDownloadTaskCompleted(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-completed', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskFailed(
  callback: (taskId: string, error: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string; error: string }>('download-task-failed', (event) => {
    callback(event.payload.task_id, event.payload.error);
  });
}

export async function listenDownloadTaskPaused(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-paused', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskResumed(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-resumed', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskCancelled(
  callback: (taskId: string) => void
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>('download-task-cancelled', (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadQueueUpdated(
  callback: (stats: DownloadQueueStats) => void
): Promise<UnlistenFn> {
  return listen<{ stats: DownloadQueueStats }>('download-queue-updated', (event) => {
    callback(event.payload.stats);
  });
}

// ===== System Tray Types and Commands =====

export type TrayIconState = 'normal' | 'downloading' | 'update' | 'error';
export type TrayLanguage = 'en' | 'zh';
export type TrayClickBehavior = 'toggle_window' | 'show_menu' | 'do_nothing';

export interface TrayStateInfo {
  icon_state: TrayIconState;
  language: TrayLanguage;
  active_downloads: number;
  has_update: boolean;
  click_behavior: TrayClickBehavior;
}

// Tray commands
export const traySetIconState = (iconState: TrayIconState) =>
  invoke<void>('tray_set_icon_state', { iconState });

export const trayUpdateTooltip = () =>
  invoke<void>('tray_update_tooltip');

export const traySetActiveDownloads = (count: number) =>
  invoke<void>('tray_set_active_downloads', { count });

export const traySetHasUpdate = (hasUpdate: boolean) =>
  invoke<void>('tray_set_has_update', { hasUpdate });

export const traySetLanguage = (language: TrayLanguage) =>
  invoke<void>('tray_set_language', { language });

export const traySetClickBehavior = (behavior: TrayClickBehavior) =>
  invoke<void>('tray_set_click_behavior', { behavior });

export const trayGetState = () =>
  invoke<TrayStateInfo>('tray_get_state');

export const trayIsAutostartEnabled = () =>
  invoke<boolean>('tray_is_autostart_enabled');

export const trayEnableAutostart = () =>
  invoke<void>('tray_enable_autostart');

export const trayDisableAutostart = () =>
  invoke<void>('tray_disable_autostart');

export const traySendNotification = (title: string, body: string) =>
  invoke<void>('tray_send_notification', { title, body });

export const trayRebuild = () =>
  invoke<void>('tray_rebuild');

// Listen for navigation events from tray
export async function listenNavigate(
  callback: (path: string) => void
): Promise<UnlistenFn> {
  return listen<string>('navigate', (event) => {
    callback(event.payload);
  });
}

// Listen for check-updates events from tray
export async function listenCheckUpdates(
  callback: () => void
): Promise<UnlistenFn> {
  return listen<void>('check-updates', () => {
    callback();
  });
}

// ============================================================================
// Custom Detection Rules Types and Commands
// ============================================================================

/** Extraction strategy types */
export type ExtractionStrategy =
  | { type: 'regex'; pattern: string; multiline?: boolean }
  | { type: 'json_path'; path: string }
  | { type: 'toml_path'; path: string }
  | { type: 'yaml_path'; path: string }
  | { type: 'xml_path'; path: string }
  | { type: 'plain_text'; strip_prefix?: string; strip_suffix?: string }
  | { type: 'tool_versions'; tool_name: string }
  | { type: 'ini_key'; section?: string; key: string }
  | { type: 'command'; cmd: string; args: string[]; output_pattern: string };

/** Version transformation options */
export interface VersionTransform {
  match_pattern?: string;
  replace_template?: string;
  strip_version_prefix?: boolean;
  normalize_semver?: boolean;
}

/** Custom detection rule */
export interface CustomDetectionRule {
  id: string;
  name: string;
  description?: string;
  env_type: string;
  priority: number;
  enabled: boolean;
  file_patterns: string[];
  extraction: ExtractionStrategy;
  version_transform?: VersionTransform;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

/** Result of custom rule detection */
export interface CustomDetectionResult {
  rule_id: string;
  rule_name: string;
  env_type: string;
  version: string;
  source_file: string;
  raw_version: string;
}

/** Result of testing a rule */
export interface TestRuleResult {
  success: boolean;
  version?: string;
  source_file?: string;
  raw_version?: string;
  error?: string;
  duration_ms: number;
}

/** Regex validation result */
export interface RegexValidation {
  valid: boolean;
  error?: string;
  has_capture_group: boolean;
  suggestion?: string;
}

/** Import result */
export interface ImportRulesResult {
  imported: number;
  updated: number;
  skipped: number;
}

/** Extraction type info */
export interface ExtractionTypeInfo {
  type_name: string;
  display_name: string;
  description: string;
  example: string;
}

// Custom Detection Rule Commands

/** List all custom detection rules */
export const customRuleList = () =>
  invoke<CustomDetectionRule[]>('custom_rule_list');

/** Get a specific rule by ID */
export const customRuleGet = (ruleId: string) =>
  invoke<CustomDetectionRule | null>('custom_rule_get', { ruleId });

/** Add a new custom detection rule */
export const customRuleAdd = (rule: CustomDetectionRule) =>
  invoke<void>('custom_rule_add', { rule });

/** Update an existing rule */
export const customRuleUpdate = (rule: CustomDetectionRule) =>
  invoke<void>('custom_rule_update', { rule });

/** Delete a rule */
export const customRuleDelete = (ruleId: string) =>
  invoke<void>('custom_rule_delete', { ruleId });

/** Enable or disable a rule */
export const customRuleToggle = (ruleId: string, enabled: boolean) =>
  invoke<void>('custom_rule_toggle', { ruleId, enabled });

/** Get preset rules (built-in templates) */
export const customRulePresets = () =>
  invoke<CustomDetectionRule[]>('custom_rule_presets');

/** Import preset rules by their IDs */
export const customRuleImportPresets = (presetIds: string[]) =>
  invoke<string[]>('custom_rule_import_presets', { presetIds });

/** Detect version using custom rules for a specific environment */
export const customRuleDetect = (envType: string, startPath: string) =>
  invoke<CustomDetectionResult | null>('custom_rule_detect', { envType, startPath });

/** Detect all versions using custom rules */
export const customRuleDetectAll = (startPath: string) =>
  invoke<CustomDetectionResult[]>('custom_rule_detect_all', { startPath });

/** Test a rule against a specific file */
export const customRuleTest = (rule: CustomDetectionRule, testPath: string) =>
  invoke<TestRuleResult>('custom_rule_test', { rule, testPath });

/** Validate a regex pattern */
export const customRuleValidateRegex = (pattern: string) =>
  invoke<RegexValidation>('custom_rule_validate_regex', { pattern });

/** Export rules to JSON string */
export const customRuleExport = () =>
  invoke<string>('custom_rule_export');

/** Import rules from JSON string */
export const customRuleImport = (json: string, overwrite: boolean = false) =>
  invoke<ImportRulesResult>('custom_rule_import', { json, overwrite });

/** List rules for a specific environment type */
export const customRuleListByEnv = (envType: string) =>
  invoke<CustomDetectionRule[]>('custom_rule_list_by_env', { envType });

/** Get supported extraction strategy types */
export const customRuleExtractionTypes = () =>
  invoke<ExtractionTypeInfo[]>('custom_rule_extraction_types');

// ============================================================================
// Health Check Types and Commands
// ============================================================================

/** Health status of an environment */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

/** Severity level of a health issue */
export type Severity = 'info' | 'warning' | 'error' | 'critical';

/** Category of health issue */
export type IssueCategory =
  | 'path_conflict'
  | 'version_mismatch'
  | 'missing_dependency'
  | 'config_error'
  | 'permission_error'
  | 'network_error'
  | 'provider_not_found'
  | 'shell_integration'
  | 'other';

/** A single health issue */
export interface HealthIssue {
  severity: Severity;
  category: IssueCategory;
  message: string;
  details: string | null;
  fix_command: string | null;
  fix_description: string | null;
}

/** Result of a health check for a single environment */
export interface EnvironmentHealthResult {
  env_type: string;
  provider_id: string | null;
  status: HealthStatus;
  issues: HealthIssue[];
  suggestions: string[];
  checked_at: string;
}

/** Result of a full system health check */
export interface SystemHealthResult {
  overall_status: HealthStatus;
  environments: EnvironmentHealthResult[];
  system_issues: HealthIssue[];
  checked_at: string;
}

/** Check health of all environments */
export const healthCheckAll = () =>
  invoke<SystemHealthResult>('health_check_all');

/** Check health of a specific environment */
export const healthCheckEnvironment = (envType: string) =>
  invoke<EnvironmentHealthResult>('health_check_environment', { envType });

// ============================================================================
// Environment Profiles Types and Commands
// ============================================================================

/** An environment version specification within a profile */
export interface ProfileEnvironment {
  env_type: string;
  version: string;
  provider_id: string | null;
}

/** An environment profile containing multiple environment configurations */
export interface EnvironmentProfile {
  id: string;
  name: string;
  description: string | null;
  environments: ProfileEnvironment[];
  created_at: string;
  updated_at: string;
}

/** Result of applying a profile */
export interface ProfileApplyResult {
  profile_id: string;
  profile_name: string;
  successful: ProfileEnvironmentResult[];
  failed: ProfileEnvironmentError[];
  skipped: ProfileEnvironmentSkipped[];
}

export interface ProfileEnvironmentResult {
  env_type: string;
  version: string;
  provider_id: string;
}

export interface ProfileEnvironmentError {
  env_type: string;
  version: string;
  error: string;
}

export interface ProfileEnvironmentSkipped {
  env_type: string;
  version: string;
  reason: string;
}

/** List all profiles */
export const profileList = () =>
  invoke<EnvironmentProfile[]>('profile_list');

/** Get a profile by ID */
export const profileGet = (id: string) =>
  invoke<EnvironmentProfile | null>('profile_get', { id });

/** Create a new profile */
export const profileCreate = (
  name: string,
  description: string | null,
  environments: ProfileEnvironment[]
) =>
  invoke<EnvironmentProfile>('profile_create', { name, description, environments });

/** Update an existing profile */
export const profileUpdate = (profile: EnvironmentProfile) =>
  invoke<EnvironmentProfile>('profile_update', { profile });

/** Delete a profile */
export const profileDelete = (id: string) =>
  invoke<void>('profile_delete', { id });

/** Apply a profile (switch to all specified versions) */
export const profileApply = (id: string) =>
  invoke<ProfileApplyResult>('profile_apply', { id });

/** Export a profile to JSON */
export const profileExport = (id: string) =>
  invoke<string>('profile_export', { id });

/** Import a profile from JSON */
export const profileImport = (json: string) =>
  invoke<EnvironmentProfile>('profile_import', { json });

/** Create a profile from current environment state */
export const profileCreateFromCurrent = (name: string) =>
  invoke<EnvironmentProfile>('profile_create_from_current', { name });
