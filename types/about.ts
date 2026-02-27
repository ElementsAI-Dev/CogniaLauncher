import type { GpuInfo, ComponentInfo, BatteryInfo, DiskInfo, NetworkInterfaceInfo } from './tauri';

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
  components: ComponentInfo[];
  battery: BatteryInfo | null;
  disks: DiskInfo[];
  networks: NetworkInterfaceInfo[];
}

export type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'done' | 'error';
