/**
 * Tauri API Types for CogniaLauncher
 * Extracted from lib/tauri.ts for better code organization
 */

// ============================================================================
// Environment Types
// ============================================================================

/** Environment installation progress event payload */
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

/** System-detected environment information (not managed by version managers) */
export interface SystemEnvironmentInfo {
  env_type: string;
  version: string;
  executable_path: string | null;
  source: string;
}

/** Environment type mapping from provider ID to logical type */
export type EnvironmentTypeMapping = Record<string, string>;

export interface EnvironmentProviderInfo {
  id: string;
  display_name: string;
  env_type: string;
  description: string;
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
}

// ============================================================================
// Cache Types
// ============================================================================

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
}

export interface EnhancedCleanResult {
  freed_bytes: number;
  freed_human: string;
  deleted_count: number;
  use_trash: boolean;
  history_id: string;
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

// ============================================================================
// Platform Types
// ============================================================================

export interface PlatformInfo {
  os: string;
  arch: string;
  os_version: string;
  os_long_version: string;
  kernel_version: string;
  hostname: string;
  cpu_model: string;
  cpu_cores: number;
  total_memory: number;
  available_memory: number;
  uptime: number;
  app_version: string;
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

export interface UpdateCheckSummary {
  updates: UpdateInfo[];
  total_checked: number;
  total_providers: number;
  errors: UpdateCheckError[];
}

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

export interface VerifyResult {
  valid: boolean;
  actualChecksum: string | null;
  expectedChecksum: string;
  error: string | null;
}

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

// ============================================================================
// System Tray Types
// ============================================================================

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

/** Result of a health check for a package manager */
export interface PackageManagerHealthResult {
  provider_id: string;
  display_name: string;
  status: HealthStatus;
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
  checked_at: string;
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
}

export interface ProfileEnvironmentSkipped {
  env_type: string;
  version: string;
  reason: string;
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
  statusInfo: string;
  runningDistros: string[];
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

/** WSL config sections (from .wslconfig) */
export type WslConfig = Record<string, Record<string, string>>;

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
