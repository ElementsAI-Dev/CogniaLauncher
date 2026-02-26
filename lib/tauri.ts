import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '@/lib/platform';

// Re-export all types from types/tauri.ts
export type {
  EnvInstallProgressEvent,
  EnvVerifyResult,
  EnvUpdateCheckResult,
  EnvCleanupResult,
  CleanedVersion,
  GlobalPackageInfo,
  EnvMigrateResult,
  MigrateFailure,
  EolCycleInfo,
  EnvironmentInfo,
  InstalledVersion,
  DetectedEnvironment,
  EnvironmentProviderInfo,
  EnvVariableConfig,
  DetectionFileConfig,
  EnvironmentSettingsConfig,
  SystemEnvironmentInfo,
  EnvironmentTypeMapping,
  RustComponent,
  RustTarget,
  RustupShowInfo,
  RustupOverride,
  GoEnvInfo,
  GoCacheInfo,
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
  CacheOptimizeResult,
  CacheSizeSnapshot,
  CacheAutoCleanedEvent,
  CleanPreviewItem,
  CleanPreview,
  EnhancedCleanResult,
  CleanedFileInfo,
  CleanupRecord,
  CleanupHistorySummary,
  BackupContentType,
  BackupManifest,
  BackupInfo,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  IntegrityCheckResult,
  DatabaseInfo,
  GpuInfo,
  PlatformInfo,
  DiskInfo,
  NetworkInterfaceInfo,
  SystemProxyInfo,
  ProxyTestResult,
  ComponentInfo,
  BatteryInfo,
  BatchInstallOptions,
  BatchProgress,
  BatchResult,
  BatchItemResult,
  BatchItemError,
  BatchItemSkipped,
  UpdateInfo,
  UpdateCheckProgress,
  UpdateCheckError,
  UpdateCheckSummary,
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
  TrayMenuItemId,
  TrayMenuConfig,
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
  PathValidationResult,
  WslDistroStatus,
  WslStatus,
  WslVersionInfo,
  WslCapabilities,
  WslImportOptions,
  WslExecResult,
  WslDiskUsage,
  WslConfig,
  WslDistroConfig,
  WslMountOptions,
  WslDistroEnvironment,
  GitRepoInfo,
  GitCommitEntry,
  GitBranchInfo,
  GitRemoteInfo,
  GitTagInfo,
  GitStashEntry,
  GitContributor,
  GitBlameEntry,
  GitConfigEntry,
  GitStatusFile,
  GitCommitDetail,
  GitGraphEntry,
  GitAheadBehind,
  GitDayActivity,
  GitFileStatEntry,
  GitReflogEntry,
  GitCloneOptions,
  GitCloneProgress,
  LaunchRequest,
  LaunchResult,
  ActivationScript,
  EnvInfoResult,
  ShimInfo,
  PathStatusInfo,
  EnvVarScope,
  EnvFileFormat,
  PathEntryInfo,
  ShellProfileInfo,
  EnvVarImportResult,
  ShellType,
  ShellConfigFile,
  ShellInfo,
  TerminalProfile,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
  ShellConfigEntries,
  DiagnosticExportOptions,
  DiagnosticCaptureFrontendCrashOptions,
  DiagnosticExportResult,
  DiagnosticErrorContext,
  CrashInfo,
} from '@/types/tauri';

import type {
  EnvInstallProgressEvent,
  EnvVerifyResult,
  EnvUpdateCheckResult,
  EnvCleanupResult,
  GlobalPackageInfo,
  EnvMigrateResult,
  EolCycleInfo,
  EnvironmentInfo,
  InstalledVersion,
  DetectedEnvironment,
  EnvironmentProviderInfo,
  EnvironmentSettingsConfig,
  SystemEnvironmentInfo,
  EnvironmentTypeMapping,
  RustComponent,
  RustTarget,
  RustupShowInfo,
  RustupOverride,
  GoEnvInfo,
  GoCacheInfo,
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
  CacheOptimizeResult,
  CacheSizeSnapshot,
  CacheAutoCleanedEvent,
  CleanPreview,
  EnhancedCleanResult,
  CleanupRecord,
  CleanupHistorySummary,
  BackupContentType,
  BackupInfo,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  IntegrityCheckResult,
  DatabaseInfo,
  PlatformInfo,
  DiskInfo,
  NetworkInterfaceInfo,
  SystemProxyInfo,
  ProxyTestResult,
  ComponentInfo,
  BatteryInfo,
  BatchProgress,
  BatchResult,
  BatchInstallOptions,
  UpdateCheckProgress,
  UpdateCheckSummary,
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
  TrayMenuItemId,
  TrayMenuConfig,
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
  PathValidationResult,
  WslDistroStatus,
  WslStatus,
  WslVersionInfo,
  WslCapabilities,
  WslImportOptions,
  WslExecResult,
  WslDiskUsage,
  WslConfig,
  WslDistroConfig,
  WslMountOptions,
  WslDistroEnvironment,
  WslDistroResources,
  WslUser,
  WslPackageUpdateResult,
  GitRepoInfo,
  GitCommitEntry,
  GitBranchInfo,
  GitRemoteInfo,
  GitTagInfo,
  GitStashEntry,
  GitContributor,
  GitBlameEntry,
  GitConfigEntry,
  GitStatusFile,
  GitCommitDetail,
  GitGraphEntry,
  GitAheadBehind,
  GitDayActivity,
  GitFileStatEntry,
  GitReflogEntry,
  GitCloneOptions,
  GitCloneProgress,
  LaunchRequest,
  LaunchResult,
  ActivationScript,
  EnvInfoResult,
  ShimInfo,
  PathStatusInfo,
  EnvVarScope,
  EnvFileFormat,
  PathEntryInfo,
  ShellProfileInfo,
  EnvVarImportResult,
  ShellType,
  ShellInfo,
  TerminalProfile,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
  ShellConfigEntries,
  DiagnosticExportOptions,
  DiagnosticCaptureFrontendCrashOptions,
  DiagnosticExportResult,
  CrashInfo,
} from '@/types/tauri';

// Re-export so existing `import { isTauri } from '@/lib/tauri'` call-sites keep working.
export { isTauri };

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

// Environment verification and query commands
export const envVerifyInstall = (envType: string, version: string) =>
  invoke<EnvVerifyResult>('env_verify_install', { envType, version });

export const envInstalledVersions = (envType: string) =>
  invoke<InstalledVersion[]>('env_installed_versions', { envType });

export const envCurrentVersion = (envType: string) =>
  invoke<string | null>('env_current_version', { envType });

// Environment update checking & cleanup commands
export const envCheckUpdates = (envType: string) =>
  invoke<EnvUpdateCheckResult>('env_check_updates', { envType });

export const envCheckUpdatesAll = () =>
  invoke<EnvUpdateCheckResult[]>('env_check_updates_all');

export const envCleanupVersions = (envType: string, versionsToRemove: string[]) =>
  invoke<EnvCleanupResult>('env_cleanup_versions', { envType, versionsToRemove });

export const envListGlobalPackages = (envType: string, version: string, providerId?: string) =>
  invoke<GlobalPackageInfo[]>('env_list_global_packages', { envType, version, providerId });

export const envMigratePackages = (
  envType: string,
  fromVersion: string,
  toVersion: string,
  packages: string[],
  providerId?: string,
) => invoke<EnvMigrateResult>('env_migrate_packages', { envType, fromVersion, toVersion, packages, providerId });

export async function listenEnvMigrateProgress(
  callback: (progress: { envType: string; current: number; total: number; package: string }) => void
): Promise<UnlistenFn> {
  return listen<{ envType: string; current: number; total: number; package: string }>('env-migrate-progress', (event) => {
    callback(event.payload);
  });
}

// EOL (End-of-Life) data commands
export const envGetEolInfo = (envType: string) =>
  invoke<EolCycleInfo[]>('env_get_eol_info', { envType });

export const envGetVersionEol = (envType: string, version: string) =>
  invoke<EolCycleInfo | null>('env_get_version_eol', { envType, version });

// Rustup-specific commands
export const rustupListComponents = (toolchain?: string) =>
  invoke<RustComponent[]>('rustup_list_components', { toolchain });

export const rustupAddComponent = (component: string, toolchain?: string) =>
  invoke<void>('rustup_add_component', { component, toolchain });

export const rustupRemoveComponent = (component: string, toolchain?: string) =>
  invoke<void>('rustup_remove_component', { component, toolchain });

export const rustupListTargets = (toolchain?: string) =>
  invoke<RustTarget[]>('rustup_list_targets', { toolchain });

export const rustupAddTarget = (target: string, toolchain?: string) =>
  invoke<void>('rustup_add_target', { target, toolchain });

export const rustupRemoveTarget = (target: string, toolchain?: string) =>
  invoke<void>('rustup_remove_target', { target, toolchain });

export const rustupShow = () =>
  invoke<RustupShowInfo>('rustup_show');

export const rustupSelfUpdate = () =>
  invoke<void>('rustup_self_update');

export const rustupUpdateAll = () =>
  invoke<string>('rustup_update_all');

// Rustup override management
export const rustupOverrideSet = (toolchain: string, path?: string) =>
  invoke<void>('rustup_override_set', { toolchain, path });

export const rustupOverrideUnset = (path?: string) =>
  invoke<void>('rustup_override_unset', { path });

export const rustupOverrideList = () =>
  invoke<RustupOverride[]>('rustup_override_list');

// Rustup run, which, profile
export const rustupRun = (toolchain: string, command: string, args?: string[]) =>
  invoke<string>('rustup_run', { toolchain, command, args });

export const rustupWhich = (binary: string) =>
  invoke<string>('rustup_which', { binary });

export const rustupGetProfile = () =>
  invoke<string>('rustup_get_profile');

export const rustupSetProfile = (profile: string) =>
  invoke<void>('rustup_set_profile', { profile });

// Go-specific commands
export const goEnvInfo = () =>
  invoke<GoEnvInfo>('go_env_info');

export const goModTidy = (projectPath: string) =>
  invoke<string>('go_mod_tidy', { projectPath });

export const goModDownload = (projectPath: string) =>
  invoke<string>('go_mod_download', { projectPath });

export const goCleanCache = (cacheType: string) =>
  invoke<string>('go_clean_cache', { cacheType });

export const goCacheInfo = () =>
  invoke<GoCacheInfo>('go_cache_info');

// Package commands
export const packageSearch = (query: string, provider?: string) => invoke<PackageSummary[]>('package_search', { query, provider });
export const packageInfo = (name: string, provider?: string) => invoke<PackageInfo>('package_info', { name, provider });
export const packageInstall = (packages: string[]) => invoke<string[]>('package_install', { packages });
export const packageUninstall = (packages: string[]) => invoke<void>('package_uninstall', { packages });
export const packageList = (provider?: string) => invoke<InstalledPackage[]>('package_list', { provider });
export const providerList = () => invoke<ProviderInfo[]>('provider_list');
export const packageCheckInstalled = (name: string) => invoke<boolean>('package_check_installed', { name });
export const packageVersions = (name: string, provider?: string) => invoke<VersionInfo[]>('package_versions', { name, provider });

// App initialization status
export interface AppInitStatus {
  initialized: boolean;
  version: string;
}

export const appCheckInit = () => invoke<AppInitStatus>('app_check_init');

// Config commands
export const configGet = (key: string) => invoke<string | null>('config_get', { key });
export const configSet = (key: string, value: string) => invoke<void>('config_set', { key, value });
export const configList = () => invoke<[string, string][]>('config_list');
export const configReset = () => invoke<void>('config_reset');
export const configExport = () => invoke<string>('config_export');
export const configImport = (tomlContent: string) => invoke<void>('config_import', { tomlContent });
export const getCogniaDir = () => invoke<string>('get_cognia_dir');
export const getPlatformInfo = () => invoke<PlatformInfo>('get_platform_info');
export const getDiskInfo = () => invoke<DiskInfo[]>('get_disk_info');
export const getNetworkInterfaces = () => invoke<NetworkInterfaceInfo[]>('get_network_interfaces');
export const detectSystemProxy = () => invoke<SystemProxyInfo>('detect_system_proxy');
export const testProxyConnection = (proxyUrl: string, testUrl?: string) =>
  invoke<ProxyTestResult>('test_proxy_connection', { proxyUrl, testUrl });
export const getComponentsInfo = () => invoke<ComponentInfo[]>('get_components_info');
export const getBatteryInfo = () => invoke<BatteryInfo | null>('get_battery_info');

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
  category: string;
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

// Database optimization & size history
export const cacheOptimize = () =>
  invoke<CacheOptimizeResult>('cache_optimize');
export const getCacheSizeHistory = (days?: number) =>
  invoke<CacheSizeSnapshot[]>('get_cache_size_history', { days });

// Backup & database maintenance
export const backupCreate = (contents: BackupContentType[], note?: string) =>
  invoke<BackupResult>('backup_create', { contents, note });
export const backupRestore = (backupPath: string, contents: BackupContentType[]) =>
  invoke<RestoreResult>('backup_restore', { backupPath, contents });
export const backupList = () =>
  invoke<BackupInfo[]>('backup_list');
export const backupDelete = (backupPath: string) =>
  invoke<boolean>('backup_delete', { backupPath });
export const backupValidate = (backupPath: string) =>
  invoke<BackupValidationResult>('backup_validate', { backupPath });
export const dbIntegrityCheck = () =>
  invoke<IntegrityCheckResult>('db_integrity_check');
export const dbGetInfo = () =>
  invoke<DatabaseInfo>('db_get_info');

export async function listenCacheAutoCleaned(
  callback: (event: CacheAutoCleanedEvent) => void
): Promise<UnlistenFn> {
  return listen<CacheAutoCleanedEvent>('cache-auto-cleaned', (event) => {
    callback(event.payload);
  });
}

// Cache change events
export interface CacheChangedEvent {
  action: string;
  freedBytes: number;
  freedHuman: string;
}

export async function listenCacheChanged(
  callback: (event: CacheChangedEvent) => void
): Promise<UnlistenFn> {
  return listen<CacheChangedEvent>('cache-changed', (event) => {
    callback(event.payload);
  });
}

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
export const checkUpdates = (packages?: string[]) => invoke<UpdateCheckSummary>('check_updates', { packages });

// Listen for update check progress events
export async function listenUpdateCheckProgress(
  callback: (progress: UpdateCheckProgress) => void
): Promise<UnlistenFn> {
  return listen<UpdateCheckProgress>('update-check-progress', (event) => {
    callback(event.payload);
  });
}

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
export const logGetTotalSize = () => invoke<number>('log_get_total_size');

// Diagnostic commands
export const diagnosticExportBundle = (options: DiagnosticExportOptions) =>
  invoke<DiagnosticExportResult>('diagnostic_export_bundle', { options });
export const diagnosticCaptureFrontendCrash = (
  options: DiagnosticCaptureFrontendCrashOptions,
) => invoke<CrashInfo>('diagnostic_capture_frontend_crash', { options });
export const diagnosticGetDefaultExportPath = () =>
  invoke<string>('diagnostic_get_default_export_path');
export const diagnosticCheckLastCrash = () =>
  invoke<CrashInfo | null>('diagnostic_check_last_crash');
export const diagnosticDismissCrash = () =>
  invoke<void>('diagnostic_dismiss_crash');

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

export const downloadSetPriority = (taskId: string, priority: number) =>
  invoke<void>('download_set_priority', { taskId, priority });

export const downloadRetry = (taskId: string) =>
  invoke<void>('download_retry', { taskId });

export const downloadCalculateChecksum = (path: string) =>
  invoke<string>('download_calculate_checksum', { path });

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

/** Extract an archive to a destination directory */
export const downloadExtract = (archivePath: string, destPath: string) =>
  invoke<string[]>('download_extract', { archivePath, destPath });

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

export const traySetMinimizeToTray = (enabled: boolean) =>
  invoke<void>('tray_set_minimize_to_tray', { enabled });

export const traySetStartMinimized = (enabled: boolean) =>
  invoke<void>('tray_set_start_minimized', { enabled });

export const traySetAlwaysOnTop = (enabled: boolean) =>
  invoke<void>('tray_set_always_on_top', { enabled });

export const trayGetMenuConfig = () =>
  invoke<TrayMenuConfig>('tray_get_menu_config');

export const traySetMenuConfig = (config: TrayMenuConfig) =>
  invoke<void>('tray_set_menu_config', { config });

export const trayGetAvailableMenuItems = () =>
  invoke<TrayMenuItemId[]>('tray_get_available_menu_items');

export const trayResetMenuConfig = () =>
  invoke<void>('tray_reset_menu_config');

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

// Listen for download pause/resume events from tray
export async function listenDownloadPauseAll(
  callback: () => void
): Promise<UnlistenFn> {
  return listen<void>('download-pause-all', () => {
    callback();
  });
}

export async function listenDownloadResumeAll(
  callback: () => void
): Promise<UnlistenFn> {
  return listen<void>('download-resume-all', () => {
    callback();
  });
}

// Listen for always-on-top toggle from tray
export async function listenToggleAlwaysOnTop(
  callback: (enabled: boolean) => void
): Promise<UnlistenFn> {
  return listen<boolean>('toggle-always-on-top', (event) => {
    callback(event.payload);
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

/** Check health of a single package manager/provider */
export const healthCheckPackageManager = (providerId: string) =>
  invoke<PackageManagerHealthResult>('health_check_package_manager', { providerId });

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
  GitHubRepoInfoResponse,
} from '@/types/github';

export type {
  GitHubBranchInfo,
  GitHubTagInfo,
  GitHubReleaseInfo,
  GitHubAssetInfo,
  GitHubParsedRepo,
  GitHubRepoInfoResponse,
};

/** Parse a GitHub URL or owner/repo string */
export const githubParseUrl = (url: string) =>
  invoke<GitHubParsedRepo | null>('github_parse_url', { url });

/** Validate if a repository exists (with optional token for private repos) */
export const githubValidateRepo = (repo: string, token?: string) =>
  invoke<boolean>('github_validate_repo', { repo, token: token || null });

/** Get repository metadata (description, stars, license, etc.) */
export const githubGetRepoInfo = (repo: string, token?: string) =>
  invoke<GitHubRepoInfoResponse>('github_get_repo_info', { repo, token: token || null });

/** List branches from a repository */
export const githubListBranches = (repo: string, token?: string) =>
  invoke<GitHubBranchInfo[]>('github_list_branches', { repo, token: token || null });

/** List tags from a repository */
export const githubListTags = (repo: string, token?: string) =>
  invoke<GitHubTagInfo[]>('github_list_tags', { repo, token: token || null });

/** List releases from a repository */
export const githubListReleases = (repo: string, token?: string) =>
  invoke<GitHubReleaseInfo[]>('github_list_releases', { repo, token: token || null });

/** Get assets for a specific release by tag */
export const githubGetReleaseAssets = (repo: string, tag: string, token?: string) =>
  invoke<GitHubAssetInfo[]>('github_get_release_assets', { repo, tag, token: token || null });

/** Download a release asset to the download queue */
export const githubDownloadAsset = (
  repo: string,
  assetId: number,
  assetUrl: string,
  assetName: string,
  destination: string,
  token?: string
) =>
  invoke<string>('github_download_asset', {
    repo, assetId, assetUrl, assetName, destination, token: token || null,
  });

/** Download source archive (zip/tar.gz) to the download queue */
export const githubDownloadSource = (
  repo: string,
  refName: string,
  format: 'zip' | 'tar.gz',
  destination: string,
  token?: string
) =>
  invoke<string>('github_download_source', {
    repo, refName, format, destination, token: token || null,
  });

/** Save a GitHub token to settings */
export const githubSetToken = (token: string) =>
  invoke<void>('github_set_token', { token });

/** Get the saved GitHub token (from settings or env) */
export const githubGetToken = () =>
  invoke<string | null>('github_get_token');

/** Clear the saved GitHub token */
export const githubClearToken = () =>
  invoke<void>('github_clear_token');

/** Validate a GitHub token by making an authenticated API call */
export const githubValidateToken = (token: string) =>
  invoke<boolean>('github_validate_token', { token });

// ============================================================================
// GitLab Commands
// ============================================================================

import type {
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabReleaseInfo,
  GitLabAssetInfo,
  GitLabParsedProject,
  GitLabProjectInfo,
} from '@/types/gitlab';

export type {
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabReleaseInfo,
  GitLabAssetInfo,
  GitLabParsedProject,
  GitLabProjectInfo,
};

/** Parse a GitLab URL or owner/repo string */
export const gitlabParseUrl = (url: string) =>
  invoke<GitLabParsedProject | null>('gitlab_parse_url', { url });

/** Validate if a GitLab project exists (with optional token for private repos) */
export const gitlabValidateProject = (project: string, token?: string, instanceUrl?: string) =>
  invoke<boolean>('gitlab_validate_project', {
    project, token: token || null, instanceUrl: instanceUrl || null,
  });

/** Get GitLab project info */
export const gitlabGetProjectInfo = (project: string, token?: string, instanceUrl?: string) =>
  invoke<GitLabProjectInfo>('gitlab_get_project_info', {
    project, token: token || null, instanceUrl: instanceUrl || null,
  });

/** List branches from a GitLab project */
export const gitlabListBranches = (project: string, token?: string, instanceUrl?: string) =>
  invoke<GitLabBranchInfo[]>('gitlab_list_branches', {
    project, token: token || null, instanceUrl: instanceUrl || null,
  });

/** List tags from a GitLab project */
export const gitlabListTags = (project: string, token?: string, instanceUrl?: string) =>
  invoke<GitLabTagInfo[]>('gitlab_list_tags', {
    project, token: token || null, instanceUrl: instanceUrl || null,
  });

/** List releases from a GitLab project */
export const gitlabListReleases = (project: string, token?: string, instanceUrl?: string) =>
  invoke<GitLabReleaseInfo[]>('gitlab_list_releases', {
    project, token: token || null, instanceUrl: instanceUrl || null,
  });

/** Get assets for a specific GitLab release by tag */
export const gitlabGetReleaseAssets = (project: string, tag: string, token?: string, instanceUrl?: string) =>
  invoke<GitLabAssetInfo[]>('gitlab_get_release_assets', {
    project, tag, token: token || null, instanceUrl: instanceUrl || null,
  });

/** Download a GitLab release asset to the download queue */
export const gitlabDownloadAsset = (
  project: string,
  assetUrl: string,
  assetName: string,
  destination: string,
  token?: string,
  instanceUrl?: string
) =>
  invoke<string>('gitlab_download_asset', {
    project, assetUrl, assetName, destination,
    token: token || null, instanceUrl: instanceUrl || null,
  });

/** Download source archive from GitLab to the download queue */
export const gitlabDownloadSource = (
  project: string,
  refName: string,
  format: 'zip' | 'tar.gz' | 'tar.bz2' | 'tar',
  destination: string,
  token?: string,
  instanceUrl?: string
) =>
  invoke<string>('gitlab_download_source', {
    project, refName, format, destination,
    token: token || null, instanceUrl: instanceUrl || null,
  });

/** Save a GitLab token to settings */
export const gitlabSetToken = (token: string) =>
  invoke<void>('gitlab_set_token', { token });

/** Get the saved GitLab token (from settings or env) */
export const gitlabGetToken = () =>
  invoke<string | null>('gitlab_get_token');

/** Clear the saved GitLab token */
export const gitlabClearToken = () =>
  invoke<void>('gitlab_clear_token');

/** Validate a GitLab token by making an authenticated API call */
export const gitlabValidateToken = (token: string, instanceUrl?: string) =>
  invoke<boolean>('gitlab_validate_token', { token, instanceUrl: instanceUrl || null });

/** Save a custom GitLab instance URL to settings */
export const gitlabSetInstanceUrl = (url: string) =>
  invoke<void>('gitlab_set_instance_url', { url });

/** Get the saved GitLab instance URL */
export const gitlabGetInstanceUrl = () =>
  invoke<string | null>('gitlab_get_instance_url');

// ============================================================================
// Filesystem Utility Commands
// ============================================================================

/** Validate a filesystem path (existence, permissions, traversal, cross-platform) */
export const validatePath = (path: string, expectDirectory: boolean = true) =>
  invoke<PathValidationResult>('validate_path', { path, expectDirectory });

// ============================================================================
// WSL Commands
// ============================================================================

/** Check if WSL is available on this system */
export const wslIsAvailable = () =>
  invoke<boolean>('wsl_is_available');

/** List all installed WSL distributions with state and version */
export const wslListDistros = () =>
  invoke<WslDistroStatus[]>('wsl_list_distros');

/** List available WSL distributions from the online store */
export const wslListOnline = () =>
  invoke<[string, string][]>('wsl_list_online');

/** Get WSL system status (version, kernel, running distros) */
export const wslGetStatus = () =>
  invoke<WslStatus>('wsl_status');

/** Terminate a specific running WSL distribution */
export const wslTerminate = (name: string) =>
  invoke<void>('wsl_terminate', { name });

/** Shutdown all running WSL instances */
export const wslShutdown = () =>
  invoke<void>('wsl_shutdown');

/** Set the default WSL distribution */
export const wslSetDefault = (name: string) =>
  invoke<void>('wsl_set_default', { name });

/** Set WSL version (1 or 2) for a specific distribution */
export const wslSetVersion = (name: string, version: number) =>
  invoke<void>('wsl_set_version', { name, version });

/** Set the default WSL version for new installations */
export const wslSetDefaultVersion = (version: number) =>
  invoke<void>('wsl_set_default_version', { version });

/** Move a WSL distribution to a new location */
export const wslMoveDistro = (name: string, location: string) =>
  invoke<string>('wsl_move_distro', { name, location });

/** Resize a WSL distribution virtual disk */
export const wslResizeDistro = (name: string, size: string) =>
  invoke<string>('wsl_resize_distro', { name, size });

/** Export a WSL distribution to a tar/vhdx file */
export const wslExport = (name: string, filePath: string, asVhd?: boolean) =>
  invoke<void>('wsl_export', { name, filePath, asVhd });

/** Import a WSL distribution from a tar/vhdx file */
export const wslImport = (options: WslImportOptions) =>
  invoke<void>('wsl_import', { options });

/** Update the WSL kernel to the latest version */
export const wslUpdate = () =>
  invoke<string>('wsl_update');

/** Launch/start a WSL distribution */
export const wslLaunch = (name: string, user?: string) =>
  invoke<void>('wsl_launch', { name, user });

/** List currently running WSL distributions */
export const wslListRunning = () =>
  invoke<string[]>('wsl_list_running');

/** Execute a command inside a WSL distribution */
export const wslExec = (distro: string, command: string, user?: string) =>
  invoke<WslExecResult>('wsl_exec', { distro, command, user });

/** Convert a path between Windows and WSL formats */
export const wslConvertPath = (path: string, distro?: string, toWindows?: boolean) =>
  invoke<string>('wsl_convert_path', { path, distro, toWindows: toWindows ?? false });

/** Read the global .wslconfig file */
export const wslGetConfig = () =>
  invoke<WslConfig>('wsl_get_config');

/** Write or remove a setting in the global .wslconfig file */
export const wslSetConfig = (section: string, key: string, value?: string) =>
  invoke<void>('wsl_set_config', { section, key, value });

/** Get disk usage for a WSL distribution */
export const wslDiskUsage = (name: string) =>
  invoke<WslDiskUsage>('wsl_disk_usage', { name });

/** Import a distribution in-place from an existing .vhdx file */
export const wslImportInPlace = (name: string, vhdxPath: string) =>
  invoke<void>('wsl_import_in_place', { name, vhdxPath });

/** Mount a physical or virtual disk in WSL2 */
export const wslMount = (options: WslMountOptions) =>
  invoke<string>('wsl_mount', { options });

/** Unmount a previously mounted disk (or all if no path given) */
export const wslUnmount = (diskPath?: string) =>
  invoke<void>('wsl_unmount', { diskPath });

/** Get the IP address of a WSL distribution */
export const wslGetIp = (distro?: string) =>
  invoke<string>('wsl_get_ip', { distro });

/** Change the default user for a distribution */
export const wslChangeDefaultUser = (distro: string, username: string) =>
  invoke<void>('wsl_change_default_user', { distro, username });

/** Read the per-distro /etc/wsl.conf file */
export const wslGetDistroConfig = (distro: string) =>
  invoke<WslDistroConfig>('wsl_get_distro_config', { distro });

/** Write or remove a setting in the per-distro /etc/wsl.conf file */
export const wslSetDistroConfig = (distro: string, section: string, key: string, value?: string) =>
  invoke<void>('wsl_set_distro_config', { distro, section, key, value });

/** Get full WSL version info (all component versions) */
export const wslGetVersionInfo = () =>
  invoke<WslVersionInfo>('wsl_get_version_info');

/** Get runtime WSL capability flags */
export const wslGetCapabilities = () =>
  invoke<WslCapabilities>('wsl_get_capabilities');

/** Set sparse VHD mode for a WSL distribution */
export const wslSetSparse = (distro: string, enabled: boolean) =>
  invoke<void>('wsl_set_sparse', { distro, enabled });

/** Install WSL engine only, without a default distribution */
export const wslInstallWslOnly = () =>
  invoke<string>('wsl_install_wsl_only');

/** Install a distribution to a custom location */
export const wslInstallWithLocation = (name: string, location: string) =>
  invoke<string>('wsl_install_with_location', { name, location });

/** Diagnostic: returns step-by-step WSL detection info for debugging */
export const wslDebugDetection = () =>
  invoke<Record<string, unknown>>('wsl_debug_detection');

/** Detect the environment inside a WSL distribution (os-release, package manager, etc.) */
export const wslDetectDistroEnv = (distro: string) =>
  invoke<WslDistroEnvironment>('wsl_detect_distro_env', { distro });

/** Get live resource usage (memory, swap, CPU, load) from a running WSL distribution */
export const wslGetDistroResources = (distro: string) =>
  invoke<WslDistroResources>('wsl_get_distro_resources', { distro });

/** List non-system users in a WSL distribution */
export const wslListUsers = (distro: string) =>
  invoke<WslUser[]>('wsl_list_users', { distro });

/** Update or upgrade packages in a WSL distribution */
export const wslUpdateDistroPackages = (distro: string, mode: string) =>
  invoke<WslPackageUpdateResult>('wsl_update_distro_packages', { distro, mode });

// ============================================================================
// Launch Commands
// ============================================================================

/** Launch a program with a specific environment version */
export const launchWithEnv = (request: LaunchRequest) =>
  invoke<LaunchResult>('launch_with_env', { request });

/** Launch a program with streaming output via events */
export const launchWithStreaming = (request: LaunchRequest) =>
  invoke<LaunchResult>('launch_with_streaming', { request });

/** Get shell activation script for a specific environment */
export const envActivate = (
  envType: string,
  version?: string,
  projectPath?: string,
  shell?: string
) =>
  invoke<ActivationScript>('env_activate', { envType, version, projectPath, shell });

/** Get environment info for display */
export const envGetInfo = (envType: string, version: string) =>
  invoke<EnvInfoResult>('env_get_info', { envType, version });

/** Execute a shell command with a specific environment */
export const execShellWithEnv = (
  command: string,
  envType?: string,
  envVersion?: string,
  cwd?: string
) =>
  invoke<LaunchResult>('exec_shell_with_env', { command, envType, envVersion, cwd });

/** Check which version of a program would be used */
export const whichProgram = (
  program: string,
  envType?: string,
  envVersion?: string,
  cwd?: string
) =>
  invoke<string | null>('which_program', { program, envType, envVersion, cwd });

// ============================================================================
// Shim Commands
// ============================================================================

/** Create a new shim for a binary */
export const shimCreate = (
  binaryName: string,
  envType: string,
  version: string | null,
  targetPath: string
) =>
  invoke<string>('shim_create', { binaryName, envType, version, targetPath });

/** Remove a shim */
export const shimRemove = (binaryName: string) =>
  invoke<boolean>('shim_remove', { binaryName });

/** List all shims */
export const shimList = () =>
  invoke<ShimInfo[]>('shim_list');

/** Update a shim to point to a new version */
export const shimUpdate = (binaryName: string, version?: string) =>
  invoke<void>('shim_update', { binaryName, version });

/** Regenerate all shims */
export const shimRegenerateAll = () =>
  invoke<void>('shim_regenerate_all');

// ============================================================================
// PATH Management Commands
// ============================================================================

/** Get PATH status and shim directory info */
export const pathStatus = () =>
  invoke<PathStatusInfo>('path_status');

/** Add shim directory to PATH */
export const pathSetup = () =>
  invoke<void>('path_setup');

/** Remove shim directory from PATH */
export const pathRemove = () =>
  invoke<void>('path_remove');

/** Check if shim directory is in PATH */
export const pathCheck = () =>
  invoke<boolean>('path_check');

/** Get the command to manually add shim directory to PATH */
export const pathGetAddCommand = () =>
  invoke<string>('path_get_add_command');

// ============================================================================
// Git Commands
// ============================================================================

/** Check if git is installed and available */
export const gitIsAvailable = () =>
  invoke<boolean>('git_is_available');

/** Get the installed git version string */
export const gitGetVersion = () =>
  invoke<string | null>('git_get_version');

/** Get the git executable path */
export const gitGetExecutablePath = () =>
  invoke<string | null>('git_get_executable_path');

/** Install git via system package manager */
export const gitInstall = () =>
  invoke<string>('git_install');

/** Update git to the latest version */
export const gitUpdate = () =>
  invoke<string>('git_update');

/** Get all global git configuration entries */
export const gitGetConfig = () =>
  invoke<GitConfigEntry[]>('git_get_config');

/** Set a global git config value */
export const gitSetConfig = (key: string, value: string) =>
  invoke<void>('git_set_config', { key, value });

/** Remove a global git config key */
export const gitRemoveConfig = (key: string) =>
  invoke<void>('git_remove_config', { key });

/** Get repository information for a given path */
export const gitGetRepoInfo = (path: string) =>
  invoke<GitRepoInfo>('git_get_repo_info', { path });

/** Get commit log for a repository */
export const gitGetLog = (
  path: string,
  limit?: number,
  author?: string,
  since?: string,
  until?: string,
  file?: string,
) =>
  invoke<GitCommitEntry[]>('git_get_log', { path, limit, author, since, until, file });

/** Get branches for a repository */
export const gitGetBranches = (path: string) =>
  invoke<GitBranchInfo[]>('git_get_branches', { path });

/** Get remotes for a repository */
export const gitGetRemotes = (path: string) =>
  invoke<GitRemoteInfo[]>('git_get_remotes', { path });

/** Get tags for a repository */
export const gitGetTags = (path: string) =>
  invoke<GitTagInfo[]>('git_get_tags', { path });

/** Get stashes for a repository */
export const gitGetStashes = (path: string) =>
  invoke<GitStashEntry[]>('git_get_stashes', { path });

/** Get contributors for a repository */
export const gitGetContributors = (path: string) =>
  invoke<GitContributor[]>('git_get_contributors', { path });

/** Get file history (commits that modified a specific file) */
export const gitGetFileHistory = (path: string, file: string, limit?: number) =>
  invoke<GitCommitEntry[]>('git_get_file_history', { path, file, limit });

/** Get blame information for a file */
export const gitGetBlame = (path: string, file: string) =>
  invoke<GitBlameEntry[]>('git_get_blame', { path, file });

/** Get detailed information about a specific commit */
export const gitGetCommitDetail = (path: string, hash: string) =>
  invoke<GitCommitDetail>('git_get_commit_detail', { path, hash });

/** Get file-level status (full paths) */
export const gitGetStatus = (path: string) =>
  invoke<GitStatusFile[]>('git_get_status', { path });

/** Get graph log for commit graph visualization */
export const gitGetGraphLog = (path: string, limit?: number, allBranches?: boolean) =>
  invoke<GitGraphEntry[]>('git_get_graph_log', { path, limit, allBranches });

/** Get ahead/behind counts for a branch */
export const gitGetAheadBehind = (path: string, branch: string, upstream?: string) =>
  invoke<GitAheadBehind>('git_get_ahead_behind', { path, branch, upstream });

/** Checkout (switch to) a branch */
export const gitCheckoutBranch = (path: string, name: string) =>
  invoke<string>('git_checkout_branch', { path, name });

/** Create a new branch */
export const gitCreateBranch = (path: string, name: string, startPoint?: string) =>
  invoke<string>('git_create_branch', { path, name, startPoint });

/** Delete a branch */
export const gitDeleteBranch = (path: string, name: string, force?: boolean) =>
  invoke<string>('git_delete_branch', { path, name, force });

/** Apply a stash */
export const gitStashApply = (path: string, stashId?: string) =>
  invoke<string>('git_stash_apply', { path, stashId });

/** Pop a stash */
export const gitStashPop = (path: string, stashId?: string) =>
  invoke<string>('git_stash_pop', { path, stashId });

/** Drop a stash */
export const gitStashDrop = (path: string, stashId?: string) =>
  invoke<string>('git_stash_drop', { path, stashId });

/** Save (create) a stash */
export const gitStashSave = (path: string, message?: string, includeUntracked?: boolean) =>
  invoke<string>('git_stash_save', { path, message, includeUntracked });

/** Create a tag */
export const gitCreateTag = (path: string, name: string, targetRef?: string, message?: string) =>
  invoke<string>('git_create_tag', { path, name, targetRef, message });

/** Delete a tag */
export const gitDeleteTag = (path: string, name: string) =>
  invoke<string>('git_delete_tag', { path, name });

/** Get activity data for heatmap */
export const gitGetActivity = (path: string, days?: number) =>
  invoke<GitDayActivity[]>('git_get_activity', { path, days });

/** Get file stats for visual file history */
export const gitGetFileStats = (path: string, file: string, limit?: number) =>
  invoke<GitFileStatEntry[]>('git_get_file_stats', { path, file, limit });

/** Search commits by message, author, or diff content */
export const gitSearchCommits = (path: string, query: string, searchType?: string, limit?: number) =>
  invoke<GitCommitEntry[]>('git_search_commits', { path, query, searchType, limit });


// ============================================================================
// Git Write Operations
// ============================================================================

/** Stage specific files */
export const gitStageFiles = (path: string, files: string[]) =>
  invoke<string>('git_stage_files', { path, files });

/** Stage all changes */
export const gitStageAll = (path: string) =>
  invoke<string>('git_stage_all', { path });

/** Unstage specific files */
export const gitUnstageFiles = (path: string, files: string[]) =>
  invoke<string>('git_unstage_files', { path, files });

/** Discard working tree changes for specific files */
export const gitDiscardChanges = (path: string, files: string[]) =>
  invoke<string>('git_discard_changes', { path, files });

/** Create a commit */
export const gitCommit = (path: string, message: string, amend?: boolean) =>
  invoke<string>('git_commit', { path, message, amend });

/** Push to remote */
export const gitPush = (path: string, remote?: string, branch?: string, forceLease?: boolean) =>
  invoke<string>('git_push', { path, remote, branch, forceLease });

/** Pull from remote */
export const gitPull = (path: string, remote?: string, branch?: string, rebase?: boolean) =>
  invoke<string>('git_pull', { path, remote, branch, rebase });

/** Fetch from remote */
export const gitFetch = (path: string, remote?: string) =>
  invoke<string>('git_fetch', { path, remote });

/** Clone a repository */
export const gitClone = (url: string, destPath: string, options?: GitCloneOptions) =>
  invoke<string>('git_clone', { url, destPath, options });

/** Extract repository name from a git URL */
export const gitExtractRepoName = (url: string) =>
  invoke<string | null>('git_extract_repo_name', { url });

/** Validate whether a string looks like a valid git remote URL */
export const gitValidateUrl = (url: string) =>
  invoke<boolean>('git_validate_url', { url });

/** Listen for git clone progress events */
export async function listenGitCloneProgress(
  callback: (progress: GitCloneProgress) => void
): Promise<UnlistenFn> {
  return listen<GitCloneProgress>('git-clone-progress', (event) => {
    callback(event.payload);
  });
}

/** Initialize a new repository */
export const gitInit = (path: string) =>
  invoke<string>('git_init', { path });

/** Get diff output (working tree or staged changes) */
export const gitGetDiff = (path: string, staged?: boolean, file?: string) =>
  invoke<string>('git_get_diff', { path, staged, file });

/** Get diff between two commits */
export const gitGetDiffBetween = (path: string, from: string, to: string, file?: string) =>
  invoke<string>('git_get_diff_between', { path, from, to, file });

/** Merge a branch into current */
export const gitMerge = (path: string, branch: string, noFf?: boolean) =>
  invoke<string>('git_merge', { path, branch, noFf });

/** Revert a commit */
export const gitRevert = (path: string, hash: string, noCommit?: boolean) =>
  invoke<string>('git_revert', { path, hash, noCommit });

/** Cherry-pick a commit */
export const gitCherryPick = (path: string, hash: string) =>
  invoke<string>('git_cherry_pick', { path, hash });

/** Reset HEAD to a target */
export const gitReset = (path: string, mode?: string, target?: string) =>
  invoke<string>('git_reset', { path, mode, target });

// ============================================================================
// Git Remote & Branch Management
// ============================================================================

/** Add a remote */
export const gitRemoteAdd = (path: string, name: string, url: string) =>
  invoke<string>('git_remote_add', { path, name, url });

/** Remove a remote */
export const gitRemoteRemove = (path: string, name: string) =>
  invoke<string>('git_remote_remove', { path, name });

/** Rename a remote */
export const gitRemoteRename = (path: string, oldName: string, newName: string) =>
  invoke<string>('git_remote_rename', { path, oldName, newName });

/** Set remote URL */
export const gitRemoteSetUrl = (path: string, name: string, url: string) =>
  invoke<string>('git_remote_set_url', { path, name, url });

/** Rename a branch */
export const gitBranchRename = (path: string, oldName: string, newName: string) =>
  invoke<string>('git_branch_rename', { path, oldName, newName });

/** Set upstream tracking branch */
export const gitBranchSetUpstream = (path: string, branch: string, upstream: string) =>
  invoke<string>('git_branch_set_upstream', { path, branch, upstream });

/** Push all tags to remote */
export const gitPushTags = (path: string, remote?: string) =>
  invoke<string>('git_push_tags', { path, remote });

/** Delete a remote branch */
export const gitDeleteRemoteBranch = (path: string, remote: string, branch: string) =>
  invoke<string>('git_delete_remote_branch', { path, remote, branch });

/** Show stash diff */
export const gitStashShow = (path: string, stashId?: string) =>
  invoke<string>('git_stash_show', { path, stashId });

/** Get reflog entries */
export const gitGetReflog = (path: string, limit?: number) =>
  invoke<GitReflogEntry[]>('git_get_reflog', { path, limit });

/** Remove untracked files */
export const gitClean = (path: string, directories?: boolean) =>
  invoke<string>('git_clean', { path, directories });

// ============================================================================
// Environment Variable Management
// ============================================================================

/** List all current process environment variables */
export const envvarListAll = () =>
  invoke<Record<string, string>>('envvar_list_all');

/** Get a specific environment variable */
export const envvarGet = (key: string) =>
  invoke<string | null>('envvar_get', { key });

/** Set a process-level environment variable */
export const envvarSetProcess = (key: string, value: string) =>
  invoke<void>('envvar_set_process', { key, value });

/** Remove a process-level environment variable */
export const envvarRemoveProcess = (key: string) =>
  invoke<void>('envvar_remove_process', { key });

/** Get a persistent environment variable by scope */
export const envvarGetPersistent = (key: string, scope: EnvVarScope) =>
  invoke<string | null>('envvar_get_persistent', { key, scope });

/** Set a persistent environment variable */
export const envvarSetPersistent = (key: string, value: string, scope: EnvVarScope) =>
  invoke<void>('envvar_set_persistent', { key, value, scope });

/** Remove a persistent environment variable */
export const envvarRemovePersistent = (key: string, scope: EnvVarScope) =>
  invoke<void>('envvar_remove_persistent', { key, scope });

/** Get PATH entries with existence info */
export const envvarGetPath = (scope: EnvVarScope) =>
  invoke<PathEntryInfo[]>('envvar_get_path', { scope });

/** Add a PATH entry */
export const envvarAddPathEntry = (path: string, scope: EnvVarScope, position?: number) =>
  invoke<void>('envvar_add_path_entry', { path, scope, position });

/** Remove a PATH entry */
export const envvarRemovePathEntry = (path: string, scope: EnvVarScope) =>
  invoke<void>('envvar_remove_path_entry', { path, scope });

/** Reorder PATH entries (full replacement) */
export const envvarReorderPath = (entries: string[], scope: EnvVarScope) =>
  invoke<void>('envvar_reorder_path', { entries, scope });

/** List available shell profiles */
export const envvarListShellProfiles = () =>
  invoke<ShellProfileInfo[]>('envvar_list_shell_profiles');

/** Read a shell profile config file */
export const envvarReadShellProfile = (path: string) =>
  invoke<string>('envvar_read_shell_profile', { path });

/** Import variables from .env file content */
export const envvarImportEnvFile = (content: string, scope: EnvVarScope) =>
  invoke<EnvVarImportResult>('envvar_import_env_file', { content, scope });

/** Export variables to a specific format */
export const envvarExportEnvFile = (scope: EnvVarScope, format: EnvFileFormat) =>
  invoke<string>('envvar_export_env_file', { scope, format });

/** List all persistent environment variables for a given scope */
export const envvarListPersistent = (scope: EnvVarScope) =>
  invoke<[string, string][]>('envvar_list_persistent', { scope });

/** Expand environment variable references in a path string */
export const envvarExpand = (path: string) =>
  invoke<string>('envvar_expand', { path });

/** Remove duplicate PATH entries for a given scope, returns count removed */
export const envvarDeduplicatePath = (scope: EnvVarScope) =>
  invoke<number>('envvar_deduplicate_path', { scope });

// ============================================================================
// Terminal Management
// ============================================================================

/** Detect all installed shells on the system */
export const terminalDetectShells = () =>
  invoke<ShellInfo[]>('terminal_detect_shells');

/** Get info for a specific shell by id */
export const terminalGetShellInfo = (shellId: string) =>
  invoke<ShellInfo>('terminal_get_shell_info', { shellId });

/** List all terminal profiles */
export const terminalListProfiles = () =>
  invoke<TerminalProfile[]>('terminal_list_profiles');

/** Get a terminal profile by id */
export const terminalGetProfile = (id: string) =>
  invoke<TerminalProfile>('terminal_get_profile', { id });

/** Create a new terminal profile */
export const terminalCreateProfile = (profile: TerminalProfile) =>
  invoke<string>('terminal_create_profile', { profile });

/** Update an existing terminal profile */
export const terminalUpdateProfile = (profile: TerminalProfile) =>
  invoke<void>('terminal_update_profile', { profile });

/** Delete a terminal profile */
export const terminalDeleteProfile = (id: string) =>
  invoke<boolean>('terminal_delete_profile', { id });

/** Get the default terminal profile */
export const terminalGetDefaultProfile = () =>
  invoke<TerminalProfile | null>('terminal_get_default_profile');

/** Set the default terminal profile */
export const terminalSetDefaultProfile = (id: string) =>
  invoke<void>('terminal_set_default_profile', { id });

/** Launch a terminal profile */
export const terminalLaunchProfile = (id: string) =>
  invoke<string>('terminal_launch_profile', { id });

/** Launch a terminal profile and return structured result */
export const terminalLaunchProfileDetailed = (id: string) =>
  invoke<LaunchResult>('terminal_launch_profile_detailed', { id });

/** Read a shell config file */
export const terminalReadConfig = (path: string) =>
  invoke<string>('terminal_read_config', { path });

/** Backup a shell config file */
export const terminalBackupConfig = (path: string) =>
  invoke<string>('terminal_backup_config', { path });

/** Append content to a shell config file */
export const terminalAppendToConfig = (path: string, content: string) =>
  invoke<void>('terminal_append_to_config', { path, content });

/** Get parsed config entries (aliases, exports, sources) */
export const terminalGetConfigEntries = (path: string, shellType: ShellType) =>
  invoke<ShellConfigEntries>('terminal_get_config_entries', { path, shellType });

/** List PowerShell profiles */
export const terminalPsListProfiles = () =>
  invoke<PSProfileInfo[]>('terminal_ps_list_profiles');

/** Read a PowerShell profile content */
export const terminalPsReadProfile = (scope: string) =>
  invoke<string>('terminal_ps_read_profile', { scope });

/** Write content to a PowerShell profile */
export const terminalPsWriteProfile = (scope: string, content: string) =>
  invoke<void>('terminal_ps_write_profile', { scope, content });

/** Get PowerShell execution policy for all scopes */
export const terminalPsGetExecutionPolicy = () =>
  invoke<[string, string][]>('terminal_ps_get_execution_policy');

/** Set PowerShell execution policy */
export const terminalPsSetExecutionPolicy = (policy: string, scope: string) =>
  invoke<void>('terminal_ps_set_execution_policy', { policy, scope });

/** List all available PowerShell modules */
export const terminalPsListAllModules = () =>
  invoke<PSModuleInfo[]>('terminal_ps_list_all_modules');

/** Get detailed info for a PowerShell module */
export const terminalPsGetModuleDetail = (name: string) =>
  invoke<PSModuleInfo>('terminal_ps_get_module_detail', { name });

/** List installed PowerShell scripts */
export const terminalPsListInstalledScripts = () =>
  invoke<PSScriptInfo[]>('terminal_ps_list_installed_scripts');

/** Detect shell frameworks for a shell type */
export const terminalDetectFramework = (shellType: ShellType) =>
  invoke<ShellFrameworkInfo[]>('terminal_detect_framework', { shellType });

/** List plugins for a detected framework */
export const terminalListPlugins = (frameworkName: string, frameworkPath: string, shellType: ShellType) =>
  invoke<ShellPlugin[]>('terminal_list_plugins', { frameworkName, frameworkPath, shellType });

/** Get shell-relevant environment variables */
export const terminalGetShellEnvVars = () =>
  invoke<[string, string][]>('terminal_get_shell_env_vars');

/** Get resolved proxy environment variables for terminal */
export const terminalGetProxyEnvVars = () =>
  invoke<[string, string][]>('terminal_get_proxy_env_vars');

/** Duplicate a terminal profile */
export const terminalDuplicateProfile = (id: string) =>
  invoke<string>('terminal_duplicate_profile', { id });

/** Export all terminal profiles as JSON */
export const terminalExportProfiles = () =>
  invoke<string>('terminal_export_profiles');

/** Import terminal profiles from JSON */
export const terminalImportProfiles = (json: string, merge: boolean) =>
  invoke<number>('terminal_import_profiles', { json, merge });

/** Write content to a shell config file (with automatic backup) */
export const terminalWriteConfig = (path: string, content: string) =>
  invoke<void>('terminal_write_config', { path, content });

/** Install a PowerShell module from PSGallery */
export const terminalPsInstallModule = (name: string, scope: string) =>
  invoke<void>('terminal_ps_install_module', { name, scope });

/** Uninstall a PowerShell module */
export const terminalPsUninstallModule = (name: string) =>
  invoke<void>('terminal_ps_uninstall_module', { name });

/** Update a PowerShell module */
export const terminalPsUpdateModule = (name: string) =>
  invoke<void>('terminal_ps_update_module', { name });

/** Search PSGallery for modules */
export const terminalPsFindModule = (query: string) =>
  invoke<PSModuleInfo[]>('terminal_ps_find_module', { query });
