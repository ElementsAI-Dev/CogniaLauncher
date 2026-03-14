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

export interface ProviderInfo {
  id: string;
  displayName: string;
  capabilities: string[];
  platforms: string[];
  priority: number;
  isEnvironmentProvider: boolean;
  enabled: boolean;
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

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

// ============================================================================
// Process
// ============================================================================

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface ProcessOptions {
  cwd?: string | null;
  env?: Record<string, string>;
  timeoutMs?: number;
  captureOutput?: boolean;
}

export interface ProcessExecOptions extends ProcessOptions {
  args?: string[];
}

export interface ProcessLookupResult {
  path: string | null;
}

export interface ProcessAvailabilityResult {
  available: boolean;
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

// ============================================================================
// Events
// ============================================================================

export interface PluginEventEnvelope<TPayload = unknown> {
  event: string;
  payload: TPayload;
  sourcePluginId: string | null;
  timestamp: string;
}

// ============================================================================
// Logging
// ============================================================================

export interface PluginLogRecord<
  TFields extends Record<string, unknown> = Record<string, unknown>,
> {
  level: string;
  message: string;
  target?: string | null;
  fields?: TFields;
  tags?: string[];
  correlationId?: string | null;
}

export interface PluginLogEnvelope<
  TFields extends Record<string, unknown> = Record<string, unknown>,
> extends PluginLogRecord<TFields> {
  sourceType: string;
  sourcePluginId: string | null;
  timestamp: string;
}

// ============================================================================
// UI Host Effects
// ============================================================================

export type PluginUiRequestStatus =
  | 'ok'
  | 'cancelled'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface PluginUiContext {
  locale: string;
  theme: string;
  windowEffect: string;
  desktop: boolean;
  inAppEffects: boolean;
}

export interface PluginUiFileFilter {
  name: string;
  extensions: string[];
}

export interface PluginUiRequestBase {
  correlationId?: string | null;
}

export interface PluginUiToastRequest extends PluginUiRequestBase {
  effect: 'toast';
  message: string;
  title?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
}

export interface PluginUiNavigateRequest extends PluginUiRequestBase {
  effect: 'navigate';
  path: string;
}

export interface PluginUiConfirmRequest extends PluginUiRequestBase {
  effect: 'confirm';
  message: string;
  title?: string;
}

export interface PluginUiPickFileRequest extends PluginUiRequestBase {
  effect: 'pick-file';
  title?: string;
  defaultPath?: string;
  multiple?: boolean;
  filters?: PluginUiFileFilter[];
}

export interface PluginUiPickDirectoryRequest extends PluginUiRequestBase {
  effect: 'pick-directory';
  title?: string;
  defaultPath?: string;
}

export interface PluginUiSaveFileRequest extends PluginUiRequestBase {
  effect: 'save-file';
  title?: string;
  defaultPath?: string;
  filters?: PluginUiFileFilter[];
}

export interface PluginUiOpenExternalRequest extends PluginUiRequestBase {
  effect: 'open-external';
  url: string;
}

export interface PluginUiRevealPathRequest extends PluginUiRequestBase {
  effect: 'reveal-path';
  path: string;
}

export type PluginUiRequest =
  | PluginUiToastRequest
  | PluginUiNavigateRequest
  | PluginUiConfirmRequest
  | PluginUiPickFileRequest
  | PluginUiPickDirectoryRequest
  | PluginUiSaveFileRequest
  | PluginUiOpenExternalRequest
  | PluginUiRevealPathRequest;

export interface PluginUiConfirmData {
  confirmed: boolean;
}

export interface PluginUiPathData {
  path: string;
}

export interface PluginUiPathsData {
  paths: string[];
}

export interface PluginUiRequestResult<TData = unknown> {
  effect: string;
  status: PluginUiRequestStatus;
  correlationId?: string | null;
  message?: string | null;
  data?: TData;
}

// ============================================================================
// Download
// ============================================================================

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  directory: string;
  status: string;
  totalBytes: number | null;
  downloadedBytes: number;
  speed: number | null;
  progress: number;
  createdAt: string;
  error: string | null;
}

export interface DownloadStats {
  active: number;
  queued: number;
  completed: number;
  failed: number;
  totalSpeed: number;
}

export interface DownloadHistoryEntry {
  id: string;
  url: string;
  filename: string;
  directory: string;
  totalBytes: number | null;
  status: string;
  completedAt: string | null;
  error: string | null;
}

export interface DownloadHistoryStats {
  totalDownloads: number;
  totalBytes: number;
  successCount: number;
  failCount: number;
}

export interface DownloadVerifyResult {
  valid: boolean;
  actualHash: string;
  expectedHash: string;
  algorithm: string;
}

// ============================================================================
// Git
// ============================================================================

export interface GitRepoInfo {
  path: string;
  currentBranch: string | null;
  isDetached: boolean;
  headCommit: string | null;
  isDirty: boolean;
  remoteUrl: string | null;
}

export interface GitStatusFile {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatus {
  branch: string | null;
  files: GitStatusFile[];
  ahead: number;
  behind: number;
  isClean: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: string | null;
  commitHash: string | null;
  lastCommitMessage: string | null;
}

export interface GitTag {
  name: string;
  commitHash: string;
  message: string | null;
  taggerDate: string | null;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
}

export interface GitCommitDetail extends GitCommit {
  body: string | null;
  parents: string[];
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitBlameEntry {
  lineStart: number;
  lineEnd: number;
  commitHash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitStash {
  index: number;
  message: string;
  branch: string | null;
  date: string;
}

export interface GitContributor {
  name: string;
  email: string;
  commits: number;
}

export interface GitAheadBehind {
  ahead: number;
  behind: number;
  branch: string;
  upstream: string | null;
}

// ============================================================================
// Health Check
// ============================================================================

export interface HealthIssue {
  severity: string;
  message: string;
  category: string;
  remediation: string | null;
}

export interface HealthReport {
  status: string;
  issues: HealthIssue[];
  checkedAt: string;
  duration: number;
}

// ============================================================================
// Profiles
// ============================================================================

export interface ProfileEntry {
  envType: string;
  version: string;
  provider: string | null;
}

export interface Profile {
  id: string;
  name: string;
  description: string | null;
  entries: ProfileEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCreateInput {
  name: string;
  description?: string | null;
  entries: ProfileEntry[];
}

// ============================================================================
// Cache (Extended)
// ============================================================================

export interface CacheDetailInfo {
  cacheDir: string;
  totalSize: number;
  totalSizeHuman: string;
  entryCount: number;
}

export interface CacheEntry {
  key: string;
  cacheType: string;
  size: number;
  sizeHuman: string;
  createdAt: string;
  lastAccessed: string | null;
  accessCount: number;
}

export interface CacheAccessStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

export interface CacheCleanupRecord {
  cacheType: string;
  bytesFreed: number;
  entriesRemoved: number;
  cleanedAt: string;
}

export interface ExternalCache {
  provider: string;
  displayName: string;
  path: string;
  size: number;
  sizeHuman: string;
  available: boolean;
}

export interface ExternalCachePath {
  provider: string;
  path: string;
  exists: boolean;
}

export interface CacheCleanPreview {
  cacheType: string;
  entriesToRemove: number;
  bytesToFree: number;
  bytesToFreeHuman: string;
}

export interface CacheCleanResult {
  cacheType: string;
  entriesRemoved: number;
  bytesFreed: number;
  bytesFreedHuman: string;
  success: boolean;
}

// ============================================================================
// Shell / Terminal
// ============================================================================

export interface DetectedShell {
  name: string;
  path: string;
  version: string | null;
  isDefault: boolean;
}

export interface ShellProfile {
  id: string;
  name: string;
  shell: string;
  args: string[];
  env: Record<string, string>;
  cwd: string | null;
  isDefault: boolean;
}

export interface ShellInfo {
  name: string;
  version: string | null;
  path: string;
  configFiles: string[];
  features: string[];
}

export interface ShellHealthReport {
  shell: string;
  healthy: boolean;
  issues: string[];
  startupTime: number | null;
}

export interface ShellFramework {
  name: string;
  version: string | null;
  shell: string;
  configDir: string | null;
}

// ============================================================================
// WSL
// ============================================================================

export interface WslStatus {
  available: boolean;
  wslVersion: string | null;
  kernelVersion: string | null;
  defaultDistro: string | null;
}

export interface WslVersionInfo {
  wslVersion: string;
  kernelVersion: string;
  wslgVersion: string | null;
}

export interface WslDistro {
  name: string;
  state: string;
  version: number;
  isDefault: boolean;
}

export interface WslOnlineDistro {
  name: string;
  friendlyName: string;
}

export interface WslDiskUsage {
  distro: string;
  sizeBytes: number;
  sizeHuman: string;
}

// ============================================================================
// Batch Operations
// ============================================================================

export interface BatchItem {
  name: string;
  version?: string | null;
  provider: string;
}

export interface BatchResultEntry {
  name: string;
  provider: string;
  success: boolean;
  error: string | null;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchResultEntry[];
}

export interface PackageHistoryEntry {
  name: string;
  version: string;
  provider: string;
  action: string;
  timestamp: string;
  success: boolean;
}

export interface PinnedPackage {
  name: string;
  version: string;
  provider: string;
  pinnedAt: string;
}

// ============================================================================
// Launch / Environment Activation
// ============================================================================

export interface EnvActivationInfo {
  envType: string;
  currentVersion: string | null;
  availableVersions: string[];
  activePath: string | null;
}

export interface ActivationResult {
  success: boolean;
  envType: string;
  version: string;
  activatedPath: string | null;
  error: string | null;
}
