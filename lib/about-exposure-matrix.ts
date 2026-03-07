export type AboutExposureSurface =
  | "about_page"
  | "copy_system_info"
  | "diagnostics_export"
  | "changelog_dialog"
  | "whats_new_dialog"
  | "intentional_hide";

export interface AboutExposureEntry {
  fieldPath: string;
  surfaces: AboutExposureSurface[];
  rationale?: string;
}

const SYSTEM_TOP_LEVEL_FIELDS = [
  "os",
  "arch",
  "osVersion",
  "osLongVersion",
  "kernelVersion",
  "hostname",
  "osName",
  "distributionId",
  "cpuArch",
  "cpuModel",
  "cpuVendorId",
  "cpuFrequency",
  "cpuCores",
  "physicalCoreCount",
  "globalCpuUsage",
  "totalMemory",
  "availableMemory",
  "usedMemory",
  "totalSwap",
  "usedSwap",
  "uptime",
  "bootTime",
  "loadAverage",
  "gpus",
  "appVersion",
  "homeDir",
  "locale",
  "cacheInternalSizeHuman",
  "cacheExternalSizeHuman",
  "cacheTotalSizeHuman",
  "components",
  "battery",
  "disks",
  "networks",
] as const;

const GPU_FIELDS = ["name", "vramMb", "driverVersion", "vendor"] as const;

const COMPONENT_FIELDS = ["label", "temperature", "max", "critical"] as const;

const BATTERY_FIELDS = [
  "percent",
  "isCharging",
  "isPluggedIn",
  "healthPercent",
  "cycleCount",
  "designCapacityMwh",
  "fullCapacityMwh",
  "voltageMv",
  "powerSource",
  "timeToEmptyMins",
  "timeToFullMins",
  "technology",
] as const;

const DISK_FIELDS = [
  "name",
  "mountPoint",
  "totalSpace",
  "availableSpace",
  "usedSpace",
  "usagePercent",
  "fileSystem",
  "diskType",
  "isRemovable",
  "isReadOnly",
  "readBytes",
  "writtenBytes",
  "totalSpaceHuman",
  "availableSpaceHuman",
  "usedSpaceHuman",
  "readBytesHuman",
  "writtenBytesHuman",
] as const;

const NETWORK_FIELDS = [
  "name",
  "macAddress",
  "ipAddresses",
  "totalReceived",
  "totalTransmitted",
  "totalReceivedHuman",
  "totalTransmittedHuman",
  "mtu",
  "totalPacketsReceived",
  "totalPacketsTransmitted",
  "totalErrorsOnReceived",
  "totalErrorsOnTransmitted",
] as const;

const CHANGELOG_ENTRY_FIELDS = [
  "version",
  "date",
  "changes",
  "markdownBody",
  "prerelease",
  "url",
  "source",
] as const;

const CHANGELOG_CHANGE_FIELDS = ["type", "description"] as const;

function prefixed(prefix: string, fields: readonly string[]): string[] {
  return fields.map((field) => `${prefix}.${field}`);
}

export const ABOUT_COLLECTED_FIELD_PATHS: string[] = [
  "updateInfo.current_version",
  "updateInfo.latest_version",
  "updateInfo.update_available",
  "updateInfo.release_notes",
  ...prefixed("systemInfo", SYSTEM_TOP_LEVEL_FIELDS),
  ...prefixed("systemInfo.gpus[]", GPU_FIELDS),
  ...prefixed("systemInfo.components[]", COMPONENT_FIELDS),
  ...prefixed("systemInfo.battery", BATTERY_FIELDS),
  ...prefixed("systemInfo.disks[]", DISK_FIELDS),
  ...prefixed("systemInfo.networks[]", NETWORK_FIELDS),
  ...prefixed("changelogEntry", CHANGELOG_ENTRY_FIELDS),
  ...prefixed("changelogEntry.changes[]", CHANGELOG_CHANGE_FIELDS),
];

const PAGE_COPY_EXPORT: AboutExposureSurface[] = [
  "about_page",
  "copy_system_info",
  "diagnostics_export",
];

const PAGE_EXPORT: AboutExposureSurface[] = [
  "about_page",
  "diagnostics_export",
];

const COPY_EXPORT: AboutExposureSurface[] = [
  "copy_system_info",
  "diagnostics_export",
];

const CHANGELOG_SURFACES: AboutExposureSurface[] = [
  "changelog_dialog",
  "whats_new_dialog",
];

export const ABOUT_EXPOSURE_MATRIX: AboutExposureEntry[] = [
  {
    fieldPath: "updateInfo.current_version",
    surfaces: PAGE_COPY_EXPORT,
  },
  {
    fieldPath: "updateInfo.latest_version",
    surfaces: PAGE_COPY_EXPORT,
  },
  {
    fieldPath: "updateInfo.update_available",
    surfaces: PAGE_COPY_EXPORT,
  },
  {
    fieldPath: "updateInfo.release_notes",
    surfaces: PAGE_EXPORT,
  },
  ...SYSTEM_TOP_LEVEL_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.${fieldPath}`,
    surfaces: PAGE_COPY_EXPORT,
  })),
  ...GPU_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.gpus[].${fieldPath}`,
    surfaces: PAGE_COPY_EXPORT,
  })),
  ...COMPONENT_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.components[].${fieldPath}`,
    surfaces: PAGE_COPY_EXPORT,
  })),
  ...BATTERY_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.battery.${fieldPath}`,
    surfaces: PAGE_COPY_EXPORT,
  })),
  ...DISK_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.disks[].${fieldPath}`,
    surfaces: PAGE_COPY_EXPORT,
  })),
  ...NETWORK_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `systemInfo.networks[].${fieldPath}`,
    surfaces: fieldPath === "macAddress" ? COPY_EXPORT : PAGE_EXPORT,
  })),
  ...CHANGELOG_ENTRY_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `changelogEntry.${fieldPath}`,
    surfaces: CHANGELOG_SURFACES,
  })),
  ...CHANGELOG_CHANGE_FIELDS.map<AboutExposureEntry>((fieldPath) => ({
    fieldPath: `changelogEntry.changes[].${fieldPath}`,
    surfaces: CHANGELOG_SURFACES,
  })),
];

export const ABOUT_EXPOSURE_INDEX: Record<string, AboutExposureEntry> =
  Object.fromEntries(
    ABOUT_EXPOSURE_MATRIX.map((entry) => [entry.fieldPath, entry]),
  );

export function getUnmappedAboutFields(
  collectedFieldPaths: string[] = ABOUT_COLLECTED_FIELD_PATHS,
  exposureIndex: Record<string, AboutExposureEntry> = ABOUT_EXPOSURE_INDEX,
): string[] {
  return collectedFieldPaths.filter((path) => !exposureIndex[path]);
}
