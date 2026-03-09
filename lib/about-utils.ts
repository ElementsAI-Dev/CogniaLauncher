import { formatBytes, formatUptime } from '@/lib/utils';
import { APP_VERSION } from '@/lib/app-version';
import type { AboutInsights, SystemInfo } from '@/types/about';
import type { SelfUpdateInfo } from '@/lib/tauri';
import type { SystemInfoDisplay } from '@/hooks/use-system-info-display';

export interface BuildSystemInfoTextParams {
  systemInfo: SystemInfo | null;
  aboutInsights?: AboutInsights | null;
  updateInfo: SelfUpdateInfo | null;
  display: Pick<SystemInfoDisplay, 'osDisplayName' | 'cpuCoresDisplay' | 'memoryDisplay' | 'swapDisplay' | 'gpuDisplay'>;
  unknownText: string;
  t: (key: string) => string;
}

export function buildSystemInfoText({
  systemInfo,
  aboutInsights,
  updateInfo,
  display,
  unknownText,
  t,
}: BuildSystemInfoTextParams): string {
  const { osDisplayName, cpuCoresDisplay, memoryDisplay, swapDisplay, gpuDisplay } = display;

  const lines: string[] = [];
  const append = (label: string, value: string | number | null | undefined) => {
    const safeValue =
      value === null || value === undefined || value === ''
        ? unknownText
        : value;
    lines.push(`${label}: ${safeValue}`);
  };

  lines.push(`${t('about.systemInfoTitle')}`);
  lines.push('================================');
  append(
    t('about.version'),
    `v${updateInfo?.current_version || systemInfo?.appVersion || APP_VERSION}`,
  );
  append(t('about.operatingSystem'), osDisplayName);
  append(t('about.architecture'), systemInfo?.cpuArch || systemInfo?.arch);
  append(t('about.kernelVersion'), systemInfo?.kernelVersion);
  append(t('about.hostname'), systemInfo?.hostname);
  append(t('about.cpu'), `${systemInfo?.cpuModel || unknownText} (${cpuCoresDisplay || 0} ${t('about.cores')})`);
  append(
    t('about.cpuFrequency'),
    systemInfo?.cpuFrequency ? `${systemInfo.cpuFrequency} MHz` : null,
  );
  append(t('about.cpuVendor'), systemInfo?.cpuVendorId);
  append(
    t('about.memory'),
    memoryDisplay ||
      (systemInfo?.totalMemory
        ? `${formatBytes(systemInfo.usedMemory)} / ${formatBytes(systemInfo.totalMemory)}`
        : null),
  );
  append(
    t('about.totalMemory'),
    systemInfo?.totalMemory ? formatBytes(systemInfo.totalMemory) : null,
  );
  append(
    'Available Memory',
    systemInfo?.availableMemory ? formatBytes(systemInfo.availableMemory) : null,
  );
  append(t('about.swap'), swapDisplay);
  append(t('about.gpu'), gpuDisplay);
  append(
    t('about.uptime'),
    systemInfo?.uptime ? formatUptime(systemInfo.uptime) : null,
  );
  append(t('about.bootTime'), systemInfo?.bootTime ? new Date(systemInfo.bootTime * 1000).toISOString() : null);
  append('Distribution', systemInfo?.distributionId);
  append('OS Name', systemInfo?.osName);
  append(t('about.homeDirectory'), systemInfo?.homeDir || '~/.cognia');
  append(t('about.cacheTotalSize'), systemInfo?.cacheTotalSizeHuman || '0 B');
  append(t('about.cacheInternalSize'), systemInfo?.cacheInternalSizeHuman || '0 B');
  append(t('about.cacheExternalSize'), systemInfo?.cacheExternalSizeHuman || '0 B');
  append(t('about.locale'), systemInfo?.locale || 'en-US');
  if (systemInfo?.loadAverage?.length === 3) {
    append(
      t('about.loadAverage'),
      systemInfo.loadAverage.map((v) => v.toFixed(2)).join(' / '),
    );
  }
  if (typeof systemInfo?.globalCpuUsage === 'number') {
    append(t('about.cpuUsage'), `${systemInfo.globalCpuUsage.toFixed(1)}%`);
  }

  if (systemInfo?.gpus?.length) {
    lines.push('');
    lines.push(`[${t('about.gpuInfo')}]`);
    for (const gpu of systemInfo.gpus) {
      append('GPU', gpu.name);
      append(t('about.gpuVram'), gpu.vramMb != null ? `${gpu.vramMb} MB` : null);
      append(t('about.gpuDriver'), gpu.driverVersion);
      append('GPU Vendor', gpu.vendor);
    }
  }

  if (systemInfo?.components?.length) {
    lines.push('');
    lines.push(`[${t('about.temperature')}]`);
    for (const component of systemInfo.components) {
      append(
        component.label,
        component.temperature != null
          ? `${component.temperature.toFixed(1)}°C`
          : null,
      );
      append(`${component.label} max`, component.max != null ? `${component.max.toFixed(1)}°C` : null);
      append(`${component.label} critical`, component.critical != null ? `${component.critical.toFixed(1)}°C` : null);
    }
  }

  if (systemInfo?.battery) {
    lines.push('');
    lines.push(`[${t('about.battery')}]`);
    append(t('about.batteryPercent'), `${systemInfo.battery.percent}%`);
    append(t('about.powerSource'), systemInfo.battery.powerSource);
    append('Charging', systemInfo.battery.isCharging ? 'yes' : 'no');
    append('Plugged In', systemInfo.battery.isPluggedIn ? 'yes' : 'no');
    append(t('about.batteryHealth'), systemInfo.battery.healthPercent != null ? `${systemInfo.battery.healthPercent}%` : null);
    append(t('about.cycleCount'), systemInfo.battery.cycleCount);
    append(t('about.batteryTechnology'), systemInfo.battery.technology);
    append('Design Capacity (mWh)', systemInfo.battery.designCapacityMwh);
    append('Full Capacity (mWh)', systemInfo.battery.fullCapacityMwh);
    append('Voltage (mV)', systemInfo.battery.voltageMv);
    append('Time to Empty (mins)', systemInfo.battery.timeToEmptyMins);
    append('Time to Full (mins)', systemInfo.battery.timeToFullMins);
  }

  if (systemInfo?.disks?.length) {
    lines.push('');
    lines.push(`[${t('about.storage')}]`);
    for (const disk of systemInfo.disks) {
      append('Disk', disk.name);
      append('Mount', disk.mountPoint);
      append('Filesystem', disk.fileSystem);
      append('Type', disk.diskType);
      append('Total', disk.totalSpaceHuman);
      append('Available', disk.availableSpaceHuman);
      append('Used', disk.usedSpaceHuman);
      append('Usage', `${Math.round(disk.usagePercent)}%`);
      append('Read', disk.readBytesHuman);
      append('Write', disk.writtenBytesHuman);
      append('Removable', disk.isRemovable ? 'yes' : 'no');
      append('ReadOnly', disk.isReadOnly ? 'yes' : 'no');
    }
  }

  if (systemInfo?.networks?.length) {
    lines.push('');
    lines.push(`[${t('about.networkInfo')}]`);
    for (const network of systemInfo.networks) {
      append('Interface', network.name);
      append('MAC', network.macAddress);
      append('IP', network.ipAddresses.join(', '));
      append('MTU', network.mtu);
      append('Received', network.totalReceivedHuman);
      append('Transmitted', network.totalTransmittedHuman);
      append('Packets Received', network.totalPacketsReceived);
      append('Packets Transmitted', network.totalPacketsTransmitted);
      append('RX Errors', network.totalErrorsOnReceived);
      append('TX Errors', network.totalErrorsOnTransmitted);
    }
  }

  if (systemInfo?.subsystemErrors?.length) {
    lines.push('');
    append('Subsystem Errors', systemInfo.subsystemErrors.join(', '));
  }

  if (aboutInsights) {
    lines.push('');
    lines.push(`[${t('about.insightsTitle')}]`);
    append(t('about.insightsRuntimeMode'), aboutInsights.runtimeMode);
    append(
      t('about.insightsProviderSummary'),
      `${aboutInsights.providerSummary.installed}/${aboutInsights.providerSummary.total}`,
    );
    append(t('about.insightsProviderSupported'), aboutInsights.providerSummary.supported);
    append(
      t('about.insightsProviderUnsupported'),
      aboutInsights.providerSummary.unsupported,
    );
    append(
      t('about.insightsLogsSize'),
      aboutInsights.storageSummary.logTotalSizeHuman ??
        (typeof aboutInsights.storageSummary.logTotalSizeBytes === 'number'
          ? formatBytes(aboutInsights.storageSummary.logTotalSizeBytes)
          : null),
    );
    append(
      t('about.insightsCacheSize'),
      aboutInsights.storageSummary.cacheTotalSizeHuman,
    );
    append(
      t('about.insightsGroupStatus'),
      [
        `providers=${aboutInsights.sections.providers}`,
        `logs=${aboutInsights.sections.logs}`,
        `cache=${aboutInsights.sections.cache}`,
      ].join(', '),
    );
  }

  return lines.join('\n');
}
