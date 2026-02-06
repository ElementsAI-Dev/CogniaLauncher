import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Re-export all types from types/tauri.ts
export type {
  EnvInstallProgressEvent,
  EnvironmentInfo,
  InstalledVersion,
  DetectedEnvironment,
  EnvironmentProviderInfo,
  EnvVariableConfig,
  DetectionFileConfig,
  EnvironmentSettingsConfig,
  SystemEnvironmentInfo,
  EnvironmentTypeMapping,
  PackageSummary,
  PackageInfo,
  VersionInfo,
  InstalledPackage,
  ProviderInfo,
  ProviderStatusInfo,
  CacheInfo,
  CacheStats,
  CacheAccessStats,
  CacheEntryItem,
  CacheEntryList,
  CacheVerificationResult,
  CacheIssue,
  CacheRepairResult,
  CacheSettings,
  CleanPreviewItem,
  CleanPreview,
  EnhancedCleanResult,
  CleanedFileInfo,
  CleanupRecord,
  CleanupHistorySummary,
  PlatformInfo,
  BatchInstallOptions,
  BatchProgress,
  BatchResult,
  BatchItemResult,
  BatchItemError,
  BatchItemSkipped,
  UpdateInfo,
  SelfUpdateInfo,
  SelfUpdateProgressEvent,
  InstallHistoryEntry,
  DependencyNode,
  ResolutionResult,
  ResolvedPackage,
  ConflictInfo,
  RequiredVersion,
  AdvancedSearchOptions,
  SearchFilters,
  EnhancedSearchResult,
  ScoredPackage,
  SearchFacets,
  SearchSuggestion,
  PackageComparison,
  PackageCompareItem,
  FeatureComparison,
  ManifestInfo,
  LogFileInfo,
  LogEntry,
  LogQueryOptions,
  LogQueryResult,
  LogExportOptions,
  LogExportResult,
  CommandOutputEvent,
  DownloadProgress,
  DownloadTask,
  DownloadQueueStats,
  DownloadHistoryRecord,
  DownloadHistoryStats,
  DiskSpaceInfo,
  DownloadRequest,
  VerifyResult,
  DownloadEvent,
  TrayIconState,
  TrayLanguage,
  TrayClickBehavior,
  TrayStateInfo,
  ExtractionStrategy,
  VersionTransform,
  CustomDetectionRule,
  CustomDetectionResult,
  TestRuleResult,
  RegexValidation,
  ImportRulesResult,
  ExtractionTypeInfo,
  HealthStatus,
  Severity,
  IssueCategory,
  HealthIssue,
  EnvironmentHealthResult,
  PackageManagerHealthResult,
  SystemHealthResult,
  ProfileEnvironment,
  EnvironmentProfile,
  ProfileApplyResult,
  ProfileEnvironmentResult,
  ProfileEnvironmentError,
  ProfileEnvironmentSkipped,
} from '@/types/tauri';

import type {
  EnvInstallProgressEvent,
  EnvironmentInfo,
  DetectedEnvironment,
  EnvironmentProviderInfo,
  EnvironmentSettingsConfig,
  SystemEnvironmentInfo,
  EnvironmentTypeMapping,
  PackageSummary,
  PackageInfo,
  VersionInfo,
  InstalledPackage,
  ProviderInfo,
  ProviderStatusInfo,
  CacheInfo,
  CacheAccessStats,
  CacheEntryItem,
  CacheEntryList,
  CacheVerificationResult,
  CacheRepairResult,
  CacheSettings,
  CleanPreview,
  EnhancedCleanResult,
  CleanupRecord,
  CleanupHistorySummary,
  PlatformInfo,
  BatchProgress,
  BatchResult,
  BatchInstallOptions,
  UpdateInfo,
  SelfUpdateInfo,
  SelfUpdateProgressEvent,
  InstallHistoryEntry,
  ResolutionResult,
  AdvancedSearchOptions,
  EnhancedSearchResult,
  SearchSuggestion,
  PackageComparison,
  ManifestInfo,
  LogFileInfo,
  LogQueryOptions,
  LogQueryResult,
  LogExportOptions,
  LogExportResult,
  CommandOutputEvent,
  DownloadProgress,
  DownloadTask,
  DownloadQueueStats,
  DownloadHistoryRecord,
  DownloadHistoryStats,
  DiskSpaceInfo,
  DownloadRequest,
  VerifyResult,
  TrayIconState,
  TrayLanguage,
  TrayClickBehavior,
  TrayStateInfo,
  CustomDetectionRule,
  CustomDetectionResult,
  TestRuleResult,
  RegexValidation,
  ImportRulesResult,
  ExtractionTypeInfo,
  SystemHealthResult,
  EnvironmentHealthResult,
  PackageManagerHealthResult,
  EnvironmentProfile,
  ProfileEnvironment,
  ProfileApplyResult,
} from '@/types/tauri';

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
export const envSaveSettings = (settings: EnvironmentSettingsConfig) => 
  invoke<void>('env_save_settings', { settings });

export const envLoadSettings = (envType: string) => 
  invoke<EnvironmentSettingsConfig | null>('env_load_settings', { envType });

// System environment detection commands
export const envDetectSystemAll = () => 
  invoke<SystemEnvironmentInfo[]>('env_detect_system_all');

export const envDetectSystem = (envType: string) => 
  invoke<SystemEnvironmentInfo | null>('env_detect_system', { envType });

export const envGetTypeMapping = () => 
  invoke<EnvironmentTypeMapping>('env_get_type_mapping');

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

// External cache management
export interface ExternalCacheInfo {
  provider: string;
  displayName: string;
  cachePath: string;
  size: number;
  sizeHuman: string;
  isAvailable: boolean;
  canClean: boolean;
}

export interface ExternalCacheCleanResult {
  provider: string;
  displayName: string;
  freedBytes: number;
  freedHuman: string;
  success: boolean;
  error?: string;
}

export interface CombinedCacheStats {
  internalSize: number;
  internalSizeHuman: string;
  externalSize: number;
  externalSizeHuman: string;
  totalSize: number;
  totalSizeHuman: string;
  externalCaches: ExternalCacheInfo[];
}

export const discoverExternalCaches = () => 
  invoke<ExternalCacheInfo[]>('discover_external_caches');
export const cleanExternalCache = (provider: string, useTrash: boolean) => 
  invoke<ExternalCacheCleanResult>('clean_external_cache', { provider, useTrash });
export const cleanAllExternalCaches = (useTrash: boolean) => 
  invoke<ExternalCacheCleanResult[]>('clean_all_external_caches', { useTrash });
export const getCombinedCacheStats = () => 
  invoke<CombinedCacheStats>('get_combined_cache_stats');

// Cache size monitoring
export interface CacheSizeMonitor {
  internalSize: number;
  internalSizeHuman: string;
  externalSize: number;
  externalSizeHuman: string;
  totalSize: number;
  totalSizeHuman: string;
  maxSize: number;
  maxSizeHuman: string;
  usagePercent: number;
  threshold: number;
  exceedsThreshold: boolean;
  diskTotal: number;
  diskAvailable: number;
  diskAvailableHuman: string;
  externalCaches: ExternalCacheSizeInfo[];
}

export interface ExternalCacheSizeInfo {
  provider: string;
  displayName: string;
  size: number;
  sizeHuman: string;
  cachePath: string;
}

export const cacheSizeMonitor = (includeExternal?: boolean) =>
  invoke<CacheSizeMonitor>('cache_size_monitor', { includeExternal });

// Cache path management
export interface CachePathInfo {
  currentPath: string;
  defaultPath: string;
  isCustom: boolean;
  isSymlink: boolean;
  symlinkTarget: string | null;
  exists: boolean;
  writable: boolean;
  diskTotal: number;
  diskAvailable: number;
  diskAvailableHuman: string;
}

export const getCachePathInfo = () => invoke<CachePathInfo>('get_cache_path_info');
export const setCachePath = (newPath: string) => invoke<void>('set_cache_path', { newPath });
export const resetCachePath = () => invoke<string>('reset_cache_path');

// Cache migration
export interface MigrationValidation {
  isValid: boolean;
  sourceExists: boolean;
  sourceSize: number;
  sourceSizeHuman: string;
  sourceFileCount: number;
  destinationExists: boolean;
  destinationWritable: boolean;
  destinationSpaceAvailable: number;
  destinationSpaceHuman: string;
  hasEnoughSpace: boolean;
  isSameDrive: boolean;
  errors: string[];
  warnings: string[];
}

export interface MigrationResult {
  success: boolean;
  mode: string;
  source: string;
  destination: string;
  bytesMigrated: number;
  bytesMigratedHuman: string;
  filesCount: number;
  symlinkCreated: boolean;
  error: string | null;
}

export const cacheMigrationValidate = (destination: string) =>
  invoke<MigrationValidation>('cache_migration_validate', { destination });
export const cacheMigrate = (destination: string, mode: 'move' | 'move_and_link') =>
  invoke<MigrationResult>('cache_migrate', { destination, mode });

// Force clean
export const cacheForceClean = (useTrash?: boolean) =>
  invoke<EnhancedCleanResult>('cache_force_clean', { useTrash });
export const cacheForceCleanExternal = (provider: string, useCommand?: boolean, useTrash?: boolean) =>
  invoke<ExternalCacheCleanResult>('cache_force_clean_external', { provider, useCommand, useTrash });

// External cache paths
export interface ExternalCachePathInfo {
  provider: string;
  displayName: string;
  cachePath: string | null;
  exists: boolean;
  size: number;
  sizeHuman: string;
  isAvailable: boolean;
  hasCleanCommand: boolean;
  cleanCommand: string | null;
  envVarsChecked: string[];
}

export const getExternalCachePaths = () =>
  invoke<ExternalCachePathInfo[]>('get_external_cache_paths');

// Enhanced cache settings
export interface EnhancedCacheSettings {
  maxSize: number;
  maxAgeDays: number;
  metadataCacheTtl: number;
  autoClean: boolean;
  autoCleanThreshold: number;
  monitorInterval: number;
  monitorExternal: boolean;
}

export const getEnhancedCacheSettings = () =>
  invoke<EnhancedCacheSettings>('get_enhanced_cache_settings');
export const setEnhancedCacheSettings = (newSettings: EnhancedCacheSettings) =>
  invoke<void>('set_enhanced_cache_settings', { newSettings });

// Provider management commands
export const providerEnable = (providerId: string) => invoke<void>('provider_enable', { providerId });
export const providerDisable = (providerId: string) => invoke<void>('provider_disable', { providerId });
export const providerCheck = (providerId: string) => invoke<boolean>('provider_check', { providerId });
export const providerSystemList = () => invoke<string[]>('provider_system_list');
export const providerStatusAll = () => invoke<ProviderStatusInfo[]>('provider_status_all');

// Listen for batch progress events
export async function listenBatchProgress(
  callback: (progress: BatchProgress) => void
): Promise<UnlistenFn> {
  return listen<BatchProgress>('batch-progress', (event) => {
    callback(event.payload);
  });
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
export const getInstallHistory = (limit?: number) =>
  invoke<InstallHistoryEntry[]>('get_install_history', { limit });

export const getPackageHistory = (name: string) =>
  invoke<InstallHistoryEntry[]>('get_package_history', { name });

export const clearInstallHistory = () =>
  invoke<void>('clear_install_history');

// Dependency resolution
export const resolveDependencies = (packages: string[]) =>
  invoke<ResolutionResult>('resolve_dependencies', { packages });

// Advanced search
export const advancedSearch = (options: AdvancedSearchOptions) =>
  invoke<EnhancedSearchResult>('advanced_search', { options });

export const searchSuggestions = (query: string, limit?: number) =>
  invoke<SearchSuggestion[]>('search_suggestions', { query, limit });

// Package comparison
export const comparePackages = (packages: [string, string | null][]) =>
  invoke<PackageComparison>('compare_packages', { packages });

// Self update
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
export const manifestRead = (projectPath?: string) => invoke<ManifestInfo | null>('manifest_read', { projectPath });
export const manifestInit = (projectPath?: string) => invoke<void>('manifest_init', { projectPath });

// Log operations
export const logListFiles = () => invoke<LogFileInfo[]>('log_list_files');
export const logQuery = (options: LogQueryOptions) => invoke<LogQueryResult>('log_query', { options });
export const logClear = (fileName?: string) => invoke<void>('log_clear', { fileName });
export const logGetDir = () => invoke<string>('log_get_dir');
export const logExport = (options: LogExportOptions) => invoke<LogExportResult>('log_export', { options });

// Command output streaming event
export async function listenCommandOutput(
  callback: (event: CommandOutputEvent) => void
): Promise<UnlistenFn> {
  return listen<CommandOutputEvent>('command-output', (event) => {
    callback(event.payload);
  });
}

// ===== Download Manager Commands =====

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

export const downloadGetMaxConcurrent = () =>
  invoke<number>('download_get_max_concurrent');

export const downloadVerifyFile = (path: string, expectedChecksum: string) =>
  invoke<VerifyResult>('download_verify_file', { path, expectedChecksum });

export const downloadOpenFile = (path: string) =>
  invoke<void>('download_open_file', { path });

export const downloadRevealFile = (path: string) =>
  invoke<void>('download_reveal_file', { path });

export const downloadBatchPause = (taskIds: string[]) =>
  invoke<number>('download_batch_pause', { taskIds });

export const downloadBatchResume = (taskIds: string[]) =>
  invoke<number>('download_batch_resume', { taskIds });

export const downloadBatchCancel = (taskIds: string[]) =>
  invoke<number>('download_batch_cancel', { taskIds });

export const downloadBatchRemove = (taskIds: string[]) =>
  invoke<number>('download_batch_remove', { taskIds });

export const downloadShutdown = () =>
  invoke<void>('download_shutdown');

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

// ===== System Tray Commands =====

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

// ===== Custom Detection Rules Commands =====

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

// ===== Health Check Commands =====

/** Check health of all environments and package managers */
export const healthCheckAll = () =>
  invoke<SystemHealthResult>('health_check_all');

/** Check health of a specific environment */
export const healthCheckEnvironment = (envType: string) =>
  invoke<EnvironmentHealthResult>('health_check_environment', { envType });

/** Check health of all package managers */
export const healthCheckPackageManagers = () =>
  invoke<PackageManagerHealthResult[]>('health_check_package_managers');

// ===== Environment Profiles Commands =====

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

// ============================================================================
// GitHub Commands
// ============================================================================

import type {
  GitHubBranchInfo,
  GitHubTagInfo,
  GitHubReleaseInfo,
  GitHubAssetInfo,
  GitHubParsedRepo,
} from '@/types/github';

export type {
  GitHubBranchInfo,
  GitHubTagInfo,
  GitHubReleaseInfo,
  GitHubAssetInfo,
  GitHubParsedRepo,
};

/** Parse a GitHub URL or owner/repo string */
export const githubParseUrl = (url: string) =>
  invoke<GitHubParsedRepo | null>('github_parse_url', { url });

/** Validate if a repository exists */
export const githubValidateRepo = (repo: string) =>
  invoke<boolean>('github_validate_repo', { repo });

/** List branches from a repository */
export const githubListBranches = (repo: string) =>
  invoke<GitHubBranchInfo[]>('github_list_branches', { repo });

/** List tags from a repository */
export const githubListTags = (repo: string) =>
  invoke<GitHubTagInfo[]>('github_list_tags', { repo });

/** List releases from a repository */
export const githubListReleases = (repo: string) =>
  invoke<GitHubReleaseInfo[]>('github_list_releases', { repo });

/** Get assets for a specific release by tag */
export const githubGetReleaseAssets = (repo: string, tag: string) =>
  invoke<GitHubAssetInfo[]>('github_get_release_assets', { repo, tag });

/** Download a release asset to the download queue */
export const githubDownloadAsset = (
  repo: string,
  assetUrl: string,
  assetName: string,
  destination: string
) =>
  invoke<string>('github_download_asset', { repo, assetUrl, assetName, destination });

/** Download source archive (zip/tar.gz) to the download queue */
export const githubDownloadSource = (
  repo: string,
  refName: string,
  format: 'zip' | 'tar.gz',
  destination: string
) =>
  invoke<string>('github_download_source', { repo, refName, format, destination });
