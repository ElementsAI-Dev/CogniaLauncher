import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/platform";

// Re-export all types from types/tauri.ts
export type {
  EnvInstallProgressEvent,
  EnvVerifyResult,
  EnvVersionMutationResult,
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
  RustupOperationResult,
  RustupScopedListResult,
  RustupProfileResult,
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
  CacheCommandScope,
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
  UpdateCheckProviderOutcome,
  UpdateCheckCoverage,
  UpdateCheckSummary,
  SelfUpdateInfo,
  SelfUpdateProgressEvent,
  InstallHistoryEntry,
  InstallHistoryQuery,
  PackageHistoryQuery,
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
  LogCleanupResult,
  LogCleanupPreviewResult,
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
  TrayNotificationLevel,
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
  HealthScopeState,
  HealthRemediationResult,
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
  GitSubmoduleInfo,
  GitWorktreeInfo,
  GitHookInfo,
  GitLfsFile,
  GitMergeRebaseState,
  GitRepoStats,
  GitBisectState,
  GitRebaseTodoItem,
  EditorCapabilityProbeResult,
  EditorOpenActionResult,
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
  PersistentEnvVar,
  EnvVarConflict,
  ShellType,
  ShellConfigFile,
  ShellInfo,
  ShellStartupMeasurement,
  ShellHealthResult,
  TerminalProfile,
  TerminalProfileTemplate,
  TerminalConfigDiagnostic,
  TerminalConfigEditorMetadata,
  TerminalConfigMutationResult,
  TerminalConfigRestoreResult,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
  FrameworkCacheInfo,
  ShellConfigEntries,
  DiagnosticExportOptions,
  DiagnosticCaptureFrontendCrashOptions,
  DiagnosticExportResult,
  DiagnosticErrorContext,
  CrashInfo,
  BrewTap,
  BrewService,
  BrewDoctorResult,
  BrewCleanupResult,
  BrewPinnedPackage,
  BrewConfigEntry,
  BrewConfigInfo,
  PortVariant,
  PortDependent,
  PortFileEntry,
  PortSelectGroup,
} from "@/types/tauri";

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
  EnvVersionMutationResult,
  EnvironmentProviderInfo,
  EnvironmentSettingsConfig,
  SystemEnvironmentInfo,
  EnvironmentTypeMapping,
  RustComponent,
  RustTarget,
  RustupOperationResult,
  RustupScopedListResult,
  RustupProfileResult,
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
  CacheCommandScope,
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
  InstallHistoryQuery,
  PackageHistoryQuery,
  ResolutionResult,
  AdvancedSearchOptions,
  SearchFilters,
  EnhancedSearchResult,
  SearchSuggestion,
  PackageComparison,
  ManifestInfo,
  LogFileInfo,
  LogQueryOptions,
  LogQueryResult,
  LogExportOptions,
  LogExportResult,
  LogCleanupResult,
  LogCleanupPreviewResult,
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
  TrayNotificationLevel,
  TrayMenuItemId,
  TrayMenuConfig,
  TrayStateInfo,
  CustomDetectionRule,
  CustomDetectionResult,
  TestRuleResult,
  RegexValidation,
  ImportRulesResult,
  ExtractionTypeInfo,
  HealthRemediationResult,
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
  GitSubmoduleInfo,
  GitWorktreeInfo,
  GitHookInfo,
  GitLfsFile,
  GitMergeRebaseState,
  GitRepoStats,
  GitBisectState,
  GitRebaseTodoItem,
  EditorCapabilityProbeResult,
  EditorOpenActionResult,
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
  PersistentEnvVar,
  EnvVarConflict,
  ShellType,
  ShellInfo,
  ShellStartupMeasurement,
  ShellHealthResult,
  TerminalProfile,
  TerminalProfileTemplate,
  TerminalConfigDiagnostic,
  TerminalConfigEditorMetadata,
  TerminalConfigMutationResult,
  TerminalConfigRestoreResult,
  PSProfileInfo,
  PSModuleInfo,
  PSScriptInfo,
  ShellFrameworkInfo,
  ShellPlugin,
  FrameworkCacheInfo,
  ShellConfigEntries,
  DiagnosticExportOptions,
  DiagnosticCaptureFrontendCrashOptions,
  DiagnosticExportResult,
  CrashInfo,
} from "@/types/tauri";

import type {
  FeedbackItem,
  FeedbackSaveResult,
  FeedbackListResult,
} from "@/types/feedback";

// Re-export so existing `import { isTauri } from '@/lib/tauri'` call-sites keep working.
export { isTauri };

export async function getAppVersion(): Promise<string | null> {
  if (typeof window === "undefined" || !isTauri()) {
    return null;
  }

  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch (error) {
    console.error("Failed to get app version:", error);
    return null;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch (error) {
    console.error("Failed to open external link:", error);
  }
}

export async function openLocalPath(path: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!isTauri()) {
    return;
  }

  try {
    const { openPath: tauriOpenPath } =
      await import("@tauri-apps/plugin-opener");
    await tauriOpenPath(path);
  } catch (error) {
    console.error("Failed to open local path:", error);
  }
}

export async function revealPath(path: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!isTauri()) {
    return;
  }

  try {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  } catch (error) {
    console.error("Failed to reveal path:", error);
  }
}

// Listen for environment install progress events
export async function listenEnvInstallProgress(
  callback: (progress: EnvInstallProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<EnvInstallProgressEvent>("env-install-progress", (event) => {
    callback(event.payload);
  });
}

// Cancel an ongoing environment installation
export const envInstallCancel = (envType: string, version: string) =>
  invoke<boolean>("env_install_cancel", { envType, version });

// Resolve a version alias (lts, latest, stable) to an actual version number
export const envResolveAlias = (envType: string, alias: string) =>
  invoke<string>("env_resolve_alias", { envType, alias });

// Environment commands
export const envList = (force?: boolean) =>
  invoke<EnvironmentInfo[]>("env_list", { force });
export const envGet = (envType: string) =>
  invoke<EnvironmentInfo>("env_get", { envType });
export const envInstall = (
  envType: string,
  version: string,
  providerId?: string,
) => invoke<void>("env_install", { envType, version, providerId });
export const envUninstall = (envType: string, version: string) =>
  invoke<void>("env_uninstall", { envType, version });
export const envUseGlobal = (envType: string, version: string) =>
  invoke<EnvVersionMutationResult>("env_use_global", { envType, version });
export const envUseLocal = (
  envType: string,
  version: string,
  projectPath: string,
) =>
  invoke<EnvVersionMutationResult>("env_use_local", {
    envType,
    version,
    projectPath,
  });
export const envDetect = (envType: string, startPath: string) =>
  invoke<DetectedEnvironment | null>("env_detect", { envType, startPath });
export const envDetectAll = (startPath: string) =>
  invoke<DetectedEnvironment[]>("env_detect_all", { startPath });
export const envAvailableVersions = (
  envType: string,
  providerId?: string,
  force?: boolean,
) =>
  invoke<VersionInfo[]>("env_available_versions", {
    envType,
    providerId,
    force,
  });
export const envListProviders = (force?: boolean) =>
  invoke<EnvironmentProviderInfo[]>("env_list_providers", { force });

// Environment settings commands
export const envSaveSettings = (settings: EnvironmentSettingsConfig) =>
  invoke<void>("env_save_settings", { settings });

export const envLoadSettings = (envType: string) =>
  invoke<EnvironmentSettingsConfig | null>("env_load_settings", { envType });

// Detection source commands
export const envGetDetectionSources = (envType: string) =>
  invoke<string[]>("env_get_detection_sources", { envType });
export const envGetDefaultDetectionSources = (envType: string) =>
  invoke<string[]>("env_get_default_detection_sources", { envType });
export const envGetAllDetectionSources = () =>
  invoke<Record<string, string[]>>("env_get_all_detection_sources");

// System environment detection commands
export const envDetectSystemAll = (force?: boolean) =>
  invoke<SystemEnvironmentInfo[]>("env_detect_system_all", { force });

export const envDetectSystem = (envType: string, force?: boolean) =>
  invoke<SystemEnvironmentInfo | null>("env_detect_system", { envType, force });

export const envGetTypeMapping = () =>
  invoke<EnvironmentTypeMapping>("env_get_type_mapping");

// Environment verification and query commands
export const envVerifyInstall = (envType: string, version: string) =>
  invoke<EnvVerifyResult>("env_verify_install", { envType, version });

export const envInstalledVersions = (envType: string, force?: boolean) =>
  invoke<InstalledVersion[]>("env_installed_versions", { envType, force });

export const envCurrentVersion = (envType: string) =>
  invoke<string | null>("env_current_version", { envType });

// Environment update checking & cleanup commands
export const envCheckUpdates = (envType: string) =>
  invoke<EnvUpdateCheckResult>("env_check_updates", { envType });

export const envCheckUpdatesAll = () =>
  invoke<EnvUpdateCheckResult[]>("env_check_updates_all");

export const envCleanupVersions = (
  envType: string,
  versionsToRemove: string[],
) =>
  invoke<EnvCleanupResult>("env_cleanup_versions", {
    envType,
    versionsToRemove,
  });

export const envListGlobalPackages = (
  envType: string,
  version: string,
  providerId?: string,
) =>
  invoke<GlobalPackageInfo[]>("env_list_global_packages", {
    envType,
    version,
    providerId,
  });

export const envMigratePackages = (
  envType: string,
  fromVersion: string,
  toVersion: string,
  packages: string[],
  providerId?: string,
) =>
  invoke<EnvMigrateResult>("env_migrate_packages", {
    envType,
    fromVersion,
    toVersion,
    packages,
    providerId,
  });

export async function listenEnvMigrateProgress(
  callback: (progress: {
    envType: string;
    current: number;
    total: number;
    package: string;
  }) => void,
): Promise<UnlistenFn> {
  return listen<{
    envType: string;
    current: number;
    total: number;
    package: string;
  }>("env-migrate-progress", (event) => {
    callback(event.payload);
  });
}

// EOL (End-of-Life) data commands
export const envGetEolInfo = (envType: string) =>
  invoke<EolCycleInfo[]>("env_get_eol_info", { envType });

export const envGetVersionEol = (envType: string, version: string) =>
  invoke<EolCycleInfo | null>("env_get_version_eol", { envType, version });

// Rustup-specific commands
export const rustupListComponents = (toolchain?: string) =>
  invoke<RustupScopedListResult<RustComponent>>("rustup_list_components", {
    toolchain,
  });

export const rustupAddComponent = (component: string, toolchain?: string) =>
  invoke<RustupOperationResult>("rustup_add_component", {
    component,
    toolchain,
  });

export const rustupRemoveComponent = (component: string, toolchain?: string) =>
  invoke<RustupOperationResult>("rustup_remove_component", {
    component,
    toolchain,
  });

export const rustupListTargets = (toolchain?: string) =>
  invoke<RustupScopedListResult<RustTarget>>("rustup_list_targets", {
    toolchain,
  });

export const rustupAddTarget = (target: string, toolchain?: string) =>
  invoke<RustupOperationResult>("rustup_add_target", { target, toolchain });

export const rustupRemoveTarget = (target: string, toolchain?: string) =>
  invoke<RustupOperationResult>("rustup_remove_target", { target, toolchain });

export const rustupShow = () => invoke<RustupShowInfo>("rustup_show");

export const rustupSelfUpdate = () => invoke<void>("rustup_self_update");

export const rustupUpdateAll = () => invoke<string>("rustup_update_all");

// Rustup override management
export const rustupOverrideSet = (toolchain: string, path?: string) =>
  invoke<RustupOperationResult>("rustup_override_set", { toolchain, path });

export const rustupOverrideUnset = (path?: string) =>
  invoke<RustupOperationResult>("rustup_override_unset", { path });

export const rustupOverrideList = () =>
  invoke<RustupScopedListResult<RustupOverride>>("rustup_override_list");

// Rustup run, which, profile
export const rustupRun = (
  toolchain: string,
  command: string,
  args?: string[],
) => invoke<string>("rustup_run", { toolchain, command, args });

export const rustupWhich = (binary: string) =>
  invoke<string>("rustup_which", { binary });

export const rustupGetProfile = () =>
  invoke<RustupProfileResult>("rustup_get_profile");

export const rustupSetProfile = (profile: string) =>
  invoke<RustupOperationResult>("rustup_set_profile", { profile });

// Go-specific commands
export const goEnvInfo = () => invoke<GoEnvInfo>("go_env_info");

export const goModTidy = (projectPath: string) =>
  invoke<string>("go_mod_tidy", { projectPath });

export const goModDownload = (projectPath: string) =>
  invoke<string>("go_mod_download", { projectPath });

export const goCleanCache = (cacheType: string) =>
  invoke<string>("go_clean_cache", { cacheType });

export const goCacheInfo = () => invoke<GoCacheInfo>("go_cache_info");

// Package commands
export const packageSearch = (
  query: string,
  provider?: string,
  force?: boolean,
) => invoke<PackageSummary[]>("package_search", { query, provider, force });
export const packageInfo = (name: string, provider?: string, force?: boolean) =>
  invoke<PackageInfo>("package_info", { name, provider, force });
export const packageInstall = (packages: string[]) =>
  invoke<string[]>("package_install", { packages });
export const packageUninstall = (packages: string[]) =>
  invoke<void>("package_uninstall", { packages });
export const packageList = (provider?: string, force?: boolean) =>
  invoke<InstalledPackage[]>("package_list", { provider, force });
export const providerList = () => invoke<ProviderInfo[]>("provider_list");
export const packageCheckInstalled = (name: string) =>
  invoke<boolean>("package_check_installed", { name });
export const packageVersions = (
  name: string,
  provider?: string,
  force?: boolean,
) => invoke<VersionInfo[]>("package_versions", { name, provider, force });

// App initialization status
export interface AppInitStatus {
  initialized: boolean;
  version: string;
}

export const appCheckInit = () => invoke<AppInitStatus>("app_check_init");

// Init progress events
export interface InitProgressEvent {
  phase: string;
  progress: number;
  message: string;
}

export async function listenInitProgress(
  callback: (event: InitProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<InitProgressEvent>("init-progress", (event) => {
    callback(event.payload);
  });
}

// Config commands
export const configGet = (key: string) =>
  invoke<string | null>("config_get", { key });
export const configSet = (key: string, value: string) =>
  invoke<void>("config_set", { key, value });
export const configList = () => invoke<[string, string][]>("config_list");
export const configListDefaults = () =>
  invoke<[string, string][]>("config_list_defaults");
export const configReset = () => invoke<void>("config_reset");
export const configExport = () => invoke<string>("config_export");
export const configImport = (tomlContent: string) =>
  invoke<void>("config_import", { tomlContent });
export const getCogniaDir = () => invoke<string>("get_cognia_dir");
export const getPlatformInfo = () => invoke<PlatformInfo>("get_platform_info");
export const getDiskInfo = () => invoke<DiskInfo[]>("get_disk_info");
export const getNetworkInterfaces = () =>
  invoke<NetworkInterfaceInfo[]>("get_network_interfaces");
export const detectSystemProxy = () =>
  invoke<SystemProxyInfo>("detect_system_proxy");
export const testProxyConnection = (proxyUrl: string, testUrl?: string) =>
  invoke<ProxyTestResult>("test_proxy_connection", { proxyUrl, testUrl });
export const getComponentsInfo = () =>
  invoke<ComponentInfo[]>("get_components_info");
export const getBatteryInfo = () =>
  invoke<BatteryInfo | null>("get_battery_info");

// Cache commands
export const cacheInfo = () => invoke<CacheInfo>("cache_info");
export const cacheClean = (cleanType?: string) =>
  invoke<{ freed_bytes: number; freed_human: string }>("cache_clean", {
    cleanType,
  });
export const cacheCleanPreview = (cleanType?: string) =>
  invoke<CleanPreview>("cache_clean_preview", { cleanType });
export const cacheCleanEnhanced = (cleanType?: string, useTrash?: boolean) =>
  invoke<EnhancedCleanResult>("cache_clean_enhanced", { cleanType, useTrash });
export const cacheVerify = (scope: CacheCommandScope = "all") =>
  invoke<CacheVerificationResult>("cache_verify", { scope });
export const cacheRepair = (scope: CacheCommandScope = "all") =>
  invoke<CacheRepairResult>("cache_repair", { scope });
export const getCacheSettings = () =>
  invoke<CacheSettings>("get_cache_settings");
export const setCacheSettings = (settings: CacheSettings) =>
  invoke<void>("set_cache_settings", { newSettings: settings });
export const getCleanupHistory = (limit?: number) =>
  invoke<CleanupRecord[]>("get_cleanup_history", { limit });
export const clearCleanupHistory = () =>
  invoke<number>("clear_cleanup_history");
export const getCleanupSummary = () =>
  invoke<CleanupHistorySummary>("get_cleanup_summary");

// Cache access stats
export const getCacheAccessStats = () =>
  invoke<CacheAccessStats>("get_cache_access_stats");
export const resetCacheAccessStats = () =>
  invoke<void>("reset_cache_access_stats");

// Cache entry browser
export const listCacheEntries = (options?: {
  entryType?: string;
  search?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}) => invoke<CacheEntryList>("list_cache_entries", options ?? {});
export const deleteCacheEntry = (key: string, useTrash?: boolean) =>
  invoke<boolean>("delete_cache_entry", { key, useTrash });
export const deleteCacheEntries = (keys: string[], useTrash?: boolean) =>
  invoke<number>("delete_cache_entries", { keys, useTrash });

// Hot files (top accessed)
export const getTopAccessedEntries = (limit?: number) =>
  invoke<CacheEntryItem[]>("get_top_accessed_entries", { limit });

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
  sizePending?: boolean;
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

export const discoverExternalCachesFast = () =>
  invoke<ExternalCacheInfo[]>("discover_external_caches_fast");
export const calculateExternalCacheSize = (provider: string) =>
  invoke<number>("calculate_external_cache_size", { provider });
export const discoverExternalCaches = () =>
  invoke<ExternalCacheInfo[]>("discover_external_caches");
export const cleanExternalCache = (provider: string, useTrash: boolean) =>
  invoke<ExternalCacheCleanResult>("clean_external_cache", {
    provider,
    useTrash,
  });
export const cleanAllExternalCaches = (useTrash: boolean) =>
  invoke<ExternalCacheCleanResult[]>("clean_all_external_caches", { useTrash });
export const getCombinedCacheStats = () =>
  invoke<CombinedCacheStats>("get_combined_cache_stats");

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
  invoke<CacheSizeMonitor>("cache_size_monitor", { includeExternal });

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

export const getCachePathInfo = () =>
  invoke<CachePathInfo>("get_cache_path_info");
export const setCachePath = (newPath: string) =>
  invoke<void>("set_cache_path", { newPath });
export const resetCachePath = () => invoke<string>("reset_cache_path");

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
  invoke<MigrationValidation>("cache_migration_validate", { destination });
export const cacheMigrate = (
  destination: string,
  mode: "move" | "move_and_link",
) => invoke<MigrationResult>("cache_migrate", { destination, mode });

// Force clean
export const cacheForceClean = (useTrash?: boolean) =>
  invoke<EnhancedCleanResult>("cache_force_clean", { useTrash });
export const cacheForceCleanExternal = (
  provider: string,
  useCommand?: boolean,
  useTrash?: boolean,
) =>
  invoke<ExternalCacheCleanResult>("cache_force_clean_external", {
    provider,
    useCommand,
    useTrash,
  });

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
  invoke<ExternalCachePathInfo[]>("get_external_cache_paths");

// Database optimization & size history
type CacheOptimizeResultCompat = Partial<CacheOptimizeResult> & {
  size_before?: number;
  size_before_human?: string;
  size_after?: number;
  size_after_human?: string;
  size_saved?: number;
  size_saved_human?: string;
};

function normalizeCacheOptimizeResult(
  result: CacheOptimizeResultCompat,
): CacheOptimizeResult {
  return {
    sizeBefore: result.sizeBefore ?? result.size_before ?? 0,
    sizeBeforeHuman:
      result.sizeBeforeHuman ?? result.size_before_human ?? "0 B",
    sizeAfter: result.sizeAfter ?? result.size_after ?? 0,
    sizeAfterHuman: result.sizeAfterHuman ?? result.size_after_human ?? "0 B",
    sizeSaved: result.sizeSaved ?? result.size_saved ?? 0,
    sizeSavedHuman: result.sizeSavedHuman ?? result.size_saved_human ?? "0 B",
  };
}

type CacheSizeSnapshotCompat = Partial<CacheSizeSnapshot> & {
  internal_size?: number;
  internal_size_human?: string;
  download_count?: number;
  metadata_count?: number;
};

function normalizeCacheSizeSnapshot(
  snapshot: CacheSizeSnapshotCompat,
): CacheSizeSnapshot {
  return {
    timestamp: snapshot.timestamp ?? "",
    internalSize: snapshot.internalSize ?? snapshot.internal_size ?? 0,
    internalSizeHuman:
      snapshot.internalSizeHuman ?? snapshot.internal_size_human ?? "0 B",
    downloadCount: snapshot.downloadCount ?? snapshot.download_count ?? 0,
    metadataCount: snapshot.metadataCount ?? snapshot.metadata_count ?? 0,
  };
}

export const cacheOptimize = async () => {
  const result = await invoke<CacheOptimizeResultCompat>("cache_optimize");
  return normalizeCacheOptimizeResult(result);
};

export const getCacheSizeHistory = async (days?: number) => {
  const snapshots = await invoke<CacheSizeSnapshotCompat[]>(
    "get_cache_size_history",
    { days },
  );
  return snapshots.map(normalizeCacheSizeSnapshot);
};

// Backup & database maintenance
export const backupCreate = (contents: BackupContentType[], note?: string) =>
  invoke<BackupResult>("backup_create", { contents, note });
export const backupRestore = (
  backupPath: string,
  contents: BackupContentType[],
) => invoke<RestoreResult>("backup_restore", { backupPath, contents });
export const backupList = () => invoke<BackupInfo[]>("backup_list");
export const backupDelete = (backupPath: string) =>
  invoke<boolean>("backup_delete", { backupPath });
export const backupValidate = (backupPath: string) =>
  invoke<BackupValidationResult>("backup_validate", { backupPath });
export const backupExport = (backupPath: string, destPath: string) =>
  invoke<number>("backup_export", { backupPath, destPath });
export const backupImport = (zipPath: string) =>
  invoke<BackupInfo>("backup_import", { zipPath });
export const backupCleanup = (maxCount: number, maxAgeDays: number) =>
  invoke<number>("backup_cleanup", { maxCount, maxAgeDays });
export const dbIntegrityCheck = () =>
  invoke<IntegrityCheckResult>("db_integrity_check");
export const dbGetInfo = () => invoke<DatabaseInfo>("db_get_info");

export async function listenCacheAutoCleaned(
  callback: (event: CacheAutoCleanedEvent) => void,
): Promise<UnlistenFn> {
  return listen<CacheAutoCleanedEvent>("cache-auto-cleaned", (event) => {
    callback(event.payload);
  });
}

// Cache change events
export interface CacheChangedEvent {
  action: string;
  freedBytes: number;
  freedHuman: string;
  scope: string;
  domains: string[];
}

export async function listenCacheChanged(
  callback: (event: CacheChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<CacheChangedEvent>("cache-changed", (event) => {
    callback(event.payload);
  });
}

// Provider management commands
export const providerEnable = (providerId: string) =>
  invoke<void>("provider_enable", { providerId });
export const providerDisable = (providerId: string) =>
  invoke<void>("provider_disable", { providerId });
export const providerCheck = (providerId: string) =>
  invoke<boolean>("provider_check", { providerId });
export const providerSystemList = () =>
  invoke<string[]>("provider_system_list");
export const providerStatusAll = (force?: boolean) =>
  invoke<ProviderStatusInfo[]>("provider_status_all", { force });

// Listen for batch progress events
export async function listenBatchProgress(
  callback: (progress: BatchProgress) => void,
): Promise<UnlistenFn> {
  return listen<BatchProgress>("batch-progress", (event) => {
    callback(event.payload);
  });
}

export const batchInstall = (
  packages: string[],
  options?: Partial<BatchInstallOptions>,
) =>
  invoke<BatchResult>("batch_install", {
    packages,
    dryRun: options?.dryRun,
    parallel: options?.parallel,
    force: options?.force,
    global: options?.global,
  });

export const batchUninstall = (packages: string[], force?: boolean) =>
  invoke<BatchResult>("batch_uninstall", { packages, force });

export const batchUpdate = (packages?: string[]) =>
  invoke<BatchResult>("batch_update", { packages });

// Update checking commands
export const checkUpdates = (packages?: string[], concurrency?: number) =>
  invoke<UpdateCheckSummary>("check_updates", { packages, concurrency });

// Listen for update check progress events
export async function listenUpdateCheckProgress(
  callback: (progress: UpdateCheckProgress) => void,
): Promise<UnlistenFn> {
  return listen<UpdateCheckProgress>("update-check-progress", (event) => {
    callback(event.payload);
  });
}

// Package pinning
export const packagePin = (name: string, version?: string) =>
  invoke<void>("package_pin", { name, version });
export const packageUnpin = (name: string) =>
  invoke<void>("package_unpin", { name });
export const getPinnedPackages = () =>
  invoke<[string, string | null][]>("get_pinned_packages");

// Package rollback
export const packageRollback = (name: string, toVersion: string) =>
  invoke<void>("package_rollback", { name, toVersion });

// Install history
export const getInstallHistory = (
  queryOrLimit?: number | InstallHistoryQuery,
) => {
  const query: Record<string, unknown> =
    typeof queryOrLimit === "number"
      ? { limit: queryOrLimit }
      : { ...(queryOrLimit ?? {}) };
  return invoke<InstallHistoryEntry[]>("get_install_history", query);
};

export const getPackageHistory = (name: string, query?: PackageHistoryQuery) =>
  invoke<InstallHistoryEntry[]>("get_package_history", {
    name,
    ...(query ?? {}),
  });

export const clearInstallHistory = () => invoke<void>("clear_install_history");

// Dependency resolution
export const resolveDependencies = (packages: string[]) =>
  invoke<ResolutionResult>("resolve_dependencies", { packages });

// Advanced search
type InvokeSearchFilters = {
  has_updates?: boolean;
  installed_only?: boolean;
  not_installed?: boolean;
  license?: string[];
  min_version?: string;
  max_version?: string;
};

type InvokeAdvancedSearchOptions = {
  query: string;
  providers?: string[];
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc" | string;
  filters?: InvokeSearchFilters;
};

function toInvokeSearchFilters(
  filters?: SearchFilters,
): InvokeSearchFilters | undefined {
  if (!filters) return undefined;
  return {
    has_updates: filters.hasUpdates,
    installed_only: filters.installedOnly,
    not_installed: filters.notInstalled,
    license: filters.license,
    min_version: filters.minVersion,
    max_version: filters.maxVersion,
  };
}

function toInvokeAdvancedSearchOptions(
  options: AdvancedSearchOptions,
): InvokeAdvancedSearchOptions {
  return {
    query: options.query,
    providers: options.providers,
    limit: options.limit,
    offset: options.offset,
    sort_by: options.sortBy,
    sort_order: options.sortOrder,
    filters: toInvokeSearchFilters(options.filters),
  };
}

export const advancedSearch = (options: AdvancedSearchOptions) =>
  invoke<EnhancedSearchResult>("advanced_search", {
    options: toInvokeAdvancedSearchOptions(options),
  });

export const searchSuggestions = (query: string, limit?: number) =>
  invoke<SearchSuggestion[]>("search_suggestions", { query, limit });

// Package comparison
export const comparePackages = (packages: [string, string | null][]) =>
  invoke<PackageComparison>("compare_packages", { packages });

// Self update
export const selfCheckUpdate = () =>
  invoke<SelfUpdateInfo>("self_check_update");
export const selfUpdate = () => invoke<void>("self_update");

export async function listenSelfUpdateProgress(
  callback: (progress: SelfUpdateProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<SelfUpdateProgressEvent>("self-update-progress", (event) => {
    callback(event.payload);
  });
}

// Manifest operations
export const manifestRead = (projectPath?: string) =>
  invoke<ManifestInfo | null>("manifest_read", { projectPath });
export const manifestInit = (projectPath?: string) =>
  invoke<void>("manifest_init", { projectPath });

// Log operations
export const logListFiles = () => invoke<LogFileInfo[]>("log_list_files");
export const logQuery = (options: LogQueryOptions) =>
  invoke<LogQueryResult>("log_query", { options });
export const logClear = (fileName?: string) =>
  invoke<void>("log_clear", { fileName });
export const logGetDir = () => invoke<string>("log_get_dir");
export const logExport = (options: LogExportOptions) =>
  invoke<LogExportResult>("log_export", { options });
export const logGetTotalSize = () => invoke<number>("log_get_total_size");
export const logCleanup = () => invoke<LogCleanupResult>("log_cleanup");
export const logCleanupPreview = () =>
  invoke<LogCleanupPreviewResult>("log_cleanup_preview");
export const logDeleteFile = (fileName: string) =>
  invoke<void>("log_delete_file", { fileName });
export const logDeleteBatch = (fileNames: string[]) =>
  invoke<LogCleanupResult>("log_delete_batch", { fileNames });

// Diagnostic commands
export const diagnosticExportBundle = (options: DiagnosticExportOptions) =>
  invoke<DiagnosticExportResult>("diagnostic_export_bundle", { options });
export const diagnosticCaptureFrontendCrash = (
  options: DiagnosticCaptureFrontendCrashOptions,
) => invoke<CrashInfo>("diagnostic_capture_frontend_crash", { options });
export const diagnosticGetDefaultExportPath = () =>
  invoke<string>("diagnostic_get_default_export_path");
export const diagnosticCheckLastCrash = () =>
  invoke<CrashInfo | null>("diagnostic_check_last_crash");
export const diagnosticDismissCrash = () =>
  invoke<void>("diagnostic_dismiss_crash");

// Command output streaming event
export async function listenCommandOutput(
  callback: (event: CommandOutputEvent) => void,
): Promise<UnlistenFn> {
  return listen<CommandOutputEvent>("command-output", (event) => {
    callback(event.payload);
  });
}

// ===== Download Manager Commands =====

export const downloadAdd = (request: DownloadRequest) =>
  invoke<string>("download_add", { request });

export const downloadGet = (taskId: string) =>
  invoke<DownloadTask | null>("download_get", { taskId });

export const downloadList = () => invoke<DownloadTask[]>("download_list");

export const downloadStats = () => invoke<DownloadQueueStats>("download_stats");

export const downloadPause = (taskId: string) =>
  invoke<void>("download_pause", { taskId });

export const downloadResume = (taskId: string) =>
  invoke<void>("download_resume", { taskId });

export const downloadCancel = (taskId: string) =>
  invoke<void>("download_cancel", { taskId });

export const downloadRemove = (taskId: string) =>
  invoke<boolean>("download_remove", { taskId });

export const downloadPauseAll = () => invoke<number>("download_pause_all");

export const downloadResumeAll = () => invoke<number>("download_resume_all");

export const downloadCancelAll = () => invoke<number>("download_cancel_all");

export const downloadClearFinished = () =>
  invoke<number>("download_clear_finished");

export const downloadRetryFailed = () =>
  invoke<number>("download_retry_failed");

export const downloadSetSpeedLimit = (bytesPerSecond: number) =>
  invoke<void>("download_set_speed_limit", { bytesPerSecond });

export const downloadGetSpeedLimit = () =>
  invoke<number>("download_get_speed_limit");

export const downloadSetMaxConcurrent = (max: number) =>
  invoke<void>("download_set_max_concurrent", { max });

export const downloadGetMaxConcurrent = () =>
  invoke<number>("download_get_max_concurrent");

export const downloadVerifyFile = (path: string, expectedChecksum: string) =>
  invoke<VerifyResult>("download_verify_file", { path, expectedChecksum });

export const downloadOpenFile = (path: string) =>
  invoke<void>("download_open_file", { path });

export const downloadRevealFile = (path: string) =>
  invoke<void>("download_reveal_file", { path });

export const downloadBatchPause = (taskIds: string[]) =>
  invoke<number>("download_batch_pause", { taskIds });

export const downloadBatchResume = (taskIds: string[]) =>
  invoke<number>("download_batch_resume", { taskIds });

export const downloadBatchCancel = (taskIds: string[]) =>
  invoke<number>("download_batch_cancel", { taskIds });

export const downloadBatchRemove = (taskIds: string[]) =>
  invoke<number>("download_batch_remove", { taskIds });

export const downloadShutdown = () => invoke<void>("download_shutdown");

export const downloadSetPriority = (taskId: string, priority: number) =>
  invoke<void>("download_set_priority", { taskId, priority });

export const downloadSetTaskSpeedLimit = (
  taskId: string,
  bytesPerSecond: number,
) => invoke<void>("download_set_task_speed_limit", { taskId, bytesPerSecond });

export const downloadRetry = (taskId: string) =>
  invoke<void>("download_retry", { taskId });

export const downloadCalculateChecksum = (path: string) =>
  invoke<string>("download_calculate_checksum", { path });

// Download history commands
export const downloadHistoryList = (limit?: number) =>
  invoke<DownloadHistoryRecord[]>("download_history_list", { limit });

export const downloadHistorySearch = (query: string) =>
  invoke<DownloadHistoryRecord[]>("download_history_search", { query });

export const downloadHistoryStats = () =>
  invoke<DownloadHistoryStats>("download_history_stats");

export const downloadHistoryClear = (days?: number) =>
  invoke<number>("download_history_clear", { days });

export const downloadHistoryRemove = (id: string) =>
  invoke<boolean>("download_history_remove", { id });

// Disk space commands
export const diskSpaceGet = (path: string) =>
  invoke<DiskSpaceInfo>("disk_space_get", { path });

export const diskSpaceCheck = (path: string, required: number) =>
  invoke<boolean>("disk_space_check", { path, required });

/** Extract an archive to a destination directory */
export const downloadExtract = (archivePath: string, destPath: string) =>
  invoke<string[]>("download_extract", { archivePath, destPath });

// Download event listeners
export async function listenDownloadTaskAdded(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-added", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskStarted(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-started", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskProgress(
  callback: (taskId: string, progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string; progress: DownloadProgress }>(
    "download-task-progress",
    (event) => {
      callback(event.payload.task_id, event.payload.progress);
    },
  );
}

export async function listenDownloadTaskCompleted(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-completed", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskFailed(
  callback: (taskId: string, error: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string; error: string }>(
    "download-task-failed",
    (event) => {
      callback(event.payload.task_id, event.payload.error);
    },
  );
}

export async function listenDownloadTaskPaused(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-paused", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskResumed(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-resumed", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskCancelled(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-cancelled", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskExtracting(
  callback: (taskId: string) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string }>("download-task-extracting", (event) => {
    callback(event.payload.task_id);
  });
}

export async function listenDownloadTaskExtracted(
  callback: (taskId: string, files: string[]) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string; files: string[] }>(
    "download-task-extracted",
    (event) => {
      callback(event.payload.task_id, event.payload.files);
    },
  );
}

export async function listenDownloadQueueUpdated(
  callback: (stats: DownloadQueueStats) => void,
): Promise<UnlistenFn> {
  return listen<{ stats: DownloadQueueStats }>(
    "download-queue-updated",
    (event) => {
      callback(event.payload.stats);
    },
  );
}

// ===== System Tray Commands =====

export const traySetIconState = (iconState: TrayIconState) =>
  invoke<void>("tray_set_icon_state", { iconState });

export const trayUpdateTooltip = () => invoke<void>("tray_update_tooltip");

export const traySetActiveDownloads = (count: number) =>
  invoke<void>("tray_set_active_downloads", { count });

export const traySetHasUpdate = (hasUpdate: boolean) =>
  invoke<void>("tray_set_has_update", { hasUpdate });

export const traySetHasError = (hasError: boolean) =>
  invoke<void>("tray_set_has_error", { hasError });

export const traySetLanguage = (language: TrayLanguage) =>
  invoke<void>("tray_set_language", { language });

export const traySetClickBehavior = (behavior: TrayClickBehavior) =>
  invoke<void>("tray_set_click_behavior", { behavior });

export const traySetShowNotifications = (enabled: boolean) =>
  invoke<void>("tray_set_show_notifications", { enabled });

export const traySetNotificationLevel = (level: TrayNotificationLevel) =>
  invoke<void>("tray_set_notification_level", { level });

export const trayGetState = () => invoke<TrayStateInfo>("tray_get_state");

export const trayIsAutostartEnabled = () =>
  invoke<boolean>("tray_is_autostart_enabled");

export const trayEnableAutostart = () => invoke<void>("tray_enable_autostart");

export const trayDisableAutostart = () =>
  invoke<void>("tray_disable_autostart");

export const traySendNotification = (
  title: string,
  body: string,
  important: boolean = false,
) => invoke<void>("tray_send_notification", { title, body, important });

export const trayRebuild = () => invoke<void>("tray_rebuild");

export const traySetMinimizeToTray = (enabled: boolean) =>
  invoke<void>("tray_set_minimize_to_tray", { enabled });

export const traySetStartMinimized = (enabled: boolean) =>
  invoke<void>("tray_set_start_minimized", { enabled });

export const traySetAlwaysOnTop = (enabled: boolean) =>
  invoke<void>("tray_set_always_on_top", { enabled });

export const trayGetMenuConfig = () =>
  invoke<TrayMenuConfig>("tray_get_menu_config");

export const traySetMenuConfig = (config: TrayMenuConfig) =>
  invoke<void>("tray_set_menu_config", { config });

export const trayGetAvailableMenuItems = () =>
  invoke<TrayMenuItemId[]>("tray_get_available_menu_items");

export const trayResetMenuConfig = () => invoke<void>("tray_reset_menu_config");

// Listen for navigation events from tray
export async function listenNavigate(
  callback: (path: string) => void,
): Promise<UnlistenFn> {
  return listen<string>("navigate", (event) => {
    callback(event.payload);
  });
}

// Listen for check-updates events from tray
export async function listenCheckUpdates(
  callback: () => void,
): Promise<UnlistenFn> {
  return listen<void>("check-updates", () => {
    callback();
  });
}

// Listen for download pause/resume events from tray
export async function listenDownloadPauseAll(
  callback: () => void,
): Promise<UnlistenFn> {
  return listen<void>("download-pause-all", () => {
    callback();
  });
}

export async function listenDownloadResumeAll(
  callback: () => void,
): Promise<UnlistenFn> {
  return listen<void>("download-resume-all", () => {
    callback();
  });
}

// Listen for always-on-top toggle from tray
export async function listenToggleAlwaysOnTop(
  callback: (enabled: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>("toggle-always-on-top", (event) => {
    callback(event.payload);
  });
}

export async function listenTrayShowNotificationsChanged(
  callback: (enabled: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>("tray-show-notifications-changed", (event) => {
    callback(event.payload);
  });
}

// ===== Custom Detection Rules Commands =====

/** List all custom detection rules */
export const customRuleList = () =>
  invoke<CustomDetectionRule[]>("custom_rule_list");

/** Get a specific rule by ID */
export const customRuleGet = (ruleId: string) =>
  invoke<CustomDetectionRule | null>("custom_rule_get", { ruleId });

/** Add a new custom detection rule */
export const customRuleAdd = (rule: CustomDetectionRule) =>
  invoke<void>("custom_rule_add", { rule });

/** Update an existing rule */
export const customRuleUpdate = (rule: CustomDetectionRule) =>
  invoke<void>("custom_rule_update", { rule });

/** Delete a rule */
export const customRuleDelete = (ruleId: string) =>
  invoke<void>("custom_rule_delete", { ruleId });

/** Enable or disable a rule */
export const customRuleToggle = (ruleId: string, enabled: boolean) =>
  invoke<void>("custom_rule_toggle", { ruleId, enabled });

/** Get preset rules (built-in templates) */
export const customRulePresets = () =>
  invoke<CustomDetectionRule[]>("custom_rule_presets");

/** Import preset rules by their IDs */
export const customRuleImportPresets = (presetIds: string[]) =>
  invoke<string[]>("custom_rule_import_presets", { presetIds });

/** Detect version using custom rules for a specific environment */
export const customRuleDetect = (envType: string, startPath: string) =>
  invoke<CustomDetectionResult | null>("custom_rule_detect", {
    envType,
    startPath,
  });

/** Detect all versions using custom rules */
export const customRuleDetectAll = (startPath: string) =>
  invoke<CustomDetectionResult[]>("custom_rule_detect_all", { startPath });

/** Test a rule against a specific file */
export const customRuleTest = (rule: CustomDetectionRule, testPath: string) =>
  invoke<TestRuleResult>("custom_rule_test", { rule, testPath });

/** Validate a regex pattern */
export const customRuleValidateRegex = (pattern: string) =>
  invoke<RegexValidation>("custom_rule_validate_regex", { pattern });

/** Export rules to JSON string */
export const customRuleExport = () => invoke<string>("custom_rule_export");

/** Import rules from JSON string */
export const customRuleImport = (json: string, overwrite: boolean = false) =>
  invoke<ImportRulesResult>("custom_rule_import", { json, overwrite });

/** List rules for a specific environment type */
export const customRuleListByEnv = (envType: string) =>
  invoke<CustomDetectionRule[]>("custom_rule_list_by_env", { envType });

/** Get supported extraction strategy types */
export const customRuleExtractionTypes = () =>
  invoke<ExtractionTypeInfo[]>("custom_rule_extraction_types");

// ===== Health Check Commands =====

/** Check health of all environments and package managers */
export const healthCheckAll = () =>
  invoke<SystemHealthResult>("health_check_all");

/** Check health of a specific environment */
export const healthCheckEnvironment = (envType: string) =>
  invoke<EnvironmentHealthResult>("health_check_environment", { envType });

/** Check health of all package managers */
export const healthCheckPackageManagers = () =>
  invoke<PackageManagerHealthResult[]>("health_check_package_managers");

/** Check health of a single package manager/provider */
export const healthCheckPackageManager = (providerId: string) =>
  invoke<PackageManagerHealthResult>("health_check_package_manager", {
    providerId,
  });

/** Preview or apply a supported health remediation */
export const healthCheckFix = (remediationId: string, dryRun = true) =>
  invoke<HealthRemediationResult>("health_check_fix", {
    remediationId,
    dryRun,
  });

// ===== Environment Profiles Commands =====

/** List all profiles */
export const profileList = () => invoke<EnvironmentProfile[]>("profile_list");

/** Get a profile by ID */
export const profileGet = (id: string) =>
  invoke<EnvironmentProfile | null>("profile_get", { id });

/** Create a new profile */
export const profileCreate = (
  name: string,
  description: string | null,
  environments: ProfileEnvironment[],
) =>
  invoke<EnvironmentProfile>("profile_create", {
    name,
    description,
    environments,
  });

/** Update an existing profile */
export const profileUpdate = (profile: EnvironmentProfile) =>
  invoke<EnvironmentProfile>("profile_update", { profile });

/** Delete a profile */
export const profileDelete = (id: string) =>
  invoke<void>("profile_delete", { id });

/** Apply a profile (switch to all specified versions) */
export const profileApply = (id: string) =>
  invoke<ProfileApplyResult>("profile_apply", { id });

/** Export a profile to JSON */
export const profileExport = (id: string) =>
  invoke<string>("profile_export", { id });

/** Import a profile from JSON */
export const profileImport = (json: string) =>
  invoke<EnvironmentProfile>("profile_import", { json });

/** Create a profile from current environment state */
export const profileCreateFromCurrent = (name: string) =>
  invoke<EnvironmentProfile>("profile_create_from_current", { name });

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
} from "@/types/github";

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
  invoke<GitHubParsedRepo | null>("github_parse_url", { url });

/** Validate if a repository exists (with optional token for private repos) */
export const githubValidateRepo = (repo: string, token?: string) =>
  invoke<boolean>("github_validate_repo", { repo, token: token || null });

/** Get repository metadata (description, stars, license, etc.) */
export const githubGetRepoInfo = (repo: string, token?: string) =>
  invoke<GitHubRepoInfoResponse>("github_get_repo_info", {
    repo,
    token: token || null,
  });

/** List branches from a repository */
export const githubListBranches = (repo: string, token?: string) =>
  invoke<GitHubBranchInfo[]>("github_list_branches", {
    repo,
    token: token || null,
  });

/** List tags from a repository */
export const githubListTags = (repo: string, token?: string) =>
  invoke<GitHubTagInfo[]>("github_list_tags", { repo, token: token || null });

/** List releases from a repository */
export const githubListReleases = (repo: string, token?: string) =>
  invoke<GitHubReleaseInfo[]>("github_list_releases", {
    repo,
    token: token || null,
  });

/** Get assets for a specific release by tag */
export const githubGetReleaseAssets = (
  repo: string,
  tag: string,
  token?: string,
) =>
  invoke<GitHubAssetInfo[]>("github_get_release_assets", {
    repo,
    tag,
    token: token || null,
  });

/** Download a release asset to the download queue */
export const githubDownloadAsset = (
  repo: string,
  assetId: number,
  assetUrl: string,
  assetName: string,
  destination: string,
  token?: string,
) =>
  invoke<string>("github_download_asset", {
    repo,
    assetId,
    assetUrl,
    assetName,
    destination,
    token: token || null,
  });

/** Download source archive (zip/tar.gz) to the download queue */
export const githubDownloadSource = (
  repo: string,
  refName: string,
  format: "zip" | "tar.gz",
  destination: string,
  token?: string,
) =>
  invoke<string>("github_download_source", {
    repo,
    refName,
    format,
    destination,
    token: token || null,
  });

/** Save a GitHub token to settings */
export const githubSetToken = (token: string) =>
  invoke<void>("github_set_token", { token });

/** Get the saved GitHub token (from settings or env) */
export const githubGetToken = () => invoke<string | null>("github_get_token");

/** Clear the saved GitHub token */
export const githubClearToken = () => invoke<void>("github_clear_token");

/** Validate a GitHub token by making an authenticated API call */
export const githubValidateToken = (token: string) =>
  invoke<boolean>("github_validate_token", { token });

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
  GitLabSearchResult,
  GitLabPipelineInfo,
  GitLabJobInfo,
  GitLabPackageInfo,
  GitLabPackageFileInfo,
} from "@/types/gitlab";

export type {
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabReleaseInfo,
  GitLabAssetInfo,
  GitLabParsedProject,
  GitLabProjectInfo,
  GitLabSearchResult,
  GitLabPipelineInfo,
  GitLabJobInfo,
  GitLabPackageInfo,
  GitLabPackageFileInfo,
};

/** Parse a GitLab URL or owner/repo string */
export const gitlabParseUrl = (url: string) =>
  invoke<GitLabParsedProject | null>("gitlab_parse_url", { url });

/** Validate if a GitLab project exists (with optional token for private repos) */
export const gitlabValidateProject = (
  project: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<boolean>("gitlab_validate_project", {
    project,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Get GitLab project info */
export const gitlabGetProjectInfo = (
  project: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabProjectInfo>("gitlab_get_project_info", {
    project,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List branches from a GitLab project */
export const gitlabListBranches = (
  project: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabBranchInfo[]>("gitlab_list_branches", {
    project,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List tags from a GitLab project */
export const gitlabListTags = (
  project: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabTagInfo[]>("gitlab_list_tags", {
    project,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List releases from a GitLab project */
export const gitlabListReleases = (
  project: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabReleaseInfo[]>("gitlab_list_releases", {
    project,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Get assets for a specific GitLab release by tag */
export const gitlabGetReleaseAssets = (
  project: string,
  tag: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabAssetInfo[]>("gitlab_get_release_assets", {
    project,
    tag,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Download a GitLab release asset to the download queue */
export const gitlabDownloadAsset = (
  project: string,
  assetUrl: string,
  assetName: string,
  destination: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<string>("gitlab_download_asset", {
    project,
    assetUrl,
    assetName,
    destination,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Download source archive from GitLab to the download queue */
export const gitlabDownloadSource = (
  project: string,
  refName: string,
  format: "zip" | "tar.gz" | "tar.bz2" | "tar",
  destination: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<string>("gitlab_download_source", {
    project,
    refName,
    format,
    destination,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Save a GitLab token to settings */
export const gitlabSetToken = (token: string) =>
  invoke<void>("gitlab_set_token", { token });

/** Get the saved GitLab token (from settings or env) */
export const gitlabGetToken = () => invoke<string | null>("gitlab_get_token");

/** Clear the saved GitLab token */
export const gitlabClearToken = () => invoke<void>("gitlab_clear_token");

/** Validate a GitLab token by making an authenticated API call */
export const gitlabValidateToken = (token: string, instanceUrl?: string) =>
  invoke<boolean>("gitlab_validate_token", {
    token,
    instanceUrl: instanceUrl || null,
  });

/** Search GitLab projects */
export const gitlabSearchProjects = (
  query: string,
  limit?: number,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabSearchResult[]>("gitlab_search_projects", {
    query,
    limit: limit ?? null,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List pipelines for a GitLab project */
export const gitlabListPipelines = (
  project: string,
  refName?: string,
  status?: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabPipelineInfo[]>("gitlab_list_pipelines", {
    project,
    refName: refName || null,
    status: status || null,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List jobs for a GitLab pipeline */
export const gitlabListPipelineJobs = (
  project: string,
  pipelineId: number,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabJobInfo[]>("gitlab_list_pipeline_jobs", {
    project,
    pipelineId,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Download job artifacts from a GitLab CI job */
export const gitlabDownloadJobArtifacts = (
  project: string,
  jobId: number,
  jobName: string,
  destination: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<string>("gitlab_download_job_artifacts", {
    project,
    jobId,
    jobName,
    destination,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List packages in a GitLab project's package registry */
export const gitlabListPackages = (
  project: string,
  packageType?: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabPackageInfo[]>("gitlab_list_packages", {
    project,
    packageType: packageType || null,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** List files for a GitLab package */
export const gitlabListPackageFiles = (
  project: string,
  packageId: number,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<GitLabPackageFileInfo[]>("gitlab_list_package_files", {
    project,
    packageId,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Download a file from a GitLab package */
export const gitlabDownloadPackageFile = (
  project: string,
  packageId: number,
  fileName: string,
  destination: string,
  token?: string,
  instanceUrl?: string,
) =>
  invoke<string>("gitlab_download_package_file", {
    project,
    packageId,
    fileName,
    destination,
    token: token || null,
    instanceUrl: instanceUrl || null,
  });

/** Save a custom GitLab instance URL to settings */
export const gitlabSetInstanceUrl = (url: string) =>
  invoke<void>("gitlab_set_instance_url", { url });

/** Get the saved GitLab instance URL */
export const gitlabGetInstanceUrl = () =>
  invoke<string | null>("gitlab_get_instance_url");

// ============================================================================
// Filesystem Utility Commands
// ============================================================================

/** Validate a filesystem path (existence, permissions, traversal, cross-platform) */
export const validatePath = (path: string, expectDirectory: boolean = true) =>
  invoke<PathValidationResult>("validate_path", { path, expectDirectory });

// ============================================================================
// WSL Commands
// ============================================================================

/** Check if WSL is available on this system */
export const wslIsAvailable = () => invoke<boolean>("wsl_is_available");

/** List all installed WSL distributions with state and version */
export const wslListDistros = () =>
  invoke<WslDistroStatus[]>("wsl_list_distros");

/** List available WSL distributions from the online store */
export const wslListOnline = () =>
  invoke<[string, string][]>("wsl_list_online");

/** Get WSL system status (version, kernel, running distros) */
export const wslGetStatus = () => invoke<WslStatus>("wsl_status");

/** Terminate a specific running WSL distribution */
export const wslTerminate = (name: string) =>
  invoke<void>("wsl_terminate", { name });

/** Shutdown all running WSL instances */
export const wslShutdown = () => invoke<void>("wsl_shutdown");

/** Set the default WSL distribution */
export const wslSetDefault = (name: string) =>
  invoke<void>("wsl_set_default", { name });

/** Set WSL version (1 or 2) for a specific distribution */
export const wslSetVersion = (name: string, version: number) =>
  invoke<void>("wsl_set_version", { name, version });

/** Set the default WSL version for new installations */
export const wslSetDefaultVersion = (version: number) =>
  invoke<void>("wsl_set_default_version", { version });

/** Move a WSL distribution to a new location */
export const wslMoveDistro = (name: string, location: string) =>
  invoke<string>("wsl_move_distro", { name, location });

/** Resize a WSL distribution virtual disk */
export const wslResizeDistro = (name: string, size: string) =>
  invoke<string>("wsl_resize_distro", { name, size });

/** Export a WSL distribution to a tar/vhdx file */
export const wslExport = (name: string, filePath: string, asVhd?: boolean) =>
  invoke<void>("wsl_export", { name, filePath, asVhd });

/** Import a WSL distribution from a tar/vhdx file */
export const wslImport = (options: WslImportOptions) =>
  invoke<void>("wsl_import", { options });

/** Update the WSL kernel to the latest version */
export const wslUpdate = () => invoke<string>("wsl_update");

/** Launch/start a WSL distribution */
export const wslLaunch = (name: string, user?: string) =>
  invoke<void>("wsl_launch", { name, user });

/** List currently running WSL distributions */
export const wslListRunning = () => invoke<string[]>("wsl_list_running");

/** Execute a command inside a WSL distribution */
export const wslExec = (distro: string, command: string, user?: string) =>
  invoke<WslExecResult>("wsl_exec", { distro, command, user });

/** Convert a path between Windows and WSL formats */
export const wslConvertPath = (
  path: string,
  distro?: string,
  toWindows?: boolean,
) =>
  invoke<string>("wsl_convert_path", {
    path,
    distro,
    toWindows: toWindows ?? false,
  });

/** Read the global .wslconfig file */
export const wslGetConfig = () => invoke<WslConfig>("wsl_get_config");

/** Write or remove a setting in the global .wslconfig file */
export const wslSetConfig = (section: string, key: string, value?: string) =>
  invoke<void>("wsl_set_config", { section, key, value });

/** Get disk usage for a WSL distribution */
export const wslDiskUsage = (name: string) =>
  invoke<WslDiskUsage>("wsl_disk_usage", { name });

/** Import a distribution in-place from an existing .vhdx file */
export const wslImportInPlace = (name: string, vhdxPath: string) =>
  invoke<void>("wsl_import_in_place", { name, vhdxPath });

/** Mount a physical or virtual disk in WSL2 */
export const wslMount = (options: WslMountOptions) =>
  invoke<string>("wsl_mount", { options });

/** Unmount a previously mounted disk (or all if no path given) */
export const wslUnmount = (diskPath?: string) =>
  invoke<void>("wsl_unmount", { diskPath });

/** Get the IP address of a WSL distribution */
export const wslGetIp = (distro?: string) =>
  invoke<string>("wsl_get_ip", { distro });

/** Change the default user for a distribution */
export const wslChangeDefaultUser = (distro: string, username: string) =>
  invoke<void>("wsl_change_default_user", { distro, username });

/** Read the per-distro /etc/wsl.conf file */
export const wslGetDistroConfig = (distro: string) =>
  invoke<WslDistroConfig>("wsl_get_distro_config", { distro });

/** Write or remove a setting in the per-distro /etc/wsl.conf file */
export const wslSetDistroConfig = (
  distro: string,
  section: string,
  key: string,
  value?: string,
) => invoke<void>("wsl_set_distro_config", { distro, section, key, value });

/** Get full WSL version info (all component versions) */
export const wslGetVersionInfo = () =>
  invoke<WslVersionInfo>("wsl_get_version_info");

/** Get runtime WSL capability flags */
export const wslGetCapabilities = () =>
  invoke<WslCapabilities>("wsl_get_capabilities");

/** Set sparse VHD mode for a WSL distribution */
export const wslSetSparse = (distro: string, enabled: boolean) =>
  invoke<void>("wsl_set_sparse", { distro, enabled });

/** Install WSL engine only, without a default distribution */
export const wslInstallWslOnly = () => invoke<string>("wsl_install_wsl_only");

/** Install a distribution to a custom location */
export const wslInstallWithLocation = (name: string, location: string) =>
  invoke<string>("wsl_install_with_location", { name, location });

/** Diagnostic: returns step-by-step WSL detection info for debugging */
export const wslDebugDetection = () =>
  invoke<Record<string, unknown>>("wsl_debug_detection");

/** Detect the environment inside a WSL distribution (os-release, package manager, etc.) */
export const wslDetectDistroEnv = (distro: string) =>
  invoke<WslDistroEnvironment>("wsl_detect_distro_env", { distro });

/** Get live resource usage (memory, swap, CPU, load) from a running WSL distribution */
export const wslGetDistroResources = (distro: string) =>
  invoke<WslDistroResources>("wsl_get_distro_resources", { distro });

/** List non-system users in a WSL distribution */
export const wslListUsers = (distro: string) =>
  invoke<WslUser[]>("wsl_list_users", { distro });

/** Update or upgrade packages in a WSL distribution */
export const wslUpdateDistroPackages = (distro: string, mode: string) =>
  invoke<WslPackageUpdateResult>("wsl_update_distro_packages", {
    distro,
    mode,
  });

/** Open a WSL distribution's filesystem in Windows Explorer */
export const wslOpenInExplorer = (name: string) =>
  invoke<void>("wsl_open_in_explorer", { name });

/** Open a WSL distribution in Windows Terminal or fallback shell */
export const wslOpenInTerminal = (name: string) =>
  invoke<void>("wsl_open_in_terminal", { name });

/** Clone a WSL distribution (export → import under a new name) */
export const wslCloneDistro = (
  name: string,
  newName: string,
  location: string,
) => invoke<string>("wsl_clone_distro", { name, newName, location });

/** Get total disk usage across all WSL distributions */
export const wslTotalDiskUsage = () =>
  invoke<[number, [string, number][]]>("wsl_total_disk_usage");

/** Launch multiple WSL distributions in parallel */
export const wslBatchLaunch = (names: string[]) =>
  invoke<[string, boolean, string][]>("wsl_batch_launch", { names });

/** Terminate multiple WSL distributions in parallel */
export const wslBatchTerminate = (names: string[]) =>
  invoke<[string, boolean, string][]>("wsl_batch_terminate", { names });

/** List all Windows port forwarding rules (netsh portproxy) */
export const wslListPortForwards = () =>
  invoke<
    {
      listenAddress: string;
      listenPort: string;
      connectAddress: string;
      connectPort: string;
    }[]
  >("wsl_list_port_forwards");

/** Add a port forwarding rule (requires admin) */
export const wslAddPortForward = (
  listenPort: number,
  connectPort: number,
  connectAddress: string,
) =>
  invoke<void>("wsl_add_port_forward", {
    listenPort,
    connectPort,
    connectAddress,
  });

/** Remove a port forwarding rule (requires admin) */
export const wslRemovePortForward = (listenPort: number) =>
  invoke<void>("wsl_remove_port_forward", { listenPort });

/** Run a health check on a WSL distribution */
export const wslDistroHealthCheck = (distro: string) =>
  invoke<{
    status: string;
    issues: { severity: string; category: string; message: string }[];
    checkedAt: string;
  }>("wsl_distro_health_check", { distro });

/** Backup a WSL distribution to a timestamped tar file */
export const wslBackupDistro = (name: string, destDir: string) =>
  invoke<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
    createdAt: string;
    distroName: string;
  }>("wsl_backup_distro", { name, destDir });

/** List WSL backup files in a directory */
export const wslListBackups = (backupDir: string) =>
  invoke<
    {
      fileName: string;
      filePath: string;
      sizeBytes: number;
      createdAt: string;
      distroName: string;
    }[]
  >("wsl_list_backups", { backupDir });

/** Restore a WSL distribution from a backup file */
export const wslRestoreBackup = (
  backupPath: string,
  name: string,
  installLocation: string,
) => invoke<void>("wsl_restore_backup", { backupPath, name, installLocation });

/** Delete a WSL backup file */
export const wslDeleteBackup = (backupPath: string) =>
  invoke<void>("wsl_delete_backup", { backupPath });

// ============================================================================
// Launch Commands
// ============================================================================

/** Launch a program with a specific environment version */
export const launchWithEnv = (request: LaunchRequest) =>
  invoke<LaunchResult>("launch_with_env", { request });

/** Launch a program with streaming output via events */
export const launchWithStreaming = (request: LaunchRequest) =>
  invoke<LaunchResult>("launch_with_streaming", { request });

/** Get shell activation script for a specific environment */
export const envActivate = (
  envType: string,
  version?: string,
  projectPath?: string,
  shell?: string,
) =>
  invoke<ActivationScript>("env_activate", {
    envType,
    version,
    projectPath,
    shell,
  });

/** Get environment info for display */
export const envGetInfo = (envType: string, version: string) =>
  invoke<EnvInfoResult>("env_get_info", { envType, version });

/** Execute a shell command with a specific environment */
export const execShellWithEnv = (
  command: string,
  envType?: string,
  envVersion?: string,
  cwd?: string,
) =>
  invoke<LaunchResult>("exec_shell_with_env", {
    command,
    envType,
    envVersion,
    cwd,
  });

/** Check which version of a program would be used */
export const whichProgram = (
  program: string,
  envType?: string,
  envVersion?: string,
  cwd?: string,
) =>
  invoke<string | null>("which_program", { program, envType, envVersion, cwd });

// ============================================================================
// Shim Commands
// ============================================================================

/** Create a new shim for a binary */
export const shimCreate = (
  binaryName: string,
  envType: string,
  version: string | null,
  targetPath: string,
) =>
  invoke<string>("shim_create", { binaryName, envType, version, targetPath });

/** Remove a shim */
export const shimRemove = (binaryName: string) =>
  invoke<boolean>("shim_remove", { binaryName });

/** List all shims */
export const shimList = () => invoke<ShimInfo[]>("shim_list");

/** Update a shim to point to a new version */
export const shimUpdate = (binaryName: string, version?: string) =>
  invoke<void>("shim_update", { binaryName, version });

/** Regenerate all shims */
export const shimRegenerateAll = () => invoke<void>("shim_regenerate_all");

// ============================================================================
// PATH Management Commands
// ============================================================================

/** Get PATH status and shim directory info */
export const pathStatus = () => invoke<PathStatusInfo>("path_status");

/** Add shim directory to PATH */
export const pathSetup = () => invoke<void>("path_setup");

/** Remove shim directory from PATH */
export const pathRemove = () => invoke<void>("path_remove");

/** Check if shim directory is in PATH */
export const pathCheck = () => invoke<boolean>("path_check");

/** Get the command to manually add shim directory to PATH */
export const pathGetAddCommand = () => invoke<string>("path_get_add_command");

// ============================================================================
// Git Commands
// ============================================================================

/** Check if git is installed and available */
export const gitIsAvailable = () => invoke<boolean>("git_is_available");

/** Get the installed git version string */
export const gitGetVersion = () => invoke<string | null>("git_get_version");

/** Get the git executable path */
export const gitGetExecutablePath = () =>
  invoke<string | null>("git_get_executable_path");

/** Install git via system package manager */
export const gitInstall = () => invoke<string>("git_install");

/** Update git to the latest version */
export const gitUpdate = () => invoke<string>("git_update");

/** Get all global git configuration entries */
export const gitGetConfig = () => invoke<GitConfigEntry[]>("git_get_config");

/** Set a global git config value */
export const gitSetConfig = (key: string, value: string) =>
  invoke<void>("git_set_config", { key, value });

/** Remove a global git config key */
export const gitRemoveConfig = (key: string) =>
  invoke<void>("git_remove_config", { key });

/** Get a single global git config value by key */
export const gitGetConfigValue = (key: string) =>
  invoke<string | null>("git_get_config_value", { key });

/** Get the path to the global git config file */
export const gitGetConfigFilePath = () =>
  invoke<string | null>("git_get_config_file_path");

/** List all git aliases */
export const gitListAliases = () =>
  invoke<GitConfigEntry[]>("git_list_aliases");

/** Set a global git config value only if not already set */
export const gitSetConfigIfUnset = (key: string, value: string) =>
  invoke<boolean>("git_set_config_if_unset", { key, value });

/** Probe whether a preferred editor can open the global git config file */
export const gitProbeEditorCapability = () =>
  invoke<EditorCapabilityProbeResult>("git_probe_editor_capability");

/** Open the global git config file using normalized editor/fallback result contract */
export const gitOpenConfigInEditor = () =>
  invoke<EditorOpenActionResult>("git_open_config_in_editor");

/** Get repository information for a given path */
export const gitGetRepoInfo = (path: string) =>
  invoke<GitRepoInfo>("git_get_repo_info", { path });

/** Get commit log for a repository */
export const gitGetLog = (
  path: string,
  limit?: number,
  author?: string,
  since?: string,
  until?: string,
  file?: string,
) =>
  invoke<GitCommitEntry[]>("git_get_log", {
    path,
    limit,
    author,
    since,
    until,
    file,
  });

/** Get branches for a repository */
export const gitGetBranches = (path: string) =>
  invoke<GitBranchInfo[]>("git_get_branches", { path });

/** Get remotes for a repository */
export const gitGetRemotes = (path: string) =>
  invoke<GitRemoteInfo[]>("git_get_remotes", { path });

/** Get tags for a repository */
export const gitGetTags = (path: string) =>
  invoke<GitTagInfo[]>("git_get_tags", { path });

/** Get stashes for a repository */
export const gitGetStashes = (path: string) =>
  invoke<GitStashEntry[]>("git_get_stashes", { path });

/** Get contributors for a repository */
export const gitGetContributors = (path: string) =>
  invoke<GitContributor[]>("git_get_contributors", { path });

/** Get file history (commits that modified a specific file) */
export const gitGetFileHistory = (path: string, file: string, limit?: number) =>
  invoke<GitCommitEntry[]>("git_get_file_history", { path, file, limit });

/** Get blame information for a file */
export const gitGetBlame = (path: string, file: string) =>
  invoke<GitBlameEntry[]>("git_get_blame", { path, file });

/** Get detailed information about a specific commit */
export const gitGetCommitDetail = (path: string, hash: string) =>
  invoke<GitCommitDetail>("git_get_commit_detail", { path, hash });

/** Get file-level status (full paths) */
export const gitGetStatus = (path: string) =>
  invoke<GitStatusFile[]>("git_get_status", { path });

/** Get graph log for commit graph visualization */
export const gitGetGraphLog = (
  path: string,
  limit?: number,
  allBranches?: boolean,
  firstParent?: boolean,
  branch?: string,
) =>
  invoke<GitGraphEntry[]>("git_get_graph_log", {
    path,
    limit,
    allBranches,
    firstParent,
    branch,
  });

/** Get ahead/behind counts for a branch */
export const gitGetAheadBehind = (
  path: string,
  branch: string,
  upstream?: string,
) => invoke<GitAheadBehind>("git_get_ahead_behind", { path, branch, upstream });

/** Checkout (switch to) a branch */
export const gitCheckoutBranch = (path: string, name: string) =>
  invoke<string>("git_checkout_branch", { path, name });

/** Create a new branch */
export const gitCreateBranch = (
  path: string,
  name: string,
  startPoint?: string,
) => invoke<string>("git_create_branch", { path, name, startPoint });

/** Delete a branch */
export const gitDeleteBranch = (path: string, name: string, force?: boolean) =>
  invoke<string>("git_delete_branch", { path, name, force });

/** Apply a stash */
export const gitStashApply = (path: string, stashId?: string) =>
  invoke<string>("git_stash_apply", { path, stashId });

/** Pop a stash */
export const gitStashPop = (path: string, stashId?: string) =>
  invoke<string>("git_stash_pop", { path, stashId });

/** Drop a stash */
export const gitStashDrop = (path: string, stashId?: string) =>
  invoke<string>("git_stash_drop", { path, stashId });

/** Save (create) a stash */
export const gitStashSave = (
  path: string,
  message?: string,
  includeUntracked?: boolean,
) => invoke<string>("git_stash_save", { path, message, includeUntracked });

/** Create a tag */
export const gitCreateTag = (
  path: string,
  name: string,
  targetRef?: string,
  message?: string,
) => invoke<string>("git_create_tag", { path, name, targetRef, message });

/** Delete a tag */
export const gitDeleteTag = (path: string, name: string) =>
  invoke<string>("git_delete_tag", { path, name });

/** Get activity data for heatmap */
export const gitGetActivity = (path: string, days?: number) =>
  invoke<GitDayActivity[]>("git_get_activity", { path, days });

/** Get file stats for visual file history */
export const gitGetFileStats = (path: string, file: string, limit?: number) =>
  invoke<GitFileStatEntry[]>("git_get_file_stats", { path, file, limit });

/** Search commits by message, author, or diff content */
export const gitSearchCommits = (
  path: string,
  query: string,
  searchType?: string,
  limit?: number,
) =>
  invoke<GitCommitEntry[]>("git_search_commits", {
    path,
    query,
    searchType,
    limit,
  });

// ============================================================================
// Git Write Operations
// ============================================================================

/** Stage specific files */
export const gitStageFiles = (path: string, files: string[]) =>
  invoke<string>("git_stage_files", { path, files });

/** Stage all changes */
export const gitStageAll = (path: string) =>
  invoke<string>("git_stage_all", { path });

/** Unstage specific files */
export const gitUnstageFiles = (path: string, files: string[]) =>
  invoke<string>("git_unstage_files", { path, files });

/** Discard working tree changes for specific files */
export const gitDiscardChanges = (path: string, files: string[]) =>
  invoke<string>("git_discard_changes", { path, files });

/** Create a commit */
export const gitCommit = (
  path: string,
  message: string,
  amend?: boolean,
  allowEmpty?: boolean,
  signoff?: boolean,
  noVerify?: boolean,
) =>
  invoke<string>("git_commit", {
    path,
    message,
    amend,
    allowEmpty,
    signoff,
    noVerify,
  });

/** Push to remote */
export const gitPush = (
  path: string,
  remote?: string,
  branch?: string,
  force?: boolean,
  forceLease?: boolean,
  setUpstream?: boolean,
) =>
  invoke<string>("git_push", {
    path,
    remote,
    branch,
    force,
    forceLease,
    setUpstream,
  });

/** Pull from remote */
export const gitPull = (
  path: string,
  remote?: string,
  branch?: string,
  rebase?: boolean,
  autostash?: boolean,
) => invoke<string>("git_pull", { path, remote, branch, rebase, autostash });

/** Fetch from remote */
export const gitFetch = (
  path: string,
  remote?: string,
  prune?: boolean,
  all?: boolean,
) => invoke<string>("git_fetch", { path, remote, prune, all });

/** Clone a repository */
export const gitClone = (
  url: string,
  destPath: string,
  options?: GitCloneOptions,
) => invoke<string>("git_clone", { url, destPath, options });

/** Cancel the current clone operation */
export const gitCancelClone = () => invoke<void>("git_cancel_clone");

/** Extract repository name from a git URL */
export const gitExtractRepoName = (url: string) =>
  invoke<string | null>("git_extract_repo_name", { url });

/** Validate whether a string looks like a valid git remote URL */
export const gitValidateUrl = (url: string) =>
  invoke<boolean>("git_validate_url", { url });

/** Listen for git clone progress events */
export async function listenGitCloneProgress(
  callback: (progress: GitCloneProgress) => void,
): Promise<UnlistenFn> {
  return listen<GitCloneProgress>("git-clone-progress", (event) => {
    callback(event.payload);
  });
}

/** Initialize a new repository */
export const gitInit = (path: string) => invoke<string>("git_init", { path });

/** Get diff output (working tree or staged changes) */
export const gitGetDiff = (
  path: string,
  staged?: boolean,
  file?: string,
  contextLines?: number,
) => invoke<string>("git_get_diff", { path, staged, file, contextLines });

/** Get diff between two commits */
export const gitGetDiffBetween = (
  path: string,
  from: string,
  to: string,
  file?: string,
  contextLines?: number,
) =>
  invoke<string>("git_get_diff_between", {
    path,
    from,
    to,
    file,
    contextLines,
  });

/** Get the full diff (patch) for a single commit */
export const gitGetCommitDiff = (
  path: string,
  hash: string,
  file?: string,
  contextLines?: number,
) => invoke<string>("git_get_commit_diff", { path, hash, file, contextLines });

/** Merge a branch into current */
export const gitMerge = (path: string, branch: string, noFf?: boolean) =>
  invoke<string>("git_merge", { path, branch, noFf });

/** Revert a commit */
export const gitRevert = (path: string, hash: string, noCommit?: boolean) =>
  invoke<string>("git_revert", { path, hash, noCommit });

/** Cherry-pick a commit */
export const gitCherryPick = (path: string, hash: string) =>
  invoke<string>("git_cherry_pick", { path, hash });

/** Reset HEAD to a target */
export const gitReset = (path: string, mode?: string, target?: string) =>
  invoke<string>("git_reset", { path, mode, target });

// ============================================================================
// Git Remote & Branch Management
// ============================================================================

/** Add a remote */
export const gitRemoteAdd = (path: string, name: string, url: string) =>
  invoke<string>("git_remote_add", { path, name, url });

/** Remove a remote */
export const gitRemoteRemove = (path: string, name: string) =>
  invoke<string>("git_remote_remove", { path, name });

/** Rename a remote */
export const gitRemoteRename = (
  path: string,
  oldName: string,
  newName: string,
) => invoke<string>("git_remote_rename", { path, oldName, newName });

/** Set remote URL */
export const gitRemoteSetUrl = (path: string, name: string, url: string) =>
  invoke<string>("git_remote_set_url", { path, name, url });

/** Rename a branch */
export const gitBranchRename = (
  path: string,
  oldName: string,
  newName: string,
) => invoke<string>("git_branch_rename", { path, oldName, newName });

/** Set upstream tracking branch */
export const gitBranchSetUpstream = (
  path: string,
  branch: string,
  upstream: string,
) => invoke<string>("git_branch_set_upstream", { path, branch, upstream });

/** Push all tags to remote */
export const gitPushTags = (path: string, remote?: string) =>
  invoke<string>("git_push_tags", { path, remote });

/** Delete a remote branch */
export const gitDeleteRemoteBranch = (
  path: string,
  remote: string,
  branch: string,
) => invoke<string>("git_delete_remote_branch", { path, remote, branch });

/** Show stash diff */
export const gitStashShow = (path: string, stashId?: string) =>
  invoke<string>("git_stash_show", { path, stashId });

/** Get reflog entries */
export const gitGetReflog = (path: string, limit?: number) =>
  invoke<GitReflogEntry[]>("git_get_reflog", { path, limit });

/** Remove untracked files */
export const gitClean = (path: string, directories?: boolean) =>
  invoke<string>("git_clean", { path, directories });

/** Dry-run clean: preview which files would be removed */
export const gitCleanDryRun = (path: string, directories?: boolean) =>
  invoke<string[]>("git_clean_dry_run", { path, directories });

/** Stash specific files */
export const gitStashPushFiles = (
  path: string,
  files: string[],
  message?: string,
  includeUntracked?: boolean,
) =>
  invoke<string>("git_stash_push_files", {
    path,
    files,
    message,
    includeUntracked,
  });

/** List submodules */
export const gitListSubmodules = (path: string) =>
  invoke<GitSubmoduleInfo[]>("git_list_submodules", { path });

/** Add a submodule */
export const gitAddSubmodule = (path: string, url: string, subpath: string) =>
  invoke<string>("git_add_submodule", { path, url, subpath });

/** Update submodules */
export const gitUpdateSubmodules = (
  path: string,
  init?: boolean,
  recursive?: boolean,
) => invoke<string>("git_update_submodules", { path, init, recursive });

/** Remove a submodule */
export const gitRemoveSubmodule = (path: string, subpath: string) =>
  invoke<string>("git_remove_submodule", { path, subpath });

/** Sync submodule URLs */
export const gitSyncSubmodules = (path: string) =>
  invoke<string>("git_sync_submodules", { path });

/** List worktrees */
export const gitListWorktrees = (path: string) =>
  invoke<GitWorktreeInfo[]>("git_list_worktrees", { path });

/** Add a worktree */
export const gitAddWorktree = (
  path: string,
  dest: string,
  branch?: string,
  newBranch?: string,
) => invoke<string>("git_add_worktree", { path, dest, branch, newBranch });

/** Remove a worktree */
export const gitRemoveWorktree = (
  path: string,
  dest: string,
  force?: boolean,
) => invoke<string>("git_remove_worktree", { path, dest, force });

/** Prune stale worktrees */
export const gitPruneWorktrees = (path: string) =>
  invoke<string>("git_prune_worktrees", { path });

/** Read .gitignore content */
export const gitGetGitignore = (path: string) =>
  invoke<string>("git_get_gitignore", { path });

/** Write .gitignore content */
export const gitSetGitignore = (path: string, content: string) =>
  invoke<void>("git_set_gitignore", { path, content });

/** Check which files are ignored */
export const gitCheckIgnore = (path: string, files: string[]) =>
  invoke<string[]>("git_check_ignore", { path, files });

/** Append patterns to .gitignore */
export const gitAddToGitignore = (path: string, patterns: string[]) =>
  invoke<void>("git_add_to_gitignore", { path, patterns });

/** List git hooks */
export const gitListHooks = (path: string) =>
  invoke<GitHookInfo[]>("git_list_hooks", { path });

/** Get hook file content */
export const gitGetHookContent = (path: string, name: string) =>
  invoke<string>("git_get_hook_content", { path, name });

/** Set hook file content */
export const gitSetHookContent = (
  path: string,
  name: string,
  content: string,
) => invoke<void>("git_set_hook_content", { path, name, content });

/** Toggle hook enabled/disabled */
export const gitToggleHook = (path: string, name: string, enabled: boolean) =>
  invoke<void>("git_toggle_hook", { path, name, enabled });

/** Check if git-lfs is available */
export const gitLfsIsAvailable = () => invoke<boolean>("git_lfs_is_available");

/** Get LFS version */
export const gitLfsGetVersion = () =>
  invoke<string | null>("git_lfs_get_version");

/** Get LFS tracked patterns */
export const gitLfsTrackedPatterns = (path: string) =>
  invoke<string[]>("git_lfs_tracked_patterns", { path });

/** List LFS files */
export const gitLfsLsFiles = (path: string) =>
  invoke<GitLfsFile[]>("git_lfs_ls_files", { path });

/** Track a pattern with LFS */
export const gitLfsTrack = (path: string, pattern: string) =>
  invoke<string>("git_lfs_track", { path, pattern });

/** Untrack a pattern from LFS */
export const gitLfsUntrack = (path: string, pattern: string) =>
  invoke<string>("git_lfs_untrack", { path, pattern });

/** Install LFS hooks */
export const gitLfsInstall = (path: string) =>
  invoke<string>("git_lfs_install", { path });

/** Rebase current branch onto target */
export const gitRebase = (path: string, onto: string) =>
  invoke<string>("git_rebase", { path, onto });

/** Abort rebase */
export const gitRebaseAbort = (path: string) =>
  invoke<string>("git_rebase_abort", { path });

/** Continue rebase */
export const gitRebaseContinue = (path: string) =>
  invoke<string>("git_rebase_continue", { path });

/** Skip current rebase commit */
export const gitRebaseSkip = (path: string) =>
  invoke<string>("git_rebase_skip", { path });

/** Squash last N commits */
export const gitSquash = (path: string, count: number, message: string) =>
  invoke<string>("git_squash", { path, count, message });

/** Get merge/rebase state */
export const gitGetMergeRebaseState = (path: string) =>
  invoke<GitMergeRebaseState>("git_get_merge_rebase_state", { path });

/** Get conflicted files */
export const gitGetConflictedFiles = (path: string) =>
  invoke<string[]>("git_get_conflicted_files", { path });

/** Resolve conflict using ours */
export const gitResolveFileOurs = (path: string, file: string) =>
  invoke<string>("git_resolve_file_ours", { path, file });

/** Resolve conflict using theirs */
export const gitResolveFileTheirs = (path: string, file: string) =>
  invoke<string>("git_resolve_file_theirs", { path, file });

/** Mark file as resolved */
export const gitResolveFileMark = (path: string, file: string) =>
  invoke<string>("git_resolve_file_mark", { path, file });

/** Abort merge */
export const gitMergeAbort = (path: string) =>
  invoke<string>("git_merge_abort", { path });

/** Continue merge */
export const gitMergeContinue = (path: string) =>
  invoke<string>("git_merge_continue", { path });

// ============================================================================
// Git Advanced Commands (cherry-pick abort/continue, revert abort, stash branch,
// local config, shallow management, repo stats, describe, remote prune,
// verify commit/tag, interactive rebase, bisect, sparse-checkout, archive, patch)
// ============================================================================

/** Abort cherry-pick */
export const gitCherryPickAbort = (path: string) =>
  invoke<string>("git_cherry_pick_abort", { path });

/** Continue cherry-pick */
export const gitCherryPickContinue = (path: string) =>
  invoke<string>("git_cherry_pick_continue", { path });

/** Abort revert */
export const gitRevertAbort = (path: string) =>
  invoke<string>("git_revert_abort", { path });

/** Create branch from stash */
export const gitStashBranch = (
  path: string,
  branchName: string,
  stashId?: string,
) => invoke<string>("git_stash_branch", { path, branchName, stashId });

/** Get local (per-repo) config */
export const gitGetLocalConfig = (path: string) =>
  invoke<GitConfigEntry[]>("git_get_local_config", { path });

/** Set local config value */
export const gitSetLocalConfig = (path: string, key: string, value: string) =>
  invoke<void>("git_set_local_config", { path, key, value });

/** Remove local config key */
export const gitRemoveLocalConfig = (path: string, key: string) =>
  invoke<void>("git_remove_local_config", { path, key });

/** Get local config value */
export const gitGetLocalConfigValue = (path: string, key: string) =>
  invoke<string | null>("git_get_local_config_value", { path, key });

/** Check if repo is shallow */
export const gitIsShallow = (path: string) =>
  invoke<boolean>("git_is_shallow", { path });

/** Deepen shallow clone */
export const gitDeepen = (path: string, depth: number) =>
  invoke<string>("git_deepen", { path, depth });

/** Convert shallow clone to full */
export const gitUnshallow = (path: string) =>
  invoke<string>("git_unshallow", { path });

/** Get repository statistics */
export const gitGetRepoStats = (path: string) =>
  invoke<GitRepoStats>("git_get_repo_stats", { path });

/** Run git fsck */
export const gitFsck = (path: string) => invoke<string[]>("git_fsck", { path });

/** Get git describe */
export const gitDescribe = (path: string) =>
  invoke<string | null>("git_describe", { path });

/** Prune stale remote-tracking branches */
export const gitRemotePrune = (path: string, remote: string) =>
  invoke<string>("git_remote_prune", { path, remote });

/** Verify commit signature */
export const gitVerifyCommit = (path: string, hash: string) =>
  invoke<string>("git_verify_commit", { path, hash });

/** Verify tag signature */
export const gitVerifyTag = (path: string, tag: string) =>
  invoke<string>("git_verify_tag", { path, tag });

/** Get interactive rebase todo preview */
export const gitGetRebaseTodoPreview = (path: string, base: string) =>
  invoke<GitRebaseTodoItem[]>("git_get_rebase_todo_preview", { path, base });

/** Start interactive rebase */
export const gitStartInteractiveRebase = (
  path: string,
  base: string,
  todo: GitRebaseTodoItem[],
) => invoke<string>("git_start_interactive_rebase", { path, base, todo });

/** Start bisect session */
export const gitBisectStart = (path: string, badRef: string, goodRef: string) =>
  invoke<string>("git_bisect_start", { path, badRef, goodRef });

/** Mark current commit as good in bisect */
export const gitBisectGood = (path: string) =>
  invoke<string>("git_bisect_good", { path });

/** Mark current commit as bad in bisect */
export const gitBisectBad = (path: string) =>
  invoke<string>("git_bisect_bad", { path });

/** Skip current commit in bisect */
export const gitBisectSkip = (path: string) =>
  invoke<string>("git_bisect_skip", { path });

/** Reset (end) bisect session */
export const gitBisectReset = (path: string) =>
  invoke<string>("git_bisect_reset", { path });

/** Get bisect log */
export const gitBisectLog = (path: string) =>
  invoke<string>("git_bisect_log", { path });

/** Get current bisect state */
export const gitGetBisectState = (path: string) =>
  invoke<GitBisectState>("git_get_bisect_state", { path });

/** Check if sparse-checkout is enabled */
export const gitIsSparseCheckout = (path: string) =>
  invoke<boolean>("git_is_sparse_checkout", { path });

/** Initialize sparse-checkout */
export const gitSparseCheckoutInit = (path: string, cone?: boolean) =>
  invoke<string>("git_sparse_checkout_init", { path, cone });

/** Set sparse-checkout patterns */
export const gitSparseCheckoutSet = (path: string, patterns: string[]) =>
  invoke<string>("git_sparse_checkout_set", { path, patterns });

/** Add sparse-checkout patterns */
export const gitSparseCheckoutAdd = (path: string, patterns: string[]) =>
  invoke<string>("git_sparse_checkout_add", { path, patterns });

/** List sparse-checkout patterns */
export const gitSparseCheckoutList = (path: string) =>
  invoke<string[]>("git_sparse_checkout_list", { path });

/** Disable sparse-checkout */
export const gitSparseCheckoutDisable = (path: string) =>
  invoke<string>("git_sparse_checkout_disable", { path });

/** Create archive of repository */
export const gitArchive = (
  path: string,
  format: string,
  outputPath: string,
  refName: string,
  prefix?: string,
) =>
  invoke<string>("git_archive", { path, format, outputPath, refName, prefix });

/** Create patch files from commit range */
export const gitFormatPatch = (
  path: string,
  range: string,
  outputDir: string,
) => invoke<string[]>("git_format_patch", { path, range, outputDir });

/** Apply a patch file */
export const gitApplyPatch = (
  path: string,
  patchPath: string,
  checkOnly?: boolean,
) => invoke<string>("git_apply_patch", { path, patchPath, checkOnly });

/** Apply a mailbox patch (git am) */
export const gitApplyMailbox = (path: string, patchPath: string) =>
  invoke<string>("git_apply_mailbox", { path, patchPath });

// ============================================================================
// Environment Variable Management
// ============================================================================

/** List all current process environment variables */
export const envvarListAll = () =>
  invoke<Record<string, string>>("envvar_list_all");

/** Get a specific environment variable */
export const envvarGet = (key: string) =>
  invoke<string | null>("envvar_get", { key });

/** Set a process-level environment variable */
export const envvarSetProcess = (key: string, value: string) =>
  invoke<void>("envvar_set_process", { key, value });

/** Remove a process-level environment variable */
export const envvarRemoveProcess = (key: string) =>
  invoke<void>("envvar_remove_process", { key });

/** Get a persistent environment variable by scope */
export const envvarGetPersistent = (key: string, scope: EnvVarScope) =>
  invoke<string | null>("envvar_get_persistent", { key, scope });

/** Set a persistent environment variable */
export const envvarSetPersistent = (
  key: string,
  value: string,
  scope: EnvVarScope,
) => invoke<void>("envvar_set_persistent", { key, value, scope });

/** Remove a persistent environment variable */
export const envvarRemovePersistent = (key: string, scope: EnvVarScope) =>
  invoke<void>("envvar_remove_persistent", { key, scope });

/** Get PATH entries with existence info */
export const envvarGetPath = (scope: EnvVarScope) =>
  invoke<PathEntryInfo[]>("envvar_get_path", { scope });

/** Add a PATH entry */
export const envvarAddPathEntry = (
  path: string,
  scope: EnvVarScope,
  position?: number,
) => invoke<void>("envvar_add_path_entry", { path, scope, position });

/** Remove a PATH entry */
export const envvarRemovePathEntry = (path: string, scope: EnvVarScope) =>
  invoke<void>("envvar_remove_path_entry", { path, scope });

/** Reorder PATH entries (full replacement) */
export const envvarReorderPath = (entries: string[], scope: EnvVarScope) =>
  invoke<void>("envvar_reorder_path", { entries, scope });

/** List available shell profiles */
export const envvarListShellProfiles = () =>
  invoke<ShellProfileInfo[]>("envvar_list_shell_profiles");

/** Read a shell profile config file */
export const envvarReadShellProfile = (path: string) =>
  invoke<string>("envvar_read_shell_profile", { path });

/** Import variables from .env file content */
export const envvarImportEnvFile = (content: string, scope: EnvVarScope) =>
  invoke<EnvVarImportResult>("envvar_import_env_file", { content, scope });

/** Export variables to a specific format */
export const envvarExportEnvFile = (
  scope: EnvVarScope,
  format: EnvFileFormat,
) => invoke<string>("envvar_export_env_file", { scope, format });

/** List all persistent environment variables for a given scope */
export const envvarListPersistent = (scope: EnvVarScope) =>
  invoke<[string, string][]>("envvar_list_persistent", { scope });

/** Expand environment variable references in a path string */
export const envvarExpand = (path: string) =>
  invoke<string>("envvar_expand", { path });

/** Remove duplicate PATH entries for a given scope, returns count removed */
export const envvarDeduplicatePath = (scope: EnvVarScope) =>
  invoke<number>("envvar_deduplicate_path", { scope });

/** List persistent vars with registry type info (Windows: REG_SZ/REG_EXPAND_SZ) */
export const envvarListPersistentTyped = (scope: EnvVarScope) =>
  invoke<PersistentEnvVar[]>("envvar_list_persistent_typed", { scope });

/** Detect conflicts between User and System environment variables */
export const envvarDetectConflicts = () =>
  invoke<EnvVarConflict[]>("envvar_detect_conflicts");

// ============================================================================
// Terminal Management
// ============================================================================

/** Detect all installed shells on the system */
export const terminalDetectShells = () =>
  invoke<ShellInfo[]>("terminal_detect_shells");

/** Get info for a specific shell by id */
export const terminalGetShellInfo = (shellId: string) =>
  invoke<ShellInfo>("terminal_get_shell_info", { shellId });

/** Measure shell startup time (with and without profile) */
export const terminalMeasureStartup = (shellId: string) =>
  invoke<ShellStartupMeasurement>("terminal_measure_startup", { shellId });

/** Check shell health (config syntax, PATH, large files) */
export const terminalCheckShellHealth = (shellId: string) =>
  invoke<ShellHealthResult>("terminal_check_shell_health", { shellId });

/** List all terminal profiles */
export const terminalListProfiles = () =>
  invoke<TerminalProfile[]>("terminal_list_profiles");

/** Get a terminal profile by id */
export const terminalGetProfile = (id: string) =>
  invoke<TerminalProfile>("terminal_get_profile", { id });

/** Create a new terminal profile */
export const terminalCreateProfile = (profile: TerminalProfile) =>
  invoke<string>("terminal_create_profile", { profile });

/** Update an existing terminal profile */
export const terminalUpdateProfile = (profile: TerminalProfile) =>
  invoke<void>("terminal_update_profile", { profile });

/** Delete a terminal profile */
export const terminalDeleteProfile = (id: string) =>
  invoke<boolean>("terminal_delete_profile", { id });

/** Get the default terminal profile */
export const terminalGetDefaultProfile = () =>
  invoke<TerminalProfile | null>("terminal_get_default_profile");

/** Set the default terminal profile */
export const terminalSetDefaultProfile = (id: string) =>
  invoke<void>("terminal_set_default_profile", { id });

/** Launch a terminal profile */
export const terminalLaunchProfile = (id: string) =>
  invoke<string>("terminal_launch_profile", { id });

/** Launch a terminal profile and return structured result */
export const terminalLaunchProfileDetailed = (id: string) =>
  invoke<LaunchResult>("terminal_launch_profile_detailed", { id });

/** Read a shell config file */
export const terminalReadConfig = (path: string) =>
  invoke<string>("terminal_read_config", { path });

/** Backup a shell config file */
export const terminalBackupConfig = (path: string) =>
  invoke<string>("terminal_backup_config", { path });

/** Backup a shell config file with structured verification metadata */
export const terminalBackupConfigVerified = (path: string) =>
  invoke<TerminalConfigMutationResult>("terminal_backup_config_verified", {
    path,
  });

/** Append content to a shell config file */
export const terminalAppendToConfig = (path: string, content: string) =>
  invoke<void>("terminal_append_to_config", { path, content });

/** Append shell config content with structured verification metadata */
export const terminalAppendToConfigVerified = (path: string, content: string) =>
  invoke<TerminalConfigMutationResult>("terminal_append_to_config_verified", {
    path,
    content,
  });

/** Get parsed config entries (aliases, exports, sources) */
export const terminalGetConfigEntries = (path: string, shellType: ShellType) =>
  invoke<ShellConfigEntries>("terminal_get_config_entries", {
    path,
    shellType,
  });

/** Parse config content directly without re-reading the file */
export const terminalParseConfigContent = (
  content: string,
  shellType: ShellType,
) =>
  invoke<ShellConfigEntries>("terminal_parse_config_content", {
    content,
    shellType,
  });

/** Validate config content and return structured diagnostics */
export const terminalValidateConfigContent = (
  content: string,
  shellType: ShellType,
) =>
  invoke<TerminalConfigDiagnostic[]>("terminal_validate_config_content", {
    content,
    shellType,
  });

/** Get editor metadata for a shell config target */
export const terminalGetConfigEditorMetadata = (
  path: string,
  shellType: ShellType,
) =>
  invoke<TerminalConfigEditorMetadata>("terminal_get_config_editor_metadata", {
    path,
    shellType,
  });

/** Restore shell config from latest persisted snapshot */
export const terminalRestoreConfigSnapshot = (path: string) =>
  invoke<TerminalConfigRestoreResult>("terminal_restore_config_snapshot", {
    path,
  });

/** List PowerShell profiles */
export const terminalPsListProfiles = () =>
  invoke<PSProfileInfo[]>("terminal_ps_list_profiles");

/** Read a PowerShell profile content */
export const terminalPsReadProfile = (scope: string) =>
  invoke<string>("terminal_ps_read_profile", { scope });

/** Write content to a PowerShell profile */
export const terminalPsWriteProfile = (scope: string, content: string) =>
  invoke<void>("terminal_ps_write_profile", { scope, content });

/** Get PowerShell execution policy for all scopes */
export const terminalPsGetExecutionPolicy = () =>
  invoke<[string, string][]>("terminal_ps_get_execution_policy");

/** Set PowerShell execution policy */
export const terminalPsSetExecutionPolicy = (policy: string, scope: string) =>
  invoke<void>("terminal_ps_set_execution_policy", { policy, scope });

/** List all available PowerShell modules */
export const terminalPsListAllModules = () =>
  invoke<PSModuleInfo[]>("terminal_ps_list_all_modules");

/** Get detailed info for a PowerShell module */
export const terminalPsGetModuleDetail = (name: string) =>
  invoke<PSModuleInfo>("terminal_ps_get_module_detail", { name });

/** List installed PowerShell scripts */
export const terminalPsListInstalledScripts = () =>
  invoke<PSScriptInfo[]>("terminal_ps_list_installed_scripts");

/** Detect shell frameworks for a shell type */
export const terminalDetectFramework = (shellType: ShellType) =>
  invoke<ShellFrameworkInfo[]>("terminal_detect_framework", { shellType });

/** List plugins for a detected framework */
export const terminalListPlugins = (
  frameworkName: string,
  frameworkPath: string,
  shellType: ShellType,
  configPath?: string | null,
) =>
  invoke<ShellPlugin[]>("terminal_list_plugins", {
    frameworkName,
    frameworkPath,
    shellType,
    configPath: configPath ?? null,
  });

/** Get shell-relevant environment variables */
export const terminalGetShellEnvVars = () =>
  invoke<[string, string][]>("terminal_get_shell_env_vars");

/** Get resolved proxy environment variables for terminal */
export const terminalGetProxyEnvVars = () =>
  invoke<[string, string][]>("terminal_get_proxy_env_vars");

/** Duplicate a terminal profile */
export const terminalDuplicateProfile = (id: string) =>
  invoke<string>("terminal_duplicate_profile", { id });

/** Export all terminal profiles as JSON */
export const terminalExportProfiles = () =>
  invoke<string>("terminal_export_profiles");

/** Import terminal profiles from JSON */
export const terminalImportProfiles = (json: string, merge: boolean) =>
  invoke<number>("terminal_import_profiles", { json, merge });

/** Write content to a shell config file (with automatic backup) */
export const terminalWriteConfig = (path: string, content: string) =>
  invoke<void>("terminal_write_config", { path, content });

/** Write shell config content with structured verification metadata */
export const terminalWriteConfigVerified = (path: string, content: string) =>
  invoke<TerminalConfigMutationResult>("terminal_write_config_verified", {
    path,
    content,
  });

/** Install a PowerShell module from PSGallery */
export const terminalPsInstallModule = (name: string, scope: string) =>
  invoke<void>("terminal_ps_install_module", { name, scope });

/** Uninstall a PowerShell module */
export const terminalPsUninstallModule = (name: string) =>
  invoke<void>("terminal_ps_uninstall_module", { name });

/** Update a PowerShell module */
export const terminalPsUpdateModule = (name: string) =>
  invoke<void>("terminal_ps_update_module", { name });

/** Search PSGallery for modules */
export const terminalPsFindModule = (query: string) =>
  invoke<PSModuleInfo[]>("terminal_ps_find_module", { query });

/** List all terminal profile templates (built-in + custom) */
export const terminalListTemplates = () =>
  invoke<TerminalProfileTemplate[]>("terminal_list_templates");

/** Create a custom terminal profile template */
export const terminalCreateCustomTemplate = (
  template: TerminalProfileTemplate,
) => invoke<string>("terminal_create_custom_template", { template });

/** Delete a custom terminal profile template */
export const terminalDeleteCustomTemplate = (id: string) =>
  invoke<boolean>("terminal_delete_custom_template", { id });

/** Save an existing profile as a reusable template */
export const terminalSaveProfileAsTemplate = (
  profileId: string,
  templateName: string,
  templateDescription: string,
) =>
  invoke<string>("terminal_save_profile_as_template", {
    profileId,
    templateName,
    templateDescription,
  });

/** Create a new profile pre-filled from a template */
export const terminalCreateProfileFromTemplate = (templateId: string) =>
  invoke<TerminalProfile>("terminal_create_profile_from_template", {
    templateId,
  });

/** Get cache stats for all detected terminal frameworks */
export const terminalGetFrameworkCacheStats = () =>
  invoke<FrameworkCacheInfo[]>("terminal_get_framework_cache_stats");

/** Get cache info for a single framework */
export const terminalGetSingleFrameworkCacheInfo = (
  frameworkName: string,
  frameworkPath: string,
  shellType: ShellType,
) =>
  invoke<FrameworkCacheInfo>("terminal_get_single_framework_cache_info", {
    frameworkName,
    frameworkPath,
    shellType,
  });

/** Clean cache for a specific terminal framework, returns freed bytes */
export const terminalCleanFrameworkCache = (frameworkName: string) =>
  invoke<number>("terminal_clean_framework_cache", { frameworkName });

// Feedback commands
export const feedbackSave = (request: {
  category: string;
  severity?: string;
  title: string;
  description: string;
  contactEmail?: string;
  screenshot?: string;
  includeDiagnostics: boolean;
  appVersion: string;
  os: string;
  arch: string;
  currentPage: string;
  errorContext?: {
    message?: string;
    stack?: string;
    component?: string;
    digest?: string;
  };
}) => invoke<FeedbackSaveResult>("feedback_save", { request });
export const feedbackList = () => invoke<FeedbackListResult>("feedback_list");
export const feedbackGet = (id: string) =>
  invoke<FeedbackItem | null>("feedback_get", { id });
export const feedbackDelete = (id: string) =>
  invoke<void>("feedback_delete", { id });
export const feedbackExport = (id: string) =>
  invoke<string>("feedback_export", { id });
export const feedbackCount = () => invoke<number>("feedback_count");

// ============================================================================
// Plugin System Commands
// ============================================================================

export type {
  PluginInfo,
  PluginManifest,
  PluginToolInfo,
  PluginPermissionState,
  PluginPermissions,
} from "@/types/plugin";

/** List all installed plugins */
export const pluginList = () =>
  invoke<import("@/types/plugin").PluginInfo[]>("plugin_list");

/** Get detailed info about a specific plugin */
export const pluginGetInfo = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginManifest>("plugin_get_info", {
    pluginId,
  });

/** List all tools from all enabled plugins */
export const pluginListAllTools = () =>
  invoke<import("@/types/plugin").PluginToolInfo[]>("plugin_list_all_tools");

/** Get tools for a specific plugin */
export const pluginGetTools = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginToolInfo[]>("plugin_get_tools", {
    pluginId,
  });

/** Install a plugin from a local directory path */
export const pluginImportLocal = (path: string) =>
  invoke<string>("plugin_import_local", { path });

/** Install a plugin from a URL or local path */
export const pluginInstall = (source: string) =>
  invoke<string>("plugin_install", { source });

/** Install a curated marketplace plugin by store id */
export const pluginInstallMarketplace = (storeId: string) =>
  invoke<string>("plugin_install_marketplace", { storeId });

/** Uninstall a plugin */
export const pluginUninstall = (pluginId: string) =>
  invoke<void>("plugin_uninstall", { pluginId });

/** Enable a plugin */
export const pluginEnable = (pluginId: string) =>
  invoke<void>("plugin_enable", { pluginId });

/** Disable a plugin */
export const pluginDisable = (pluginId: string) =>
  invoke<void>("plugin_disable", { pluginId });

/** Reload a plugin (re-read WASM file) */
export const pluginReload = (pluginId: string) =>
  invoke<void>("plugin_reload", { pluginId });

/** Call a tool function on a plugin */
export const pluginCallTool = (
  pluginId: string,
  toolEntry: string,
  input: string,
) => invoke<string>("plugin_call_tool", { pluginId, toolEntry, input });

/** Get permissions for a plugin */
export const pluginGetPermissions = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginPermissionState>(
    "plugin_get_permissions",
    { pluginId },
  );

/** Get global plugin permission enforcement mode */
export const pluginGetPermissionMode = () =>
  invoke<import("@/types/plugin").PluginPermissionMode>(
    "plugin_get_permission_mode",
  );

/** Grant a permission to a plugin */
export const pluginGrantPermission = (pluginId: string, permission: string) =>
  invoke<void>("plugin_grant_permission", { pluginId, permission });

/** Revoke a permission from a plugin */
export const pluginRevokePermission = (pluginId: string, permission: string) =>
  invoke<void>("plugin_revoke_permission", { pluginId, permission });

/** Get plugin data directory path */
export const pluginGetDataDir = (pluginId: string) =>
  invoke<string>("plugin_get_data_dir", { pluginId });

/** Get plugin locale data for i18n */
export const pluginGetLocales = (pluginId: string) =>
  invoke<Record<string, Record<string, string>>>("plugin_get_locales", {
    pluginId,
  });

/** Scaffold a new plugin project */
export const pluginScaffold = (
  config: import("@/types/plugin").ScaffoldConfig,
) =>
  invoke<import("@/types/plugin").ScaffoldResult>("plugin_scaffold", {
    config,
  });

/** Open scaffold output folder in system file manager */
export const pluginOpenScaffoldFolder = (path: string) =>
  invoke<import("@/types/plugin").ScaffoldOpenResult>(
    "plugin_open_scaffold_folder",
    { path },
  );

/** Open scaffold output folder in VSCode, fallback to folder open */
export const pluginOpenScaffoldInVscode = (path: string) =>
  invoke<import("@/types/plugin").ScaffoldOpenResult>(
    "plugin_open_scaffold_in_vscode",
    { path },
  );

/** Validate a plugin directory */
export const pluginValidate = (path: string) =>
  invoke<import("@/types/plugin").ValidationResult>("plugin_validate", {
    path,
  });

/** Get iframe entry HTML for a plugin's custom UI */
export const pluginGetUiEntry = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginUiEntry>("plugin_get_ui_entry", {
    pluginId,
  });

/** Check if an update is available for a plugin */
export const pluginCheckUpdate = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginUpdateInfo | null>(
    "plugin_check_update",
    { pluginId },
  );

/** Update a plugin to its latest version */
export const pluginUpdate = (pluginId: string) =>
  invoke<void>("plugin_update", { pluginId });

/** Get a static asset from a plugin's UI directory */
export const pluginGetUiAsset = (pluginId: string, assetPath: string) =>
  invoke<number[]>("plugin_get_ui_asset", { pluginId, assetPath });

/** Get health metrics for a specific plugin */
export const pluginGetHealth = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginHealth>("plugin_get_health", {
    pluginId,
  });

/** Get health metrics for all plugins */
export const pluginGetAllHealth = () =>
  invoke<Record<string, import("@/types/plugin").PluginHealth>>(
    "plugin_get_all_health",
  );

/** Get capability audit records for plugin runtime permission handshakes */
export const pluginGetCapabilityAudit = (pluginId?: string) =>
  invoke<import("@/types/plugin").PluginCapabilityAuditRecord[]>(
    "plugin_get_capability_audit",
    {
      pluginId: pluginId ?? null,
    },
  );

/** Reset auto-disabled state for a plugin */
export const pluginResetHealth = (pluginId: string) =>
  invoke<void>("plugin_reset_health", { pluginId });

/** Export a plugin's directory + data as a zip file */
export const pluginExportData = (pluginId: string) =>
  invoke<string>("plugin_export_data", { pluginId });

/** Get settings schema for a plugin */
export const pluginGetSettingsSchema = (pluginId: string) =>
  invoke<import("@/types/plugin").PluginSettingDeclaration[]>(
    "plugin_get_settings_schema",
    { pluginId },
  );

/** Get current settings values for a plugin */
export const pluginGetSettingsValues = (pluginId: string) =>
  invoke<Record<string, unknown>>("plugin_get_settings_values", { pluginId });

/** Set a single setting value for a plugin */
export const pluginSetSetting = (
  pluginId: string,
  key: string,
  value: unknown,
) => invoke<void>("plugin_set_setting", { pluginId, key, value });

/** Check for updates across all plugins */
export const pluginCheckAllUpdates = () =>
  invoke<import("@/types/plugin").PluginUpdateInfo[]>(
    "plugin_check_all_updates",
  );

/** Update all plugins that have available updates */
export const pluginUpdateAll = () =>
  invoke<Array<{ Ok?: string; Err?: string }>>("plugin_update_all");

/** Dispatch a system event to all listening plugins */
export const pluginDispatchEvent = (eventName: string, payload: unknown = {}) =>
  invoke<void>("plugin_dispatch_event", { eventName, payload });

// ============================================================================
// Winget-specific commands
// ============================================================================

// Pin management
export const wingetPinList = () =>
  invoke<import("@/types/tauri").WingetPin[]>("winget_pin_list");
export const wingetPinAdd = (
  id: string,
  version?: string,
  blocking?: boolean,
) =>
  invoke<void>("winget_pin_add", { id, version, blocking: blocking ?? false });
export const wingetPinRemove = (id: string) =>
  invoke<void>("winget_pin_remove", { id });
export const wingetPinReset = () => invoke<void>("winget_pin_reset");

// Source management
export const wingetSourceList = () =>
  invoke<import("@/types/tauri").WingetSource[]>("winget_source_list");
export const wingetSourceAdd = (
  name: string,
  url: string,
  sourceType?: string,
) => invoke<void>("winget_source_add", { name, url, sourceType });
export const wingetSourceRemove = (name: string) =>
  invoke<void>("winget_source_remove", { name });
export const wingetSourceReset = () => invoke<void>("winget_source_reset");

// Export / Import
export const wingetExport = (outputPath: string, includeVersions?: boolean) =>
  invoke<void>("winget_export", {
    outputPath,
    includeVersions: includeVersions ?? true,
  });
export const wingetImport = (
  inputPath: string,
  ignoreUnavailable?: boolean,
  ignoreVersions?: boolean,
) =>
  invoke<string>("winget_import", {
    inputPath,
    ignoreUnavailable: ignoreUnavailable ?? false,
    ignoreVersions: ignoreVersions ?? false,
  });

// Repair
export const wingetRepair = (id: string) =>
  invoke<void>("winget_repair", { id });

// Download (offline installer)
export const wingetDownload = (
  id: string,
  version?: string,
  directory?: string,
) => invoke<string>("winget_download", { id, version, directory });

// Info
export const wingetGetInfo = () =>
  invoke<import("@/types/tauri").WingetInfo>("winget_get_info");

// Advanced install with scope/architecture/locale/location
export const wingetInstallAdvanced = (options: {
  id: string;
  version?: string;
  scope?: "user" | "machine";
  architecture?: "x64" | "x86" | "arm64";
  locale?: string;
  location?: string;
  force?: boolean;
}) =>
  invoke<string>("winget_install_advanced", {
    id: options.id,
    version: options.version,
    scope: options.scope,
    architecture: options.architecture,
    locale: options.locale,
    location: options.location,
    force: options.force ?? false,
  });

// ============================================================================
// Xmake/Xrepo Commands
// ============================================================================

export type { XmakeRepo } from "@/types/tauri";

// Repository management
export const xmakeListRepos = () =>
  invoke<import("@/types/tauri").XmakeRepo[]>("xmake_list_repos");
export const xmakeAddRepo = (name: string, url: string, branch?: string) =>
  invoke<void>("xmake_add_repo", { name, url, branch });
export const xmakeRemoveRepo = (name: string) =>
  invoke<void>("xmake_remove_repo", { name });
export const xmakeUpdateRepos = () => invoke<void>("xmake_update_repos");

// Cache management
export const xmakeCleanCache = (packages?: string[], cacheOnly?: boolean) =>
  invoke<string>("xmake_clean_cache", {
    packages,
    cacheOnly: cacheOnly ?? false,
  });

// Virtual environment
export const xmakeEnvShow = (packages: string[]) =>
  invoke<Record<string, string>>("xmake_env_show", { packages });
export const xmakeEnvList = () => invoke<string[]>("xmake_env_list");
export const xmakeEnvBind = (nameOrPackages: string, command: string) =>
  invoke<string>("xmake_env_bind", { nameOrPackages, command });

// Export / Import / Download
export const xmakeExportPackage = (name: string, outputDir: string) =>
  invoke<void>("xmake_export_package", { name, outputDir });
export const xmakeImportPackage = (inputDir: string) =>
  invoke<void>("xmake_import_package", { inputDir });
export const xmakeDownloadSource = (name: string, outputDir?: string) =>
  invoke<void>("xmake_download_source", { name, outputDir });

// ============================================================================
// Homebrew Commands
// ============================================================================

// Tap management
export const brewListTaps = () =>
  invoke<import("@/types/tauri").BrewTap[]>("brew_list_taps");
export const brewAddTap = (name: string) =>
  invoke<string>("brew_add_tap", { name });
export const brewRemoveTap = (name: string) =>
  invoke<string>("brew_remove_tap", { name });

// Services management
export const brewListServices = () =>
  invoke<import("@/types/tauri").BrewService[]>("brew_list_services");
export const brewServiceStart = (name: string) =>
  invoke<string>("brew_service_start", { name });
export const brewServiceStop = (name: string) =>
  invoke<string>("brew_service_stop", { name });
export const brewServiceRestart = (name: string) =>
  invoke<string>("brew_service_restart", { name });

// Maintenance
export const brewCleanup = (dryRun: boolean = false) =>
  invoke<import("@/types/tauri").BrewCleanupResult>("brew_cleanup", { dryRun });
export const brewDoctor = () =>
  invoke<import("@/types/tauri").BrewDoctorResult>("brew_doctor");
export const brewAutoremove = () => invoke<string[]>("brew_autoremove");

// Pin management
export const brewListPinned = () =>
  invoke<import("@/types/tauri").BrewPinnedPackage[]>("brew_list_pinned");
export const brewPin = (name: string) => invoke<string>("brew_pin", { name });
export const brewUnpin = (name: string) =>
  invoke<string>("brew_unpin", { name });

// Config & analytics
export const brewGetConfig = () =>
  invoke<import("@/types/tauri").BrewConfigInfo>("brew_get_config");
export const brewAnalyticsStatus = () =>
  invoke<boolean>("brew_analytics_status");
export const brewAnalyticsToggle = (enabled: boolean) =>
  invoke<string>("brew_analytics_toggle", { enabled });

// ============================================================================
// MacPorts Commands
// ============================================================================

// Variant management
export const macportsListVariants = (name: string) =>
  invoke<import("@/types/tauri").PortVariant[]>("macports_list_variants", {
    name,
  });

// Contents & dependents
export const macportsPortContents = (name: string) =>
  invoke<import("@/types/tauri").PortFileEntry[]>("macports_port_contents", {
    name,
  });
export const macportsPortDependents = (name: string) =>
  invoke<import("@/types/tauri").PortDependent[]>("macports_port_dependents", {
    name,
  });

// Cleanup
export const macportsPortClean = (name: string) =>
  invoke<string>("macports_port_clean", { name });
export const macportsCleanAll = () => invoke<string>("macports_clean_all");

// Self-update
export const macportsSelfupdate = () => invoke<string>("macports_selfupdate");

// Select (alternative versions)
export const macportsListSelectGroups = () =>
  invoke<import("@/types/tauri").PortSelectGroup[]>(
    "macports_list_select_groups",
  );
export const macportsSelectOptions = (group: string) =>
  invoke<import("@/types/tauri").PortSelectGroup>("macports_select_options", {
    group,
  });
export const macportsSelectSet = (group: string, option: string) =>
  invoke<string>("macports_select_set", { group, option });

// Reclaim disk space
export const macportsReclaim = () => invoke<string>("macports_reclaim");

// ============================================================================
// uv Project Management Commands
// ============================================================================

export const uvInit = (path: string, name?: string) =>
  invoke<string>("uv_init", { path, name });
export const uvAdd = (
  path: string,
  packages: string[],
  dev: boolean = false,
  optional?: string,
) => invoke<string>("uv_add", { path, packages, dev, optional });
export const uvRemove = (
  path: string,
  packages: string[],
  dev: boolean = false,
) => invoke<string>("uv_remove", { path, packages, dev });
export const uvSync = (path: string, frozen: boolean = false) =>
  invoke<string>("uv_sync", { path, frozen });
export const uvLock = (path: string, upgrade: boolean = false) =>
  invoke<string>("uv_lock", { path, upgrade });
export const uvRun = (path: string, command: string[]) =>
  invoke<import("@/types/tauri").UvRunResult>("uv_run", { path, command });
export const uvTree = (path: string) => invoke<string>("uv_tree", { path });
export const uvVenvCreate = (path: string, python?: string) =>
  invoke<string>("uv_venv_create", { path, python });
export const uvPythonInstall = (version: string) =>
  invoke<string>("uv_python_install", { version });
export const uvPythonUninstall = (version: string) =>
  invoke<string>("uv_python_uninstall", { version });
export const uvPythonList = (onlyInstalled: boolean = false) =>
  invoke<import("@/types/tauri").UvPythonEntry[]>("uv_python_list", {
    onlyInstalled,
  });
export const uvPythonPin = (path: string, version: string) =>
  invoke<string>("uv_python_pin", { path, version });
export const uvPipCompile = (path: string, input: string, output?: string) =>
  invoke<string>("uv_pip_compile", { path, input, output });
export const uvSelfUpdate = () => invoke<string>("uv_self_update");
export const uvVersion = () => invoke<string>("uv_version");
export const uvCacheClean = () => invoke<string>("uv_cache_clean");
export const uvCacheDir = () => invoke<string>("uv_cache_dir");
export const uvToolInstall = (name: string, python?: string) =>
  invoke<string>("uv_tool_install", { name, python });
export const uvToolUninstall = (name: string) =>
  invoke<string>("uv_tool_uninstall", { name });
export const uvToolList = () => invoke<string>("uv_tool_list");
export const uvToolRun = (name: string, toolArgs: string[]) =>
  invoke<import("@/types/tauri").UvRunResult>("uv_tool_run", {
    name,
    toolArgs,
  });

// ============================================================================
// Conda Environment Management Commands
// ============================================================================

export const condaEnvList = () =>
  invoke<import("@/types/tauri").CondaEnvInfo[]>("conda_env_list");
export const condaEnvCreate = (
  name: string,
  pythonVersion?: string,
  packages: string[] = [],
) => invoke<string>("conda_env_create", { name, pythonVersion, packages });
export const condaEnvRemove = (name: string) =>
  invoke<string>("conda_env_remove", { name });
export const condaEnvClone = (source: string, target: string) =>
  invoke<string>("conda_env_clone", { source, target });
export const condaEnvExport = (name: string, noBuilds: boolean = false) =>
  invoke<import("@/types/tauri").CondaExportResult>("conda_env_export", {
    name,
    noBuilds,
  });
export const condaEnvImport = (filePath: string, name?: string) =>
  invoke<string>("conda_env_import", { filePath, name });
export const condaEnvRename = (oldName: string, newName: string) =>
  invoke<string>("conda_env_rename", { oldName, newName });
export const condaGetInfo = () =>
  invoke<import("@/types/tauri").CondaInfo>("conda_info");
export const condaClean = (
  all: boolean = false,
  packages: boolean = false,
  tarballs: boolean = false,
) => invoke<string>("conda_clean", { all, packages, tarballs });
export const condaConfigShow = () => invoke<string>("conda_config_show");
export const condaConfigSet = (key: string, value: string) =>
  invoke<string>("conda_config_set", { key, value });
export const condaChannelAdd = (channel: string) =>
  invoke<string>("conda_channel_add", { channel });
export const condaChannelRemove = (channel: string) =>
  invoke<string>("conda_channel_remove", { channel });

// ============================================================================
// Poetry Project Management Commands
// ============================================================================

export const poetryLock = (path: string, noUpdate: boolean = false) =>
  invoke<string>("poetry_lock", { path, noUpdate });
export const poetryUpdate = (path: string, packages: string[] = []) =>
  invoke<string>("poetry_update", { path, packages });
export const poetryRun = (path: string, command: string[]) =>
  invoke<import("@/types/tauri").PoetryRunResult>("poetry_run", {
    path,
    command,
  });
export const poetryEnvList = (path: string) =>
  invoke<import("@/types/tauri").PoetryEnvInfo[]>("poetry_env_list", { path });
export const poetryEnvRemove = (path: string, python: string) =>
  invoke<string>("poetry_env_remove", { path, python });
export const poetryEnvUse = (path: string, python: string) =>
  invoke<string>("poetry_env_use", { path, python });
export const poetryExport = (
  path: string,
  format?: string,
  withHashes: boolean = false,
) => invoke<string>("poetry_export", { path, format, withHashes });
export const poetryCheck = (path: string) =>
  invoke<string>("poetry_check", { path });
export const poetryVersion = (path: string) =>
  invoke<string>("poetry_version", { path });

// ============================================================================
// pipx Commands
// ============================================================================

export const pipxInject = (appName: string, packages: string[]) =>
  invoke<string>("pipx_inject", { appName, packages });
export const pipxRun = (packageName: string, runArgs: string[] = []) =>
  invoke<import("@/types/tauri").PipxRunResult>("pipx_run", {
    package: packageName,
    runArgs,
  });
export const pipxUpgrade = (packageName: string) =>
  invoke<string>("pipx_upgrade", { package: packageName });
export const pipxUpgradeAll = () => invoke<string>("pipx_upgrade_all");
export const pipxEnsurepath = () => invoke<string>("pipx_ensurepath");
export const pipxReinstallAll = () => invoke<string>("pipx_reinstall_all");
export const pipxListJson = () => invoke<string>("pipx_list_json");

// ============================================================================
// Window Effect Commands
// ============================================================================

export const windowEffectApply = (effect: string, dark?: boolean) =>
  invoke<void>("window_effect_apply", { effect, dark: dark ?? null });
export const windowEffectClear = () => invoke<void>("window_effect_clear");
export const windowEffectGetSupported = () =>
  invoke<string[]>("window_effect_get_supported");
