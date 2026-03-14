import { compareVersions } from '@/lib/version-utils';
import { DEFAULT_TOOL_CONTRACT_VERSION } from '@/types/tool-contract';
import type {
  PluginDeprecationNotice,
  PluginHealth,
  PluginInfo,
  PluginPermissionMode,
  PluginToolInfo,
} from '@/types/plugin';

export type PluginHealthStatus = 'good' | 'warning' | 'critical';

const LEGACY_CAPABILITY_REPLACEMENTS: Record<string, string> = {
  config_read: 'settings.read',
  config_write: 'settings.write',
  env_read: 'environment.read',
  pkg_search: 'packages.search',
  pkg_install: 'packages.install',
  clipboard: 'clipboard.readwrite',
  notification: 'notification.send',
  process_exec: 'process.exec',
  fs_read: 'fs.read',
  fs_write: 'fs.write',
  http: 'http.request',
};

const PERMISSION_TO_CAPABILITY: Record<string, string> = {
  config_read: 'settings.read',
  config_write: 'settings.write',
  env_read: 'environment.read',
  pkg_search: 'packages.search',
  pkg_install: 'packages.install',
  clipboard: 'clipboard.readwrite',
  notification: 'notification.send',
  process_exec: 'process.exec',
  fs_read: 'fs.read',
  fs_write: 'fs.write',
  http: 'http.request',
};

export function evaluatePluginHealthStatus(
  health: PluginHealth | null | undefined,
  enabled: boolean,
): PluginHealthStatus {
  if (!enabled || !health) return 'good';
  if (health.autoDisabled || health.consecutiveFailures >= 3) return 'critical';

  const errorRate = health.totalCalls > 0 ? health.failedCalls / health.totalCalls : 0;
  const avgDuration = health.totalCalls > 0 ? health.totalDurationMs / health.totalCalls : 0;

  if (errorRate >= 0.2 || avgDuration >= 5000) return 'warning';
  return 'good';
}

export function evaluatePluginDeprecations(
  plugin: Pick<PluginInfo, 'toolContractVersion' | 'compatibility'>,
  tools: Array<Pick<PluginToolInfo, 'toolId' | 'capabilityDeclarations'>> = [],
): PluginDeprecationNotice[] {
  const warnings: PluginDeprecationNotice[] = [];
  const contractVersion = plugin.toolContractVersion ?? DEFAULT_TOOL_CONTRACT_VERSION;

  if (compareVersions(contractVersion, DEFAULT_TOOL_CONTRACT_VERSION) < 0) {
    warnings.push({
      code: 'contract_version_deprecated',
      severity: 'warning',
      message: `Tool contract version ${contractVersion} is deprecated.`,
      guidance: `Migrate to ${DEFAULT_TOOL_CONTRACT_VERSION} and update manifest/tool schemas.`,
    });
  }

  for (const tool of tools) {
    for (const capability of tool.capabilityDeclarations ?? []) {
      const replacement = LEGACY_CAPABILITY_REPLACEMENTS[capability];
      if (!replacement) continue;
      warnings.push({
        code: 'capability_deprecated',
        severity: 'warning',
        message: `Tool ${tool.toolId} uses deprecated capability '${capability}'.`,
        guidance: `Replace '${capability}' with '${replacement}'.`,
      });
    }
  }

  if (plugin.compatibility && !plugin.compatibility.compatible) {
    warnings.push({
      code: 'contract_removal_blocked',
      severity: 'critical',
      message: plugin.compatibility.reason ?? 'Plugin contract is incompatible with host.',
      guidance: 'Update host compatibility range and contract/capabilities before re-enabling.',
    });
  }

  return dedupeDeprecationWarnings(warnings);
}

function dedupeDeprecationWarnings(
  warnings: PluginDeprecationNotice[],
): PluginDeprecationNotice[] {
  const seen = new Set<string>();
  const deduped: PluginDeprecationNotice[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${warning.message}:${warning.guidance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(warning);
  }
  return deduped;
}

export function getDiscoverabilityDiagnostic(
  tool: Pick<PluginToolInfo, 'compatibility' | 'capabilityDeclarations' | 'discoverable' | 'exclusionReason'>,
  pluginHealth: PluginHealth | null | undefined,
  options?: {
    pluginEnabled?: boolean;
    permissionMode?: PluginPermissionMode;
    grantedPermissions?: string[];
  },
): { discoverable: boolean; reason: string | null } {
  if (tool.discoverable === false) {
    return {
      discoverable: false,
      reason: tool.exclusionReason ?? 'Plugin point is blocked by validation.',
    };
  }

  if (options?.pluginEnabled === false) {
    return {
      discoverable: false,
      reason: 'Plugin is disabled.',
    };
  }

  if (tool.compatibility && !tool.compatibility.compatible) {
    return {
      discoverable: false,
      reason: tool.compatibility.reason ?? 'Compatibility checks failed.',
    };
  }

  if (pluginHealth?.autoDisabled) {
    return {
      discoverable: false,
      reason: 'Plugin auto-disabled after repeated failures.',
    };
  }

  if (options?.permissionMode === 'strict') {
    const declared = new Set(tool.capabilityDeclarations ?? []);
    const grantedCapabilities = mapGrantedPermissionsToCapabilities(
      options.grantedPermissions ?? [],
    );
    const missing = grantedCapabilities.filter((capability) => !declared.has(capability));
    if (missing.length > 0) {
      return {
        discoverable: false,
        reason: `Strict policy mismatch: missing capability declarations (${missing.join(', ')}).`,
      };
    }
  }

  return { discoverable: true, reason: null };
}

export function mapGrantedPermissionsToCapabilities(grantedPermissions: string[]): string[] {
  const caps = new Set<string>();
  for (const permission of grantedPermissions) {
    const cap = PERMISSION_TO_CAPABILITY[permission];
    if (cap) caps.add(cap);
  }
  return [...caps].sort();
}
