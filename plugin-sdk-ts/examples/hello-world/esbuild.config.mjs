import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/plugin.js',
  format: 'cjs',
  target: 'es2020',
  platform: 'neutral',
  external: [],
});
