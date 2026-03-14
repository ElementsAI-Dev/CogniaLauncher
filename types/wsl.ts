import type {
  WslDistroStatus,
  WslStatus,
  WslCapabilities,
  WslImportOptions,
  WslExecResult,
  WslDiskUsage,
  WslConfig,
  WslDistroConfig,
  WslMountOptions,
  WslDistroEnvironment,
  WslDistroResources,
  WslPackageUpdateResult,
  WslUser,
} from '@/types/tauri';

// ============================================================================
// Shared data types used across WSL components
// ============================================================================

/** Command execution history entry (used by exec terminal & distro terminal) */
export interface ExecHistoryEntry {
  command: string;
  distro?: string;
  user?: string;
  result: WslExecResult;
  timestamp: number;
}

/** A parsed file entry from `ls -la` output */
export interface FileEntry {
  name: string;
  type: 'dir' | 'file' | 'link' | 'other';
  permissions: string;
  size: string;
  modified: string;
  linkTarget?: string;
}

/** Network overview info for a WSL distribution */
export interface NetworkInfo {
  hostname: string;
  ipAddress: string;
  dns: string[];
  listeningPorts: ListeningPort[];
  interfaces: NetworkInterface[];
}

/** A listening port parsed from ss/netstat output */
export interface ListeningPort {
  protocol: string;
  address: string;
  port: string;
  process: string;
}

/** A network interface parsed from `ip addr show` output */
export interface NetworkInterface {
  name: string;
  ipv4: string;
  ipv6: string;
  mac: string;
}

/** A systemd service entry parsed from systemctl output */
export interface ServiceInfo {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'exited' | 'inactive' | 'other';
  description: string;
  pid?: string;
  activeState: string;
  subState: string;
}

// ============================================================================
// WSL assistance workflow types
// ============================================================================

export type WslAssistanceScope = 'runtime' | 'distro';
export type WslAssistanceCategory = 'check' | 'repair' | 'maintenance';
export type WslAssistanceRisk = 'safe' | 'high';
export type WslAssistanceStatus = 'healthy' | 'warning' | 'error';
export type WslAssistanceActionResult = 'success' | 'failed' | 'blocked';

export interface WslAssistanceActionDescriptor {
  id: string;
  scope: WslAssistanceScope;
  category: WslAssistanceCategory;
  risk: WslAssistanceRisk;
  labelKey: string;
  descriptionKey: string;
  supported: boolean;
  blockedReason?: string;
  requiresAdmin?: boolean;
  distroName?: string;
}

export interface WslAssistancePreflightCheck {
  id: string;
  label: string;
  status: WslAssistanceStatus;
  detail: string;
  recommendation?: string;
}

export interface WslAssistancePreflightResult {
  status: WslAssistanceStatus;
  timestamp: string;
  checks: WslAssistancePreflightCheck[];
  recommendations: string[];
}

export interface WslAssistanceSummary {
  actionId: string;
  status: WslAssistanceActionResult;
  timestamp: string;
  title: string;
  findings: string[];
  recommendations: string[];
  retryable: boolean;
  details?: string;
}

export interface WslAssistanceSuggestion {
  actionId: string;
  reason: string;
}

// ============================================================================
// WSL batch workflow types
// ============================================================================

export type WslBatchWorkflowTargetMode = 'selected' | 'tag' | 'explicit';
export type WslBatchWorkflowActionKind = 'lifecycle' | 'command' | 'health-check' | 'assistance';
export type WslBatchWorkflowLifecycleOperation = 'launch' | 'terminate';
export type WslBatchWorkflowTargetStatus = 'runnable' | 'blocked' | 'skipped' | 'missing';
export type WslBatchWorkflowItemStatus = 'success' | 'failed' | 'skipped';

export interface WslBatchWorkflowTarget {
  mode: WslBatchWorkflowTargetMode;
  tag?: string;
  distroNames?: string[];
}

export interface WslBatchWorkflowLifecycleAction {
  kind: 'lifecycle';
  operation: WslBatchWorkflowLifecycleOperation;
  label?: string;
}

export interface WslBatchWorkflowCommandAction {
  kind: 'command';
  command: string;
  user?: string;
  savedCommandId?: string;
  label?: string;
}

export interface WslBatchWorkflowHealthCheckAction {
  kind: 'health-check';
  label?: string;
}

export interface WslBatchWorkflowAssistanceAction {
  kind: 'assistance';
  actionId: string;
  label?: string;
}

export type WslBatchWorkflowAction =
  | WslBatchWorkflowLifecycleAction
  | WslBatchWorkflowCommandAction
  | WslBatchWorkflowHealthCheckAction
  | WslBatchWorkflowAssistanceAction;

export interface WslBatchWorkflowPreset {
  id: string;
  name: string;
  target: WslBatchWorkflowTarget;
  action: WslBatchWorkflowAction;
  createdAt: string;
  updatedAt: string;
}

export interface WslBatchWorkflowResolvedTarget {
  distroName: string;
  status: WslBatchWorkflowTargetStatus;
  reason?: string;
}

export interface WslBatchWorkflowTargetResolution {
  resolvedNames: string[];
  missingNames: string[];
}

export interface WslBatchWorkflowPreflight {
  workflowName: string;
  actionLabel: string;
  risk: 'safe' | 'high';
  longRunning: boolean;
  requiresConfirmation: boolean;
  refreshTargets: Array<'inventory' | 'runtime' | 'config' | 'backup' | 'network'>;
  targets: WslBatchWorkflowResolvedTarget[];
  runnableCount: number;
  blockedCount: number;
  skippedCount: number;
  missingCount: number;
}

export interface WslBatchWorkflowItemResult {
  distroName: string;
  status: WslBatchWorkflowItemStatus;
  detail?: string;
  retryable: boolean;
}

export interface WslBatchWorkflowSummary {
  id: string;
  workflowName: string;
  actionLabel: string;
  startedAt: string;
  completedAt: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  refreshTargets: Array<'inventory' | 'runtime' | 'config' | 'backup' | 'network'>;
  workflow: WslBatchWorkflowPreset;
  results: WslBatchWorkflowItemResult[];
}

// ============================================================================
// WSL completeness contract
// ============================================================================

export type WslCompletenessState =
  | 'unavailable'
  | 'empty'
  | 'ready'
  | 'degraded';

export type WslFailureCategory =
  | 'unsupported'
  | 'permission'
  | 'runtime'
  | 'operation';

export type WslOperationId =
  | 'runtime.importInPlace'
  | 'runtime.mount'
  | 'runtime.mountWithOptions'
  | 'distro.setSparse'
  | 'network.portForward'
  | 'distro.healthCheck';

export interface WslOperationGate {
  supported: boolean;
  reason?: string;
  capability?: keyof WslCapabilities;
}

export interface WslOperationFailure {
  category: WslFailureCategory;
  message: string;
  raw: string;
}

export interface WslCompletenessSnapshot {
  state: WslCompletenessState;
  available: boolean;
  distroCount: number;
  runningCount: number;
  degradedReasons: string[];
}

// ============================================================================
// WSL config setting definitions
// ============================================================================

export type SettingType = 'text' | 'bool' | 'select' | 'number' | 'path';

/** A WSL2 global setting definition (.wslconfig) */
export interface WslSettingDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
  type: SettingType;
  options?: string[];
  /** INI section this setting belongs to (default: 'wsl2') */
  section?: 'wsl2' | 'experimental';
  /** Frontend validation: returns error message or null if valid */
  validate?: (value: string) => string | null;
}

/** A per-distro quick setting definition (/etc/wsl.conf) */
export interface QuickSetting {
  section: string;
  key: string;
  labelKey: string;
  descKey: string;
  type: 'boolean' | 'text' | 'select';
  defaultValue: string;
  options?: string[];
}

// ============================================================================
// Component Props interfaces
// ============================================================================

export interface WslDistroCardProps {
  distro: WslDistroStatus;
  detailHref?: string;
  onLaunch: (name: string) => void;
  onTerminate: (name: string) => void;
  onSetDefault: (name: string) => void;
  onSetVersion: (name: string, version: number) => void;
  onExport: (name: string) => void;
  onUnregister: (name: string) => void;
  onChangeDefaultUser?: (name: string) => void;
  onOpenInExplorer?: (name: string) => void;
  onOpenInTerminal?: (name: string) => void;
  onClone?: (name: string) => void;
  getDiskUsage?: (name: string) => Promise<WslDiskUsage | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslStatusCardProps {
  status: WslStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onShutdownAll: () => void;
  getIpAddress?: () => Promise<string>;
  config?: WslConfig | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslConfigCardProps {
  config: WslConfig | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSetConfig: (section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroConfigCardProps {
  distroName: string;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslOnlineListProps {
  distros: [string, string][];
  installedNames: string[];
  loading: boolean;
  onInstall: (name: string) => void;
  onInstallWithLocation?: (name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslExecTerminalProps {
  distros: WslDistroStatus[];
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslExportDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onExport: (name: string, filePath: string, asVhd: boolean) => Promise<void>;
  capabilities?: WslCapabilities | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (options: WslImportOptions) => Promise<void>;
  capabilities?: WslCapabilities | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslImportInPlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, vhdxPath: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslInstallLocationDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, location: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslCloneDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, newName: string, location: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslMountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities: WslCapabilities | null;
  onConfirm: (options: WslMountOptions) => Promise<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslMoveDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslResizeDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (size: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslChangeUserDialogProps {
  open: boolean;
  distroName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (distro: string, username: string) => Promise<void>;
  listUsers: (distro: string) => Promise<WslUser[]>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslBatchWorkflowCardProps {
  draft: WslBatchWorkflowPreset;
  editingPresetId: string | null;
  presets: WslBatchWorkflowPreset[];
  distros: WslDistroStatus[];
  availableTags: string[];
  selectedCount: number;
  commandOptions: Array<{ id: string; name: string; command: string; user?: string }>;
  assistanceActions: WslAssistanceActionDescriptor[];
  onDraftChange: (draft: WslBatchWorkflowPreset) => void;
  onSavePreset: () => void;
  onRunDraft: () => void;
  onEditPreset: (preset: WslBatchWorkflowPreset) => void;
  onRunPreset: (preset: WslBatchWorkflowPreset) => void;
  onDeletePreset: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslBatchWorkflowPreviewDialogProps {
  open: boolean;
  workflowName: string;
  preview: WslBatchWorkflowPreflight | null;
  running?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslBatchWorkflowSummaryCardProps {
  summary: WslBatchWorkflowSummary | null;
  onRetry: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslEmptyStateProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslNotAvailableProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  onInstallWsl?: () => Promise<string>;
}

export interface WslDistroDetailPageProps {
  distroName: string;
  returnTo?: string;
  origin?: string;
  continueAction?: string;
}

export interface WslDistroOverviewProps {
  distroName: string;
  distro: WslDistroStatus | null;
  getDiskUsage: (name: string) => Promise<WslDiskUsage | null>;
  getIpAddress: (distro?: string) => Promise<string>;
  getDistroConfig: (distro: string) => Promise<WslDistroConfig | null>;
  setDistroConfigValue: (distro: string, section: string, key: string, value?: string) => Promise<void>;
  detectDistroEnv: (distro: string) => Promise<WslDistroEnvironment | null>;
  getDistroResources?: (distro: string) => Promise<WslDistroResources | null>;
  updateDistroPackages?: (distro: string, mode: string) => Promise<WslPackageUpdateResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroTerminalProps {
  distroName: string;
  isRunning: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroFilesystemProps {
  distroName: string;
  isRunning?: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroNetworkProps {
  distroName: string;
  isRunning: boolean;
  getIpAddress: (distro?: string) => Promise<string>;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  listPortForwards: () => Promise<{
    listenAddress: string;
    listenPort: string;
    connectAddress: string;
    connectPort: string;
  }[]>;
  addPortForward: (listenPort: number, connectPort: number, connectAddress: string) => Promise<void>;
  removePortForward: (listenPort: number) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroServicesProps {
  distroName: string;
  isRunning: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}
