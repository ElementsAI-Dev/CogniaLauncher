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
});
