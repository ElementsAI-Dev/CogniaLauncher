import { APP_VERSION } from '@/lib/app-version';
import type { SelfUpdateInfo } from '@/lib/tauri';
import type {
  AboutInsights,
  SystemInfo,
  SystemSectionState,
  SystemSubsystem,
  UpdateErrorCategory,
  UpdateStatus,
} from '@/types/about';
import type { NetworkInterfaceInfo } from '@/types/tauri';

export interface WebDiagnosticsRuntimeSnapshot {
  navigator: {
    userAgent: string;
    language: string;
    languages: string[];
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
    hardwareConcurrency: number;
    deviceMemory: number | null;
    maxTouchPoints: number;
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  performance: {
    memory: unknown;
    timing: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoadedEventEnd: number;
    } | null;
  };
}

export interface BuildWebDiagnosticsReportParams {
  systemInfo: SystemInfo | null;
  aboutInsights?: AboutInsights | null;
  updateInfo: SelfUpdateInfo | null;
  updateStatus: UpdateStatus;
  updateErrorCategory: UpdateErrorCategory | null;
  updateErrorMessage: string | null;
  runtime: WebDiagnosticsRuntimeSnapshot;
  generatedAt?: string;
}

function formatMem(bytes: number): string {
  return bytes > 0 ? `${Math.round(bytes / (1024 * 1024 * 1024))} GB` : 'N/A';
}

function redactHostname(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  if (hostname.length <= 2) return '**';
  return `${hostname.slice(0, 2)}***`;
}

export function redactIpAddress(value: string): string {
  if (!value) return value;
  if (value.includes('.')) {
    const parts = value.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }
  }
  if (value.includes(':')) {
    const parts = value.split(':').filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0]}:${parts[1]}::****`;
    }
  }
  return '[redacted]';
}

export function redactMacAddress(value: string): string {
  if (!value) return value;
  const compact = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (compact.length === 12) {
    return `${compact.slice(0, 6)}******`;
  }
  return '[redacted]';
}

export function sanitizeNetworks(
  networks: NetworkInterfaceInfo[],
): Array<Record<string, unknown>> {
  return networks.map((network) => ({
    name: network.name,
    mtu: network.mtu,
    ipAddressCount: network.ipAddresses.length,
    ipAddressesRedacted: network.ipAddresses.map(redactIpAddress),
    macAddressRedacted: redactMacAddress(network.macAddress),
    totalReceived: network.totalReceived,
    totalTransmitted: network.totalTransmitted,
    totalReceivedHuman: network.totalReceivedHuman,
    totalTransmittedHuman: network.totalTransmittedHuman,
    totalPacketsReceived: network.totalPacketsReceived,
    totalPacketsTransmitted: network.totalPacketsTransmitted,
    totalErrorsOnReceived: network.totalErrorsOnReceived,
    totalErrorsOnTransmitted: network.totalErrorsOnTransmitted,
  }));
}

export function buildSystemSectionSummary(
  systemInfo: Pick<
    SystemInfo,
    'components' | 'battery' | 'disks' | 'networks' | 'subsystemErrors'
  > | null,
): Record<SystemSubsystem, SystemSectionState> {
  const failures = new Set(systemInfo?.subsystemErrors ?? []);
  const hasSystem = !!systemInfo;

  const statusFor = (key: SystemSubsystem): SystemSectionState['status'] => {
    if (!hasSystem) return 'unavailable';
    if (failures.has(key)) return 'failed';
    return 'ok';
  };

  return {
    platform: { status: statusFor('platform') },
    components: {
      status: statusFor('components'),
      itemCount: systemInfo?.components?.length ?? 0,
    },
    battery: { status: statusFor('battery') },
    disks: {
      status: statusFor('disks'),
      itemCount: systemInfo?.disks?.length ?? 0,
    },
    networks: {
      status: statusFor('networks'),
      itemCount: systemInfo?.networks?.length ?? 0,
    },
    cache: { status: statusFor('cache') },
    homeDir: { status: statusFor('homeDir') },
  };
}

export function buildWebDiagnosticsReport({
  systemInfo,
  aboutInsights,
  updateInfo,
  updateStatus,
  updateErrorCategory,
  updateErrorMessage,
  runtime,
  generatedAt,
}: BuildWebDiagnosticsReportParams): Record<string, unknown> {
  return {
    generated: generatedAt ?? new Date().toISOString(),
    mode: 'web',
    appVersion: APP_VERSION,
    system: {
      os: systemInfo?.osLongVersion || systemInfo?.os || 'Web',
      osName: systemInfo?.osName || runtime.navigator.platform || 'Unknown',
      hostnameRedacted: redactHostname(systemInfo?.hostname),
      distributionId: systemInfo?.distributionId || null,
      arch: systemInfo?.cpuArch || systemInfo?.arch || 'Unknown',
      cpu: systemInfo?.cpuModel || 'Unknown',
      cpuVendorId: systemInfo?.cpuVendorId || null,
      cpuFrequencyMhz: systemInfo?.cpuFrequency || null,
      cpuCores: systemInfo?.cpuCores || runtime.navigator.hardwareConcurrency || 0,
      memoryTotal: systemInfo?.totalMemory
        ? formatMem(systemInfo.totalMemory)
        : 'Unknown',
      memoryAvailable: systemInfo?.availableMemory
        ? formatMem(systemInfo.availableMemory)
        : 'Unknown',
      memoryUsed: systemInfo?.usedMemory
        ? formatMem(systemInfo.usedMemory)
        : 'Unknown',
      swapTotal: systemInfo?.totalSwap
        ? formatMem(systemInfo.totalSwap)
        : 'Unknown',
      swapUsed: systemInfo?.usedSwap
        ? formatMem(systemInfo.usedSwap)
        : 'Unknown',
      uptimeSeconds: systemInfo?.uptime ?? null,
      bootTimeEpochSeconds: systemInfo?.bootTime ?? null,
      loadAverage: systemInfo?.loadAverage ?? [0, 0, 0],
      subsystemErrors: systemInfo?.subsystemErrors ?? [],
      sectionSummary: buildSystemSectionSummary(systemInfo),
      gpus:
        systemInfo?.gpus?.map((g) => ({
          name: g.name,
          vramMb: g.vramMb,
          driverVersion: g.driverVersion,
          vendor: g.vendor,
        })) || [],
      battery: systemInfo?.battery || null,
      disks: systemInfo?.disks || [],
      networks: sanitizeNetworks(systemInfo?.networks || []),
    },
    browser: {
      userAgent: runtime.navigator.userAgent,
      language: runtime.navigator.language,
      languages: runtime.navigator.languages,
      platform: runtime.navigator.platform,
      cookieEnabled: runtime.navigator.cookieEnabled,
      onLine: runtime.navigator.onLine,
      hardwareConcurrency: runtime.navigator.hardwareConcurrency,
      deviceMemory: runtime.navigator.deviceMemory,
      maxTouchPoints: runtime.navigator.maxTouchPoints,
    },
    screen: runtime.screen,
    performance: runtime.performance,
    update: updateInfo
      ? {
          currentVersion: updateInfo.current_version,
          latestVersion: updateInfo.latest_version,
          updateAvailable: updateInfo.update_available,
          status: updateStatus,
          errorCategory: updateErrorCategory,
          errorMessage: updateErrorMessage,
        }
      : null,
    aboutInsights,
  };
}
