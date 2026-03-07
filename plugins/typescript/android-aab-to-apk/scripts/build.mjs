import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { runBuildPipeline } = require('../../../../plugin-sdk-ts/examples/scripts/build-pipeline.cjs');

function resolveBinaryenBinCandidate(candidate) {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const wasmOpt = path.join(candidate, `wasm-opt${exe}`);
  const wasmMerge = path.join(candidate, `wasm-merge${exe}`);
  return existsSync(wasmOpt) && existsSync(wasmMerge) ? candidate : null;
}

function resolveExtismCandidate(candidate) {
  return existsSync(candidate) ? candidate : null;
}

if (!process.env.EXTISM_JS_PATH) {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    path.resolve(ROOT, `../../../plugin-sdk-ts/examples/aab-to-apk/.tools/extism-js/extism-js${exe}`),
    path.resolve(ROOT, `../../../plugin-sdk-ts/examples/hello-world/.tools/extism-js/extism-js${exe}`),
  ];
  for (const candidate of candidates) {
    const resolved = resolveExtismCandidate(candidate);
    if (resolved) {
      process.env.EXTISM_JS_PATH = resolved;
      break;
    }
  }
}

if (!process.env.BINARYEN_BIN) {
  const candidates = [
    path.resolve(ROOT, '../../../plugin-sdk-ts/examples/aab-to-apk/.tools/binaryen/bin'),
    path.resolve(ROOT, '../../../plugin-sdk-ts/examples/hello-world/.tools/binaryen/bin'),
  ];
  for (const candidate of candidates) {
    const resolved = resolveBinaryenBinCandidate(candidate);
    if (resolved) {
      process.env.BINARYEN_BIN = resolved;
      break;
    }
  }
}

await runBuildPipeline({
  root: ROOT,
  pluginName: 'builtin-aab-to-apk',
  bundleScript: 'esbuild.config.mjs',
});
