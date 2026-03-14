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

export type AboutInsightGroupState =
  | 'loading'
  | 'ok'
  | 'failed'
  | 'unavailable';

export interface AboutProviderSummary {
  total: number;
  installed: number;
  supported: number;
  unsupported: number;
}

export interface AboutStorageSummary {
  cacheTotalSizeHuman: string;
  logTotalSizeBytes: number | null;
  logTotalSizeHuman: string | null;
}

export interface AboutInsightsSectionSummary {
  providers: AboutInsightGroupState;
  logs: AboutInsightGroupState;
  cache: AboutInsightGroupState;
}

export interface AboutInsights {
  runtimeMode: 'desktop' | 'web';
  providerSummary: AboutProviderSummary;
  storageSummary: AboutStorageSummary;
  sections: AboutInsightsSectionSummary;
  generatedAt: string;
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
  | 'source_unavailable_error'
  | 'network_error'
  | 'timeout_error'
  | 'validation_error'
  | 'signature_error'
  | 'permission_error'
  | 'unsupported_error'
  | 'update_check_failed'
  | 'update_install_failed'
  | 'unknown_error';
