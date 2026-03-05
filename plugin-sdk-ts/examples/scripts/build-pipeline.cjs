const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { access, chmod, cp, mkdir, readdir, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');

const EXTISM_VERSION = 'v1.6.0';
const BINARYEN_VERSION = 'version_126';

const TARGETS = {
  'win32-x64': { extism: 'x86_64-windows', binaryen: 'x86_64-windows', exe: '.exe' },
  'win32-arm64': { extism: 'aarch64-windows', binaryen: 'arm64-windows', exe: '.exe' },
  'linux-x64': { extism: 'x86_64-linux', binaryen: 'x86_64-linux', exe: '' },
  'linux-arm64': { extism: 'aarch64-linux', binaryen: 'aarch64-linux', exe: '' },
  'darwin-x64': { extism: 'x86_64-macos', binaryen: 'x86_64-macos', exe: '' },
  'darwin-arm64': { extism: 'aarch64-macos', binaryen: 'arm64-macos', exe: '' },
};

async function runBuildPipeline(options) {
  const root = options.root;
  const bundleScript = options.bundleScript ?? 'esbuild.config.mjs';
  const setupOnly = options.setupOnly ?? process.argv.includes('--setup-only');
  const pluginName = options.pluginName ?? path.basename(root);
  const logger = options.logger ?? defaultLogger(pluginName);

  const targetKey = `${process.platform}-${os.arch()}`;
  const target = options.target ?? TARGETS[targetKey];
  if (!target) {
    fail('preflight', {
      code: 'UNSUPPORTED_PLATFORM',
      message: `Unsupported platform/arch: ${targetKey}`,
      recommendations: ['Use a supported host platform/arch pair from the build matrix.'],
    });
  }

  const toolsDir = path.join(root, '.tools');

  try {
    const preflight = await runPreflight({
      root,
      bundleScript,
      setupOnly,
      target,
      searchPaths: getSearchPaths(),
      ensureExtism: () => ensureLocalExtism({ toolsDir, target, logger }),
      ensureBinaryen: () => ensureLocalBinaryen({ toolsDir, target, logger }),
      logger,
    });

    if (!preflight.ok) {
      fail('preflight', preflight);
    }

    logger('preflight', 'All required checks passed.');

    if (setupOnly) {
      logger('preflight', 'Toolchain setup completed.');
      return;
    }

    runPhase({
      phase: 'bundle',
      command: 'node',
      args: [bundleScript],
      cwd: root,
      logger,
    });

    const extraPathEntries = [path.dirname(preflight.extismExecutable)];
    if (preflight.binaryenBin) {
      extraPathEntries.unshift(preflight.binaryenBin);
    }

    const env = {
      ...process.env,
      PATH: [...extraPathEntries, process.env.PATH ?? ''].join(path.delimiter),
    };

    runPhase({
      phase: 'wasm-compile',
      command: preflight.extismExecutable,
      args: ['dist/plugin.js', '-i', 'plugin.d.ts', '-o', 'plugin.wasm'],
      cwd: root,
      env,
      logger,
    });

    logger('wasm-compile', 'Build completed: plugin.wasm');
  } catch (error) {
    if (error instanceof BuildPhaseError) {
      fail(error.diagnostics.phase, error.diagnostics);
    }
    fail('build', {
      code: 'BUILD_PIPELINE_FAILED',
      message: error instanceof Error ? error.message : String(error),
      recommendations: ['Inspect the output above and retry after fixing the root cause.'],
    });
  }
}

async function runPreflight(options) {
  const {
    root,
    bundleScript,
    target,
    searchPaths,
    ensureExtism,
    ensureBinaryen,
    logger,
  } = options;

  const bundleScriptPath = path.join(root, bundleScript);
  const pluginDtsPath = path.join(root, 'plugin.d.ts');
  const distDir = path.join(root, 'dist');

  if (!(await pathExists(bundleScriptPath))) {
    return {
      ok: false,
      code: 'BUNDLE_SCRIPT_NOT_FOUND',
      message: `Bundle script not found: ${bundleScriptPath}`,
      recommendations: ['Restore esbuild.config.mjs and retry build.'],
    };
  }
  logger('preflight', `bundle-script: ok (${bundleScriptPath})`);

  if (!(await pathExists(pluginDtsPath))) {
    return {
      ok: false,
      code: 'PLUGIN_TYPES_NOT_FOUND',
      message: `plugin.d.ts not found: ${pluginDtsPath}`,
      recommendations: ['Ensure plugin.d.ts exists in the plugin root before building.'],
    };
  }
  logger('preflight', `plugin-types: ok (${pluginDtsPath})`);

  try {
    await ensureWritableDirectory(distDir);
  } catch (error) {
    return {
      ok: false,
      code: 'OUTPUT_NOT_WRITABLE',
      message: `Output directory is not writable: ${distDir}`,
      recommendations: [
        'Grant write access to the plugin directory or choose a writable workspace.',
        `Underlying error: ${error.message}`,
      ],
    };
  }
  logger('preflight', `output-path: ok (${distDir})`);

  try {
    require.resolve('esbuild', { paths: [root] });
  } catch {
    return {
      ok: false,
      code: 'ESBUILD_NOT_FOUND',
      message: 'esbuild package is not resolvable for this plugin.',
      recommendations: [
        'Install dependencies for the plugin package.',
        'Run pnpm install in the workspace and retry.',
      ],
    };
  }
  logger('preflight', 'esbuild-package: ok');

  let extismExecutable;
  try {
    extismExecutable = await resolveExtismExecutable({
      target,
      searchPaths,
      ensureExtism,
      logger,
    });
  } catch (error) {
    return {
      ok: false,
      code: 'EXTISM_SETUP_FAILED',
      message: error.message,
      recommendations: [
        'Set EXTISM_JS_PATH to a valid local extism-js binary.',
        'Or set EXTISM_JS_URL to a reachable mirror URL.',
      ],
    };
  }

  let binaryenBin = null;
  try {
    binaryenBin = await resolveBinaryenBin({
      target,
      searchPaths,
      ensureBinaryen,
      logger,
    });
  } catch (error) {
    return {
      ok: false,
      code: 'BINARYEN_SETUP_FAILED',
      message: error.message,
      recommendations: [
        'Set BINARYEN_BIN to a folder containing wasm-opt and wasm-merge.',
        'Or set BINARYEN_URL to a reachable mirror URL.',
      ],
    };
  }

  return {
    ok: true,
    code: 'PREFLIGHT_OK',
    extismExecutable,
    binaryenBin,
  };
}

async function resolveExtismExecutable(options) {
  const { target, searchPaths, ensureExtism, logger } = options;
  if (process.env.EXTISM_JS_PATH) {
    if (!(await pathExists(process.env.EXTISM_JS_PATH))) {
      throw new Error(`EXTISM_JS_PATH does not exist: ${process.env.EXTISM_JS_PATH}`);
    }
    logger('preflight', `extism-js: EXTISM_JS_PATH (${process.env.EXTISM_JS_PATH})`);
    return process.env.EXTISM_JS_PATH;
  }

  const onPath = findExecutable(['extism-js'], searchPaths);
  if (onPath) {
    logger('preflight', `extism-js: PATH (${onPath})`);
    return onPath;
  }

  const ensured = await ensureExtism(target);
  logger('preflight', `extism-js: local-cache (${ensured})`);
  return ensured;
}

async function resolveBinaryenBin(options) {
  const { target, searchPaths, ensureBinaryen, logger } = options;

  if (process.env.BINARYEN_BIN) {
    const wasmOpt = path.join(process.env.BINARYEN_BIN, `wasm-opt${target.exe}`);
    const wasmMerge = path.join(process.env.BINARYEN_BIN, `wasm-merge${target.exe}`);
    if (!(await pathExists(wasmOpt)) || !(await pathExists(wasmMerge))) {
      throw new Error(`BINARYEN_BIN is missing wasm-opt/wasm-merge: ${process.env.BINARYEN_BIN}`);
    }
    logger('preflight', `binaryen: BINARYEN_BIN (${process.env.BINARYEN_BIN})`);
    return process.env.BINARYEN_BIN;
  }

  if (hasBinaryen(searchPaths)) {
    logger('preflight', 'binaryen: PATH');
    return null;
  }

  const ensured = await ensureBinaryen(target);
  logger('preflight', `binaryen: local-cache (${ensured})`);
  return ensured;
}

function runPhase(options) {
  const { phase, command, args, cwd, env, logger } = options;
  logger(phase, `Running command: ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw new BuildPhaseError(classifySpawnError(phase, command, result.error));
  }

  if ((result.status ?? 1) !== 0) {
    const inferred = classifyFromProcessOutput(phase, command, result.stderr ?? '', result.stdout ?? '');
    if (inferred) {
      throw new BuildPhaseError(inferred);
    }

    throw new BuildPhaseError({
      phase,
      code: phaseToCode(phase, 'FAILED'),
      message: `Command failed in phase "${phase}" with exit code ${result.status ?? 1}: ${command}`,
      recommendations: ['Inspect command output above and fix the root cause before retrying.'],
    });
  }
}

function classifyFromProcessOutput(phase, command, stderr, stdout) {
  const output = `${stderr}\n${stdout}`;
  if (/spawn\s+EPERM/i.test(output)) {
    return classifySpawnError(phase, command, { code: 'EPERM' });
  }
  if (/spawn\s+ENOENT/i.test(output)) {
    return classifySpawnError(phase, command, { code: 'ENOENT' });
  }
  return null;
}

function classifySpawnError(phase, command, error) {
  const errorCode = String(error?.code ?? '').toUpperCase();
  const phaseCode = phaseToCode(phase, '');
  const commandLower = String(command).toLowerCase();

  if (errorCode === 'EPERM') {
    return {
      phase,
      code: `${phaseCode}_SPAWN_PERMISSION_DENIED`,
      message: `Failed to launch "${command}" in phase "${phase}": permission denied (EPERM).`,
      recommendations: [
        'Run build in a non-restricted shell or grant escalated permissions in sandboxed environments.',
        'Ensure security tooling is not blocking child process creation for this workspace.',
      ],
    };
  }

  if (errorCode === 'ENOENT') {
    const recommendations = ['Ensure the executable exists on PATH and is accessible.'];
    if (commandLower.includes('extism')) {
      recommendations.push('Set EXTISM_JS_PATH to the local extism-js binary.');
    }
    if (commandLower.includes('node')) {
      recommendations.push('Install Node.js 20+ and ensure `node` is available on PATH.');
    }
    return {
      phase,
      code: `${phaseCode}_EXECUTABLE_NOT_FOUND`,
      message: `Failed to launch "${command}" in phase "${phase}": executable not found (ENOENT).`,
      recommendations,
    };
  }

  return {
    phase,
    code: `${phaseCode}_SPAWN_FAILED`,
    message: `Failed to launch "${command}" in phase "${phase}": ${error?.message ?? 'unknown error'}.`,
    recommendations: ['Inspect host process execution permissions and command availability.'],
  };
}

function phaseToCode(phase, suffix) {
  const base = String(phase).replace(/-/g, '_').toUpperCase();
  return suffix ? `${base}_${suffix}` : base;
}

function defaultLogger(pluginName) {
  return (phase, message) => {
    console.log(`[build][${pluginName}][${phase}] ${message}`);
  };
}

async function ensureWritableDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
  const probe = path.join(dirPath, `.write-check-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await writeFile(probe, 'ok');
  await rm(probe, { force: true });
}

function getSearchPaths() {
  return (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
}

function findExecutable(names, searchPaths) {
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];

  for (const dir of searchPaths) {
    for (const name of names) {
      const variants =
        process.platform === 'win32' && path.extname(name) === ''
          ? extensions.map((ext) => `${name}${ext}`)
          : [name];

      for (const variant of variants) {
        const fullPath = path.join(dir, variant);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

function hasBinaryen(searchPaths) {
  return Boolean(
    findExecutable(['wasm-opt'], searchPaths) && findExecutable(['wasm-merge'], searchPaths),
  );
}

async function ensureLocalExtism(options) {
  const { toolsDir, target, logger } = options;
  const extismDir = path.join(toolsDir, 'extism-js');
  const extismPath = path.join(extismDir, `extism-js${target.exe}`);

  if (await pathExists(extismPath)) {
    return extismPath;
  }

  await mkdir(extismDir, { recursive: true });

  const downloadUrl =
    process.env.EXTISM_JS_URL ??
    `https://github.com/extism/js-pdk/releases/download/${EXTISM_VERSION}/extism-js-${target.extism}-${EXTISM_VERSION}.gz`;

  logger('preflight', `Downloading extism-js from ${downloadUrl}`);
  let compressed;
  try {
    compressed = await downloadBuffer(downloadUrl);
  } catch (error) {
    throw new Error(
      `Failed to download extism-js from ${downloadUrl}. ${error.message}`,
    );
  }

  const binary = gunzipSync(compressed);
  await writeFile(extismPath, binary);
  if (process.platform !== 'win32') {
    await chmod(extismPath, 0o755);
  }

  return extismPath;
}

async function ensureLocalBinaryen(options) {
  const { toolsDir, target, logger } = options;
  const binaryenRoot = path.join(toolsDir, 'binaryen');
  const binaryenBin = path.join(binaryenRoot, 'bin');
  const wasmOpt = path.join(binaryenBin, `wasm-opt${target.exe}`);
  const wasmMerge = path.join(binaryenBin, `wasm-merge${target.exe}`);

  if ((await pathExists(wasmOpt)) && (await pathExists(wasmMerge))) {
    return binaryenBin;
  }

  const tarBinary = findExecutable(['tar'], getSearchPaths());
  if (!tarBinary) {
    throw new Error(
      'Missing "tar" command. Install tar, or install binaryen globally so wasm-opt and wasm-merge are on PATH.',
    );
  }

  const downloadsDir = path.join(toolsDir, 'downloads');
  const extractRoot = path.join(toolsDir, 'binaryen-extract');
  const archivePath = path.join(
    downloadsDir,
    `binaryen-${BINARYEN_VERSION}-${target.binaryen}.tar.gz`,
  );

  await mkdir(downloadsDir, { recursive: true });
  const downloadUrl =
    process.env.BINARYEN_URL ??
    `https://github.com/WebAssembly/binaryen/releases/download/${BINARYEN_VERSION}/binaryen-${BINARYEN_VERSION}-${target.binaryen}.tar.gz`;

  if (!(await pathExists(archivePath))) {
    logger('preflight', `Downloading binaryen from ${downloadUrl}`);
    let archiveBytes;
    try {
      archiveBytes = await downloadBuffer(downloadUrl);
    } catch (error) {
      throw new Error(`Failed to download binaryen from ${downloadUrl}. ${error.message}`);
    }
    await writeFile(archivePath, archiveBytes);
  }

  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  runPhase({
    phase: 'preflight',
    command: tarBinary,
    args: ['-xzf', archivePath, '-C', extractRoot],
    cwd: toolsDir,
    logger,
  });

  const extractedDir = (await readdir(extractRoot, { withFileTypes: true })).find(
    (entry) => entry.isDirectory() && entry.name.startsWith(`binaryen-${BINARYEN_VERSION}`),
  );

  if (!extractedDir) {
    throw new Error(`Failed to extract binaryen archive: ${archivePath}`);
  }

  await rm(binaryenRoot, { recursive: true, force: true });
  await cp(path.join(extractRoot, extractedDir.name), binaryenRoot, { recursive: true });
  await rm(extractRoot, { recursive: true, force: true });

  if (!(await pathExists(wasmOpt)) || !(await pathExists(wasmMerge))) {
    throw new Error(`binaryen installation incomplete: expected ${wasmOpt} and ${wasmMerge}`);
  }

  return binaryenBin;
}

async function downloadBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CogniaLauncher-plugin-sdk-ts-example',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function fail(phase, diagnostics) {
  console.error(`[build][${phase}][error] ${diagnostics.code}: ${diagnostics.message}`);
  for (const recommendation of diagnostics.recommendations ?? []) {
    console.error(`[build][${phase}][hint] ${recommendation}`);
  }
  process.exit(1);
}

class BuildPhaseError extends Error {
  constructor(diagnostics) {
    super(diagnostics.message);
    this.name = 'BuildPhaseError';
    this.diagnostics = diagnostics;
  }
}

module.exports = {
  runBuildPipeline,
  __test: {
    classifySpawnError,
    runPreflight,
  },
};
