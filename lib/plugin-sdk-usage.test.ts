import {
  getSdkUsageInventoryEntry,
  normalizeDeclaredSdkCapabilityIds,
  resolveDeclaredSdkCapabilityCoverage,
} from './plugin-sdk-usage';

describe('plugin-sdk-usage', () => {
  it('returns normalized inventory entries for known capabilities', () => {
    expect(getSdkUsageInventoryEntry('env')).toMatchObject({
      capabilityId: 'env',
      desktopOnly: true,
      permissionGuidance: expect.arrayContaining(['env_read']),
      usagePaths: [
        expect.objectContaining({
          pluginId: 'com.cognia.builtin.env-provider-audit',
          entrypoints: ['env_provider_audit'],
        }),
      ],
    });
    expect(getSdkUsageInventoryEntry('missing-capability')).toBeNull();
  });

  it('normalizes declared capability aliases and removes duplicates', () => {
    expect(
      normalizeDeclaredSdkCapabilityIds([
        'settings.read',
        'config_write',
        'env',
        'env_read',
        'unknown',
      ]),
    ).toEqual(['config', 'env']);
  });

  it('blocks known capabilities in non-desktop mode before permission checks', () => {
    expect(resolveDeclaredSdkCapabilityCoverage({
      declarations: ['env'],
      grantedPermissions: ['env_read', 'notification'],
      isDesktop: false,
    })).toEqual([
      expect.objectContaining({
        capabilityId: 'env',
        desktopOnly: true,
        status: 'blocked',
        reason: 'Desktop runtime is required for this capability.',
      }),
    ]);
  });

  it('blocks desktop capabilities with missing permissions and reports the missing set', () => {
    expect(resolveDeclaredSdkCapabilityCoverage({
      declarations: ['process.exec'],
      grantedPermissions: [],
      isDesktop: true,
    })).toEqual([
      expect.objectContaining({
        capabilityId: 'process',
        status: 'blocked',
        reason: 'Missing permissions: process_exec',
        missingPermissions: ['process_exec'],
      }),
    ]);
  });

  it('returns covered capability metadata when desktop requirements and permissions are satisfied', () => {
    expect(resolveDeclaredSdkCapabilityCoverage({
      declarations: ['ui.feedback', 'ui_dialog'],
      grantedPermissions: ['ui_feedback'],
      isDesktop: true,
    })).toEqual([
      expect.objectContaining({
        capabilityId: 'ui',
        status: 'covered',
        missingPermissions: [],
        requiredPermissions: ['ui_feedback'],
      }),
    ]);
  });

  it('returns warning coverage when a normalized capability has no maintained inventory entry', async () => {
    jest.resetModules();
    jest.doMock('@/plugins/sdk-usage-inventory.json', () => ({
      capabilities: [],
    }));

    const isolated = await import('./plugin-sdk-usage');
    expect(isolated.resolveDeclaredSdkCapabilityCoverage({
      declarations: ['process.exec'],
      grantedPermissions: [],
      isDesktop: true,
    })).toEqual([
      {
        capabilityId: 'process',
        permissionGuidance: [],
        hostPrerequisites: [],
        usagePaths: [],
        requiredPermissions: [],
        recoveryActions: ['open-guidance'],
        desktopOnly: false,
        status: 'warning',
        reason: 'No maintained SDK usage path is registered for this capability.',
        missingPermissions: [],
      },
    ]);

    jest.resetModules();
    jest.unmock('@/plugins/sdk-usage-inventory.json');
  });

  it('normalizes mocked inventory metadata and supports direct capability ids without grantedPermissions input', async () => {
    jest.resetModules();
    jest.doMock('@/plugins/sdk-usage-inventory.json', () => ({
      capabilities: [
        {
          id: 'custom-capability',
          permissionGuidance: [' env_read ', '', 'env_read'],
          hostPrerequisites: [' desktop-host ', '', 'desktop-host'],
          toolbox: {
            desktopOnly: false,
            recoveryActions: [' open-guidance ', '', 'open-guidance'],
          },
          usagePaths: [
            {
              type: 'official-example',
              path: 'plugin-sdk-ts/examples/custom',
              entrypoints: [' run ', '', 'run'],
              requiredPermissions: [' env_read ', '', 'env_read'],
              pluginPointIds: [' point.a ', '', 'point.a'],
            },
          ],
        },
      ],
    }));

    const isolated = await import('./plugin-sdk-usage');
    expect(isolated.getSdkUsageInventoryEntry('custom-capability')).toEqual({
      capabilityId: 'custom-capability',
      permissionGuidance: ['env_read'],
      hostPrerequisites: ['desktop-host'],
      usagePaths: [
        {
          type: 'official-example',
          path: 'plugin-sdk-ts/examples/custom',
          pluginId: undefined,
          entrypoints: ['run'],
          requiredPermissions: ['env_read'],
          pluginPointIds: ['point.a'],
        },
      ],
      recoveryActions: ['open-guidance'],
      desktopOnly: false,
    });

    expect(isolated.normalizeDeclaredSdkCapabilityIds([' custom-capability '])).toEqual(['custom-capability']);
    expect(isolated.resolveDeclaredSdkCapabilityCoverage({
      declarations: ['custom-capability'],
      isDesktop: true,
    })).toEqual([
      {
        capabilityId: 'custom-capability',
        permissionGuidance: ['env_read'],
        hostPrerequisites: ['desktop-host'],
        usagePaths: [
          {
            type: 'official-example',
            path: 'plugin-sdk-ts/examples/custom',
            pluginId: undefined,
            entrypoints: ['run'],
            requiredPermissions: ['env_read'],
            pluginPointIds: ['point.a'],
          },
        ],
        requiredPermissions: ['env_read'],
        recoveryActions: ['open-guidance'],
        desktopOnly: false,
        status: 'blocked',
        reason: 'Missing permissions: env_read',
        missingPermissions: ['env_read'],
      },
    ]);

    jest.resetModules();
    jest.unmock('@/plugins/sdk-usage-inventory.json');
  });
});
