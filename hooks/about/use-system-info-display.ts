import { useMemo } from 'react';
import { formatBytes } from '@/lib/utils';
import type { SystemInfo } from '@/types/about';

export interface SystemInfoDisplay {
  osDisplayName: string | undefined;
  memoryDisplay: string | undefined;
  memoryPercent: number;
  swapDisplay: string | undefined;
  swapPercent: number;
  cpuCoresDisplay: string | undefined;
  gpuDisplay: string | undefined;
}

export function useSystemInfoDisplay(systemInfo: SystemInfo | null): SystemInfoDisplay {
  const osDisplayName = useMemo(() => {
    if (!systemInfo) return undefined;
    if (systemInfo.osLongVersion) return systemInfo.osLongVersion;
    if (systemInfo.osVersion) return `${systemInfo.os} ${systemInfo.osVersion}`;
    return systemInfo.os;
  }, [systemInfo]);

  const memoryDisplay = useMemo(() => {
    if (!systemInfo || systemInfo.totalMemory === 0) return undefined;
    return `${formatBytes(systemInfo.usedMemory)} / ${formatBytes(systemInfo.totalMemory)}`;
  }, [systemInfo]);

  const memoryPercent = useMemo(() => {
    if (!systemInfo || systemInfo.totalMemory === 0) return 0;
    return Math.round(
      (systemInfo.usedMemory / systemInfo.totalMemory) * 100
    );
  }, [systemInfo]);

  const swapDisplay = useMemo(() => {
    if (!systemInfo || systemInfo.totalSwap === 0) return undefined;
    return `${formatBytes(systemInfo.usedSwap)} / ${formatBytes(systemInfo.totalSwap)}`;
  }, [systemInfo]);

  const swapPercent = useMemo(() => {
    if (!systemInfo || systemInfo.totalSwap === 0) return 0;
    return Math.round(
      (systemInfo.usedSwap / systemInfo.totalSwap) * 100
    );
  }, [systemInfo]);

  const cpuCoresDisplay = useMemo(() => {
    if (!systemInfo || !systemInfo.cpuCores) return undefined;
    const logical = systemInfo.cpuCores;
    const physical = systemInfo.physicalCoreCount;
    if (physical && physical !== logical) {
      return `${physical}P / ${logical}L`;
    }
    return `${logical}`;
  }, [systemInfo]);

  const gpuDisplay = useMemo(() => {
    if (!systemInfo?.gpus?.length) return undefined;
    return systemInfo.gpus
      .map((g) => {
        let s = g.name;
        if (g.vramMb) s += ` (${g.vramMb >= 1024 ? `${(g.vramMb / 1024).toFixed(1)} GB` : `${g.vramMb} MB`})`;
        return s;
      })
      .join(", ");
  }, [systemInfo]);

  return {
    osDisplayName,
    memoryDisplay,
    memoryPercent,
    swapDisplay,
    swapPercent,
    cpuCoresDisplay,
    gpuDisplay,
  };
}
