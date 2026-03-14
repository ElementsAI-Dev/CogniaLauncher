import type { PluginDeprecationNotice, PluginHealth, PluginInfo, PluginToolInfo } from '@/types/plugin';
import { DEFAULT_TOOL_CONTRACT_VERSION } from '@/types/tool-contract';
import {
  evaluatePluginDeprecations,
  evaluatePluginHealthStatus,
  getDiscoverabilityDiagnostic,
  mapGrantedPermissionsToCapabilities,
} from './plugin-governance';

function createHealth(overrides?: Partial<PluginHealth>): PluginHealth {
  return {
    consecutiveFailures: 0,
    totalCalls: 10,
    failedCalls: 0,
    totalDurationMs: 2000,
    lastError: null,
    autoDisabled: false,
    ...overrides,
  };
}

function createPluginInfo(overrides?: Partial<PluginInfo>): Pick<PluginInfo, 'toolContractVersion' | 'compatibility'> {
  return {
    toolContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
    compatibility: null,
    ...overrides,
  };
}

function createTool(overrides?: Partial<PluginToolInfo>): Pick<PluginToolInfo, 'toolId' | 'capabilityDeclarations' | 'discoverable' | 'exclusionReason'> {
  return {
    toolId: 'tool.demo',
    capabilityDeclarations: [],
    discoverable: true,
    exclusionReason: null,
    ...overrides,
  };
}

describe('evaluatePluginHealthStatus', () => {
  it('returns good when plugin is disabled or health is missing', () => {
    expect(evaluatePluginHealthStatus(createHealth(), false)).toBe('good');
    expect(evaluatePluginHealthStatus(null, true)).toBe('good');
  });

  it('returns critical for auto-disabled or repeated failures', () => {
    expect(evaluatePluginHealthStatus(createHealth({ autoDisabled: true }), true)).toBe('critical');
    expect(evaluatePluginHealthStatus(createHealth({ consecutiveFailures: 3 }), true)).toBe('critical');
  });

  it('returns warning for high error rate or high latency', () => {
    expect(evaluatePluginHealthStatus(createHealth({ failedCalls: 3, totalCalls: 10 }), true)).toBe('warning');
    expect(evaluatePluginHealthStatus(createHealth({ totalCalls: 2, totalDurationMs: 10000 }), true)).toBe('warning');
  });

  it('returns good for healthy runtime profile', () => {
    expect(evaluatePluginHealthStatus(createHealth({ failedCalls: 1, totalCalls: 20, totalDurationMs: 2000 }), true)).toBe('good');
  });
});

describe('evaluatePluginDeprecations', () => {
  it('flags deprecated contract versions', () => {
    const warnings = evaluatePluginDeprecations(createPluginInfo({ toolContractVersion: '0.9.0' }));
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'contract_version_deprecated',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('flags legacy capability declarations and dedupes identical notices', () => {
    const warnings = evaluatePluginDeprecations(createPluginInfo(), [
      createTool({ capabilityDeclarations: ['config_read', 'config_read'] }),
      createTool({ toolId: 'tool.http', capabilityDeclarations: ['http'] }),
    ]);

    const capabilityWarnings = warnings.filter((item) => item.code === 'capability_deprecated');
    expect(capabilityWarnings).toHaveLength(2);
    expect(capabilityWarnings.some((item) => item.message.includes('config_read'))).toBe(true);
    expect(capabilityWarnings.some((item) => item.message.includes('http'))).toBe(true);
  });

  it('emits critical warning for incompatible contract gating', () => {
    const warnings = evaluatePluginDeprecations(
      createPluginInfo({
        compatibility: {
          compatible: false,
          reason: 'Host range mismatch',
          hostVersion: '0.1.0',
          declaredContractVersion: '2.0.0',
          supportedContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
          requiredHostRange: '>=0.2.0',
          minHostVersion: '0.2.0',
        },
      }),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'contract_removal_blocked',
          severity: 'critical',
          message: 'Host range mismatch',
        }),
      ]),
    );
  });
});

describe('discoverability governance', () => {
  const compatibleTool = {
    compatibility: { compatible: true, reason: null },
    capabilityDeclarations: ['settings.read', 'packages.search'],
  };

  it('blocks when plugin is disabled, tool is incompatible, or auto-disabled', () => {
    expect(getDiscoverabilityDiagnostic(compatibleTool, null, { pluginEnabled: false })).toEqual({
      discoverable: false,
      reason: 'Plugin is disabled.',
    });

    expect(
      getDiscoverabilityDiagnostic(
        { ...compatibleTool, compatibility: { compatible: false, reason: 'No host bridge' } },
        null,
      ),
    ).toEqual({ discoverable: false, reason: 'No host bridge' });

    expect(getDiscoverabilityDiagnostic(compatibleTool, createHealth({ autoDisabled: true }))).toEqual({
      discoverable: false,
      reason: 'Plugin auto-disabled after repeated failures.',
    });
  });

  it('honors backend plugin-point exclusion diagnostics before local policy checks', () => {
    expect(
      getDiscoverabilityDiagnostic(
        createTool({ discoverable: false, exclusionReason: 'Plugin point blocked by validation.' }),
        null,
      ),
    ).toEqual({
      discoverable: false,
      reason: 'Plugin point blocked by validation.',
    });
  });

  it('blocks strict permission mismatch and allows matching declarations', () => {
    const strictMismatch = getDiscoverabilityDiagnostic(
      { compatibility: { compatible: true, reason: null }, capabilityDeclarations: [] },
      null,
      { permissionMode: 'strict', grantedPermissions: ['config_read'] },
    );
    expect(strictMismatch.discoverable).toBe(false);
    expect(strictMismatch.reason).toContain('settings.read');

    const strictAllowed = getDiscoverabilityDiagnostic(
      compatibleTool,
      null,
      { permissionMode: 'strict', grantedPermissions: ['config_read', 'pkg_search'] },
    );
    expect(strictAllowed).toEqual({ discoverable: true, reason: null });
  });

  it('maps granted permissions to sorted, deduped capabilities', () => {
    expect(
      mapGrantedPermissionsToCapabilities(['pkg_search', 'config_read', 'pkg_search', 'unknown']),
    ).toEqual(['packages.search', 'settings.read']);
  });
});

describe('warning shape sanity', () => {
  it('returns deterministic warning objects', () => {
    const warnings = evaluatePluginDeprecations(
      createPluginInfo({ toolContractVersion: '0.0.1' }),
      [createTool({ capabilityDeclarations: ['config_write'] })],
    );

    warnings.forEach((warning: PluginDeprecationNotice) => {
      expect(warning.code).toBeTruthy();
      expect(warning.message).toBeTruthy();
      expect(warning.guidance).toBeTruthy();
      expect(['warning', 'critical']).toContain(warning.severity);
    });
  });
});
