import rawSdkUsageInventory from '@/plugins/sdk-usage-inventory.json';
import type {
  PluginSdkCapabilityCoverage,
  PluginSdkUsagePath,
} from '@/types/plugin';

type RawSdkUsageInventoryEntry = {
  id: string;
  permissionGuidance?: string[];
  hostPrerequisites?: string[];
  toolbox?: {
    desktopOnly?: boolean;
    recoveryActions?: string[];
  };
  usagePaths?: Array<{
    type: PluginSdkUsagePath['type'];
    surface?: PluginSdkUsagePath['surface'];
    coverage?: PluginSdkUsagePath['coverage'];
    path: string;
    pluginId?: string;
    toolId?: string;
    displayName?: string;
    launchCommand?: string;
    entrypoints?: string[];
    requiredPermissions?: string[];
    interactionMode?: PluginSdkUsagePath['interactionMode'];
    discoverable?: boolean;
    localPrerequisites?: string[];
    pluginPointIds?: string[];
    workflowIntents?: string[];
  }>;
};

type RawSdkUsagePath = NonNullable<RawSdkUsageInventoryEntry['usagePaths']>[number];

const CAPABILITY_ALIAS_MAP: Record<string, string> = {
  batch: 'batch',
  cache: 'cache',
  clipboard: 'clipboard',
  'clipboard.readwrite': 'clipboard',
  config: 'config',
  config_read: 'config',
  config_write: 'config',
  'settings.read': 'config',
  'settings.write': 'config',
  download: 'download',
  download_read: 'download',
  download_write: 'download',
  env: 'env',
  env_read: 'env',
  'environment.read': 'env',
  event: 'event',
  fs: 'fs',
  fs_read: 'fs',
  fs_write: 'fs',
  'fs.read': 'fs',
  'fs.write': 'fs',
  git: 'git',
  git_read: 'git',
  git_write: 'git',
  health: 'health',
  health_read: 'health',
  http: 'http',
  'http.request': 'http',
  i18n: 'i18n',
  launch: 'launch',
  log: 'log',
  notification: 'notification',
  'notification.send': 'notification',
  pkg: 'pkg',
  pkg_search: 'pkg',
  pkg_install: 'pkg',
  'packages.search': 'pkg',
  'packages.install': 'pkg',
  platform: 'platform',
  process: 'process',
  process_exec: 'process',
  'process.exec': 'process',
  profiles: 'profiles',
  profiles_read: 'profiles',
  profiles_write: 'profiles',
  shell: 'shell',
  shell_read: 'shell',
  ui: 'ui',
  ui_feedback: 'ui',
  ui_dialog: 'ui',
  ui_file_picker: 'ui',
  ui_navigation: 'ui',
  'ui.feedback': 'ui',
  'ui.dialog': 'ui',
  'ui.file-picker': 'ui',
  'ui.navigation': 'ui',
  wsl: 'wsl',
  wsl_read: 'wsl',
};

function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

function normalizeCoverage(coverage: RawSdkUsagePath['coverage']): PluginSdkUsagePath['coverage'] {
  return coverage === 'builtin-primary' ? 'builtin-primary' : 'reference';
}

function normalizeInteractionMode(
  mode: RawSdkUsagePath['interactionMode'],
): PluginSdkUsagePath['interactionMode'] {
  if (mode === 'declarative' || mode === 'iframe') {
    return mode;
  }
  if (mode === 'text') {
    return 'text';
  }
  return undefined;
}

function normalizeUsagePath(path: RawSdkUsagePath): PluginSdkUsagePath {
  return {
    type: path.type,
    surface: path.surface === 'ink-authoring' ? 'ink-authoring' : 'runtime',
    coverage: normalizeCoverage(path.coverage),
    path: path.path,
    pluginId: path.pluginId,
    toolId: path.toolId?.trim() || undefined,
    displayName: path.displayName?.trim() || undefined,
    launchCommand: path.launchCommand?.trim() || undefined,
    entrypoints: unique(path.entrypoints ?? []),
    requiredPermissions: unique(path.requiredPermissions ?? []),
    interactionMode: normalizeInteractionMode(path.interactionMode),
    discoverable: typeof path.discoverable === 'boolean' ? path.discoverable : undefined,
    localPrerequisites: unique(path.localPrerequisites ?? []),
    pluginPointIds: unique(path.pluginPointIds ?? []),
    workflowIntents: unique(path.workflowIntents ?? []),
  };
}

function isToolboxRunnableUsagePath(path: PluginSdkUsagePath): boolean {
  return (
    path.type === 'builtin-plugin'
    && path.surface === 'runtime'
    && Boolean(path.toolId)
    && Boolean(path.interactionMode)
    && path.discoverable !== false
  );
}

function resolvePreferredWorkflow(usagePaths: PluginSdkUsagePath[]): PluginSdkUsagePath | undefined {
  return usagePaths.find(
    (usagePath) => isToolboxRunnableUsagePath(usagePath) && usagePath.coverage === 'builtin-primary',
  ) ?? usagePaths.find((usagePath) => isToolboxRunnableUsagePath(usagePath));
}

const sdkUsageEntries = new Map(
  ((rawSdkUsageInventory.capabilities ?? []) as RawSdkUsageInventoryEntry[]).map((entry) => [
    entry.id,
    {
      capabilityId: entry.id,
      permissionGuidance: unique(entry.permissionGuidance ?? []),
      hostPrerequisites: unique(entry.hostPrerequisites ?? []),
      usagePaths: (entry.usagePaths ?? []).map(normalizeUsagePath),
      recoveryActions: unique(entry.toolbox?.recoveryActions ?? []),
      desktopOnly: entry.toolbox?.desktopOnly === true,
    },
  ]),
);

export function getSdkUsageInventoryEntry(capabilityId: string) {
  return sdkUsageEntries.get(capabilityId) ?? null;
}

export function normalizeDeclaredSdkCapabilityIds(
  declarations: string[] | null | undefined,
): string[] {
  return unique(
    (declarations ?? []).map((declaration) => {
      const normalized = declaration.trim();
      return CAPABILITY_ALIAS_MAP[normalized] ?? (sdkUsageEntries.has(normalized) ? normalized : undefined);
    }),
  );
}

export function resolveDeclaredSdkCapabilityCoverage(options: {
  declarations: string[] | null | undefined;
  grantedPermissions?: string[];
  isDesktop: boolean;
}): PluginSdkCapabilityCoverage[] {
  const grantedPermissions = new Set(options.grantedPermissions ?? []);

  return normalizeDeclaredSdkCapabilityIds(options.declarations).map((capabilityId) => {
    const inventoryEntry = getSdkUsageInventoryEntry(capabilityId);
    if (!inventoryEntry) {
      return {
        capabilityId,
        permissionGuidance: [],
        hostPrerequisites: [],
        usagePaths: [],
        requiredPermissions: [],
        recoveryActions: ['open-guidance'],
        desktopOnly: false,
        status: 'warning',
        reason: 'No maintained SDK usage path is registered for this capability.',
        missingPermissions: [],
      };
    }

    const preferredWorkflow = resolvePreferredWorkflow(inventoryEntry.usagePaths);
    const requiredPermissions = preferredWorkflow
      ? [...preferredWorkflow.requiredPermissions]
      : unique(inventoryEntry.usagePaths.flatMap((usagePath) => usagePath.requiredPermissions));
    const missingPermissions = requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission),
    );

    let status: PluginSdkCapabilityCoverage['status'] = 'covered';
    let reason: string | null = null;

    if (!options.isDesktop && inventoryEntry.desktopOnly) {
      status = 'blocked';
      reason = 'Desktop runtime is required for this capability.';
    } else if (missingPermissions.length > 0) {
      status = 'blocked';
      reason = `Missing permissions: ${missingPermissions.join(', ')}`;
    }

    const coverage: PluginSdkCapabilityCoverage = {
      capabilityId,
      permissionGuidance: inventoryEntry.permissionGuidance,
      hostPrerequisites: inventoryEntry.hostPrerequisites,
      usagePaths: inventoryEntry.usagePaths,
      requiredPermissions,
      recoveryActions: inventoryEntry.recoveryActions,
      desktopOnly: inventoryEntry.desktopOnly,
      status,
      reason,
      missingPermissions,
    };

    if (preferredWorkflow) {
      coverage.preferredWorkflow = preferredWorkflow;
    }

    return coverage;
  });
}
