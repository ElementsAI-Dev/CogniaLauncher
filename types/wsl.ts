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
// WSL config setting definitions
// ============================================================================

export type SettingType = 'text' | 'bool' | 'select';

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
  onLaunch: (name: string) => void;
  onTerminate: (name: string) => void;
  onSetDefault: (name: string) => void;
  onSetVersion: (name: string, version: number) => void;
  onExport: (name: string) => void;
  onUnregister: (name: string) => void;
  onChangeDefaultUser?: (name: string) => void;
  getDiskUsage?: (name: string) => Promise<WslDiskUsage | null>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslStatusCardProps {
  status: WslStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onShutdownAll: () => void;
  getIpAddress?: () => Promise<string>;
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (options: WslImportOptions) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslImportInPlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, vhdxPath: string) => Promise<void>;
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

export interface WslEmptyStateProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslNotAvailableProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  onInstallWsl?: () => Promise<string>;
}

export interface WslDistroDetailPageProps {
  distroName: string;
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface WslDistroServicesProps {
  distroName: string;
  isRunning: boolean;
  onExec: (distro: string, command: string, user?: string) => Promise<WslExecResult>;
  t: (key: string, params?: Record<string, string | number>) => string;
}
