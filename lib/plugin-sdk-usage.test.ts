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
      usagePaths: expect.arrayContaining([
        expect.objectContaining({
          coverage: 'reference',
          surface: 'runtime',
          pluginId: 'com.cognia.builtin.env-provider-audit',
          toolId: 'env-provider-audit',
          interactionMode: 'text',
          workflowIntents: expect.arrayContaining(['audit-environment-providers']),
          entrypoints: ['env_provider_audit'],
        }),
        expect.objectContaining({
          coverage: 'builtin-primary',
          toolId: 'env-provider-audit-guided',
          interactionMode: 'declarative',
          workflowIntents: expect.arrayContaining(['audit-environment-providers']),
        }),
      ]),
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
              coverage: 'builtin-primary',
              type: 'official-example',
              surface: 'ink-authoring',
              path: 'plugin-sdk-ts/examples/custom',
              displayName: 'Custom Ink Preview',
              launchCommand: 'pnpm authoring:ink',
              toolId: 'custom-guided',
              interactionMode: 'declarative',
              discoverable: true,
              entrypoints: [' run ', '', 'run'],
              requiredPermissions: [' env_read ', '', 'env_read'],
              localPrerequisites: [' node>=20 ', '', 'node>=20'],
              pluginPointIds: [' point.a ', '', 'point.a'],
              workflowIntents: [' inspect.custom ', '', 'inspect.custom'],
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
          coverage: 'builtin-primary',
          type: 'official-example',
          surface: 'ink-authoring',
          path: 'plugin-sdk-ts/examples/custom',
          displayName: 'Custom Ink Preview',
          launchCommand: 'pnpm authoring:ink',
          toolId: 'custom-guided',
          interactionMode: 'declarative',
          discoverable: true,
          pluginId: undefined,
          entrypoints: ['run'],
          requiredPermissions: ['env_read'],
          localPrerequisites: ['node>=20'],
          pluginPointIds: ['point.a'],
          workflowIntents: ['inspect.custom'],
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
            coverage: 'builtin-primary',
            type: 'official-example',
            surface: 'ink-authoring',
            path: 'plugin-sdk-ts/examples/custom',
            displayName: 'Custom Ink Preview',
            launchCommand: 'pnpm authoring:ink',
            toolId: 'custom-guided',
            interactionMode: 'declarative',
            discoverable: true,
            pluginId: undefined,
            entrypoints: ['run'],
            requiredPermissions: ['env_read'],
            localPrerequisites: ['node>=20'],
            pluginPointIds: ['point.a'],
            workflowIntents: ['inspect.custom'],
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

  it('prefers builtin-primary runtime workflows when resolving capability coverage metadata', async () => {
    jest.resetModules();
    jest.doMock('@/plugins/sdk-usage-inventory.json', () => ({
      capabilities: [
        {
          id: 'pkg',
          permissionGuidance: ['pkg_search', 'clipboard'],
          hostPrerequisites: ['desktop-host'],
          toolbox: {
            desktopOnly: true,
            recoveryActions: ['manage-plugin'],
          },
          usagePaths: [
            {
              type: 'builtin-plugin',
              coverage: 'reference',
              surface: 'runtime',
              pluginId: 'com.example.pkg',
              path: 'plugins/typescript/pkg-plugin',
              toolId: 'pkg-text',
              interactionMode: 'text',
              discoverable: true,
              entrypoints: ['pkg_text'],
              requiredPermissions: ['pkg_search'],
              workflowIntents: ['review-updates'],
            },
            {
              type: 'builtin-plugin',
              coverage: 'builtin-primary',
              surface: 'runtime',
              pluginId: 'com.example.pkg',
              path: 'plugins/typescript/pkg-plugin',
              toolId: 'pkg-guided',
              interactionMode: 'declarative',
              discoverable: true,
              entrypoints: ['pkg_guided'],
              requiredPermissions: ['pkg_search', 'clipboard'],
              workflowIntents: ['review-updates', 'export-summary'],
            },
          ],
        },
      ],
    }));

    const isolated = await import('./plugin-sdk-usage');
    expect(isolated.resolveDeclaredSdkCapabilityCoverage({
      declarations: ['pkg'],
      grantedPermissions: ['pkg_search'],
      isDesktop: true,
    })).toEqual([
      expect.objectContaining({
        capabilityId: 'pkg',
        requiredPermissions: ['pkg_search', 'clipboard'],
        missingPermissions: ['clipboard'],
        reason: 'Missing permissions: clipboard',
        preferredWorkflow: {
          type: 'builtin-plugin',
          coverage: 'builtin-primary',
          surface: 'runtime',
          pluginId: 'com.example.pkg',
          path: 'plugins/typescript/pkg-plugin',
          toolId: 'pkg-guided',
          interactionMode: 'declarative',
          discoverable: true,
          entrypoints: ['pkg_guided'],
          requiredPermissions: ['pkg_search', 'clipboard'],
          localPrerequisites: [],
          pluginPointIds: [],
          workflowIntents: ['review-updates', 'export-summary'],
        },
      }),
    ]);

    jest.resetModules();
    jest.unmock('@/plugins/sdk-usage-inventory.json');
  });

  it('exposes guided companion metadata for env capability from the real inventory', () => {
    expect(resolveDeclaredSdkCapabilityCoverage({
      declarations: ['env'],
      grantedPermissions: ['env_read', 'notification'],
      isDesktop: true,
    })).toEqual([
      expect.objectContaining({
        capabilityId: 'env',
        status: 'covered',
        preferredWorkflow: expect.objectContaining({
          coverage: 'builtin-primary',
          toolId: 'env-provider-audit-guided',
          interactionMode: 'declarative',
          workflowIntents: expect.arrayContaining(['audit-environment-providers']),
        }),
      }),
    ]);
  });
});
