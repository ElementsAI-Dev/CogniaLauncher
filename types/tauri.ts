/**
 * Tauri API Types for CogniaLauncher
 * Extracted from lib/tauri.ts for better code organization
 */

// ============================================================================
// Environment Types
// ============================================================================

/** Environment installation progress event payload */
export type EnvInstallStep =
  | 'fetching'
  | 'downloading'
  | 'extracting'
  | 'configuring'
  | 'done'
  | 'error'
  | 'cancelled';

export type EnvInstallPhase =
  | 'resolve'
  | 'select_artifact'
  | 'download'
  | 'verify'
  | 'persist'
  | 'finalize';

export type EnvInstallTerminalState = 'completed' | 'failed' | 'cancelled';

export type EnvInstallFailureClass =
  | 'selection_error'
  | 'network_error'
  | 'integrity_error'
  | 'cache_error'
  | 'cancelled'
  | 'timeout';

export interface EnvInstallArtifact {
  id: string;
  name: string;
  version: string;
  provider: string;
}

export interface EnvInstallProgressEvent {
  envType: string;
  version: string;
  step: EnvInstallStep;
  phase?: EnvInstallPhase;
  terminalState?: EnvInstallTerminalState;
  failureClass?: EnvInstallFailureClass;
  artifact?: EnvInstallArtifact;
  stageMessage?: string;
  selectionRationale?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  attempt?: number;
  maxAttempts?: number;
  progress: number;
  downloadedSize?: number;
  totalSize?: number;
  speed?: number;
  error?: string;
}

export interface EnvironmentInfo {
  env_type: string;
  provider_id: string;
  provider: string;
  current_version: string | null;
  installed_versions: InstalledVersion[];
  available: boolean;
  total_size: number;
  version_count: number;
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
  source_type?: 'local' | 'manifest' | 'global' | 'unknown';
}

export interface EnvVersionMutationResult {
  envType: string;
  operation: string;
  requestedVersion: string;
  effectiveVersion: string | null;
  sourceType: 'local' | 'manifest' | 'global' | 'unknown';
  success: boolean;
  status: 'verified' | 'verification_failed';
  message: string | null;
}

/** System-detected environment information (not managed by version managers) */
export interface SystemEnvironmentInfo {
  env_type: string;
  version: string;
  executable_path: string | null;
  source: string;
}

/** Provider-aware environment detection info (supports same-language multi-provider rows) */
export interface ProviderDetectedEnvironmentInfo {
  env_type: string;
  provider_id: string;
  provider_name: string;
  version: string;
  executable_path: string | null;
  source: string;
  scope: 'system' | 'managed';
}

/** Environment type mapping from provider ID to logical type */
export type EnvironmentTypeMapping = Record<string, string>;

export interface EnvironmentProviderInfo {
  id: string;
  display_name: string;
  env_type: string;
  description: string;
}

/** Rustup component info from `rustup component list` */
export interface RustComponent {
  name: string;
  installed: boolean;
  default: boolean;
}

/** Rustup target info from `rustup target list` */
export interface RustTarget {
  name: string;
  installed: boolean;
  default: boolean;
}

/** Parsed output from `rustup show` */
export interface RustupShowInfo {
  defaultToolchain: string | null;
  activeToolchain: string | null;
  installedToolchains: string[];
  installedTargets: string[];
  rustcVersion: string | null;
}

/** Rustup directory override entry from `rustup override list` */
export interface RustupOverride {
  path: string;
  toolchain: string;
}

export type RustupFailureClass =
  | 'provider_unavailable'
  | 'toolchain_not_installed'
  | 'component_missing'
  | 'target_install_failed'
  | 'metadata_corrupt'
  | 'command_timeout'
  | 'invalid_profile'
  | 'unknown_error';

export interface RustupOperationError {
  class: RustupFailureClass;
  message: string;
  rawError?: string | null;
  retryable: boolean;
}

export interface RustupOperationResult {
  operation: string;
  toolchain?: string | null;
  subject?: string | null;
  success: boolean;
  error?: RustupOperationError | null;
}

export interface RustupScopedListResult<T> {
  operation: string;
  toolchain?: string | null;
  success: boolean;
  items: T[];
  error?: RustupOperationError | null;
}

export interface RustupProfileResult {
  operation: string;
  profile?: string | null;
  success: boolean;
  error?: RustupOperationError | null;
}

/** Go environment info from `go env -json` */
export interface GoEnvInfo {
  goroot: string;
  gopath: string;
  gobin: string;
  goproxy: string;
  goprivate: string;
  gonosumdb: string;
  gotoolchain: string;
  gomodcache: string;
  goos: string;
  goarch: string;
  goversion: string;
  goflags: string;
  cgoEnabled: string;
}

/** Go cache size info */
export interface GoCacheInfo {
  buildCachePath: string;
  buildCacheSize: number;
  buildCacheSizeHuman: string;
  modCachePath: string;
  modCacheSize: number;
  modCacheSizeHuman: string;
}

/** Result of verifying an environment installation */
export interface EnvVerifyResult {
  installed: boolean;
  providerAvailable: boolean;
  currentVersion: string | null;
  requestedVersion: string;
}

// ============================================================================
// Environment Settings Types
// ============================================================================

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

// ============================================================================
// Package Types
// ============================================================================

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

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderInfo {
  id: string;
  display_name: string;
  capabilities: string[];
  platforms: string[];
  priority: number;
  is_environment_provider: boolean;
  enabled: boolean;
}

export interface ProviderStatusInfo {
  id: string;
  display_name: string;
  installed: boolean;
  platforms: string[];
  scope_state?: 'available' | 'unavailable' | 'timeout' | 'unsupported';
  scope_reason?: string | null;
  status?: 'supported' | 'unsupported';
  reason?: string | null;
  reason_code?: string | null;
  update_supported?: boolean;
  update_reason?: string | null;
  update_reason_code?: string | null;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheInfo {
  download_cache: CacheStats;
  metadata_cache: CacheStats;
  default_downloads?: DefaultDownloadsStats;
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

export interface DefaultDownloadsStats {
  entry_count: number;
  size: number;
  size_human: string;
  location?: string | null;
  is_available: boolean;
  reason?: string | null;
}

export interface CacheAccessStats {
  hits: number;
  misses: number;
  hit_rate: number;
  total_requests: number;
  last_reset: string | null;
}

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

export type CacheCommandScope =
  | 'all'
  | 'download'
  | 'metadata'
  | 'default_downloads';

export interface DefaultDownloadsSkipItem {
  path: string;
  reason: string;
}

export interface DefaultDownloadsFileOutcome {
  path: string;
  size: number;
  size_human: string;
  outcome: 'deleted' | 'skipped' | string;
  reason?: string | null;
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
  auto_clean_threshold?: number;
  monitor_interval?: number;
  monitor_external?: boolean;
}

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
  skipped?: DefaultDownloadsSkipItem[];
  skipped_count?: number;
}

export interface EnhancedCleanResult {
  freed_bytes: number;
  freed_human: string;
  deleted_count: number;
  use_trash: boolean;
  history_id: string;
  file_outcomes?: DefaultDownloadsFileOutcome[];
  skipped_count?: number;
}

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

export interface CacheOptimizeResult {
  sizeBefore: number;
  sizeBeforeHuman: string;
  sizeAfter: number;
  sizeAfterHuman: string;
  sizeSaved: number;
  sizeSavedHuman: string;
}

export interface CacheSizeSnapshot {
  timestamp: string;
  internalSize: number;
  internalSizeHuman: string;
  downloadCount: number;
  metadataCount: number;
}

export interface CacheAutoCleanedEvent {
  expiredMetadataRemoved: number;
  expiredDownloadsFreed: number;
  evictedCount: number;
  stalePartialsRemoved: number;
  totalFreedHuman: string;
  action?: string;
  scope?: string;
  domains?: string[];
}

// ============================================================================
// Backup & Database Types
// ============================================================================

export type BackupContentType =
  | 'config'
  | 'terminal_profiles'
  | 'environment_profiles'
  | 'cache_database'
  | 'download_history'
  | 'cleanup_history'
  | 'custom_detection_rules'
  | 'environment_settings';

export interface BackupManifest {
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  platform: string;
  hostname: string;
  contents: BackupContentType[];
  fileChecksums: Record<string, string>;
  totalSize: number;
  note: string | null;
  autoGenerated: boolean;
}

export interface BackupInfo {
  path: string;
  name: string;
  manifest: BackupManifest;
  size: number;
  sizeHuman: string;
}

export type BackupOperationStatus = 'success' | 'partial' | 'skipped' | 'failed';

export interface BackupOperationIssue {
  code: string;
  message: string;
  contentType?: string | null;
}

export interface BackupResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  path: string;
  manifest: BackupManifest;
  durationMs: number;
  error: string | null;
}

export interface RestoreSkipped {
  contentType: string;
  reason: string;
}

export interface RestoreResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  restored: string[];
  skipped: RestoreSkipped[];
  error: string | null;
}

export interface BackupValidationResult {
  valid: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  manifest: BackupManifest | null;
  missingFiles: string[];
  checksumMismatches: string[];
  errors: string[];
}

export interface BackupDeleteResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  deleted: boolean;
  path: string;
  error: string | null;
}

export interface BackupExportResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  bytes: number;
  backupPath: string;
  destPath: string;
  error: string | null;
}

export interface BackupImportResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  zipPath: string;
  info: BackupInfo | null;
  error: string | null;
}

export interface BackupCleanupResult {
  success: boolean;
  status: BackupOperationStatus;
  reasonCode?: string | null;
  issues?: BackupOperationIssue[];
  deleted: number;
  maxCount: number;
  maxAgeDays: number;
  error: string | null;
}

export interface IntegrityCheckResult {
  ok: boolean;
  errors: string[];
}

export interface DatabaseInfo {
  dbSize: number;
  dbSizeHuman: string;
  walSize: number;
  walSizeHuman: string;
  pageCount: number;
  pageSize: number;
  freelistCount: number;
  tableCounts: Record<string, number>;
}

// ============================================================================
// Platform Types
// ============================================================================

export interface GpuInfo {
  name: string;
  vramMb: number | null;
  driverVersion: string | null;
  vendor: string | null;
}

export interface PlatformInfo {
  os: string;
  arch: string;
  osVersion: string;
  osLongVersion: string;
  kernelVersion: string;
  hostname: string;
  osName: string;
  distributionId: string;
  cpuArch: string;
  cpuModel: string;
  cpuVendorId: string;
  cpuFrequency: number;
  cpuCores: number;
  physicalCoreCount: number | null;
  globalCpuUsage: number;
  totalMemory: number;
  availableMemory: number;
  usedMemory: number;
  totalSwap: number;
  usedSwap: number;
  uptime: number;
  bootTime: number;
  loadAverage: [number, number, number];
  gpus: GpuInfo[];
  appVersion: string;
}

export interface DiskInfo {
  name: string;
  mountPoint: string;
  totalSpace: number;
  availableSpace: number;
  usedSpace: number;
  usagePercent: number;
  fileSystem: string;
  diskType: string;
  isRemovable: boolean;
  isReadOnly: boolean;
  readBytes: number;
  writtenBytes: number;
  totalSpaceHuman: string;
  availableSpaceHuman: string;
  usedSpaceHuman: string;
  readBytesHuman: string;
  writtenBytesHuman: string;
}

export interface SystemProxyInfo {
  httpProxy: string | null;
  httpsProxy: string | null;
  noProxy: string | null;
  source: 'environment' | 'windows_registry' | 'none';
}

export interface ProxyTestResult {
  success: boolean;
  latencyMs: number;
  error: string | null;
}

export interface NetworkInterfaceInfo {
  name: string;
  macAddress: string;
  ipAddresses: string[];
  totalReceived: number;
  totalTransmitted: number;
  totalReceivedHuman: string;
  totalTransmittedHuman: string;
  mtu: number;
  totalPacketsReceived: number;
  totalPacketsTransmitted: number;
  totalErrorsOnReceived: number;
  totalErrorsOnTransmitted: number;
}

export interface ComponentInfo {
  label: string;
  temperature: number | null;
  max: number | null;
  critical: number | null;
}

export interface BatteryInfo {
  percent: number;
  isCharging: boolean;
  isPluggedIn: boolean;
  healthPercent: number | null;
  cycleCount: number | null;
  designCapacityMwh: number | null;
  fullCapacityMwh: number | null;
  voltageMv: number | null;
  powerSource: string;
  timeToEmptyMins: number | null;
  timeToFullMins: number | null;
  technology: string | null;
}

// ============================================================================
// Batch Operation Types
// ============================================================================

export interface BatchInstallOptions {
  packages: string[];
  dryRun?: boolean;
  parallel?: boolean;
  force?: boolean;
  global?: boolean;
}

export type BatchProgress =
  | { type: 'starting'; total: number }
  | { type: 'resolving'; package: string; current: number; total: number }
  | { type: 'downloading'; package: string; progress: number; current: number; total: number }
  | { type: 'installing'; package: string; current: number; total: number }
  | { type: 'item_completed'; package: string; success: boolean; current: number; total: number }
  | { type: 'completed'; result: BatchResult };

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

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateInfo {
  name: string;
  current_version: string;
  latest_version: string;
  provider: string;
  update_type?: string;
}

export interface UpdateCheckProgress {
  phase: string; // "collecting" | "checking" | "done"
  current: number;
  total: number;
  current_package: string | null;
  current_provider: string | null;
  found_updates: number;
  errors: number;
}

export interface UpdateCheckError {
  provider: string;
  package: string | null;
  message: string;
}

export interface UpdateCheckProviderOutcome {
  provider: string;
  status: 'supported' | 'partial' | 'unsupported' | 'error';
  reason: string | null;
  reason_code?: string | null;
  checked: number;
  updates: number;
  errors: number;
}

export interface UpdateCheckCoverage {
  supported: number;
  partial: number;
  unsupported: number;
  error: number;
}

export interface UpdateCheckSummary {
  updates: UpdateInfo[];
  total_checked: number;
  total_providers: number;
  errors: UpdateCheckError[];
  provider_outcomes: UpdateCheckProviderOutcome[];
  coverage: UpdateCheckCoverage;
}

export interface SelfUpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_notes: string | null;
  selected_source?: SelfUpdateSourceKind | null;
  attempted_sources?: SelfUpdateSourceKind[];
  error_category?: SelfUpdateErrorCategory | null;
  error_message?: string | null;
}

export type SelfUpdateSourceKind = 'official' | 'mirror' | 'custom';

export type SelfUpdateErrorCategory =
  | 'source_unavailable'
  | 'network'
  | 'timeout'
  | 'validation'
  | 'signature'
  | 'no_update'
  | 'unknown';

export interface SelfUpdateProgressEvent {
  progress: number | null;
  status: 'downloading' | 'installing' | 'done' | 'error';
  selectedSource?: SelfUpdateSourceKind;
  attemptedSources?: SelfUpdateSourceKind[];
  errorCategory?: SelfUpdateErrorCategory;
  errorMessage?: string;
}

// ============================================================================
// Environment Update Check Types
// ============================================================================

export interface EnvUpdateCheckResult {
  envType: string;
  providerId: string;
  currentVersion: string | null;
  latestVersion: string | null;
  latestLts: string | null;
  newerCount: number;
  isOutdated: boolean;
}

export interface EnvCleanupResult {
  removed: CleanedVersion[];
  freedBytes: number;
  errors: string[];
}

export interface CleanedVersion {
  version: string;
  size: number;
}

export interface GlobalPackageInfo {
  name: string;
  version: string;
}

export interface EnvMigrateResult {
  migrated: string[];
  failed: MigrateFailure[];
  skipped: string[];
}

export interface MigrateFailure {
  name: string;
  error: string;
}

export interface EolCycleInfo {
  cycle: string;
  releaseDate: string | null;
  eol: string | null;
  latest: string | null;
  lts: string | null;
  support: string | null;
  isEol: boolean;
  eolApproaching: boolean;
}

// ============================================================================
// Install History Types
// ============================================================================

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

export type InstallHistoryAction = 'install' | 'uninstall' | 'update' | 'rollback';

export interface InstallHistoryQuery {
  limit?: number;
  name?: string;
  provider?: string;
  action?: InstallHistoryAction | string;
  success?: boolean;
}

export interface PackageHistoryQuery {
  limit?: number;
  provider?: string;
  action?: InstallHistoryAction | string;
  success?: boolean;
}

// ============================================================================
// Dependency Resolution Types
// ============================================================================

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

// ============================================================================
// Search Types
// ============================================================================

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

export interface SearchSuggestion {
  text: string;
  suggestion_type: string;
  provider: string | null;
}

// ============================================================================
// Package Comparison Types
// ============================================================================

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
  [key: string]: unknown;
}

export interface FeatureComparison {
  feature: string;
  values: (string | null)[];
}

// ============================================================================
// Manifest Types
// ============================================================================

export interface ManifestInfo {
  project_name: string | null;
  project_version: string | null;
  environments: Record<string, string>;
  packages: string[];
  path: string;
}

// ============================================================================
// Log Types
// ============================================================================

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

export type LogOperationStatus = 'success' | 'partial_success' | 'failed';
export type LogOperationReasonCode =
  | 'current_session_protected'
  | 'log_file_not_found'
  | 'log_delete_failed'
  | 'stale_policy_context'
  | (string & {});

export interface LogQueryOptions {
  fileName?: string;
  levelFilter?: string[];
  target?: string;
  search?: string;
  useRegex?: boolean;
  startTime?: number | null;
  endTime?: number | null;
  limit?: number;
  offset?: number;
  maxScanLines?: number;
}

export interface LogQueryResult {
  entries: LogEntry[];
  totalCount: number;
  hasMore: boolean;
  meta: LogQueryMeta;
}

export interface LogQueryMeta {
  scannedLines: number;
  sourceLineCount: number;
  matchedCount: number;
  effectiveMaxScanLines?: number | null;
  scanTruncated: boolean;
  windowStartLine?: number | null;
  windowEndLine?: number | null;
  queryFingerprint: string;
}

export interface LogExportOptions {
  fileName?: string;
  levelFilter?: string[];
  target?: string;
  search?: string;
  useRegex?: boolean;
  startTime?: number | null;
  endTime?: number | null;
  format?: 'txt' | 'json' | 'csv';
  diagnosticMode?: boolean;
  sanitizeSensitive?: boolean;
}

export interface LogExportResult {
  sizeBytes: number;
  status: LogOperationStatus;
  reasonCode?: LogOperationReasonCode | null;
  redactedCount: number;
  sanitized: boolean;
  warnings: string[];
  content: string;
  fileName: string;
}

export interface LogCleanupPolicyInput {
  maxRetentionDays?: number;
  maxTotalSizeMb?: number;
}

export interface LogCleanupOptions {
  policy?: LogCleanupPolicyInput;
  expectedPolicyFingerprint?: string;
}

export interface LogCleanupResult {
  deletedCount: number;
  freedBytes: number;
  protectedCount: number;
  skippedCount: number;
  status: LogOperationStatus;
  reasonCode?: LogOperationReasonCode | null;
  warnings: string[];
  policyFingerprint?: string | null;
  maxRetentionDays?: number | null;
  maxTotalSizeMb?: number | null;
}

export interface LogCleanupPreviewResult {
  deletedCount: number;
  freedBytes: number;
  protectedCount: number;
  skippedCount: number;
  status: LogOperationStatus;
  reasonCode?: LogOperationReasonCode | null;
  warnings: string[];
  policyFingerprint: string;
  maxRetentionDays: number;
  maxTotalSizeMb: number;
}

// ============================================================================
// Command Output Types
// ============================================================================

export interface CommandOutputEvent {
  commandId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

// ============================================================================
// Download Manager Types
// ============================================================================

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
  state: 'queued' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'failed' | 'extracting';
  progress: DownloadProgress;
  error: string | null;
  provider: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retries: number;
  priority: number;
  expectedChecksum: string | null;
  supportsResume: boolean;
  metadata: Record<string, string>;
  serverFilename: string | null;
  tags?: string[];
  speedLimit?: number;
  autoExtract?: boolean;
  extractDest?: string | null;
  segments?: number;
  postAction?: 'none' | 'open_file' | 'reveal_in_folder';
  deleteAfterExtract?: boolean;
  autoRename?: boolean;
  recoverable?: boolean | null;
  failureReasonCode?: string | null;
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
  headers?: Record<string, string>;
  autoExtract?: boolean;
  extractDest?: string;
  segments?: number;
  mirrorUrls?: string[];
  postAction?: 'none' | 'open_file' | 'reveal_in_folder';
  deleteAfterExtract?: boolean;
  autoRename?: boolean;
  tags?: string[];
}

export interface VerifyResult {
  valid: boolean;
  actualChecksum: string | null;
  expectedChecksum: string;
  error: string | null;
}

export interface DownloadShutdownOutcome {
  paused: number;
  fallbackCancelled: number;
  queuedPreserved: number;
}

export type DownloadEvent =
  | { type: 'task_added'; task_id: string }
  | { type: 'task_started'; task_id: string }
  | { type: 'task_progress'; task_id: string; progress: DownloadProgress }
  | { type: 'task_completed'; task_id: string }
  | {
      type: 'task_failed';
      task_id: string;
      error: string;
      reason_code: string;
      recoverable: boolean;
    }
  | { type: 'task_paused'; task_id: string }
  | { type: 'task_resumed'; task_id: string }
  | { type: 'task_cancelled'; task_id: string }
  | { type: 'queue_updated'; stats: DownloadQueueStats };

// ============================================================================
// System Tray Types
// ============================================================================

export type TrayIconState = 'normal' | 'downloading' | 'update' | 'error';
export type TrayLanguage = 'en' | 'zh';
export type TrayClickBehavior =
  | 'toggle_window'
  | 'show_menu'
  | 'check_updates'
  | 'quick_action'
  | 'do_nothing';
export type TrayQuickAction =
  | 'open_settings'
  | 'open_downloads'
  | 'check_updates'
  | 'open_logs'
  | 'open_command_palette'
  | 'open_quick_search'
  | 'toggle_logs'
  | 'manage_plugins'
  | 'install_plugin'
  | 'create_plugin'
  | 'go_dashboard'
  | 'go_toolbox'
  | 'report_bug';
export type TrayNotificationLevel = 'all' | 'important_only' | 'none';
export type TrayNotificationEvent = 'updates' | 'downloads' | 'errors' | 'system';

export type TrayMenuItemId =
  | 'show_hide'
  | 'quick_nav'
  | 'downloads'
  | 'settings'
  | 'check_updates'
  | 'toggle_notifications'
  | 'open_logs'
  | 'open_command_palette'
  | 'open_quick_search'
  | 'toggle_logs'
  | 'manage_plugins'
  | 'install_plugin'
  | 'create_plugin'
  | 'go_dashboard'
  | 'go_toolbox'
  | 'report_bug'
  | 'always_on_top'
  | 'autostart'
  | 'quit';

export interface TrayMenuConfig {
  items: TrayMenuItemId[];
  priorityItems: TrayMenuItemId[];
}

export interface TrayStateInfo {
  iconState: TrayIconState;
  language: TrayLanguage;
  activeDownloads: number;
  hasUpdate: boolean;
  hasError: boolean;
  clickBehavior: TrayClickBehavior;
  quickAction: TrayQuickAction;
  minimizeToTray: boolean;
  startMinimized: boolean;
  showNotifications: boolean;
  notificationLevel: TrayNotificationLevel;
  notificationEvents: TrayNotificationEvent[];
  alwaysOnTop: boolean;
  menuConfig: TrayMenuConfig;
}

// ============================================================================
// Custom Detection Rules Types
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

// ============================================================================
// Health Check Types
// ============================================================================

/** Health status of an environment */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

/** Severity level of a health issue */
export type Severity = 'info' | 'warning' | 'error' | 'critical';

/** Availability/scope state for a health target */
export type HealthScopeState = 'available' | 'unavailable' | 'timeout' | 'unsupported';

/** Source of health diagnostic signal */
export type HealthSignalSource =
  | 'runtime_probe'
  | 'path_heuristic'
  | 'shell_heuristic'
  | 'network_probe'
  | 'api_probe'
  | 'system_probe';

/** Confidence of health diagnostic signal */
export type HealthEvidenceConfidence = 'verified' | 'inferred';

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
  remediation_id?: string | null;
  signal_source?: HealthSignalSource | null;
  confidence?: HealthEvidenceConfidence | null;
  check_id?: string | null;
}

/** Result of a health check for a single environment */
export interface EnvironmentHealthResult {
  env_type: string;
  provider_id: string | null;
  status: HealthStatus;
  scope_state?: HealthScopeState;
  scope_reason?: string | null;
  issues: HealthIssue[];
  suggestions: string[];
  current_version: string | null;
  installed_count: number | null;
  checked_at: string;
}

/** Result of a health check for a package manager */
export interface PackageManagerHealthResult {
  provider_id: string;
  display_name: string;
  status: HealthStatus;
  scope_state?: HealthScopeState;
  scope_reason?: string | null;
  version: string | null;
  executable_path: string | null;
  issues: HealthIssue[];
  install_instructions: string | null;
  checked_at: string;
}

/** Result of a full system health check */
export interface SystemHealthResult {
  overall_status: HealthStatus;
  environments: EnvironmentHealthResult[];
  package_managers: PackageManagerHealthResult[];
  system_issues: HealthIssue[];
  skipped_providers: string[];
  checked_at: string;
}

/** Result of previewing or applying a health remediation */
export interface HealthRemediationResult {
  remediation_id: string;
  supported: boolean;
  dry_run: boolean;
  executed: boolean;
  success: boolean;
  manual_only: boolean;
  command: string | null;
  description: string | null;
  message: string;
  stdout: string | null;
  stderr: string | null;
}

// ============================================================================
// Environment Profiles Types
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
  provider_id?: string | null;
}

export interface ProfileEnvironmentSkipped {
  env_type: string;
  version: string;
  reason: string;
  provider_id?: string | null;
}

// ============================================================================
// WSL Types
// ============================================================================

/** WSL distribution status info */
export interface WslDistroStatus {
  name: string;
  state: string;
  wslVersion: string;
  isDefault: boolean;
}

/** WSL system-level status */
export interface WslStatus {
  version: string;
  kernelVersion?: string;
  wslgVersion?: string;
  defaultDistribution?: string;
  defaultVersion?: string;
  statusInfo: string;
  runningDistros: string[];
}

/** Parsed component versions from `wsl --version` */
export interface WslVersionInfo {
  wslVersion?: string;
  kernelVersion?: string;
  wslgVersion?: string;
  msrdcVersion?: string;
  direct3dVersion?: string;
  dxcoreVersion?: string;
  windowsVersion?: string;
}

/** Runtime-detected WSL capabilities for feature gating */
export interface WslCapabilities {
  manage: boolean;
  move: boolean;
  resize: boolean;
  setSparse: boolean;
  setDefaultUser: boolean;
  mountOptions: boolean;
  shutdownForce: boolean;
  exportFormat: boolean;
  importInPlace: boolean;
  version?: string;
}

/** One probe result within staged runtime detection. */
export interface WslRuntimeProbe {
  id: string;
  command: string;
  success: boolean;
  reasonCode: string;
  detail?: string;
}

/** One non-command runtime stage state (status/capability/distro probes). */
export interface WslRuntimeStage {
  ready: boolean;
  reasonCode: string;
  detail?: string;
}

/** Structured runtime readiness snapshot for WSL management flows. */
export interface WslRuntimeSnapshot {
  state: "unavailable" | "empty" | "degraded" | "ready";
  available: boolean;
  reasonCode: string;
  reason: string;
  runtimeProbes: WslRuntimeProbe[];
  statusProbe: WslRuntimeStage;
  capabilityProbe: WslRuntimeStage;
  distroProbe: WslRuntimeStage;
  distroCount: number;
  degradedReasons: string[];
}

/** Options for importing a WSL distribution */
export interface WslImportOptions {
  name: string;
  installLocation: string;
  filePath: string;
  wslVersion?: number;
  asVhd: boolean;
}

/** Result of executing a command inside a WSL distribution */
export interface WslExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Disk usage information for a WSL distribution */
export interface WslDiskUsage {
  totalBytes: number;
  usedBytes: number;
  filesystemPath: string;
}

/** Aggregated disk usage across all WSL distributions */
export interface WslTotalDiskUsage {
  totalBytes: number;
  perDistro: [string, number][];
}

/** WSL config sections (from .wslconfig) */
export type WslConfig = Record<string, Record<string, string>>;

/** Per-distro /etc/wsl.conf config (same structure as WslConfig) */
export type WslDistroConfig = Record<string, Record<string, string>>;

/** Options for mounting a disk in WSL2 */
export interface WslMountOptions {
  diskPath: string;
  isVhd: boolean;
  fsType?: string;
  partition?: number;
  mountName?: string;
  mountOptions?: string;
  bare: boolean;
}

/** Detected environment info from inside a WSL distribution */
export interface WslDistroEnvironment {
  /** Lowercase distro identifier from os-release ID (e.g. "ubuntu", "arch") */
  distroId: string;
  /** Related distro families from os-release ID_LIKE */
  distroIdLike: string[];
  /** Human-readable name from os-release PRETTY_NAME */
  prettyName: string;
  /** Version number from os-release VERSION_ID */
  versionId?: string;
  /** Version codename from os-release VERSION_CODENAME */
  versionCodename?: string;
  /** CPU architecture (e.g. "x86_64", "aarch64") */
  architecture: string;
  /** Linux kernel version */
  kernelVersion: string;
  /** Detected package manager (e.g. "apt", "pacman", "dnf") */
  packageManager: string;
  /** Init system running as PID 1 (e.g. "systemd", "init") */
  initSystem: string;
  /** Default login shell for the current user */
  defaultShell?: string;
  /** Default (current) username */
  defaultUser?: string;
  /** System uptime in seconds */
  uptimeSeconds?: number;
  /** Hostname of the distro */
  hostname?: string;
  /** Number of installed packages */
  installedPackages?: number;
  /** Whether Docker CLI is available inside the distro */
  dockerAvailable: boolean;
  /** GPU name detected via nvidia-smi */
  gpuName?: string;
  /** GPU total memory (e.g. "8192 MiB") */
  gpuMemory?: string;
  /** Whether Docker socket exists at /var/run/docker.sock (Docker Desktop integration) */
  dockerSocket: boolean;
  /** Number of running Docker containers (if docker is available) */
  dockerContainerCount?: number;
}

/** Live resource usage from a running WSL distribution */
export interface WslDistroResources {
  memTotalKb: number;
  memAvailableKb: number;
  memUsedKb: number;
  swapTotalKb: number;
  swapUsedKb: number;
  cpuCount: number;
  loadAvg: [number, number, number];
}

/** A user account inside a WSL distribution */
export interface WslUser {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
}

/** Result of a package update/upgrade operation */
export interface WslPackageUpdateResult {
  packageManager: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ============================================================================
// Winget Types
// ============================================================================

/** A pinned package entry from winget pin list */
export interface WingetPin {
  name: string;
  id: string;
  version: string;
  source: string;
  pinType: string;
}

/** A winget source entry from winget source list */
export interface WingetSource {
  name: string;
  argument: string;
  sourceType: string;
  updated: string;
}

/** Detailed winget info from winget --info */
export interface WingetInfo {
  version: string;
  logsDir: string | null;
  isAdmin: boolean;
  sources: WingetSource[];
}

// ============================================================================
// Git Types
// ============================================================================

/** Git repository information */
export interface GitRepoInfo {
  rootPath: string;
  currentBranch: string;
  isDirty: boolean;
  fileCountStaged: number;
  fileCountModified: number;
  fileCountUntracked: number;
}

/** Git commit log entry */
export interface GitCommitEntry {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

/** Git branch information */
export interface GitBranchInfo {
  name: string;
  shortHash: string;
  upstream: string | null;
  isCurrent: boolean;
  isRemote: boolean;
}

/** Git remote information */
export interface GitRemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

/** Git tag information */
export interface GitTagInfo {
  name: string;
  shortHash: string;
  date: string | null;
}

/** Git stash entry */
export interface GitStashEntry {
  id: string;
  message: string;
  date: string;
}

/** Git contributor with commit count */
export interface GitContributor {
  name: string;
  email: string;
  commitCount: number;
}

/** Git blame entry for a single line */
export interface GitBlameEntry {
  commitHash: string;
  author: string;
  authorEmail: string;
  timestamp: number;
  summary: string;
  lineNumber: number;
  content: string;
}

/** Git diff file stats */
export interface GitDiffFile {
  path: string;
  insertions: number;
  deletions: number;
}

/** Git configuration entry */
export interface GitConfigEntry {
  key: string;
  value: string;
}

/** Git file-level status entry */
export interface GitStatusFile {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  oldPath: string | null;
}

/** Git commit detail with changed files */
export interface GitCommitDetail {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: GitDiffFile[];
}

/** Git graph entry for commit graph visualization */
export interface GitGraphEntry {
  hash: string;
  parents: string[];
  refs: string[];
  authorName: string;
  date: string;
  message: string;
}

/** Git ahead/behind counts for a branch */
export interface GitAheadBehind {
  ahead: number;
  behind: number;
}

export type GitSupportStatus = 'supported' | 'unsupported' | 'unknown';

export type GitSupportFeatureKey =
  | 'rebaseSquash'
  | 'interactiveRebase'
  | 'bisect'
  | 'sparseCheckout'
  | 'signatureVerify'
  | 'archive'
  | 'patch'
  | 'lfs';

/** Git feature-level runtime support state used for UI gating. */
export interface GitSupportFeature {
  key: GitSupportFeatureKey | string;
  status: GitSupportStatus;
  supported: boolean;
  reason: string | null;
  nextSteps: string[];
  requiresRepo: boolean;
  minVersion: string | null;
}

/** Snapshot of Git runtime support used to gate advanced operations. */
export interface GitSupportSnapshot {
  gitAvailable: boolean;
  gitVersion: string | null;
  executablePath: string | null;
  repoReady: boolean;
  features: GitSupportFeature[];
}

/** Git daily activity for heatmap */
export interface GitDayActivity {
  date: string;
  commitCount: number;
}

/** Git file stat entry for visual file history */
export interface GitFileStatEntry {
  hash: string;
  authorName: string;
  date: string;
  additions: number;
  deletions: number;
}

/** Git reflog entry */
export interface GitReflogEntry {
  hash: string;
  selector: string;
  action: string;
  message: string;
  date: string;
}

export type GitHistorySearchType = 'message' | 'author' | 'diff';

/** Unified history query contract used by git history views. */
export interface GitHistoryQuery {
  query?: string;
  searchType?: GitHistorySearchType;
  author?: string;
  since?: string;
  until?: string;
  file?: string;
  branch?: string;
  limit?: number;
  skip?: number;
  append?: boolean;
}

export type GitHistoryErrorCategory =
  | 'invalid_path'
  | 'invalid_query'
  | 'repo_unavailable'
  | 'command_failed'
  | 'unknown';

export interface GitHistoryQueryError {
  category: GitHistoryErrorCategory;
  message: string;
  recoverable: boolean;
  nextSteps: string[];
}

/** Unified query status model to distinguish empty results and failures. */
export interface GitHistoryQueryState {
  query: GitHistoryQuery | null;
  loading: boolean;
  empty: boolean;
  resultCount: number;
  hasMore: boolean;
  error: GitHistoryQueryError | null;
  updatedAt: string | null;
}

/** Git clone options */
export interface GitCloneOptions {
  branch?: string;
  depth?: number;
  singleBranch?: boolean;
  recurseSubmodules?: boolean;
  shallowSubmodules?: boolean;
  noCheckout?: boolean;
  bare?: boolean;
  mirror?: boolean;
  sparse?: boolean;
  filter?: string;
  jobs?: number;
  noTags?: boolean;
  remoteName?: string;
}

/** Git clone progress event */
export interface GitCloneProgress {
  phase: string;
  percent: number | null;
  current: number | null;
  total: number | null;
  speed: string | null;
  message: string;
}

export type EditorCapabilityReason =
  | 'ok'
  | 'editor_not_found'
  | 'config_not_found'
  | 'runtime_error';

export interface EditorCapabilityProbeResult {
  available: boolean;
  reason: EditorCapabilityReason;
  preferredEditor: string | null;
  configPath: string | null;
  fallbackAvailable: boolean;
}

export type EditorOpenActionKind =
  | 'opened_editor'
  | 'fallback_opened'
  | 'unavailable'
  | 'error';

export type EditorOpenActionReason =
  | 'ok'
  | 'editor_not_found'
  | 'config_not_found'
  | 'editor_launch_failed'
  | 'fallback_failed'
  | 'runtime_error';

export interface EditorOpenActionResult {
  success: boolean;
  kind: EditorOpenActionKind;
  reason: EditorOpenActionReason;
  message: string;
  openedWith: string | null;
  fallbackUsed: boolean;
  fallbackPath: string | null;
}

/** Git submodule information */
export interface GitSubmoduleInfo {
  path: string;
  hash: string;
  status: string;
  describe: string;
}

/** Git worktree information */
export interface GitWorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  isBare: boolean;
  isDetached: boolean;
}

/** Git hook information */
export interface GitHookInfo {
  name: string;
  enabled: boolean;
  hasContent: boolean;
  fileName: string;
}

/** Git LFS file entry */
export interface GitLfsFile {
  oid: string;
  name: string;
  pointerStatus: string;
}

/** Git merge/rebase state */
export interface GitMergeRebaseState {
  state: 'none' | 'merging' | 'rebasing' | 'cherry_picking' | 'reverting';
  onto: string | null;
  progress: number | null;
  total: number | null;
}

/** Git repository statistics */
export interface GitRepoStats {
  sizeOnDisk: string;
  objectCount: number;
  packCount: number;
  looseObjects: number;
  commitCount: number;
  isShallow: boolean;
}

/** Git bisect session state */
export interface GitBisectState {
  active: boolean;
  currentHash: string | null;
  stepsTaken: number;
  remainingEstimate: number | null;
}

/** Git interactive rebase todo item */
export interface GitRebaseTodoItem {
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
  hash: string;
  message: string;
}

export type GitCommandErrorCategory =
  | 'environment'
  | 'precondition'
  | 'conflict'
  | 'execution'
  | 'cancelled'
  | 'timeout'
  | 'unknown';

export interface GitCommandError {
  category: GitCommandErrorCategory;
  recoverable: boolean;
  message: string;
  nextSteps: string[];
}

// ============================================================================
// Launch Types
// ============================================================================

/** Request to launch a program with a specific environment */
export interface LaunchRequest {
  program: string;
  args: string[];
  cwd?: string;
  envType?: string;
  envVersion?: string;
  extraEnv?: Record<string, string>;
  timeoutSecs?: number;
}

/** Result of launching a program */
export interface LaunchResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

/** Shell activation script for an environment */
export interface ActivationScript {
  shell: string;
  script: string;
  envVars: Record<string, string>;
  pathAdditions: string[];
}

/** Environment info for display */
export interface EnvInfoResult {
  envType: string;
  version: string;
  binPath: string | null;
  envVars: Record<string, string>;
}

// ============================================================================
// Shim & PATH Types
// ============================================================================

/** Information about a shim */
export interface ShimInfo {
  binaryName: string;
  envType: string;
  version: string | null;
  targetPath: string;
  shimPath: string;
}

/** PATH status info */
export interface PathStatusInfo {
  shimDir: string;
  isInPath: boolean;
  addCommand: string;
}

/** Result of path validation from backend */
export interface PathValidationResult {
  normalizedPath: string;
  isValid: boolean;
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
  writable: boolean;
  readable: boolean;
  isAbsolute: boolean;
  parentExists: boolean;
  parentWritable: boolean;
  hasTraversal: boolean;
  hasSuspiciousChars: boolean;
  diskAvailable: number;
  diskAvailableHuman: string;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Environment Variable Management
// ============================================================================

export type EnvVarScope = 'process' | 'user' | 'system';
export type EnvFileFormat = 'dotenv' | 'shell' | 'fish' | 'powershell' | 'nushell';
export type EnvVarSensitivityReason =
  | 'token_key'
  | 'password_key'
  | 'secret_key'
  | 'api_key'
  | 'credential_key'
  | 'private_key_value'
  | 'certificate_value'
  | 'jwt_value';

export interface EnvVarValueSummary {
  displayValue: string;
  masked: boolean;
  hasValue: boolean;
  length: number;
  isSensitive: boolean;
  sensitivityReason?: EnvVarSensitivityReason | null;
}

export interface EnvVarSummary {
  key: string;
  scope: EnvVarScope;
  value: EnvVarValueSummary;
  regType?: string | null;
}

export interface EnvVarRevealResult {
  key: string;
  scope: EnvVarScope;
  value: string | null;
  isSensitive: boolean;
  sensitivityReason?: EnvVarSensitivityReason | null;
}

export interface PathEntryInfo {
  path: string;
  exists: boolean;
  isDirectory: boolean;
  isDuplicate: boolean;
}

export interface ShellProfileInfo {
  shell: string;
  configPath: string;
  exists: boolean;
  isCurrent: boolean;
}

export interface EnvVarImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  scope: EnvVarScope;
  success: boolean;
  verified: boolean;
  status: 'verified' | 'verification_failed' | 'manual_followup_required' | 'blocked';
  reasonCode?: string | null;
  message?: string | null;
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

export type EnvVarImportPreviewAction = 'add' | 'update' | 'noop' | 'invalid' | 'skipped';

export interface EnvVarImportPreviewItem {
  key: string;
  value: string;
  action: EnvVarImportPreviewAction;
  reason?: string | null;
  isSensitive: boolean;
  sensitivityReason?: EnvVarSensitivityReason | null;
  redacted: boolean;
}

export interface EnvVarShellGuidance {
  shell: string;
  configPath: string;
  command: string;
  autoApplied: boolean;
  containsSensitiveValue: boolean;
  redacted: boolean;
}

export interface EnvVarImportPreview {
  scope: EnvVarScope;
  fingerprint: string;
  additions: number;
  updates: number;
  noops: number;
  invalid: number;
  skipped: number;
  items: EnvVarImportPreviewItem[];
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

export interface EnvVarPathRepairPreview {
  scope: EnvVarScope;
  fingerprint: string;
  currentEntries: string[];
  repairedEntries: string[];
  duplicateCount: number;
  missingCount: number;
  removedCount: number;
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

export interface EnvVarConflictResolutionResult {
  key: string;
  sourceScope: EnvVarScope;
  targetScope: EnvVarScope;
  appliedValue: string;
  appliedValueSummary: EnvVarValueSummary;
  success: boolean;
  verified: boolean;
  status: 'verified' | 'verification_failed' | 'manual_followup_required' | 'blocked';
  reasonCode?: string | null;
  message?: string | null;
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

export interface EnvVarShellProfileReadResult {
  path: string;
  content: string;
  redactedCount: number;
  containsSensitive: boolean;
  revealed: boolean;
}

export interface EnvVarExportResult {
  scope: EnvVarScope;
  format: EnvFileFormat;
  content: string;
  redacted: boolean;
  sensitiveCount: number;
  variableCount: number;
  revealed: boolean;
}

export interface PersistentEnvVar {
  key: string;
  value: string;
  regType?: string;
}

export interface EnvVarConflict {
  key: string;
  userValue: string;
  systemValue: string;
  effectiveValue: string;
}

export interface EnvVarActionSupport {
  action: string;
  scope?: EnvVarScope | null;
  supported: boolean;
  state: 'ready' | 'blocked' | 'degraded' | 'unavailable';
  reasonCode: string;
  reason: string;
  nextSteps: string[];
}

export interface EnvVarSupportSnapshot {
  state: 'ready' | 'degraded';
  reasonCode: string;
  reason: string;
  platform: string;
  detectedShells: number;
  primaryShellTarget?: string | null;
  actions: EnvVarActionSupport[];
}

export interface EnvVarMutationResult {
  operation: string;
  key: string;
  scope: EnvVarScope;
  success: boolean;
  verified: boolean;
  status: 'verified' | 'verification_failed' | 'manual_followup_required' | 'blocked';
  reasonCode?: string | null;
  message?: string | null;
  effectiveValueSummary?: EnvVarValueSummary | null;
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

export interface EnvVarPathMutationResult {
  operation: string;
  scope: EnvVarScope;
  success: boolean;
  verified: boolean;
  status: 'verified' | 'verification_failed' | 'manual_followup_required' | 'blocked';
  reasonCode?: string | null;
  message?: string | null;
  removedCount: number;
  pathEntries: PathEntryInfo[];
  primaryShellTarget?: string | null;
  shellGuidance: EnvVarShellGuidance[];
}

// ============================================================================
// Terminal Management
// ============================================================================

export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'nushell';

export interface ShellConfigFile {
  path: string;
  exists: boolean;
  sizeBytes: number;
}

export interface ShellInfo {
  id: string;
  name: string;
  shellType: ShellType;
  version: string | null;
  executablePath: string;
  configFiles: ShellConfigFile[];
  isDefault: boolean;
}

export interface ShellStartupMeasurement {
  shellId: string;
  withProfileMs: number;
  withoutProfileMs: number;
  differenceMs: number;
}

export interface ShellHealthResult {
  shellId: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  issues: HealthIssue[];
}

export interface TerminalProfile {
  id: string;
  name: string;
  shellId: string;
  args: string[];
  envVars: Record<string, string>;
  cwd: string | null;
  startupCommand: string | null;
  envType: string | null;
  envVersion: string | null;
  color?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalEnvVarSummary {
  key: string;
  value: EnvVarValueSummary;
}

export interface TerminalEnvVarRevealResult {
  key: string;
  value: string | null;
  isSensitive: boolean;
  sensitivityReason?: EnvVarSensitivityReason | null;
}

export type TemplateCategory = 'general' | 'development' | 'devOps' | 'admin' | 'custom';

export interface TerminalProfileTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  shellType: string | null;
  args: string[];
  envVars: Record<string, string>;
  cwd: string | null;
  startupCommand: string | null;
  envType: string | null;
  envVersion: string | null;
  isBuiltin: boolean;
}

export interface PSProfileInfo {
  scope: string;
  path: string;
  exists: boolean;
  sizeBytes: number;
}

export interface PSModuleInfo {
  name: string;
  version: string;
  moduleType: string;
  path: string;
  description: string;
  exportedCommandsCount: number;
}

export interface PSScriptInfo {
  name: string;
  version: string;
  author: string;
  description: string;
  installPath: string;
}

export type FrameworkCategory = 'framework' | 'plugin-manager' | 'prompt-engine' | 'theme';

export interface ShellFrameworkInfo {
  name: string;
  version: string | null;
  path: string;
  shellType: ShellType;
  category: FrameworkCategory;
  description: string;
  homepage: string | null;
  configPath: string | null;
  activeTheme: string | null;
}

export interface ShellPlugin {
  name: string;
  enabled: boolean;
  source: string;
}

export interface FrameworkCacheInfo {
  frameworkName: string;
  cachePaths: string[];
  totalSize: number;
  totalSizeHuman: string;
  canClean: boolean;
  description: string;
}

export interface ShellConfigEntries {
  aliases: [string, string][];
  exports: [string, string][];
  sources: string[];
}

export type TerminalEditorLanguage = 'bash' | 'powershell' | 'dos' | 'plaintext';
export type TerminalEditorMode = 'enhanced' | 'fallback';
export type TerminalEditorEnhancementLevel = 'basic' | 'enhanced';
export type TerminalEditorContributionKind =
  | 'grammar'
  | 'language-configuration'
  | 'snippets'
  | 'theme'
  | 'completion'
  | 'diagnostics';

export interface TerminalEditorContribution {
  id: string;
  label: string;
  kind: TerminalEditorContributionKind;
  source: 'vscode-compatible';
  enabled: boolean;
  reason: string | null;
}

export interface TerminalConfigEditorCapability {
  mode: TerminalEditorMode;
  enhancementLevel: TerminalEditorEnhancementLevel;
  bundleId: string | null;
  bundleLabel: string | null;
  languageId: string;
  supportsCompletion: boolean;
  supportsInlineDiagnostics: boolean;
  fallbackReason: string | null;
  contributions: TerminalEditorContribution[];
}

export type TerminalConfigMutationOperation = 'backup' | 'append' | 'write';
export type TerminalConfigMutationStage = 'validation' | 'backup' | 'write' | 'verification';
export type TerminalConfigDiagnosticCategory =
  | 'validation'
  | 'backup'
  | 'write'
  | 'verification'
  | 'snapshot'
  | 'unknown';

export interface TerminalConfigDiagnosticLocation {
  line: number | null;
  column: number | null;
  endLine: number | null;
  endColumn: number | null;
}

export interface TerminalConfigDiagnostic {
  category: TerminalConfigDiagnosticCategory;
  stage: TerminalConfigMutationStage | null;
  message: string;
  location: TerminalConfigDiagnosticLocation | null;
}

export interface TerminalConfigEditorMetadata {
  path: string;
  shellType: ShellType;
  language: TerminalEditorLanguage;
  snapshotPath: string | null;
  fingerprint: string | null;
  capability?: TerminalConfigEditorCapability | null;
}

export interface TerminalConfigMutationResult {
  operation: TerminalConfigMutationOperation;
  path: string;
  backupPath: string | null;
  bytesWritten: number;
  verified: boolean;
  diagnostics: string[];
  diagnosticDetails?: TerminalConfigDiagnostic[];
  snapshotPath?: string | null;
  fingerprint?: string | null;
  contextMessage?: string | null;
}

export interface TerminalConfigRestoreResult {
  path: string;
  snapshotPath: string;
  bytesWritten: number;
  verified: boolean;
  diagnostics: string[];
  diagnosticDetails?: TerminalConfigDiagnostic[];
  fingerprint?: string | null;
  contextMessage?: string | null;
}

// ============================================================================
// Diagnostic Types
// ============================================================================

/** Options for exporting a diagnostic bundle */
export interface DiagnosticExportOptions {
  outputPath?: string;
  includeConfig?: boolean;
  errorContext?: DiagnosticErrorContext;
}

/** Options for auto-capturing a frontend crash diagnostic bundle */
export interface DiagnosticCaptureFrontendCrashOptions {
  includeConfig?: boolean;
  source?: string;
  errorContext: DiagnosticErrorContext;
  runtimeBreadcrumbs?: DiagnosticRuntimeBreadcrumb[];
}

/** Error context to embed in a diagnostic report */
export interface DiagnosticErrorContext {
  message?: string;
  stack?: string;
  component?: string;
  timestamp?: string;
  extra?: Record<string, unknown>;
}

export interface DiagnosticRuntimeBreadcrumb {
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

/** Result of a diagnostic bundle export */
export interface DiagnosticExportResult {
  path: string;
  size: number;
  fileCount: number;
}

/** Information about a crash from a previous session */
export interface CrashInfo {
  id?: string;
  source?: string;
  reportPath: string;
  timestamp: string;
  message?: string;
}

/** Crash report artifact metadata exposed to the logs workspace */
export type ShellFrameworkPluginSupportStatus =
  | 'supported'
  | 'missing-config'
  | 'unsupported';
export interface CrashReportInfo {
  id: string;
  source: string;
  reportPath: string;
  timestamp: string;
  message?: string;
  size: number;
  pending: boolean;
}

// ============================================================================
  pluginSupportStatus: ShellFrameworkPluginSupportStatus;
  pluginSupportReason: string | null;
// Xmake/Xrepo Types
// ============================================================================

/** Xrepo repository information from `xrepo list-repo` */
export interface XmakeRepo {
  name: string;
  url: string;
  branch?: string;
}

// ============================================================================
// Homebrew Types
// ============================================================================

/** A Homebrew tap (third-party repository) */
export interface BrewTap {
  name: string;
  remote: string;
  formulaCount: number;
  caskCount: number;
}

/** A Homebrew-managed background service */
export interface BrewService {
  name: string;
  status: string;
  user: string | null;
  file: string | null;
}

/** Result of `brew doctor` health check */
export interface BrewDoctorResult {
  healthy: boolean;
  warnings: string[];
}

/** Result of `brew cleanup` */
export interface BrewCleanupResult {
  freedBytes: number;
  removedItems: string[];
}

/** A pinned (version-locked) Homebrew package */
export interface BrewPinnedPackage {
  name: string;
  version: string;
}

/** A key-value entry from `brew config` */
export interface BrewConfigEntry {
  key: string;
  value: string;
}

/** Homebrew configuration info from `brew config` */
export interface BrewConfigInfo {
  homebrewVersion: string;
  origin: string;
  coreTap: string;
  homebrewPrefix: string;
  homebrewCellar: string;
  homebrewCaskroom: string;
  entries: BrewConfigEntry[];
}

// ============================================================================
// MacPorts Types
// ============================================================================

/** A MacPorts port variant */
export interface PortVariant {
  name: string;
  description: string;
  isDefault: boolean;
}

/** A port that depends on a given port */
export interface PortDependent {
  name: string;
  depType: string;
}

/** A file installed by a port */
export interface PortFileEntry {
  path: string;
}

/** A MacPorts select group (e.g., python, ruby) */
export interface PortSelectGroup {
  group: string;
  options: string[];
  selected: string | null;
}

// ============================================================================
// Python Ecosystem Types (uv, conda, poetry, pipx)
// ============================================================================

/** uv Python entry from `uv python list` */
export interface UvPythonEntry {
  key: string;
  version: string;
  path: string | null;
  managed: boolean;
}

/** uv command run result */
export interface UvRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Conda environment info */
export interface CondaEnvInfo {
  name: string;
  prefix: string;
  isActive: boolean;
  isBase: boolean;
  pythonVersion: string | null;
}

/** Conda system info */
export interface CondaInfo {
  condaVersion: string | null;
  pythonVersion: string | null;
  platform: string | null;
  activePrefix: string | null;
  rootPrefix: string | null;
  envsDirs: string[];
  channels: string[];
}

/** Conda env export result */
export interface CondaExportResult {
  content: string;
  envName: string;
}

/** Poetry virtual environment info */
export interface PoetryEnvInfo {
  path: string;
  pythonVersion: string | null;
  isActive: boolean;
}

/** Poetry command run result */
export interface PoetryRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** pipx command run result */
export interface PipxRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
