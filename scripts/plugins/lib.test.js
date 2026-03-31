let fs;
let os;
let path;

let pluginLib;

beforeAll(async () => {
  ({ default: fs } = await import('node:fs'));
  ({ default: os } = await import('node:os'));
  ({ default: path } = await import('node:path'));
  pluginLib = await import('./lib.mjs');
});

describe('scripts/plugins lib helpers', () => {
  const catalog = {
    plugins: [
      {
        id: 'com.example.alpha',
        name: 'Alpha',
        framework: 'typescript',
        version: '1.0.0',
        pluginDir: 'typescript/alpha',
        artifact: 'plugin.wasm',
        checksumSha256: 'aaa',
        packageName: 'alpha-package',
        testFile: 'plugins/typescript/alpha/src/index.test.ts',
        onboarding: {
          profile: 'builtin',
          catalogPath: 'plugins/manifest.json',
          checksumCommand: 'pnpm plugins:checksums',
          validationCommand: 'pnpm plugins:validate',
        },
      },
      {
        id: 'com.example.beta',
        name: 'Beta',
        framework: 'rust',
        version: '1.0.0',
        pluginDir: 'rust/beta',
        artifact: 'plugin.wasm',
        checksumSha256: 'bbb',
        rustCrate: 'builtin_beta',
        onboarding: {
          profile: 'builtin',
          catalogPath: 'plugins/manifest.json',
          checksumCommand: 'pnpm plugins:checksums',
          validationCommand: 'pnpm plugins:validate',
        },
      },
      {
        id: 'com.example.gamma',
        name: 'Gamma',
        framework: 'typescript',
        version: '1.0.0',
        pluginDir: 'typescript/gamma',
        artifact: 'plugin.wasm',
        checksumSha256: 'ccc',
        packageName: 'gamma-package',
        testFile: 'plugins/typescript/gamma/src/index.test.ts',
        onboarding: {
          profile: 'builtin',
          catalogPath: 'plugins/manifest.json',
          checksumCommand: 'pnpm plugins:checksums',
          validationCommand: 'pnpm plugins:validate',
        },
      },
    ],
  };

  it('parses shared maintainer args with selectors and validate flags', () => {
    expect(
      pluginLib.parseMaintainerArgs(
        ['--', '--plugin', 'com.example.alpha', '--framework', 'rust', '--json', '--skip-tests'],
        { allowSkipBuild: true, allowSkipTests: true },
      ),
    ).toEqual({
      pluginIds: ['com.example.alpha'],
      frameworks: ['rust'],
      json: true,
      skipBuild: false,
      skipTests: true,
      filtered: true,
    });
  });

  it('selects the union of plugin and framework selectors while preserving catalog order', () => {
    const selection = pluginLib.resolveSelectedPlugins(catalog, {
        pluginIds: ['com.example.alpha'],
        frameworks: ['rust'],
        json: false,
        skipBuild: false,
        skipTests: false,
        filtered: true,
      });

    expect(selection.filtered).toBe(true);
    expect(selection.selected.map((plugin) => plugin.id)).toEqual([
      'com.example.alpha',
      'com.example.beta',
    ]);
    expect(selection.skipped.map((plugin) => plugin.id)).toEqual(['com.example.gamma']);
  });

  it('rejects unknown plugin selectors before processing', () => {
    expect(() =>
      pluginLib.resolveSelectedPlugins(catalog, {
          pluginIds: ['com.example.missing'],
          frameworks: [],
          json: false,
          skipBuild: false,
          skipTests: false,
          filtered: true,
        }),
    ).toThrow('Unknown plugin selector');
  });

  it('rejects builtin TypeScript catalog entries missing maintainer test metadata', () => {
    const missingPackageName = {
      plugins: [
        {
          ...catalog.plugins[0],
          packageName: '',
        },
      ],
    };
    expect(() => pluginLib.validateCatalogShape(missingPackageName)).toThrow('packageName');

    const missingTestFile = {
      plugins: [
        {
          ...catalog.plugins[0],
          testFile: '',
        },
      ],
    };
    expect(() => pluginLib.validateCatalogShape(missingTestFile)).toThrow('testFile');
  });

  it('detects framework-specific metadata drift against project files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-script-lib-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'example');
      fs.mkdirSync(pluginRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.plugin"',
          'name = "Example Plugin"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "example-tool"',
          'name = "Example Tool"',
          '',
        ].join('\n'),
        'utf8',
      );
      fs.writeFileSync(
        path.join(pluginRoot, 'package.json'),
        JSON.stringify(
          {
            name: 'wrong-package-name',
            version: '2.0.0',
          },
          null,
          2,
        ),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(pluginRoot, 'src', 'index.test.ts'), 'export {};', 'utf8');

      const drift = pluginLib.validatePluginProjectMetadata(
        {
          id: 'com.example.plugin',
          name: 'Example Plugin',
          version: '1.0.0',
          framework: 'typescript',
          pluginDir: 'typescript/example',
          artifact: 'plugin.wasm',
          checksumSha256: 'deadbeef',
          packageName: 'expected-package-name',
          testFile: 'plugins/typescript/example/src/index.test.ts',
        },
        { repoRoot: tempRoot },
      );

      expect(drift).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'package.json',
            field: 'name',
            expected: 'expected-package-name',
            actual: 'wrong-package-name',
          }),
          expect.objectContaining({
            source: 'package.json',
            field: 'version',
            expected: '1.0.0',
            actual: '2.0.0',
          }),
        ]),
      );
      expect(drift).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            source: 'plugin.toml',
            field: 'id',
          }),
        ]),
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('extracts official SDK capability families from both public entrypoints', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-capability-exports-'));

    try {
      fs.mkdirSync(path.join(tempRoot, 'plugin-sdk', 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, 'plugin-sdk-ts', 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempRoot, 'plugin-sdk', 'src', 'lib.rs'),
        [
          'pub mod batch;',
          'pub mod env;',
          'pub mod platform;',
          'pub mod types;',
        ].join('\n'),
        'utf8',
      );
      fs.writeFileSync(
        path.join(tempRoot, 'plugin-sdk-ts', 'src', 'index.ts'),
        [
          "export * as batch from './batch';",
          "export * as env from './env';",
          "export * as platform from './platform';",
          "export * from './types';",
        ].join('\n'),
        'utf8',
      );

      expect(pluginLib.getOfficialSdkCapabilityFamilies({ repoRoot: tempRoot })).toEqual([
        'batch',
        'env',
        'platform',
      ]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects sdk usage inventory entries that drift from official capability exports', () => {
    expect(() =>
      pluginLib.validateSdkUsageInventoryShape(
        {
          schemaVersion: 1,
          capabilities: [
            {
              id: 'env',
              permissionGuidance: ['env_read'],
              hostPrerequisites: [],
              usagePaths: [
                {
                  type: 'official-example',
                  path: 'plugin-sdk-ts/examples/hello-world',
                  requiredPermissions: ['env_read'],
                },
              ],
            },
          ],
        },
        {
          officialCapabilities: ['env', 'platform'],
          catalog,
          sdkCapabilityMatrix: {
            schemaVersion: 1,
            requiredPluginIds: [],
            supportedSdkCapabilities: ['env', 'platform'],
            plugins: [],
          },
          extensionPointMatrix: {
            schemaVersion: 1,
            pluginPoints: [],
          },
          repoRoot: process.cwd(),
        },
      ),
    ).toThrow('Missing sdk usage inventory entries for official capabilities: platform');
  });

  it('rejects broken usage asset references and built-in permission drift in sdk usage inventory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-usage-inventory-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'alpha');
      fs.mkdirSync(pluginRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.alpha"',
          'name = "Alpha"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "alpha-tool"',
          'name_en = "Alpha Tool"',
          'description_en = "Alpha"',
          'entry = "alpha_entry"',
          '',
          '[permissions]',
          'env_read = true',
        ].join('\n'),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'src', 'index.ts'),
        'export function alpha_entry() { return 0; }\n',
        'utf8',
      );

      expect(() =>
        pluginLib.validateSdkUsageInventoryShape(
          {
            schemaVersion: 1,
            capabilities: [
              {
                id: 'env',
                permissionGuidance: ['env_read'],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'builtin-plugin',
                    pluginId: 'com.example.alpha',
                    path: 'plugins/typescript/alpha',
                    entrypoints: ['alpha_entry'],
                    requiredPermissions: ['config_read'],
                  },
                ],
              },
              {
                id: 'platform',
                permissionGuidance: [],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'official-example',
                    path: 'plugin-sdk-ts/examples/missing-example',
                    requiredPermissions: [],
                  },
                ],
              },
            ],
          },
          {
            officialCapabilities: ['env', 'platform'],
            catalog: {
              plugins: [catalog.plugins[0]],
            },
            sdkCapabilityMatrix: {
              schemaVersion: 1,
              requiredPluginIds: [],
              supportedSdkCapabilities: ['env', 'platform'],
              plugins: [
                {
                  id: 'com.example.alpha',
                  sdkCapabilities: ['env'],
                  expectedPermissions: ['env_read'],
                  primaryEntrypoints: ['alpha_entry'],
                },
              ],
            },
            extensionPointMatrix: {
              schemaVersion: 1,
              pluginPoints: [],
            },
            repoRoot: tempRoot,
          },
        ),
      ).toThrow("com.example.alpha usage path permissions drift");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects ink authoring usage paths that omit a launch command', () => {
    expect(() =>
      pluginLib.validateSdkUsageInventoryShape(
        {
          schemaVersion: 1,
          capabilities: [
            {
              id: 'env',
              permissionGuidance: ['env_read'],
              hostPrerequisites: [],
              usagePaths: [
                {
                  type: 'official-example',
                  surface: 'ink-authoring',
                  path: 'plugin-sdk-ts/examples/hello-world',
                  displayName: 'Hello Ink Preview',
                  requiredPermissions: [],
                },
              ],
            },
          ],
        },
        {
          officialCapabilities: ['env'],
          catalog,
          sdkCapabilityMatrix: {
            schemaVersion: 1,
            requiredPluginIds: [],
            supportedSdkCapabilities: ['env'],
            plugins: [],
          },
          extensionPointMatrix: {
            schemaVersion: 1,
            pluginPoints: [],
          },
          repoRoot: process.cwd(),
        },
      ),
    ).toThrow("ink-authoring usage path must declare a non-empty launchCommand");
  });

  it('accepts built-in ink authoring paths nested under the plugin directory with a narrower permission set', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-usage-authoring-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'alpha');
      fs.mkdirSync(path.join(pluginRoot, 'authoring'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.alpha"',
          'name = "Alpha"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "alpha-tool"',
          'name_en = "Alpha Tool"',
          'description_en = "Alpha"',
          'entry = "alpha_entry"',
          '',
          '[permissions]',
          'env_read = true',
          'notification = true',
        ].join('\n'),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'src', 'index.ts'),
        'export function alpha_entry() { return 0; }\n',
        'utf8',
      );
      fs.writeFileSync(
        path.join(pluginRoot, 'authoring', 'ink.tsx'),
        'export {};\n',
        'utf8',
      );

      expect(() =>
        pluginLib.validateSdkUsageInventoryShape(
          {
            schemaVersion: 1,
            capabilities: [
              {
                id: 'env',
                permissionGuidance: ['env_read', 'notification'],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'builtin-plugin',
                    pluginId: 'com.example.alpha',
                    surface: 'ink-authoring',
                    displayName: 'Alpha Ink Preview',
                    launchCommand: 'pnpm authoring:ink',
                    path: 'plugins/typescript/alpha/authoring/ink.tsx',
                    entrypoints: ['alpha_entry'],
                    requiredPermissions: ['env_read'],
                    localPrerequisites: ['Node.js 20+'],
                  },
                ],
              },
            ],
          },
          {
            officialCapabilities: ['env'],
            catalog: {
              plugins: [catalog.plugins[0]],
            },
            sdkCapabilityMatrix: {
              schemaVersion: 1,
              requiredPluginIds: [],
              supportedSdkCapabilities: ['env'],
              plugins: [
                {
                  id: 'com.example.alpha',
                  sdkCapabilities: ['env'],
                  expectedPermissions: ['env_read', 'notification'],
                  primaryEntrypoints: ['alpha_entry'],
                },
              ],
            },
            extensionPointMatrix: {
              schemaVersion: 1,
              pluginPoints: [],
            },
            repoRoot: tempRoot,
          },
        ),
      ).not.toThrow();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects builtin-primary runtime usage paths that omit toolbox workflow metadata', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-usage-guided-required-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'alpha');
      fs.mkdirSync(pluginRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.alpha"',
          'name = "Alpha"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "alpha-guided"',
          'name_en = "Alpha Guided"',
          'description_en = "Alpha guided workflow"',
          'entry = "alpha_entry"',
          'ui_mode = "declarative"',
          '',
          '[permissions]',
          'env_read = true',
        ].join('\n'),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'src', 'index.ts'),
        'export function alpha_entry() { return 0; }\n',
        'utf8',
      );

      expect(() =>
        pluginLib.validateSdkUsageInventoryShape(
          {
            schemaVersion: 1,
            capabilities: [
              {
                id: 'env',
                permissionGuidance: ['env_read'],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'builtin-plugin',
                    coverage: 'builtin-primary',
                    pluginId: 'com.example.alpha',
                    path: 'plugins/typescript/alpha',
                    entrypoints: ['alpha_entry'],
                    requiredPermissions: ['env_read'],
                  },
                ],
              },
            ],
          },
          {
            officialCapabilities: ['env'],
            catalog: {
              plugins: [catalog.plugins[0]],
            },
            sdkCapabilityMatrix: {
              schemaVersion: 1,
              requiredPluginIds: [],
              supportedSdkCapabilities: ['env'],
              plugins: [
                {
                  id: 'com.example.alpha',
                  sdkCapabilities: ['env'],
                  expectedPermissions: ['env_read'],
                  primaryEntrypoints: ['alpha_entry'],
                },
              ],
            },
            extensionPointMatrix: {
              schemaVersion: 1,
              pluginPoints: [],
            },
            repoRoot: tempRoot,
          },
        ),
      ).toThrow('builtin-primary runtime usage path must declare a non-empty toolId');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects builtin workflow tool metadata drift for tool id and interaction mode', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-usage-guided-tool-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'alpha');
      fs.mkdirSync(pluginRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.alpha"',
          'name = "Alpha"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "alpha-guided"',
          'name_en = "Alpha Guided"',
          'description_en = "Alpha guided workflow"',
          'entry = "alpha_guided"',
          'ui_mode = "declarative"',
          '',
          '[permissions]',
          'env_read = true',
        ].join('\n'),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'src', 'index.ts'),
        'export function alpha_guided() { return 0; }\n',
        'utf8',
      );

      expect(() =>
        pluginLib.validateSdkUsageInventoryShape(
          {
            schemaVersion: 1,
            capabilities: [
              {
                id: 'env',
                permissionGuidance: ['env_read'],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'builtin-plugin',
                    coverage: 'builtin-primary',
                    pluginId: 'com.example.alpha',
                    path: 'plugins/typescript/alpha',
                    toolId: 'alpha-guided',
                    interactionMode: 'text',
                    discoverable: true,
                    workflowIntents: ['audit-env'],
                    entrypoints: ['alpha_guided'],
                    requiredPermissions: ['env_read'],
                  },
                ],
              },
            ],
          },
          {
            officialCapabilities: ['env'],
            catalog: {
              plugins: [catalog.plugins[0]],
            },
            sdkCapabilityMatrix: {
              schemaVersion: 1,
              requiredPluginIds: [],
              supportedSdkCapabilities: ['env'],
              plugins: [
                {
                  id: 'com.example.alpha',
                  sdkCapabilities: ['env'],
                  expectedPermissions: ['env_read'],
                  primaryEntrypoints: ['alpha_guided'],
                },
              ],
            },
            extensionPointMatrix: {
              schemaVersion: 1,
              pluginPoints: [],
            },
            repoRoot: tempRoot,
          },
        ),
      ).toThrow("com.example.alpha workflow interactionMode drift for tool 'alpha-guided'.");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects builtin-primary workflow inventory that drifts from guided workflow matrix metadata', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-sdk-usage-guided-matrix-'));

    try {
      const pluginRoot = path.join(tempRoot, 'plugins', 'typescript', 'alpha');
      fs.mkdirSync(pluginRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'plugin.toml'),
        [
          '[plugin]',
          'id = "com.example.alpha"',
          'name = "Alpha"',
          'version = "1.0.0"',
          '',
          '[[tools]]',
          'id = "alpha-tool"',
          'name_en = "Alpha Tool"',
          'description_en = "Alpha"',
          'entry = "alpha_entry"',
          '',
          '[[tools]]',
          'id = "alpha-guided"',
          'name_en = "Alpha Guided"',
          'description_en = "Alpha guided workflow"',
          'entry = "alpha_guided"',
          'ui_mode = "declarative"',
          '',
          '[permissions]',
          'env_read = true',
        ].join('\n'),
        'utf8',
      );
      fs.mkdirSync(path.join(pluginRoot, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(pluginRoot, 'src', 'index.ts'),
        'export function alpha_entry() { return 0; }\nexport function alpha_guided() { return 0; }\n',
        'utf8',
      );

      expect(() =>
        pluginLib.validateSdkUsageInventoryShape(
          {
            schemaVersion: 1,
            capabilities: [
              {
                id: 'env',
                permissionGuidance: ['env_read'],
                hostPrerequisites: [],
                usagePaths: [
                  {
                    type: 'builtin-plugin',
                    coverage: 'builtin-primary',
                    pluginId: 'com.example.alpha',
                    path: 'plugins/typescript/alpha',
                    toolId: 'alpha-guided',
                    interactionMode: 'declarative',
                    discoverable: true,
                    workflowIntents: ['audit-env'],
                    entrypoints: ['alpha_guided'],
                    requiredPermissions: ['env_read'],
                  },
                ],
              },
            ],
          },
          {
            officialCapabilities: ['env'],
            catalog: {
              plugins: [catalog.plugins[0]],
            },
            sdkCapabilityMatrix: {
              schemaVersion: 1,
              requiredPluginIds: [],
              supportedSdkCapabilities: ['env'],
              plugins: [
                {
                  id: 'com.example.alpha',
                  sdkCapabilities: ['env'],
                  expectedPermissions: ['env_read'],
                  primaryEntrypoints: ['alpha_entry'],
                  guidedWorkflowEntrypoints: ['alpha_guided_mismatch'],
                  guidedWorkflowToolIds: ['alpha-guided'],
                },
              ],
            },
            extensionPointMatrix: {
              schemaVersion: 1,
              pluginPoints: [],
            },
            repoRoot: tempRoot,
          },
        ),
      ).toThrow("com.example.alpha guided workflow entrypoints drift from sdk-capability-matrix guidedWorkflowEntrypoints.");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds direct jest args for TypeScript plugin tests so runInBand stays a real option', () => {
    expect(
      pluginLib.buildTypeScriptPluginTestCommand({
        testFile: 'plugins/typescript/alpha/src/index.test.ts',
      }),
    ).toEqual({
      command: 'pnpm',
      args: ['exec', 'jest', '--runInBand', 'plugins/typescript/alpha/src/index.test.ts'],
    });
  });
});
