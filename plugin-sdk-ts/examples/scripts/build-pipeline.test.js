const path = require('node:path');

const { __test } = require('./build-pipeline.cjs');

describe('build pipeline diagnostics', () => {
  it('classifies EPERM spawn failure with actionable remediation', () => {
    const error = Object.assign(new Error('spawn EPERM'), { code: 'EPERM' });
    const result = __test.classifySpawnError('bundle', 'node', error);

    expect(result.code).toBe('BUNDLE_SPAWN_PERMISSION_DENIED');
    expect(result.message).toContain('permission denied');
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('non-restricted shell'),
        expect.stringContaining('escalated permissions'),
      ]),
    );
  });

  it('classifies ENOENT spawn failure as executable not found', () => {
    const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    const result = __test.classifySpawnError('wasm-compile', 'extism-js', error);

    expect(result.code).toBe('WASM_COMPILE_EXECUTABLE_NOT_FOUND');
    expect(result.message).toContain('not found');
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('EXTISM_JS_PATH'),
      ]),
    );
  });

  it('fails preflight when bundle script is missing', async () => {
    const root = path.resolve(__dirname, '..', 'hello-world');
    const report = await __test.runPreflight({
      root,
      bundleScript: 'missing-esbuild.config.mjs',
      setupOnly: false,
      target: { exe: '' },
      searchPaths: [],
      ensureExtism: async () => path.join(root, '.tools', 'extism-js', 'extism-js'),
      ensureBinaryen: async () => path.join(root, '.tools', 'binaryen', 'bin'),
      logger: () => {},
    });

    expect(report.ok).toBe(false);
    expect(report.code).toBe('BUNDLE_SCRIPT_NOT_FOUND');
    expect(report.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('esbuild.config.mjs')]),
    );
  });
});
