import type { GpuInfo, ComponentInfo, BatteryInfo, DiskInfo, NetworkInterfaceInfo } from './tauri';

export type SystemSubsystem =
  | 'platform'
  | 'components'
  | 'battery'
  | 'disks'
  | 'networks'
  | 'cache'
  | 'homeDir';

export interface SystemSectionState {
  status: 'ok' | 'failed' | 'unavailable';
  itemCount?: number;
}

export interface SystemInfo {
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
  homeDir: string;
  locale: string;
  cacheInternalSizeHuman?: string;
  cacheExternalSizeHuman?: string;
  cacheTotalSizeHuman?: string;
  components: ComponentInfo[];
  battery: BatteryInfo | null;
  disks: DiskInfo[];
  networks: NetworkInterfaceInfo[];
  subsystemErrors?: SystemSubsystem[];
  sectionSummary?: Partial<Record<SystemSubsystem, SystemSectionState>>;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'update_available'
  | 'up_to_date'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error';

export type UpdateErrorCategory =
  | 'network_error'
  | 'timeout_error'
  | 'permission_error'
  | 'unsupported_error'
  | 'update_check_failed'
  | 'update_install_failed'
  | 'unknown_error';
