import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { access, chmod, cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, '.tools');

// Pinned toolchain versions for deterministic builds.
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

const targetKey = `${process.platform}-${os.arch()}`;
const target = TARGETS[targetKey];
const setupOnly = process.argv.includes('--setup-only');

if (!target) {
  fail(`Unsupported platform/arch: ${targetKey}`);
}

await main();

async function main() {
  let extismExecutable = null;
  let binaryenBin = null;

  if (process.env.EXTISM_JS_PATH) {
    if (!(await pathExists(process.env.EXTISM_JS_PATH))) {
      fail(`EXTISM_JS_PATH does not exist: ${process.env.EXTISM_JS_PATH}`);
    }
    extismExecutable = process.env.EXTISM_JS_PATH;
    console.log(`[build] Using extism-js from EXTISM_JS_PATH: ${extismExecutable}`);
  } else {
    extismExecutable = findExecutable(['extism-js'], getSearchPaths());
    if (!extismExecutable) {
      extismExecutable = await ensureLocalExtism();
    } else {
      console.log(`[build] Using extism-js from PATH: ${extismExecutable}`);
    }
  }

  if (process.env.BINARYEN_BIN) {
    const wasmOpt = path.join(process.env.BINARYEN_BIN, `wasm-opt${target.exe}`);
    const wasmMerge = path.join(process.env.BINARYEN_BIN, `wasm-merge${target.exe}`);
    if (!(await pathExists(wasmOpt)) || !(await pathExists(wasmMerge))) {
      fail(`BINARYEN_BIN is missing wasm-opt/wasm-merge: ${process.env.BINARYEN_BIN}`);
    }
    binaryenBin = process.env.BINARYEN_BIN;
    console.log(`[build] Using binaryen from BINARYEN_BIN: ${binaryenBin}`);
  } else {
    if (!hasBinaryen(getSearchPaths())) {
      binaryenBin = await ensureLocalBinaryen();
    } else {
      console.log('[build] Using binaryen tools from PATH');
    }
  }

  if (setupOnly) {
    console.log('[build] Toolchain setup completed.');
    return;
  }

  run('node', ['esbuild.config.mjs']);

  const extraPathEntries = [path.dirname(extismExecutable)];
  if (binaryenBin) {
    extraPathEntries.unshift(binaryenBin);
  }

  const env = {
    ...process.env,
    PATH: [...extraPathEntries, process.env.PATH ?? ''].join(path.delimiter),
  };

  run(extismExecutable, ['dist/plugin.js', '-i', 'plugin.d.ts', '-o', 'plugin.wasm'], { env });
  console.log('[build] Build completed: plugin.wasm');
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    fail(`Failed to run "${command}": ${result.error.message}`);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function ensureLocalExtism() {
  const extismDir = path.join(TOOLS_DIR, 'extism-js');
  const extismPath = path.join(extismDir, `extism-js${target.exe}`);

  if (await pathExists(extismPath)) {
    console.log(`[build] Using cached extism-js: ${extismPath}`);
    return extismPath;
  }

  await mkdir(extismDir, { recursive: true });

  const downloadUrl =
    process.env.EXTISM_JS_URL ??
    `https://github.com/extism/js-pdk/releases/download/${EXTISM_VERSION}/extism-js-${target.extism}-${EXTISM_VERSION}.gz`;
  console.log(`[build] Downloading extism-js ${EXTISM_VERSION}...`);
  let compressed;
  try {
    compressed = await downloadBuffer(downloadUrl);
  } catch (error) {
    fail(
      `Failed to download extism-js from ${downloadUrl}. Set EXTISM_JS_PATH to a local binary or EXTISM_JS_URL to a reachable mirror. ${error.message}`,
    );
  }
  const binary = gunzipSync(compressed);

  await writeFile(extismPath, binary);
  if (process.platform !== 'win32') {
    await chmod(extismPath, 0o755);
  }

  console.log(`[build] Installed extism-js: ${extismPath}`);
  return extismPath;
}

async function ensureLocalBinaryen() {
  const binaryenRoot = path.join(TOOLS_DIR, 'binaryen');
  const binaryenBin = path.join(binaryenRoot, 'bin');
  const wasmOpt = path.join(binaryenBin, `wasm-opt${target.exe}`);
  const wasmMerge = path.join(binaryenBin, `wasm-merge${target.exe}`);

  if ((await pathExists(wasmOpt)) && (await pathExists(wasmMerge))) {
    console.log(`[build] Using cached binaryen: ${binaryenBin}`);
    return binaryenBin;
  }

  const tarBinary = findExecutable(['tar'], getSearchPaths());
  if (!tarBinary) {
    fail(
      'Missing "tar" command. Install tar, or install binaryen globally so wasm-opt and wasm-merge are on PATH.',
    );
  }

  const downloadsDir = path.join(TOOLS_DIR, 'downloads');
  const extractRoot = path.join(TOOLS_DIR, 'binaryen-extract');
  const archivePath = path.join(
    downloadsDir,
    `binaryen-${BINARYEN_VERSION}-${target.binaryen}.tar.gz`,
  );

  await mkdir(downloadsDir, { recursive: true });
  const downloadUrl =
    process.env.BINARYEN_URL ??
    `https://github.com/WebAssembly/binaryen/releases/download/${BINARYEN_VERSION}/binaryen-${BINARYEN_VERSION}-${target.binaryen}.tar.gz`;

  if (!(await pathExists(archivePath))) {
    console.log(`[build] Downloading binaryen ${BINARYEN_VERSION}...`);
    let archiveBytes;
    try {
      archiveBytes = await downloadBuffer(downloadUrl);
    } catch (error) {
      fail(
        `Failed to download binaryen from ${downloadUrl}. Set BINARYEN_BIN to a local bin folder or BINARYEN_URL to a reachable mirror. ${error.message}`,
      );
    }
    await writeFile(archivePath, archiveBytes);
  } else {
    console.log(`[build] Using cached binaryen archive: ${archivePath}`);
  }

  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  run(tarBinary, ['-xzf', archivePath, '-C', extractRoot]);

  const extractedDir = (await readdir(extractRoot, { withFileTypes: true })).find(
    (entry) => entry.isDirectory() && entry.name.startsWith(`binaryen-${BINARYEN_VERSION}`),
  );

  if (!extractedDir) {
    fail(`Failed to extract binaryen archive: ${archivePath}`);
  }

  await rm(binaryenRoot, { recursive: true, force: true });
  await cp(path.join(extractRoot, extractedDir.name), binaryenRoot, { recursive: true });
  await rm(extractRoot, { recursive: true, force: true });

  if (!(await pathExists(wasmOpt)) || !(await pathExists(wasmMerge))) {
    fail(`binaryen installation incomplete: expected ${wasmOpt} and ${wasmMerge}`);
  }

  console.log(`[build] Installed binaryen: ${binaryenBin}`);
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

function fail(message) {
  console.error(`[build] ${message}`);
  process.exit(1);
}
