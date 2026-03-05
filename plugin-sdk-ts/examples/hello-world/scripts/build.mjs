import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { runBuildPipeline } = require('../../scripts/build-pipeline.cjs');

await runBuildPipeline({
  root: ROOT,
  pluginName: 'hello-world',
  bundleScript: 'esbuild.config.mjs',
});
